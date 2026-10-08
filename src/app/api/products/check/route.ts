import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { items, categoryIds, excludedSiteIds, siteId } = body;

    // items: Array<{ name: string; country?: string | null; key?: string | number }>
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ results: {} });
    }

    // Filter valid names (trim and ignore empty)
    const validItems = items
      .map((item, idx) => ({
        key: item.key !== undefined ? String(item.key) : String(idx),
        name: typeof item.name === "string" ? item.name.trim() : "",
        country: typeof item.country === "string" ? item.country.trim().toUpperCase() : null,
      }))
      .filter((item) => item.name.length >= 2);

    if (validItems.length === 0) {
      return NextResponse.json({ results: {} });
    }

    const uniqueNames = Array.from(new Set(validItems.map((i) => i.name.toLowerCase())));

    // Determine target sites
    const targetSiteIds = new Set<number>();
    if (siteId) {
      targetSiteIds.add(parseInt(siteId));
    } else if (Array.isArray(categoryIds) && categoryIds.length > 0) {
      const parsedCatIds = categoryIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));
      if (parsedCatIds.length > 0) {
        const catsWithSites = await prisma.category.findMany({
          where: { id: { in: parsedCatIds } },
          include: { sites: { select: { id: true } } },
        });
        const excludedSet = new Set(
          (Array.isArray(excludedSiteIds) ? excludedSiteIds : []).map((id: any) => parseInt(id))
        );
        for (const cat of catsWithSites) {
          for (const s of cat.sites) {
            if (!excludedSet.has(s.id)) {
              targetSiteIds.add(s.id);
            }
          }
        }
      }
    }

    // Query matching products and trendmap researchers concurrently
    const [existingProducts, existingTrendmaps] = await Promise.all([
      prisma.product.findMany({
        where: {
          OR: uniqueNames.map((uName) => ({ name: uName })),
        },
        select: {
          id: true,
          name: true,
          country: true,
          remarks: true,
          siteId: true,
          site: { select: { id: true, name: true, allowCountrySpecific: true } },
          addedBy: { select: { name: true, role: true } },
          article: {
            select: {
              country: true,
              writer: { select: { name: true } },
            },
          },
        },
        orderBy: { addedAt: "desc" },
      }),
      prisma.trendmapProduct.findMany({
        where: {
          OR: uniqueNames.map((uName) => ({ name: uName })),
        },
        select: {
          name: true,
          researchedBy: true,
          addedBy: { select: { name: true } },
        },
      }),
    ]);

    const trendmapResearcherMap = new Map<string, string>();
    for (const tm of existingTrendmaps) {
      const r = tm.researchedBy || tm.addedBy?.name;
      if (r) trendmapResearcherMap.set(tm.name.trim().toLowerCase(), r);
    }

    // Check each valid item against existing products
    const results: Record<
      string,
      {
        exists: boolean;
        isUncertain: boolean;
        message: string;
        productId?: number;
        productName: string;
        researchedBy?: string | null;
        conflicts: Array<{
          productId: number;
          siteId: number;
          siteName: string;
          addedBy: string;
          researchedBy?: string | null;
          country?: string | null;
        }>;
      }
    > = {};

    for (const item of validItems) {
      const itemLower = item.name.toLowerCase();
      const itemCountry = (item.country || "").toUpperCase();

      const exactConflicts: Array<{
        productId: number;
        siteId: number;
        siteName: string;
        addedBy: string;
        researchedBy?: string | null;
        country?: string | null;
      }> = [];
      const uncertainConflicts: Array<{
        productId: number;
        siteId: number;
        siteName: string;
        addedBy: string;
        researchedBy?: string | null;
        country?: string | null;
      }> = [];

      for (const ep of existingProducts) {
        if (ep.name.trim().toLowerCase() === itemLower) {
          const siteAllowsCountry = Boolean(ep.site?.allowCountrySpecific);
          const epCountry = (ep.country || ep.article?.country || "").trim().toUpperCase();
          const countryMatches = !siteAllowsCountry || !epCountry || !itemCountry || epCountry === itemCountry;

          if (countryMatches) {
            const remarksResearcher = ep.remarks?.match(/Researched by:\s*([^.\n,]+)/i)?.[1]?.trim();
            const researcher =
              remarksResearcher ||
              (ep.addedBy?.role === "PRODUCT_RESEARCHER" ? ep.addedBy.name : null) ||
              trendmapResearcherMap.get(itemLower) ||
              null;

            const conflictInfo = {
              productId: ep.id,
              siteId: ep.siteId,
              siteName: ep.site?.name || "Unknown Site",
              addedBy: ep.addedBy?.name || "Unknown User",
              researchedBy: researcher,
              country: epCountry || null,
            };

            const isTargetSite = targetSiteIds.size === 0 || targetSiteIds.has(ep.siteId);
            if (isTargetSite) {
              exactConflicts.push(conflictInfo);
            } else {
              uncertainConflicts.push(conflictInfo);
            }
          }
        }
      }

      if (exactConflicts.length > 0) {
        const first = exactConflicts[0];
        const countryText = first.country ? ` for country ${first.country}` : "";
        results[item.key] = {
          exists: true,
          isUncertain: false,
          productId: first.productId,
          productName: item.name,
          researchedBy: first.researchedBy || trendmapResearcherMap.get(itemLower) || null,
          message: `Already added by ${first.addedBy} on ${first.siteName}${countryText}`,
          conflicts: exactConflicts,
        };
      } else if (uncertainConflicts.length > 0) {
        const first = uncertainConflicts[0];
        const countryText = first.country ? ` for country ${first.country}` : "";
        results[item.key] = {
          exists: false,
          isUncertain: true,
          productId: first.productId,
          productName: item.name,
          researchedBy: first.researchedBy || trendmapResearcherMap.get(itemLower) || null,
          message: `May already exist: already on ${first.siteName} (added by ${first.addedBy})${countryText}`,
          conflicts: uncertainConflicts,
        };
      } else {
        results[item.key] = {
          exists: false,
          isUncertain: false,
          productName: item.name,
          message: "Available to add",
          conflicts: [],
        };
      }
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error("[POST /api/products/check]", err);
    return NextResponse.json({ error: err.message || "Failed to check products" }, { status: 500 });
  }
}
