import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const siteIdsParam = searchParams.get("siteIds");
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const filter = searchParams.get("filter") || "all"; // "all" | "similar" | "different"
    const missingInSiteParam = searchParams.get("missingInSiteId");

    // Fetch all sites user has access to
    const userRole = session.user.role;
    const userId = Number(session.user.id);

    let allowedSiteIds: number[] | undefined = undefined;
    if (userRole === "WRITER" || userRole === "TEAM_LEAD") {
      const accesses = await prisma.siteAccess.findMany({
        where: { userId },
        select: { siteId: true },
      });
      allowedSiteIds = accesses.map((a) => a.siteId);
    }

    const allSites = await prisma.site.findMany({
      where: allowedSiteIds !== undefined ? { id: { in: allowedSiteIds } } : {},
      select: {
        id: true,
        name: true,
        url: true,
        allowCountrySpecific: true,
        categories: { select: { id: true, name: true } },
        _count: { select: { products: true } },
      },
      orderBy: { name: "asc" },
    });

    if (allSites.length === 0) {
      return NextResponse.json({
        allSites: [],
        selectedSites: [],
        comparedProducts: [],
        stats: {
          totalProducts: 0,
          similarCount: 0,
          differentCount: 0,
          selectedSiteCounts: {},
        },
      });
    }

    // Determine selected site IDs
    let selectedSiteIds: number[] = [];
    if (siteIdsParam) {
      selectedSiteIds = siteIdsParam
        .split(",")
        .map((s) => parseInt(s.trim()))
        .filter((n) => !isNaN(n) && allSites.some((site) => site.id === n));
    }

    // If none specified or less than 2, default to the first 2 sites (or all if < 2)
    if (selectedSiteIds.length === 0) {
      selectedSiteIds = allSites.slice(0, Math.min(2, allSites.length)).map((s) => s.id);
    }

    const selectedSites = allSites.filter((s) => selectedSiteIds.includes(s.id));

    // Fetch all products on selected sites
    const rawProducts = await prisma.product.findMany({
      where: {
        siteId: { in: selectedSiteIds },
      },
      include: {
        site: { select: { id: true, name: true, url: true, allowCountrySpecific: true } },
        category: { select: { id: true, name: true } },
        article: {
          select: {
            id: true,
            status: true,
            articleLink: true,
            country: true,
            writer: { select: { id: true, name: true } },
          },
        },
        linkLogs: {
          select: {
            id: true,
            status: true,
            affiliateName: true,
            affiliateLink: true,
            bridgePageLink: true,
            buyLink: true,
          },
        },
        addedBy: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });

    // Group products by normalized name (and country if applicable)
    // Key format: name.trim().toLowerCase():::country
    interface SiteProductInfo {
      id: number;
      name: string;
      slug?: string | null;
      country?: string | null;
      siteId: number;
      siteName: string;
      categoryId: number;
      categoryName?: string;
      productCategory?: string | null;
      affiliateName?: string | null;
      trendLevel?: string | null;
      trendLink?: string | null;
      previewLink?: string | null;
      remarks?: string | null;
      status: string;
      writerName?: string | null;
      articleLink?: string | null;
      linksCount: number;
      hasAcceptedLinks: boolean;
      hasBridgePage: boolean;
      addedAt: string;
      addedByName?: string;
    }

    interface ComparisonGroup {
      key: string;
      name: string;
      slug?: string | null;
      country?: string | null;
      productCategory?: string | null;
      affiliateName?: string | null;
      trendLevel?: string | null;
      trendLink?: string | null;
      previewLink?: string | null;
      remarks?: string | null;
      categoryId?: number;
      categoryName?: string;
      sampleProductId: number;
      sites: Record<number, SiteProductInfo | null>;
      presentSiteIds: number[];
      missingSiteIds: number[];
      isSimilar: boolean;
      isDifferent: boolean;
    }

    const groupMap = new Map<string, ComparisonGroup>();

    for (const p of rawProducts) {
      const normName = p.name.trim().toLowerCase();
      const normCountry = (p.country || "").trim().toUpperCase();
      // Grouping key: by name (and country if present)
      const groupKey = normCountry ? `${normName}:::${normCountry}` : normName;

      if (!groupMap.has(groupKey)) {
        const initialSites: Record<number, SiteProductInfo | null> = {};
        for (const sId of selectedSiteIds) {
          initialSites[sId] = null;
        }

        groupMap.set(groupKey, {
          key: groupKey,
          name: p.name.trim(),
          slug: p.slug,
          country: p.country,
          productCategory: p.productCategory,
          affiliateName: p.affiliateName,
          trendLevel: p.trendLevel || "HIGH",
          trendLink: p.trendLink,
          previewLink: p.previewLink,
          remarks: p.remarks,
          categoryId: p.categoryId,
          categoryName: p.category?.name,
          sampleProductId: p.id,
          sites: initialSites,
          presentSiteIds: [],
          missingSiteIds: [],
          isSimilar: false,
          isDifferent: false,
        });
      }

      const group = groupMap.get(groupKey)!;
      const hasAccepted = (p.linkLogs || []).some((l) => l.status === "ACCEPTED");
      const hasBridge = (p.linkLogs || []).some((l) => Boolean(l.bridgePageLink));

      group.sites[p.siteId] = {
        id: p.id,
        name: p.name,
        slug: p.slug,
        country: p.country,
        siteId: p.siteId,
        siteName: p.site.name,
        categoryId: p.categoryId,
        categoryName: p.category?.name,
        productCategory: p.productCategory,
        affiliateName: p.affiliateName,
        trendLevel: p.trendLevel,
        trendLink: p.trendLink,
        previewLink: p.previewLink,
        remarks: p.remarks,
        status: p.article?.status || "PENDING",
        writerName: p.article?.writer?.name || null,
        articleLink: p.article?.articleLink || null,
        linksCount: p.linkLogs?.length || 0,
        hasAcceptedLinks: hasAccepted,
        hasBridgePage: hasBridge,
        addedAt: p.addedAt.toISOString(),
        addedByName: p.addedBy?.name,
      };

      if (!group.presentSiteIds.includes(p.siteId)) {
        group.presentSiteIds.push(p.siteId);
      }
    }

    // Determine missing site IDs, similarity and difference flags
    const comparedProducts: ComparisonGroup[] = [];
    let similarCount = 0;
    let differentCount = 0;

    for (const group of groupMap.values()) {
      group.missingSiteIds = selectedSiteIds.filter((sId) => !group.presentSiteIds.includes(sId));
      
      // Similar = present on all selected sites (or on at least 2 if > 2 sites)
      // When 2 sites: similar means present on both!
      // Different = missing on at least 1 site!
      group.isSimilar = group.missingSiteIds.length === 0;
      group.isDifferent = group.missingSiteIds.length > 0;

      if (group.isSimilar) similarCount++;
      if (group.isDifferent) differentCount++;

      // Filter logic
      if (search) {
        const matchesName = group.name.toLowerCase().includes(search);
        const matchesSlug = group.slug ? group.slug.toLowerCase().includes(search) : false;
        const matchesCat = group.productCategory ? group.productCategory.toLowerCase().includes(search) : false;
        const matchesAff = group.affiliateName ? group.affiliateName.toLowerCase().includes(search) : false;
        if (!matchesName && !matchesSlug && !matchesCat && !matchesAff) {
          continue;
        }
      }

      if (filter === "similar" && !group.isSimilar) {
        continue;
      }
      if (filter === "different" && !group.isDifferent) {
        continue;
      }
      if (missingInSiteParam) {
        const missingInId = parseInt(missingInSiteParam);
        if (!group.missingSiteIds.includes(missingInId)) {
          continue;
        }
      }

      comparedProducts.push(group);
    }

    // Count per selected site
    const selectedSiteCounts: Record<number, { total: number; missing: number; siteName: string }> = {};
    for (const site of selectedSites) {
      let total = 0;
      let missing = 0;
      for (const group of groupMap.values()) {
        if (group.presentSiteIds.includes(site.id)) total++;
        if (group.missingSiteIds.includes(site.id)) missing++;
      }
      selectedSiteCounts[site.id] = {
        total,
        missing,
        siteName: site.name,
      };
    }

    return NextResponse.json({
      allSites,
      selectedSites,
      comparedProducts,
      stats: {
        totalProducts: groupMap.size,
        similarCount,
        differentCount,
        selectedSiteCounts,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/products/compare]", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
