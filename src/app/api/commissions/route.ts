import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Helper to determine category key: NUTRA or ECOM
export function resolveCategoryKey(catName?: string | null): "NUTRA" | "ECOM" {
  if (!catName) return "NUTRA";
  const upper = catName.toUpperCase();
  if (upper.includes("ECOM") || upper.includes("COMMERCE") || upper.includes("AMAZON")) {
    return "ECOM";
  }
  return "NUTRA";
}

// GET /api/commissions — list products by site with commission tracking & settings
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const siteIdParam = searchParams.get("siteId");
    const search = searchParams.get("search")?.toLowerCase().trim();
    const paymentStatus = searchParams.get("paymentStatus");
    const categoryParam = searchParams.get("category"); // "NUTRA" | "ECOM"

    // 1. Fetch all sites with product counts for navbar tabs
    const sites = await prisma.site.findMany({
      select: {
        id: true,
        name: true,
        url: true,
        _count: {
          select: { products: true, commissionSales: true },
        },
      },
      orderBy: { name: "asc" },
    });

    // 2. Fetch all commission settings tiers
    const settingsList = await prisma.commissionSetting.findMany();
    const settingsMap: Record<string, any> = {};
    settingsList.forEach((s) => {
      settingsMap[`${s.category}_${s.saleType}`] = s;
    });

    // 3. Query products (optionally filtered by siteId)
    const whereClause: any = {};
    if (siteIdParam && siteIdParam !== "ALL") {
      whereClause.siteId = parseInt(siteIdParam);
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        site: { select: { id: true, name: true, url: true } },
        category: { select: { id: true, name: true } },
        addedBy: { select: { id: true, name: true, role: true } },
        article: {
          select: {
            id: true,
            status: true,
            articleLink: true,
            completedAt: true,
            productCreatedAt: true,
            writer: { select: { id: true, name: true } },
          },
        },
        linkLogs: {
          take: 1,
          orderBy: { addedAt: "desc" },
          select: { id: true, affiliateName: true, addedBy: { select: { id: true, name: true } } },
        },
        commissionSales: {
          orderBy: { saleDate: "desc" },
        },
      },
      orderBy: { addedAt: "desc" },
    });

    // 4. Query all commission sales matching siteId (or all) for the flat Commission List
    const saleWhere: any = {};
    if (siteIdParam && siteIdParam !== "ALL") {
      saleWhere.siteId = parseInt(siteIdParam);
    }

    const allSalesFromDb = await prisma.commissionSale.findMany({
      where: saleWhere,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: { select: { id: true, name: true } },
            article: { select: { id: true, status: true, articleLink: true } },
          },
        },
        site: { select: { id: true, name: true, url: true } },
      },
      orderBy: { saleDate: "desc" },
    });

    // 5. Transform flat Commission Sales List
    const salesList = allSalesFromDb.map((s) => {
      const catKey = resolveCategoryKey(s.product?.category?.name);
      return {
        id: s.id,
        productId: s.productId,
        productName: s.product?.name || "Product #" + s.productId,
        siteId: s.siteId,
        siteName: s.site?.name || "General",
        siteUrl: s.site?.url || null,
        categoryName: s.product?.category?.name || "Nutra",
        categoryKey: catKey,
        articleLink: s.product?.article?.articleLink || null,
        articleStatus: s.product?.article?.status || "PENDING",
        saleType: s.saleType as "FIRST_SALE" | "RESALE",
        saleDate: s.saleDate.toISOString(),
        writerId: s.writerId,
        writerName: s.writerName || "Unassigned",
        writerAmount: parseFloat((s.writerAmount || 0).toFixed(2)),
        linkerId: s.linkerId,
        linkerName: s.linkerName || "Unassigned",
        linkerAmount: parseFloat((s.linkerAmount || 0).toFixed(2)),
        teamLeadId: s.teamLeadId,
        teamLeadName: s.teamLeadName || null,
        tlAmount: parseFloat((s.tlAmount || 0).toFixed(2)),
        seoAmount: parseFloat((s.seoAmount || 0).toFixed(2)),
        bonusAmount: parseFloat((s.bonusAmount || 0).toFixed(2)),
        partyAmount: parseFloat((s.partyAmount || 0).toFixed(2)),
        amount: parseFloat((s.amount || 0).toFixed(2)),
        paymentStatus: s.paymentStatus as "PENDING" | "PAID",
        paidAt: s.paidAt ? s.paidAt.toISOString() : null,
        notes: s.notes,
        createdAt: s.createdAt.toISOString(),
      };
    });

    // 6. Transform and enrich each product row
    let enriched = products.map((prod) => {
      const catKey = resolveCategoryKey(prod.category?.name);
      const linkerName = prod.addedBy?.name || prod.linkLogs[0]?.addedBy?.name || "Unassigned";
      const linkerId = prod.addedBy?.id || prod.linkLogs[0]?.addedBy?.id || null;
      const writerName = prod.article?.writer?.name || "Unassigned";
      const writerId = prod.article?.writer?.id || null;

      const firstSales = prod.commissionSales.filter((s) => s.saleType === "FIRST_SALE");
      const resales = prod.commissionSales.filter((s) => s.saleType === "RESALE");

      const totalSalesCount = prod.commissionSales.length;
      const totalCommissionAmount = prod.commissionSales.reduce((acc, s) => acc + (s.amount || 0), 0);
      const paidCommissionAmount = prod.commissionSales
        .filter((s) => s.paymentStatus === "PAID")
        .reduce((acc, s) => acc + (s.amount || 0), 0);
      const pendingCommissionAmount = prod.commissionSales
        .filter((s) => s.paymentStatus === "PENDING")
        .reduce((acc, s) => acc + (s.amount || 0), 0);

      // Payment status determination for the product
      let overallPaymentStatus: "PAID" | "PENDING" | "NO_SALES" = "NO_SALES";
      if (prod.commissionSales.length > 0) {
        const hasPending = prod.commissionSales.some((s) => s.paymentStatus === "PENDING");
        overallPaymentStatus = hasPending ? "PENDING" : "PAID";
      }

      // Expected rates from CommissionSetting for this category
      const firstSaleSetting = settingsMap[`${catKey}_FIRST_SALE`];
      const resaleSetting = settingsMap[`${catKey}_RESALE`];

      // Most relevant date: latest sale date or article completion date or addedAt
      const latestDate = prod.commissionSales[0]?.saleDate
        || prod.article?.completedAt
        || prod.article?.productCreatedAt
        || prod.addedAt;

      return {
        id: prod.id,
        name: prod.name,
        siteId: prod.siteId,
        siteName: prod.site.name,
        siteUrl: prod.site.url,
        categoryName: prod.category?.name || "Nutra",
        categoryKey: catKey,
        linkerId,
        linkerName,
        writerId,
        writerName,
        articleStatus: prod.article?.status || "PENDING",
        articleLink: prod.article?.articleLink || null,
        firstSalesCount: firstSales.length,
        resalesCount: resales.length,
        totalSalesCount,
        totalCommissionAmount: parseFloat(totalCommissionAmount.toFixed(2)),
        paidCommissionAmount: parseFloat(paidCommissionAmount.toFixed(2)),
        pendingCommissionAmount: parseFloat(pendingCommissionAmount.toFixed(2)),
        overallPaymentStatus,
        latestDate,
        sales: prod.commissionSales,
        rates: {
          firstSaleTotal: firstSaleSetting?.total || 0,
          resaleTotal: resaleSetting?.total || 0,
          firstSaleBreakdown: firstSaleSetting || null,
          resaleBreakdown: resaleSetting || null,
        },
      };
    });

    // 7. Calculate aggregate pool & sales metrics from all sales
    let totalFirstSales = 0;
    let totalFirstSalesAmount = 0;
    let totalResales = 0;
    let totalResalesAmount = 0;
    let totalBonusPool = 0;
    let totalSeoPool = 0;
    let totalPartyFunds = 0;
    let totalLinkerAmount = 0;
    let totalWriterAmount = 0;
    let totalTlAmount = 0;
    let totalCommissions = 0;
    let totalPaid = 0;
    let totalPending = 0;

    salesList.forEach((s) => {
      totalCommissions += s.amount;
      if (s.paymentStatus === "PAID") {
        totalPaid += s.amount;
      } else {
        totalPending += s.amount;
      }

      if (s.saleType === "FIRST_SALE") {
        totalFirstSales += 1;
        totalFirstSalesAmount += s.amount;
      } else {
        totalResales += 1;
        totalResalesAmount += s.amount;
      }

      totalBonusPool += s.bonusAmount || 0;
      totalSeoPool += s.seoAmount || 0;
      totalPartyFunds += s.partyAmount || 0;
      totalLinkerAmount += s.linkerAmount || 0;
      totalWriterAmount += s.writerAmount || 0;
      totalTlAmount += s.tlAmount || 0;
    });

    // 8. Apply Client-side Filtering to products if requested
    if (search) {
      enriched = enriched.filter((p) =>
        p.name.toLowerCase().includes(search) ||
        p.writerName.toLowerCase().includes(search) ||
        p.linkerName.toLowerCase().includes(search) ||
        p.siteName.toLowerCase().includes(search)
      );
    }

    if (paymentStatus && paymentStatus !== "ALL") {
      enriched = enriched.filter((p) => p.overallPaymentStatus === paymentStatus);
    }

    if (categoryParam && categoryParam !== "ALL") {
      enriched = enriched.filter((p) => p.categoryKey === categoryParam);
    }

    return NextResponse.json({
      sites,
      settings: settingsMap,
      products: enriched,
      sales: salesList,
      metrics: {
        totalProducts: enriched.length,
        totalSales: salesList.length,
        totalCommissions: parseFloat(totalCommissions.toFixed(2)),
        totalPaid: parseFloat(totalPaid.toFixed(2)),
        totalPending: parseFloat(totalPending.toFixed(2)),
        totalFirstSales,
        totalFirstSalesAmount: parseFloat(totalFirstSalesAmount.toFixed(2)),
        totalResales,
        totalResalesAmount: parseFloat(totalResalesAmount.toFixed(2)),
        totalBonusPool: parseFloat(totalBonusPool.toFixed(2)),
        totalSeoPool: parseFloat(totalSeoPool.toFixed(2)),
        totalPartyFunds: parseFloat(totalPartyFunds.toFixed(2)),
        totalLinkerAmount: parseFloat(totalLinkerAmount.toFixed(2)),
        totalWriterAmount: parseFloat(totalWriterAmount.toFixed(2)),
        totalTlAmount: parseFloat(totalTlAmount.toFixed(2)),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/commissions]", err);
    return NextResponse.json(
      { error: err.message || "Failed to load commissions" },
      { status: 500 }
    );
  }
}

// POST /api/commissions — Record a new 1st sale or resale for a product
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { productId, saleType, saleDate, paymentStatus, notes } = body;

    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    const type: "FIRST_SALE" | "RESALE" =
      saleType === "RESALE" ? "RESALE" : "FIRST_SALE";

    // 1. Fetch product with site, category, writer, linker
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) },
      include: {
        site: true,
        category: true,
        addedBy: true,
        article: { include: { writer: true } },
        linkLogs: { take: 1, orderBy: { addedAt: "desc" }, include: { addedBy: true } },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 2. Resolve category key
    const catKey = resolveCategoryKey(product.category?.name);

    // 3. Find matching CommissionSetting tier
    const setting = await prisma.commissionSetting.findUnique({
      where: {
        category_saleType: {
          category: catKey,
          saleType: type,
        },
      },
    });

    // Default amounts if setting not found
    const amount = setting?.total || 0;
    const linkerAmount = setting?.linker || 0;
    const writerAmount = setting?.writer || 0;
    const tlAmount = setting?.tl || 0;
    const seoAmount = setting?.seo || 0;
    const bonusAmount = setting?.bonusPool || 0;
    const partyAmount = setting?.partyFund || 0;

    // Beneficiaries
    const linker = product.addedBy || product.linkLogs[0]?.addedBy;
    const writer = product.article?.writer;

    let teamLeadId: number | null = null;
    let teamLeadName: string | null = null;

    if (writer?.teamLeadId) {
      // Writer has a separate assigned Team Lead — credit TL commission to them
      const tl = await prisma.user.findUnique({
        where: { id: writer.teamLeadId },
        select: { id: true, name: true },
      });
      teamLeadId = tl?.id || null;
      teamLeadName = tl?.name || null;
    } else if (writer?.role === "TEAM_LEAD") {
      // Special case: the writer IS a Team Lead themselves (no separate TL above them).
      // Both writer commission AND TL commission go to this same user.
      teamLeadId = writer.id;
      teamLeadName = writer.name;
    }

    const parsedDate = saleDate ? new Date(saleDate) : new Date();
    const status = paymentStatus === "PAID" ? "PAID" : "PENDING";
    const paidAt = status === "PAID" ? new Date() : null;

    // 4. Create CommissionSale record
    const createdSale = await prisma.commissionSale.create({
      data: {
        productId: product.id,
        siteId: product.siteId,
        saleType: type,
        saleDate: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
        writerId: writer?.id || null,
        writerName: writer?.name || null,
        linkerId: linker?.id || null,
        linkerName: linker?.name || null,
        teamLeadId,
        teamLeadName,
        paymentStatus: status,
        paidAt,
        amount,
        linkerAmount,
        writerAmount,
        tlAmount,
        seoAmount,
        bonusAmount,
        partyAmount,
        notes: notes?.trim() || null,
        createdById: session.user.id ? Number(session.user.id) : null,
      },
    });

    return NextResponse.json({
      message: `${type === "FIRST_SALE" ? "1st Sale" : "Resale"} recorded successfully!`,
      sale: createdSale,
    });
  } catch (err: any) {
    console.error("[POST /api/commissions]", err);
    return NextResponse.json(
      { error: err.message || "Failed to record sale" },
      { status: 500 }
    );
  }
}
