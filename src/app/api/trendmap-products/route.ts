import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Helper to deduce demand level from score or text
function calculateDemandLevel(score?: number | null, text?: string | null): string {
  if (typeof score === "number" && !isNaN(score)) {
    if (score >= 60) return "HIGH";
    if (score >= 25) return "MODERATE";
    if (score > 0) return "LOW";
    return "NOT_ANALYZED";
  }

  if (text) {
    const lower = text.toLowerCase();
    if (lower.includes("high")) return "HIGH";
    if (lower.includes("mod")) return "MODERATE";
    if (lower.includes("low")) return "LOW";
    const match = text.match(/(\d+)\s*\/\s*100/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 60) return "HIGH";
      if (num >= 25) return "MODERATE";
      if (num > 0) return "LOW";
    }
  }

  return "NOT_ANALYZED";
}

// GET /api/trendmap-products
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    // Allow SUPER_ADMIN, ADMIN, LINKER, PRODUCT_RESEARCHER or anyone authenticated
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const demandLevel = url.searchParams.get("demandLevel") || "ALL";
    const status = url.searchParams.get("status") || "ALL";
    const competitor = url.searchParams.get("competitor") || "ALL";
    const sort = url.searchParams.get("sort") || "latest";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit") || "25", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { competitor: { contains: search } },
        { category: { contains: search } },
        { productUrl: { contains: search } },
        { researchedBy: { contains: search } },
      ];
    }

    if (demandLevel !== "ALL") {
      where.demandLevel = demandLevel;
    }

    if (status !== "ALL") {
      if (status === "ADDED") {
        where.addedToCatalog = true;
      } else if (status === "PENDING") {
        where.addedToCatalog = false;
      } else if (status === "DUPLICATES") {
        const dupGroups = await prisma.trendmapProduct.groupBy({
          by: ["name"],
          _count: { id: true },
          having: { id: { _count: { gt: 1 } } },
        });
        const dupNames = dupGroups.map((d) => d.name);
        where.name = { in: dupNames };
      } else {
        where.status = status;
      }
    }

    if (competitor !== "ALL") {
      where.competitor = competitor;
    }

    let orderBy: any = { createdAt: "desc" };
    if (sort === "oldest") orderBy = { createdAt: "asc" };
    else if (sort === "demand_desc") orderBy = { demandScore: "desc" };
    else if (sort === "demand_asc") orderBy = { demandScore: "asc" };
    else if (sort === "name_asc") orderBy = { name: "asc" };

    const [products, totalCount, countsGroup, competitorsList, duplicateGroups] = await Promise.all([
      prisma.trendmapProduct.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          addedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.trendmapProduct.count({ where }),
      prisma.trendmapProduct.groupBy({
        by: ["demandLevel", "addedToCatalog"],
        _count: { id: true },
      }),
      prisma.trendmapProduct.findMany({
        where: { competitor: { not: null } },
        select: { competitor: true },
        distinct: ["competitor"],
      }),
      prisma.trendmapProduct.groupBy({
        by: ["name"],
        _count: { id: true },
        having: { id: { _count: { gt: 1 } } },
      }),
    ]);

    // Aggregate counts
    let totalAll = 0;
    let high = 0;
    let moderate = 0;
    let low = 0;
    let notAnalyzed = 0;
    let addedCount = 0;
    let pendingCount = 0;

    countsGroup.forEach((g) => {
      const c = g._count.id;
      totalAll += c;
      if (g.addedToCatalog) addedCount += c;
      else pendingCount += c;

      if (g.demandLevel === "HIGH") high += c;
      else if (g.demandLevel === "MODERATE") moderate += c;
      else if (g.demandLevel === "LOW") low += c;
      else notAnalyzed += c;
    });

    const competitors = competitorsList
      .map((c) => c.competitor)
      .filter((c): c is string => Boolean(c))
      .sort();

    // Deduplication & Live Catalog Cross-Reference
    const productNames = Array.from(new Set(products.map((p) => p.name.trim()).filter(Boolean)));

    const [catalogMatches, allRelatedOpportunities] = await Promise.all([
      productNames.length > 0
        ? prisma.product.findMany({
            where: {
              OR: productNames.flatMap((n) => [
                { name: n },
                { name: n.toLowerCase() },
                { name: n.toUpperCase() },
              ]),
            },
            select: {
              id: true,
              name: true,
              addedAt: true,
              site: { select: { id: true, name: true } },
              addedBy: { select: { id: true, name: true } },
            },
            orderBy: { addedAt: "desc" },
          })
        : Promise.resolve([]),
      productNames.length > 0
        ? prisma.trendmapProduct.findMany({
            where: {
              name: { in: productNames },
            },
            select: {
              id: true,
              name: true,
              competitor: true,
              researchedBy: true,
              addedToCatalog: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const enrichedProducts = products.map((item) => {
      const norm = item.name.trim().toLowerCase();
      const related = allRelatedOpportunities.filter(
        (r) => r.name.trim().toLowerCase() === norm
      );
      const isAnyDuplicateAdded = related.some((r) => r.addedToCatalog);
      const catMatch = catalogMatches.find(
        (c) => c.name.trim().toLowerCase() === norm
      );
      const inCatalog = Boolean(catMatch) || isAnyDuplicateAdded || item.addedToCatalog;

      return {
        ...item,
        duplicateCount: related.length,
        hasDuplicates: related.length > 1,
        duplicateSources: Array.from(
          new Set(
            related
              .map((r) => r.competitor)
              .filter((c): c is string => Boolean(c))
          )
        ),
        duplicateResearchers: Array.from(
          new Set(
            related
              .map((r) => r.researchedBy)
              .filter((u): u is string => Boolean(u))
          )
        ),
        inCatalog,
        catalogDetails: catMatch
          ? {
              id: catMatch.id,
              siteName: catMatch.site?.name || "Catalog Site",
              addedBy: catMatch.addedBy?.name || "Catalog User",
              addedAt: catMatch.addedAt,
            }
          : null,
      };
    });

    return NextResponse.json({
      products: enrichedProducts,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
      counts: {
        total: totalAll,
        high,
        moderate,
        low,
        notAnalyzed,
        added: addedCount,
        pending: pendingCount,
        duplicates: duplicateGroups.length,
      },
      competitors,
    });
  } catch (error: any) {
    console.error("Failed to fetch Trendmap products:", error);
    return NextResponse.json(
      { error: "Failed to fetch Trendmap products", details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/trendmap-products
// Accepts submissions from Trendmap app/extension or manual user entry
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();

    // Support flexible naming conventions from Trendmap or forms
    const name = (body.name || body.title || body.productOpportunity || "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "Product name is required" },
        { status: 400 }
      );
    }

    const productUrl = body.productUrl || body.url || body.link || null;
    const competitor = body.competitor || body.competitorDomain || null;
    const searchDemand = body.searchDemand ? String(body.searchDemand) : null;

    let demandScore: number | null = null;
    if (typeof body.demandScore === "number") {
      demandScore = body.demandScore;
    } else if (body.demandScore !== undefined && body.demandScore !== null && !isNaN(Number(body.demandScore))) {
      demandScore = Number(body.demandScore);
    } else if (searchDemand) {
      const match = searchDemand.match(/(\d+)/);
      if (match) demandScore = parseInt(match[1], 10);
    }

    const demandLevel =
      body.demandLevel || calculateDemandLevel(demandScore, searchDemand);
    const category = body.category || null;
    const market = body.market || "United (US)";
    const modifiedDate = body.modifiedDate || null;
    const discoveredDate = body.discoveredDate || null;
    const explicitResearcher =
      body.researchedBy ||
      body.userName ||
      body.user ||
      body.researcher ||
      body.researchedByName ||
      null;
    const researchedBy =
      explicitResearcher ||
      (session?.user?.name ? session.user.name : null);
    const notes = body.notes || body.remarks || null;

    const addedById = session?.user?.id ? Number(session.user.id) : null;

    // Deduplication check: check if product with same name and competitor/url exists
    const existing = await prisma.trendmapProduct.findFirst({
      where: {
        name,
        ...(competitor ? { competitor } : {}),
      },
    });

    let result;
    let isUpdate = false;

    // Check if this product is already in the Articleflow Catalog or added from another opportunity
    const [matchingCatalogProduct, otherDuplicateOpportunity] = await Promise.all([
      prisma.product.findFirst({
        where: {
          OR: [
            { name },
            { name: name.toLowerCase() },
            { name: name.toUpperCase() },
          ],
        },
        select: { id: true, name: true, site: { select: { name: true } }, addedBy: { select: { name: true } } },
      }),
      prisma.trendmapProduct.findFirst({
        where: {
          name,
          addedToCatalog: true,
        },
        select: { id: true, catalogProductId: true },
      }),
    ]);

    const isAlreadyInCatalog = Boolean(matchingCatalogProduct) || Boolean(otherDuplicateOpportunity);
    const catalogProductId = matchingCatalogProduct?.id || otherDuplicateOpportunity?.catalogProductId || null;

    if (existing) {
      result = await prisma.trendmapProduct.update({
        where: { id: existing.id },
        data: {
          productUrl: productUrl || existing.productUrl,
          searchDemand: searchDemand || existing.searchDemand,
          demandScore: demandScore !== null ? demandScore : existing.demandScore,
          demandLevel: demandLevel || existing.demandLevel,
          category: category || existing.category,
          market: market || existing.market,
          modifiedDate: modifiedDate || existing.modifiedDate,
          discoveredDate: discoveredDate || existing.discoveredDate,
          // CRITICAL: Preserve original researcher name if already set unless explicitly passed
          researchedBy: explicitResearcher ? explicitResearcher : (existing.researchedBy || researchedBy),
          notes: notes || existing.notes,
          ...(isAlreadyInCatalog && !existing.addedToCatalog ? { addedToCatalog: true, status: "ADDED", catalogProductId } : {}),
        },
      });
      isUpdate = true;
    } else {
      result = await prisma.trendmapProduct.create({
        data: {
          name,
          productUrl,
          competitor,
          searchDemand,
          demandScore,
          demandLevel,
          category,
          market,
          modifiedDate,
          discoveredDate,
          researchedBy,
          notes,
          addedById,
          status: isAlreadyInCatalog ? "ADDED" : "PENDING",
          addedToCatalog: isAlreadyInCatalog,
          catalogProductId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: isUpdate
        ? `Updated existing opportunity: ${name}`
        : `Successfully recorded opportunity: ${name}`,
      product: result,
      isUpdate,
      alreadyInCatalog: isAlreadyInCatalog,
    });
  } catch (error: any) {
    console.error("Failed to create/update Trendmap product:", error);
    return NextResponse.json(
      { error: "Failed to process Trendmap product", details: error.message },
      { status: 500 }
    );
  }
}
