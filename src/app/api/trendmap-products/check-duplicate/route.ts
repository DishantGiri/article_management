import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const name = url.searchParams.get("name")?.trim();
    const excludeId = url.searchParams.get("excludeId")
      ? parseInt(url.searchParams.get("excludeId")!, 10)
      : null;

    if (!name || name.length < 2) {
      return NextResponse.json({
        hasDuplicates: false,
        trendmapDuplicates: [],
        catalogMatches: [],
        existsInCatalog: false,
      });
    }

    // 1. Query Trendmap opportunities with same name
    const trendmapOpportunities = await prisma.trendmapProduct.findMany({
      where: {
        OR: [
          { name: name },
          { name: name.toLowerCase() },
          { name: name.toUpperCase() },
        ],
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: {
        id: true,
        name: true,
        competitor: true,
        researchedBy: true,
        category: true,
        addedToCatalog: true,
        status: true,
        productUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. Query Live Articleflow Product Catalog for matching product
    const catalogMatches = await prisma.product.findMany({
      where: {
        OR: [
          { name: name },
          { name: name.toLowerCase() },
          { name: name.toUpperCase() },
        ],
      },
      select: {
        id: true,
        name: true,
        addedAt: true,
        country: true,
        site: { select: { id: true, name: true } },
        addedBy: { select: { id: true, name: true } },
      },
      orderBy: { addedAt: "desc" },
      take: 10,
    });

    const isAnyTrendmapAdded = trendmapOpportunities.some((t) => t.addedToCatalog);
    const existsInCatalog = catalogMatches.length > 0 || isAnyTrendmapAdded;

    return NextResponse.json({
      name,
      hasTrendmapDuplicates: trendmapOpportunities.length > 0,
      trendmapCount: trendmapOpportunities.length,
      trendmapDuplicates: trendmapOpportunities,
      hasCatalogMatches: catalogMatches.length > 0,
      existsInCatalog,
      catalogMatches: catalogMatches.map((c) => ({
        id: c.id,
        name: c.name,
        siteName: c.site?.name || "Catalog Site",
        addedBy: c.addedBy?.name || "User",
        country: c.country,
        addedAt: c.addedAt,
      })),
      sourcesList: Array.from(
        new Set(
          trendmapOpportunities
            .map((t) => t.competitor)
            .filter((c): c is string => Boolean(c))
        )
      ),
    });
  } catch (error: any) {
    console.error("[GET /api/trendmap-products/check-duplicate]", error);
    return NextResponse.json(
      { error: "Failed to check product duplicates", details: error.message },
      { status: 500 }
    );
  }
}
