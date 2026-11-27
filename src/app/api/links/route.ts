import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { canUserAddLinkOnSite, isAdmin } from "@/lib/permissions";
import { isResearchSite } from "@/lib/researchSite";
import { cached, delByPattern } from "@/lib/redis";
import {
  LINK_LOG_INCLUDE,
  buildLinkLogWhere,
  consolidateProductLinkLogs,
  fetchPaginatedConsolidatedLinks,
  getLinkLogsAuthScope,
} from "@/lib/link-logs-server";

// GET /api/links?productId=X OR server-paginated ?page=1&limit=10&...
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");
  const paginatedParam = searchParams.get("paginated") === "true";
  const includeMeta = searchParams.get("includeMeta") === "true";
  const all = searchParams.get("all") === "true" || searchParams.get("all") === "1";
  const exportMode = searchParams.get("export") === "true" || searchParams.get("export") === "1";

  const search = searchParams.get("search");
  const exact = searchParams.get("exact") === "true" || searchParams.get("exact") === "1";
  const status = searchParams.get("status");
  const addedById = searchParams.get("addedById");
  const addedByName = searchParams.get("addedBy") || searchParams.get("adder");
  const site = searchParams.get("site");
  const siteId = searchParams.get("siteId");
  const deadOnly = searchParams.get("deadOnly") === "true" || searchParams.get("deadOnly") === "1";
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const userId = session.user.id;
  const userRole = session.user.role || "";

  const authScope = await getLinkLogsAuthScope(userId, userRole);
  if (!authScope.allowed) {
    return NextResponse.json({ error: authScope.error }, { status: authScope.status });
  }
  const allowedSiteIds = authScope.allowedSiteIds;

  const isPaginated =
    !all && !exportMode && (paginatedParam || pageParam !== null || limitParam !== null);
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitParam || "10", 10) || 10));

  const scopePrefix = isAdmin(userRole) ? "global" : `user:${userId}:${userRole}`;

  if (isPaginated) {
    const pageCacheKey = `links:page:${scopePrefix}:p${page}_l${limit}:s=${search || ""}:ex=${exact ? 1 : 0}:st=${status || ""}:ab=${addedById || addedByName || ""}:site=${siteId || site || ""}:dead=${deadOnly ? 1 : 0}:sd=${startDate || ""}:ed=${endDate || ""}`;

    const pageData = await cached(pageCacheKey, 30, async () => {
      return fetchPaginatedConsolidatedLinks(
        {
          allowedSiteIds,
          productId,
          status,
          search,
          exact,
          addedById,
          addedByName,
          siteName: site,
          siteId,
          deadOnly,
          startDate,
          endDate,
        },
        page,
        limit
      );
    });

    let meta: any = undefined;
    if (includeMeta) {
      const metaCacheKey = `links:meta:${scopePrefix}`;
      meta = await cached(metaCacheKey, 45, async () => {
        const baseWhere = buildLinkLogWhere({ allowedSiteIds });
        const [
          total,
          flagged,
          pending,
          accepted,
          missingBridge,
          adderGroups,
        ] = await Promise.all([
          prisma.product.count({ where: { linkLogs: { some: baseWhere } } }),
          prisma.product.count({
            where: {
              linkLogs: {
                some: {
                  ...baseWhere,
                  status: { in: ["ISSUE", "NEED_TO_CHECK"] },
                },
              },
            },
          }),
          prisma.product.count({
            where: {
              linkLogs: { some: { ...baseWhere, status: "REQUESTED" } },
            },
          }),
          prisma.product.count({
            where: {
              linkLogs: { some: { ...baseWhere, status: "ACCEPTED" } },
            },
          }),
          prisma.product.count({
            where: {
              linkLogs: {
                some: baseWhere,
                none: {
                  AND: [
                    { bridgePageLink: { not: null } },
                    { bridgePageLink: { not: "" } },
                  ],
                },
              },
            },
          }),
          prisma.linkLog.groupBy({
            by: ["addedById"],
            where: baseWhere,
            _count: { _all: true },
          }),
        ]);

        const adderIds = adderGroups.map((g) => g.addedById).filter(Boolean);
        const adders =
          adderIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: adderIds } },
                select: { id: true, name: true },
                orderBy: { name: "asc" },
              })
            : [];

        return {
          counts: {
            total,
            flagged,
            pending,
            accepted,
            missingBridge,
            uniqueAdders: adders.length,
          },
          adders,
        };
      });
    }

    return NextResponse.json({
      ...pageData,
      ...(meta ? { meta } : {}),
    });
  }

  // Export or explicit full / single-product fetch
  const where = buildLinkLogWhere({
    allowedSiteIds,
    productId,
    status,
    search,
    exact,
    addedById,
    addedByName,
    siteName: site,
    siteId,
    deadOnly,
    startDate,
    endDate,
  });

  if (exportMode) {
    const rawRows = await prisma.linkLog.findMany({
      where,
      include: LINK_LOG_INCLUDE,
      orderBy: { addedAt: "desc" },
    });
    return NextResponse.json(consolidateProductLinkLogs(rawRows));
  }

  const cacheKey = `${scopePrefix === "global" ? "links:global" : `links:${scopePrefix}`}:${productId || "all"}`;

  const links = await cached(cacheKey, 45, async () => {
    return prisma.linkLog.findMany({
      where,
      include: LINK_LOG_INCLUDE,
      orderBy: { addedAt: "desc" },
    });
  });

  return NextResponse.json(links);
}

// POST /api/links - create a new link log entry
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { productId, bridgePageLink, buyLink, affiliateName, affiliateLink, affiliateEntries, countryLinks, geos, status, linkerRemarks, applyToAllSites } = body;

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: String(productId) },
      select: {
        id: true,
        name: true,
        slug: true,
        siteId: true,
        site: { select: { id: true, name: true, url: true, bridgeUrl: true } },
      },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (!product.siteId || isResearchSite(product.site?.name)) {
      return NextResponse.json(
        { error: "Cannot add links: This product has No Site assigned. Please add the product to a website first." },
        { status: 400 }
      );
    }

    const canAddLink = await canUserAddLinkOnSite(String(session.user.id), session.user.role, product.siteId);
    if (!canAddLink) {
      return NextResponse.json(
        { error: "Access Denied: You do not have Linker permissions to add links for this site." },
        { status: 403 }
      );
    }

    const VALID_LINK_STATUSES = [
      "REQUESTED",
      "ACCEPTED",
      "CANCELED",
      "ISSUE",
      "NEED_TO_CHECK",
      "PRESELL_PAGE",
      "REDIRECTED",
    ];

    const STATUS_MAP: Record<string, string> = {
      PENDING: "REQUESTED",
      Pending: "REQUESTED",
      REJECTED: "CANCELED",
      Rejected: "CANCELED",
    };

    const targetStatus = status ? (STATUS_MAP[status] || status) : "REQUESTED";

    if (!VALID_LINK_STATUSES.includes(targetStatus)) {
      return NextResponse.json(
        { error: `Invalid status '${status}'. Allowed values are: ${VALID_LINK_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const uniqueGeos = Array.from(
      new Set(((geos as string[]) || []).map((g: string) => String(g).trim().toUpperCase()).filter(Boolean))
    );

    // Consolidate entries into unified network groups so ONE LinkLog is created per product/network!
    type NormalizedGeo = { geo: string; affiliateLink: string; affiliateName?: string };
    type UnifiedEntry = {
      affiliateName: string;
      affiliateLink: string;
      geos: NormalizedGeo[];
    };

    const unifiedMap = new Map<string, UnifiedEntry>();

    if (Array.isArray(countryLinks) && countryLinks.length > 0) {
      const distinctNames = Array.from(
        new Set(countryLinks.map((c) => c.affiliateName?.trim()).filter(Boolean))
      );
      const primaryName = (affiliateName || distinctNames[0] || "Standard").trim();
      const primaryLink = (affiliateLink || countryLinks[0]?.affiliateLink || "").trim();

      const geosToSave: NormalizedGeo[] = [];
      for (const c of countryLinks) {
        const geoCode = String(c.geo || "").trim().toUpperCase();
        if (!geoCode) continue;
        const affLink = (c.affiliateLink || affiliateLink || "").trim();
        const affName = (c.affiliateName || affiliateName || "Standard").trim();
        if (!geosToSave.some((g) => g.geo === geoCode)) {
          geosToSave.push({ geo: geoCode, affiliateLink: affLink, affiliateName: affName });
        }
      }

      unifiedMap.set("unified_country_submission", {
        affiliateName: primaryName,
        affiliateLink: primaryLink,
        geos: geosToSave,
      });
    } else if (Array.isArray(affiliateEntries) && affiliateEntries.length > 0) {
      const allGeosToSave: NormalizedGeo[] = [];
      const distinctNets: string[] = [];
      let primaryAffLink = (affiliateLink || "").trim();

      for (const entry of affiliateEntries) {
        const netName = (entry.affiliateName || "Standard").trim();
        const affLink = (entry.affiliateLink || "").trim();
        if (netName && !distinctNets.includes(netName)) distinctNets.push(netName);
        if (!primaryAffLink && affLink) primaryAffLink = affLink;

        const entryGeos = Array.isArray(entry.geos) && entry.geos.length > 0
          ? entry.geos
          : uniqueGeos;

        for (const g of entryGeos) {
          const geoCode = (typeof g === "string" ? g : g?.geo || "").trim().toUpperCase();
          const geoLink = (typeof g === "object" && g?.affiliateLink ? g.affiliateLink : affLink).trim();
          const geoAffName = (typeof g === "object" && g?.affiliateName ? g.affiliateName : netName).trim();
          if (geoCode && !allGeosToSave.some((item) => item.geo === geoCode)) {
            allGeosToSave.push({ geo: geoCode, affiliateLink: geoLink || affLink, affiliateName: geoAffName || netName });
          }
        }
      }

      const primaryAffName = (affiliateName || distinctNets[0] || "Standard").trim();

      unifiedMap.set("unified_affiliate_submission", {
        affiliateName: primaryAffName,
        affiliateLink: primaryAffLink,
        geos: allGeosToSave,
      });
    } else if (affiliateName && affiliateLink) {
      const netName = affiliateName.trim();
      unifiedMap.set(netName, {
        affiliateName: netName,
        affiliateLink: affiliateLink.trim(),
        geos: uniqueGeos.map((g) => ({ geo: g, affiliateLink: affiliateLink.trim(), affiliateName: netName })),
      });
    }

    const entriesToCreate: UnifiedEntry[] = Array.from(unifiedMap.values());

    if (!productId || entriesToCreate.length === 0) {
      return NextResponse.json({ error: "productId and at least one affiliate network entry (affiliateName & affiliateLink) are required" }, { status: 400 });
    }

    for (const entry of entriesToCreate) {
      if (!entry.affiliateName?.trim() || !entry.affiliateLink?.trim()) {
        return NextResponse.json({ error: "Affiliate Name and Affiliate Link are required for all network entries." }, { status: 400 });
      }
      if (entry.geos.length === 0) {
        return NextResponse.json({ error: "At least one valid GEO must be selected." }, { status: 400 });
      }
    }

    const addedById = session.user.id;

    const dbUser = await prisma.user.findUnique({
      where: { id: addedById },
      select: { role: true, allowLinkLogAccess: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    if (dbUser.role === "WRITER" && !dbUser.allowLinkLogAccess) {
      return NextResponse.json({ error: "Access Denied: Writers do not have access to Link Logs unless allowed separately by the Admin Department." }, { status: 403 });
    }

    if (dbUser.role === "TEAM_LEAD") {
      return NextResponse.json(
        { error: "Access Denied: Team Leads cannot add links. Only Linkers can add links." },
        { status: 403 }
      );
    }

    if (dbUser.role !== "LINKER" && dbUser.role !== "ADMIN" && dbUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Access Denied: Only Linkers can add links." },
        { status: 403 }
      );
    }

    // Business rule: Bridge Page Link and Buy Link are required
    if (!bridgePageLink?.trim()) {
      return NextResponse.json({ error: "Bridge Page Link is required before saving links." }, { status: 400 });
    }

    if (!buyLink?.trim()) {
      return NextResponse.json({ error: "Buy Link is required before saving links." }, { status: 400 });
    }

    // Determine target products: either just this product or all sibling site products if applyToAllSites
    const targetProducts: Array<{
      id: string;
      name: string;
      slug: string | null;
      siteId: string | null;
      site: { id: string; name: string; url: string | null; bridgeUrl: string | null } | null;
    }> = [product];

    if (applyToAllSites && product.name) {
      const siblings = await prisma.product.findMany({
        where: {
          name: product.name.trim(),
          id: { not: product.id },
          site: { name: { not: "Product Research" } },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          siteId: true,
          site: { select: { id: true, name: true, url: true, bridgeUrl: true } },
        },
      });

      for (const sib of siblings) {
        if (sib.siteId) {
          const canAdd = await canUserAddLinkOnSite(String(session.user.id), session.user.role, sib.siteId);
          if (canAdd) {
            targetProducts.push(sib);
          }
        }
      }
    }

    const createdLinks = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const currentProd of targetProducts) {
        const prodSlug =
          currentProd.slug ||
          currentProd.name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
        const siteUrl = currentProd.site?.url?.replace(/\/+$/, "");

        const targetBuyLink =
          currentProd.id === product.id
            ? buyLink?.trim() || null
            : siteUrl && prodSlug
            ? `${siteUrl}/${prodSlug}`
            : buyLink?.trim() || null;

        let targetBridgeLink = bridgePageLink?.trim() || null;
        if (currentProd.id !== product.id && currentProd.site?.bridgeUrl) {
          const firstBridge = currentProd.site.bridgeUrl
            .split(/[\n,]+/)[0]
            ?.trim()
            .replace(/\/+$/, "");
          if (firstBridge && prodSlug) {
            targetBridgeLink = `${firstBridge}/${prodSlug}`;
          }
        }

        for (const entry of entriesToCreate) {
          const existingLink = await tx.linkLog.findFirst({
            where: {
              productId: currentProd.id,
              affiliateName: entry.affiliateName.trim(),
            },
            include: { geos: true },
          });

          if (existingLink) {
            await tx.linkGeo.deleteMany({
              where: { linkLogId: existingLink.id },
            });
            const updated = await tx.linkLog.update({
              where: { id: existingLink.id },
              data: {
                updatedById: addedById,
                bridgePageLink: targetBridgeLink,
                buyLink: targetBuyLink,
                affiliateName: entry.affiliateName.trim(),
                affiliateLink: entry.affiliateLink.trim(),
                status: targetStatus as any,
                linkerRemarks: linkerRemarks?.trim() || existingLink.linkerRemarks,
                geos: {
                  create: entry.geos.map((g) => ({
                    geo: g.geo,
                    affiliateLink: g.affiliateLink || entry.affiliateLink.trim(),
                    affiliateName: g.affiliateName || entry.affiliateName.trim(),
                  })),
                },
              },
              include: { geos: true, addedBy: { select: { name: true } } },
            });
            results.push(updated);
          } else {
            const created = await tx.linkLog.create({
              data: {
                productId: currentProd.id,
                addedById: addedById,
                bridgePageLink: targetBridgeLink,
                buyLink: targetBuyLink,
                affiliateName: entry.affiliateName.trim(),
                affiliateLink: entry.affiliateLink.trim(),
                status: targetStatus as any,
                linkerRemarks: linkerRemarks?.trim() || null,
                geos: {
                  create: entry.geos.map((g) => ({
                    geo: g.geo,
                    affiliateLink: g.affiliateLink || entry.affiliateLink.trim(),
                    affiliateName: g.affiliateName || entry.affiliateName.trim(),
                  })),
                },
              },
              include: { geos: true, addedBy: { select: { name: true } } },
            });
            results.push(created);
          }
        }
      }
      return results;
    });

    // Log history for each created or updated link log
    await prisma.$transaction(
      createdLinks.map((link) =>
        prisma.linkHistory.create({
          data: {
            linkLogId: link.id,
            updatedById: addedById,
            newBridgeLink: link.bridgePageLink,
            newBuyLink: link.buyLink,
            newAffiliateLink: link.affiliateLink,
            newStatus: link.status,
            newRemarks: link.linkerRemarks,
          },
        })
      )
    );

    await Promise.all([
      delByPattern("products:*"),
      delByPattern("articles:*"),
      delByPattern("links:*"),
      delByPattern("dashboard:*"),
    ]);

    return NextResponse.json(createdLinks.length === 1 ? createdLinks[0] : createdLinks, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/links]", err);
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Duplicate entry or GEO assignment" }, { status: 400 });
    }
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
