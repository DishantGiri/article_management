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

    // Query matching products
    const existingProducts = await prisma.product.findMany({
      where: {
        ...(targetSiteIds.size > 0 ? { siteId: { in: Array.from(targetSiteIds) } } : {}),
        OR: uniqueNames.flatMap((uName) => [
          { name: uName },
          { name: uName.toLowerCase() },
          { name: uName.toUpperCase() },
        ]),
      },
      include: {
        site: { select: { id: true, name: true, allowCountrySpecific: true } },
        addedBy: { select: { name: true } },
        article: {
          select: {
            country: true,
            writer: { select: { name: true } },
          },
        },
      },
      orderBy: { addedAt: "desc" },
    });

    // Check each valid item against existing products
    const results: Record<
      string,
      {
        exists: boolean;
        message: string;
        conflicts: Array<{ siteName: string; addedBy: string; country?: string | null }>;
      }
    > = {};

    for (const item of validItems) {
      const itemLower = item.name.toLowerCase();
      const itemCountry = (item.country || "").toUpperCase();

      const conflicts: Array<{ siteName: string; addedBy: string; country?: string | null }> = [];

      for (const ep of existingProducts) {
        if (ep.name.trim().toLowerCase() === itemLower) {
          const siteAllowsCountry = Boolean(ep.site?.allowCountrySpecific);
          const epCountry = (ep.country || ep.article?.country || "").trim().toUpperCase();

          if (siteAllowsCountry) {
            if (epCountry === itemCountry) {
              conflicts.push({
                siteName: ep.site?.name || "Unknown Site",
                addedBy: ep.addedBy?.name || "Unknown Linker",
                country: epCountry || null,
              });
            }
          } else {
            conflicts.push({
              siteName: ep.site?.name || "Unknown Site",
              addedBy: ep.addedBy?.name || "Unknown Linker",
              country: epCountry || null,
            });
          }
        }
      }

      if (conflicts.length > 0) {
        const first = conflicts[0];
        const countryText = first.country ? ` for country ${first.country}` : "";
        results[item.key] = {
          exists: true,
          message: `Already added by ${first.addedBy} on ${first.siteName}${countryText}`,
          conflicts,
        };
      } else {
        results[item.key] = {
          exists: false,
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
