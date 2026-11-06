import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { DEFAULT_COMMISSION_TIERS } from "@/app/api/commission-settings/route";

// Helper to determine category key: NUTRA or ECOM
export function resolveCategoryKey(catName?: string | null): "NUTRA" | "ECOM" {
  if (!catName) return "NUTRA";
  const upper = catName.toUpperCase();
  if (upper.includes("ECOM") || upper.includes("COMMERCE") || upper.includes("AMAZON")) {
    return "ECOM";
  }
  return "NUTRA";
}

// Enforce single FIRST_SALE per product across the database:
// If any product has multiple sales marked FIRST_SALE, keep the earliest one as FIRST_SALE
// and convert subsequent sales to RESALE with appropriate RESALE rates.
export async function normalizeProductFirstSales() {
  try {
    const duplicates = await prisma.commissionSale.groupBy({
      by: ["productId"],
      where: { saleType: "FIRST_SALE" },
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    });

    if (!duplicates || duplicates.length === 0) return;

    const settings = await prisma.commissionSetting.findMany();
    const settingsMap = new Map<string, any>();
    settings.forEach((s) => {
      settingsMap.set(`${s.category}_${s.saleType}`, s);
    });

    for (const item of duplicates) {
      const sales = await prisma.commissionSale.findMany({
        where: { productId: item.productId, saleType: "FIRST_SALE" },
        include: {
          product: { include: { category: true } },
        },
        orderBy: [{ saleDate: "asc" }, { id: "asc" }],
      });

      if (sales.length <= 1) continue;

      // Ensure sales #2, #3, ... are classified as RESALE if they were mistakenly FIRST_SALE,
      // while strictly PRESERVING their original recorded commission amounts and rates.
      for (let i = 1; i < sales.length; i++) {
        const sale = sales[i];
        if (sale.saleType === "FIRST_SALE") {
          await prisma.commissionSale.update({
            where: { id: sale.id },
            data: {
              saleType: "RESALE",
            },
          });
        }
      }
    }
  } catch (err) {
    console.error("Error normalizing product first sales:", err);
  }
}

// GET /api/commissions - list products by site with commission tracking & settings
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userRole = session.user.role;
    const rawRoles: string[] = (session.user as any)?.roles || [];
    const normalizedRoles = new Set([...rawRoles, userRole].filter(Boolean).map((r: any) => r.toUpperCase()));
    const isAllowed = normalizedRoles.has("SUPER_ADMIN") || normalizedRoles.has("GUEST");

    if (!isAllowed) {
      return NextResponse.json({ error: "Forbidden: Super Admin or Guest access required" }, { status: 403 });
    }

    // Auto-normalize any legacy duplicate first sales across database
    await normalizeProductFirstSales();

    const { searchParams } = new URL(req.url);
    const siteIdParam = searchParams.get("siteId");
    const search = searchParams.get("search")?.toLowerCase().trim();
    const paymentStatus = searchParams.get("paymentStatus");
    const categoryParam = searchParams.get("category"); // "NUTRA" | "ECOM"
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    // Build date filter if provided
    const saleDateFilter: any = {};
    if (startDateParam || endDateParam) {
      if (startDateParam) {
        saleDateFilter.gte = new Date(startDateParam);
      }
      if (endDateParam) {
        const end = new Date(endDateParam);
        end.setHours(23, 59, 59, 999);
        saleDateFilter.lte = end;
      }
    }

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
    let settingsList = await prisma.commissionSetting.findMany();
    if (settingsList.length === 0) {
      for (const tier of DEFAULT_COMMISSION_TIERS) {
        await prisma.commissionSetting.upsert({
          where: {
            category_saleType: {
              category: tier.category,
              saleType: tier.saleType,
            },
          },
          create: { ...tier },
          update: {},
        });
      }
      settingsList = await prisma.commissionSetting.findMany();
    }
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
            writerId: true,
            status: true,
            articleLink: true,
            completedAt: true,
            productCreatedAt: true,
            writer: { select: { id: true, name: true, hasLeftCompany: true, commissionToPartyFund: true, approved: true } },
          },
        },
        linkLogs: {
          take: 1,
          orderBy: { addedAt: "desc" },
          select: { id: true, affiliateName: true, addedBy: { select: { id: true, name: true, role: true } } },
        },
        commissionSales: {
          where: Object.keys(saleDateFilter).length > 0 ? { saleDate: saleDateFilter } : undefined,
          orderBy: { saleDate: "desc" },
        },
      },
      orderBy: { addedAt: "desc" },
    });

    // 4. Query all commission sales matching siteId (or all) and date range for the flat Commission List
    const saleWhere: any = {};
    if (siteIdParam && siteIdParam !== "ALL") {
      saleWhere.siteId = parseInt(siteIdParam);
    }
    if (Object.keys(saleDateFilter).length > 0) {
      saleWhere.saleDate = saleDateFilter;
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
        saleType: s.saleType as "FIRST_SALE" | "RESALE" | "REDIRECT",
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
        writerLeftCompany: s.writerLeftCompany || false,
        writerTransferredToParty: parseFloat((s.writerTransferredToParty || 0).toFixed(2)),
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
      // Resolve Linker: Product Researchers do NOT receive commission, only Linkers
      let resolvedLinker: any = null;
      if (prod.linkLogs[0]?.addedBy?.role === "LINKER") {
        resolvedLinker = prod.linkLogs[0].addedBy;
      } else if (prod.addedBy?.role === "LINKER") {
        resolvedLinker = prod.addedBy;
      } else if (prod.linkLogs[0]?.addedBy && prod.linkLogs[0].addedBy.role !== "PRODUCT_RESEARCHER") {
        resolvedLinker = prod.linkLogs[0].addedBy;
      } else if (prod.addedBy && prod.addedBy.role !== "PRODUCT_RESEARCHER" && prod.addedBy.role !== "SUPER_ADMIN" && prod.addedBy.role !== "ADMIN") {
        resolvedLinker = prod.addedBy;
      }

      const linkerName = resolvedLinker?.name || "Unassigned";
      const linkerId = resolvedLinker?.id || null;
      const writerName = prod.article?.writer?.name || "Unassigned";
      const writerId = prod.article?.writer?.id || null;
      const isUnassigned = !prod.article?.writerId || !prod.article?.writer;
      const writerHasLeft = Boolean(
        prod.article?.writer?.hasLeftCompany ||
        (prod.article?.writer && !prod.article?.writer?.approved)
      );
      const writerToPartyFund = Boolean(prod.article?.writer?.commissionToPartyFund);

      const totalSalesCount = prod.commissionSales.length;
      // A product can only have at most ONE genuine first sale.
      // Every sale after that is classified and counted as a resale.
      const hasFirstSale = prod.commissionSales.some((s) => s.saleType === "FIRST_SALE");
      const firstSalesCount = hasFirstSale ? 1 : 0;
      const redirectSalesCount = prod.commissionSales.filter((s) => s.saleType === "REDIRECT").length;
      const resalesCount = Math.max(0, totalSalesCount - firstSalesCount - redirectSalesCount);

      let pendingWriterAmount = 0;
      let pendingLinkerAmount = 0;
      let pendingTlAmount = 0;
      let paidCommissionAmount = 0;
      let pendingCommissionAmount = 0;

      prod.commissionSales.forEach((s) => {
        if (s.writerId && s.writerAmount > 0) {
          if (s.writerPaid) paidCommissionAmount += s.writerAmount;
          else {
            pendingCommissionAmount += s.writerAmount;
            pendingWriterAmount += s.writerAmount;
          }
        }
        if (s.linkerId && s.linkerAmount > 0) {
          if (s.linkerPaid) paidCommissionAmount += s.linkerAmount;
          else {
            pendingCommissionAmount += s.linkerAmount;
            pendingLinkerAmount += s.linkerAmount;
          }
        }
        if (s.teamLeadId && s.tlAmount > 0) {
          if (s.tlPaid) paidCommissionAmount += s.tlAmount;
          else {
            pendingCommissionAmount += s.tlAmount;
            pendingTlAmount += s.tlAmount;
          }
        }
        const nonRolePools = (s.seoAmount || 0) + (s.bonusAmount || 0) + (s.partyAmount || 0);
        if (s.paymentStatus === "PAID") {
          paidCommissionAmount += nonRolePools;
        } else {
          pendingCommissionAmount += nonRolePools;
        }
      });

      const totalCommissionAmount = paidCommissionAmount + pendingCommissionAmount;

      // Payment status determination for the product
      let overallPaymentStatus: "PAID" | "PENDING" | "PARTIAL" | "NO_SALES" = "NO_SALES";
      if (prod.commissionSales.length > 0) {
        if (pendingCommissionAmount === 0) {
          overallPaymentStatus = "PAID";
        } else if (paidCommissionAmount > 0) {
          overallPaymentStatus = "PARTIAL";
        } else {
          overallPaymentStatus = "PENDING";
        }
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
        isUnassigned,
        writerHasLeft,
        writerToPartyFund,
        articleStatus: prod.article?.status || "PENDING",
        articleLink: prod.article?.articleLink || null,
        firstSalesCount,
        resalesCount,
        redirectSalesCount,
        totalSalesCount,
        totalCommissionAmount: parseFloat(totalCommissionAmount.toFixed(2)),
        paidCommissionAmount: parseFloat(paidCommissionAmount.toFixed(2)),
        pendingCommissionAmount: parseFloat(pendingCommissionAmount.toFixed(2)),
        pendingWriterAmount: parseFloat(pendingWriterAmount.toFixed(2)),
        pendingLinkerAmount: parseFloat(pendingLinkerAmount.toFixed(2)),
        pendingTlAmount: parseFloat(pendingTlAmount.toFixed(2)),
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
    let totalRedirectSales = 0;
    let totalRedirectSalesAmount = 0;
    let totalBonusPool = 0;
    let totalSeoPool = 0;
    let totalPartyFunds = 0;
    let totalTransferredToParty = 0;
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
      } else if (s.saleType === "REDIRECT") {
        totalRedirectSales += 1;
        totalRedirectSalesAmount += s.amount;
      } else {
        totalResales += 1;
        totalResalesAmount += s.amount;
      }

      totalBonusPool += s.bonusAmount || 0;
      totalSeoPool += s.seoAmount || 0;
      totalPartyFunds += s.partyAmount || 0;
      totalTransferredToParty += s.writerTransferredToParty || 0;
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
      if (paymentStatus === "PAID") {
        enriched = enriched.filter((p) => p.overallPaymentStatus === "PAID" || p.paidCommissionAmount > 0);
      } else if (paymentStatus === "PENDING") {
        enriched = enriched.filter((p) => p.overallPaymentStatus === "PENDING" || p.pendingCommissionAmount > 0);
      } else if (paymentStatus === "PARTIAL") {
        enriched = enriched.filter((p) => p.overallPaymentStatus === "PARTIAL");
      } else {
        enriched = enriched.filter((p) => p.overallPaymentStatus === paymentStatus);
      }
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
        totalRedirectSales,
        totalRedirectSalesAmount: parseFloat(totalRedirectSalesAmount.toFixed(2)),
        totalBonusPool: parseFloat(totalBonusPool.toFixed(2)),
        totalSeoPool: parseFloat(totalSeoPool.toFixed(2)),
        totalPartyFunds: parseFloat(totalPartyFunds.toFixed(2)),
        totalTransferredToParty: parseFloat(totalTransferredToParty.toFixed(2)),
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

// POST /api/commissions - Record a new 1st sale or resale for a product
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
    const { productId, saleType, saleDate, paymentStatus, notes, writerLeftCompany } = body;

    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

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

    const isRedirectSale =
      saleType === "REDIRECT" ||
      saleType === "REDIRECT_SALE" ||
      body.isRedirect === true;

    // Enforce: Commission cannot be recorded or calculated for an unassigned article (unless it's a redirect sale)
    if (!isRedirectSale && (!product.article || !product.article.writerId || !product.article.writer)) {
      return NextResponse.json(
        { error: "Assign this article to a user before recording commission" },
        { status: 400 }
      );
    }

    // Enforce: A product can only have ONE genuine first sale.
    // Every sale after that MUST be classified as a RESALE (unless it is a REDIRECT sale).
    const existingFirstSale = await prisma.commissionSale.findFirst({
      where: {
        productId: product.id,
        saleType: "FIRST_SALE",
      },
    });

    const isAlreadyFirstSold = Boolean(existingFirstSale);
    const type: "FIRST_SALE" | "RESALE" | "REDIRECT" = isRedirectSale
      ? "REDIRECT"
      : isAlreadyFirstSold
      ? "RESALE"
      : saleType === "RESALE"
      ? "RESALE"
      : "FIRST_SALE";

    // 2. Resolve category key
    const catKey = resolveCategoryKey(product.category?.name);

    // 3. Find matching CommissionSetting tier to derive rates
    const baseLookupType = isRedirectSale
      ? (isAlreadyFirstSold ? "RESALE" : "FIRST_SALE")
      : type;

    const setting = await prisma.commissionSetting.findUnique({
      where: {
        category_saleType: {
          category: catKey,
          saleType: baseLookupType,
        },
      },
    });

    // Default amounts if setting not found (fallback to standard tiers)
    const fallbackTier = DEFAULT_COMMISSION_TIERS.find(
      (t) => t.category === catKey && t.saleType === baseLookupType
    );

    const isPercentage = setting?.rateType === "PERCENTAGE";
    const totalSaleBase = (fallbackTier?.total && fallbackTier.total > 0) ? fallbackTier.total : ((setting?.total && setting.total > 100) ? setting.total : 320);

    const rawLinkerRate = setting?.linker ?? fallbackTier?.linker ?? 0;
    const baseLinkerAmount = isPercentage
      ? parseFloat(((rawLinkerRate / 100) * totalSaleBase).toFixed(2))
      : rawLinkerRate;

    // For REDIRECT sales:
    // Linker receives standard commission + 50% extra bonus (1.5x)
    // All other roles (Writer, Team Lead, SEO, Bonus, Party) receive their normal standard commissions.
    const redirectBonus = parseFloat((baseLinkerAmount * 0.5).toFixed(2));
    const effectiveLinkerRate = isRedirectSale
      ? parseFloat((baseLinkerAmount * 1.5).toFixed(2))
      : baseLinkerAmount;

    const rawWriterRate = setting?.writer ?? fallbackTier?.writer ?? 0;
    const baseWriterAmount = isPercentage
      ? parseFloat(((rawWriterRate / 100) * totalSaleBase).toFixed(2))
      : rawWriterRate;

    const rawTlRate = setting?.tl ?? fallbackTier?.tl ?? 0;
    const baseTlAmount = isPercentage
      ? parseFloat(((rawTlRate / 100) * totalSaleBase).toFixed(2))
      : rawTlRate;

    const rawSeoRate = setting?.seo ?? fallbackTier?.seo ?? 0;
    const seoAmount = isPercentage
      ? parseFloat(((rawSeoRate / 100) * totalSaleBase).toFixed(2))
      : rawSeoRate;

    const rawBonusRate = setting?.bonusPool ?? fallbackTier?.bonusPool ?? 0;
    const bonusAmount = isPercentage
      ? parseFloat(((rawBonusRate / 100) * totalSaleBase).toFixed(2))
      : rawBonusRate;

    const rawPartyRate = setting?.partyFund ?? fallbackTier?.partyFund ?? 0;
    const basePartyAmount = isPercentage
      ? parseFloat(((rawPartyRate / 100) * totalSaleBase).toFixed(2))
      : rawPartyRate;

    const standardTotal = isPercentage
      ? totalSaleBase
      : (setting?.total ?? fallbackTier?.total ?? 0);

    const amount = isRedirectSale
      ? parseFloat((standardTotal + redirectBonus).toFixed(2))
      : standardTotal;

    // Beneficiaries: Product Researchers do NOT receive commission, only Linkers
    let linker: any = null;
    if (product.linkLogs[0]?.addedBy && product.linkLogs[0].addedBy.role === "LINKER") {
      linker = product.linkLogs[0].addedBy;
    } else if (product.addedBy && product.addedBy.role === "LINKER") {
      linker = product.addedBy;
    } else if (product.linkLogs[0]?.addedBy && product.linkLogs[0].addedBy.role !== "PRODUCT_RESEARCHER") {
      linker = product.linkLogs[0].addedBy;
    } else if (product.addedBy && product.addedBy.role !== "PRODUCT_RESEARCHER" && product.addedBy.role !== "SUPER_ADMIN" && product.addedBy.role !== "ADMIN") {
      linker = product.addedBy;
    }

    if (isRedirectSale && (!linker || linker.role === "PRODUCT_RESEARCHER")) {
      return NextResponse.json(
        { error: "A linker must be assigned to this product or its affiliate links to record a redirect sale" },
        { status: 400 }
      );
    }

    const writer = product.article?.writer;

    // Determine if writer has left the company or has commission routed to Party Fund
    const isWriterLeft =
      writerLeftCompany !== undefined
        ? Boolean(writerLeftCompany)
        : Boolean(writer?.hasLeftCompany || !writer?.approved);

    const isWriterToParty = isWriterLeft || Boolean(writer?.commissionToPartyFund);

    // If writer has left or commission routed to party fund, their commission transfers to the Office Party Fund
    const writerTransferredToParty = isWriterToParty ? baseWriterAmount : 0;
    const writerAmount = isWriterToParty ? 0 : baseWriterAmount;

    // Linker commission routed to party fund if linker has commissionToPartyFund or no valid linker assigned
    let linkerTransferred = 0;
    let linkerAmount = effectiveLinkerRate;
    if (!linker || linker.role === "PRODUCT_RESEARCHER" || linker.commissionToPartyFund) {
      linkerTransferred = effectiveLinkerRate;
      linkerAmount = 0;
    }

    let teamLeadId: number | null = null;
    let teamLeadName: string | null = null;
    let tlTransferred = 0;
    let tlAmount = baseTlAmount;

    if (writer?.teamLeadId) {
      // Writer has a separate assigned Team Lead - credit TL commission to them
      const tl = await prisma.user.findUnique({
        where: { id: writer.teamLeadId },
        select: { id: true, name: true, commissionToPartyFund: true },
      });
      teamLeadId = tl?.id || null;
      teamLeadName = tl?.name || null;
      if (tl?.commissionToPartyFund) {
        tlTransferred = tlAmount;
        tlAmount = 0;
      }
    } else if (writer?.role === "TEAM_LEAD") {
      // Special case: the writer IS a Team Lead themselves (no separate TL above them).
      // Both writer commission AND TL commission go to this same user.
      teamLeadId = writer.id;
      teamLeadName = writer.name;
      if (writer.commissionToPartyFund) {
        tlTransferred = tlAmount;
        tlAmount = 0;
      }
    }

    const partyAmount = basePartyAmount + writerTransferredToParty + linkerTransferred + tlTransferred;

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
        writerName: writer?.name || (isWriterLeft ? "Departed Writer" : null),
        linkerId: (linker && linker.role !== "PRODUCT_RESEARCHER") ? linker.id : null,
        linkerName: (linker && linker.role !== "PRODUCT_RESEARCHER") ? linker.name : null,
        teamLeadId,
        teamLeadName,
        paymentStatus: status,
        paidAt,
        writerPaid: status === "PAID" && writerAmount > 0,
        writerPaidAt: status === "PAID" && writerAmount > 0 ? paidAt : null,
        linkerPaid: status === "PAID" && linkerAmount > 0,
        linkerPaidAt: status === "PAID" && linkerAmount > 0 ? paidAt : null,
        tlPaid: status === "PAID" && tlAmount > 0,
        tlPaidAt: status === "PAID" && tlAmount > 0 ? paidAt : null,
        amount,
        linkerAmount: (linker && linker.role !== "PRODUCT_RESEARCHER") ? linkerAmount : 0,
        writerAmount,
        tlAmount,
        seoAmount,
        bonusAmount,
        partyAmount,
        writerLeftCompany: isWriterLeft,
        writerTransferredToParty,
        notes: notes?.trim() || (isRedirectSale ? "Redirect sale (Linker +50% bonus, normal other commissions)" : null),
        createdById: session.user.id ? Number(session.user.id) : null,
      },
    });

    const successMsg =
      type === "REDIRECT"
        ? `Redirect sale logged successfully! Rs. ${linkerAmount.toFixed(2)} allocated to Linker (+50% bonus), and normal commissions allocated to all other roles.`
        : isAlreadyFirstSold && saleType === "FIRST_SALE"
        ? "Resale recorded! (Product already has a 1st Sale, so this sale was automatically classified as a Resale)"
        : `${type === "FIRST_SALE" ? "1st Sale" : "Resale"} recorded successfully!`;

    return NextResponse.json({
      message: successMsg,
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
