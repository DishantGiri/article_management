import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/affiliates/stats - overview of affiliates, product volume by affiliate, and linker contribution
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    // Allow SUPER_ADMIN, ADMIN, and LINKER
    if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "LINKER") {
      return NextResponse.json(
        { error: "Access Denied: Only Admins, Super Admins, and Linkers can view affiliate analytics." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const siteIdParam = searchParams.get("siteId");
    const siteId = siteIdParam ? parseInt(siteIdParam) : undefined;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDateParam) {
      const parts = startDateParam.split("-").map(Number);
      if (parts.length === 3) {
        dateFilter.gte = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
      } else {
        const start = new Date(startDateParam);
        start.setHours(0, 0, 0, 0);
        dateFilter.gte = start;
      }
    }
    if (endDateParam) {
      const parts = endDateParam.split("-").map(Number);
      if (parts.length === 3) {
        dateFilter.lte = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
      } else {
        const end = new Date(endDateParam);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
    }

    const productWhere: any = {};
    if (siteId) productWhere.siteId = siteId;
    if (dateFilter.gte || dateFilter.lte) productWhere.addedAt = dateFilter;

    const [affiliateNames, products, sites] = await Promise.all([
      prisma.affiliateName.findMany({ orderBy: { name: "asc" } }),
      prisma.product.findMany({
        where: productWhere,
        include: {
          site: { select: { id: true, name: true } },
          addedBy: { select: { id: true, name: true, email: true, role: true } },
          linkLogs: {
            select: {
              id: true,
              status: true,
              affiliateName: true,
              addedById: true,
              addedBy: { select: { id: true, name: true, role: true } },
            },
          },
        },
        orderBy: { addedAt: "desc" },
      }),
      prisma.site.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const affiliateMap = new Map<string, {
      id: number;
      name: string;
      productCount: number;
      linkersMap: Map<number, {
        userId: number;
        userName: string;
        userEmail?: string;
        userRole: string;
        count: number;
      }>;
      products: Array<{
        id: number;
        name: string;
        slug: string | null;
        siteName: string;
        addedByName: string;
        addedById: number;
        addedByRole: string;
        addedAt: Date;
        previewLink: string | null;
        trendLink: string | null;
      }>;
    }>();

    // Initialize all registered affiliate networks
    for (const aff of affiliateNames) {
      affiliateMap.set(aff.name.toLowerCase().trim(), {
        id: aff.id,
        name: aff.name,
        productCount: 0,
        linkersMap: new Map(),
        products: [],
      });
    }

    let totalAffiliateProducts = 0;
    let unassignedProductsCount = 0;
    const linkerMap = new Map<number, {
      userId: number;
      userName: string;
      userEmail?: string;
      userRole: string;
      totalProducts: number;
      affiliateProductsCount: number;
      affiliatesMap: Map<string, number>;
    }>();

    for (const p of products) {
      const rawAff = p.affiliateName ? p.affiliateName.trim() : null;
      const addedByUser = p.addedBy;
      const linkerId = addedByUser?.id || p.addedById;
      const linkerName = addedByUser?.name || "Unknown";
      const linkerRole = addedByUser?.role || "USER";

      if (rawAff) {
        totalAffiliateProducts++;
        const lowerAff = rawAff.toLowerCase();
        let affData = affiliateMap.get(lowerAff);
        if (!affData) {
          affData = {
            id: 0,
            name: rawAff,
            productCount: 0,
            linkersMap: new Map(),
            products: [],
          };
          affiliateMap.set(lowerAff, affData);
        }

        affData.productCount++;
        affData.products.push({
          id: p.id,
          name: p.name,
          slug: p.slug,
          siteName: p.site?.name || "Unassigned",
          addedByName: linkerName,
          addedById: linkerId,
          addedByRole: linkerRole,
          addedAt: p.addedAt,
          previewLink: p.previewLink,
          trendLink: p.trendLink,
        });

        // Track linker in this affiliate
        const currentLinkerEntry = affData.linkersMap.get(linkerId) || {
          userId: linkerId,
          userName: linkerName,
          userEmail: addedByUser?.email,
          userRole: linkerRole,
          count: 0,
        };
        currentLinkerEntry.count++;
        affData.linkersMap.set(linkerId, currentLinkerEntry);

        // Track linker overall
        if (!linkerMap.has(linkerId)) {
          linkerMap.set(linkerId, {
            userId: linkerId,
            userName: linkerName,
            userEmail: addedByUser?.email,
            userRole: linkerRole,
            totalProducts: 0,
            affiliateProductsCount: 0,
            affiliatesMap: new Map(),
          });
        }
        const lData = linkerMap.get(linkerId)!;
        lData.affiliateProductsCount++;
        lData.affiliatesMap.set(
          rawAff,
          (lData.affiliatesMap.get(rawAff) || 0) + 1
        );
      } else {
        unassignedProductsCount++;
      }

      if (linkerId) {
        if (!linkerMap.has(linkerId)) {
          linkerMap.set(linkerId, {
            userId: linkerId,
            userName: linkerName,
            userEmail: addedByUser?.email,
            userRole: linkerRole,
            totalProducts: 0,
            affiliateProductsCount: 0,
            affiliatesMap: new Map(),
          });
        }
        linkerMap.get(linkerId)!.totalProducts++;
      }
    }

    const affiliatesList = Array.from(affiliateMap.values())
      .map((a) => ({
        id: a.id,
        name: a.name,
        productCount: a.productCount,
        percentage:
          totalAffiliateProducts > 0
            ? Math.round((a.productCount / totalAffiliateProducts) * 100)
            : 0,
        linkers: Array.from(a.linkersMap.values()).sort((x, y) => y.count - x.count),
        products: a.products,
      }))
      .sort((a, b) => b.productCount - a.productCount);

    const linkersList = Array.from(linkerMap.values())
      .map((l) => ({
        userId: l.userId,
        userName: l.userName,
        userEmail: l.userEmail,
        userRole: l.userRole,
        totalProducts: l.totalProducts,
        affiliateProductsCount: l.affiliateProductsCount,
        affiliates: Array.from(l.affiliatesMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.affiliateProductsCount - a.affiliateProductsCount);

    const activeAffiliatesCount = affiliatesList.filter((a) => a.productCount > 0).length;
    const topAffiliate = affiliatesList.length > 0 ? affiliatesList[0] : null;

    return NextResponse.json({
      summary: {
        totalAffiliates: affiliateNames.length,
        activeAffiliatesCount,
        totalAffiliateProducts,
        totalAllProducts: products.length,
        unassignedProductsCount,
        totalContributingLinkers: linkersList.filter((l) => l.affiliateProductsCount > 0).length,
        topAffiliate: topAffiliate && topAffiliate.productCount > 0 ? {
          name: topAffiliate.name,
          count: topAffiliate.productCount,
          percentage: topAffiliate.percentage,
        } : null,
      },
      affiliates: affiliatesList,
      linkers: linkersList,
      sites,
    });
  } catch (err: any) {
    console.error("[GET /api/affiliates/stats]", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch affiliate statistics" },
      { status: 500 }
    );
  }
}
