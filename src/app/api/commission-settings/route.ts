import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const DEFAULT_COMMISSION_TIERS = [
  {
    category: "NUTRA",
    saleType: "FIRST_SALE",
    rateType: "FIXED",
    currency: "USD",
    linker: 2.5,
    writer: 3.5,
    tl: 1.0,
    seo: 1.0,
    bonusPool: 1.0,
    partyFund: 0.5,
    total: 9.5,
    notes: "Nutra initial customer acquisition commission distribution",
  },
  {
    category: "NUTRA",
    saleType: "RESALE",
    rateType: "FIXED",
    currency: "USD",
    linker: 1.5,
    writer: 2.0,
    tl: 0.5,
    seo: 0.5,
    bonusPool: 0.5,
    partyFund: 0.25,
    total: 5.25,
    notes: "Nutra recurring / repeat order commission distribution",
  },
  {
    category: "ECOM",
    saleType: "FIRST_SALE",
    rateType: "FIXED",
    currency: "USD",
    linker: 2.0,
    writer: 3.0,
    tl: 1.0,
    seo: 0.8,
    bonusPool: 0.8,
    partyFund: 0.4,
    total: 8.0,
    notes: "Ecom initial conversion commission distribution",
  },
  {
    category: "ECOM",
    saleType: "RESALE",
    rateType: "FIXED",
    currency: "USD",
    linker: 1.2,
    writer: 1.5,
    tl: 0.5,
    seo: 0.4,
    bonusPool: 0.4,
    partyFund: 0.2,
    total: 4.2,
    notes: "Ecom repeat customer commission distribution",
  },
];

// Helper: Ensure 4 default settings exist
async function ensureDefaultTiers(userId?: number | null) {
  for (const tier of DEFAULT_COMMISSION_TIERS) {
    const existing = await prisma.commissionSetting.findUnique({
      where: {
        category_saleType: {
          category: tier.category,
          saleType: tier.saleType,
        },
      },
    });

    if (!existing) {
      await prisma.commissionSetting.create({
        data: {
          ...tier,
          updatedById: userId && !isNaN(userId) ? userId : null,
        },
      });
    }
  }
}

// GET /api/commission-settings — Retrieve all commission settings (Super Admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Commission settings are restricted to Super Admin" },
        { status: 403 }
      );
    }

    const rawId = (session.user as any)?.id;
    const userId = rawId && !isNaN(Number(rawId)) ? Number(rawId) : null;

    // Seed defaults if empty
    await ensureDefaultTiers(userId);

    const settings = await prisma.commissionSetting.findMany({
      orderBy: [{ category: "asc" }, { saleType: "asc" }],
    });

    return NextResponse.json(settings);
  } catch (err: any) {
    console.error("[GET /api/commission-settings]", err);
    return NextResponse.json(
      { error: err.message || "Failed to load commission settings" },
      { status: 500 }
    );
  }
}

// PUT /api/commission-settings — Update commission settings (Super Admin only)
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only Super Admin can modify commission settings" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const items = Array.isArray(body) ? body : [body];
    const rawId = (session.user as any)?.id;
    const userId = rawId && !isNaN(Number(rawId)) ? Number(rawId) : null;

    const updatedResults = [];

    for (const item of items) {
      const {
        category,
        saleType,
        rateType = "FIXED",
        currency = "USD",
        linker = 0,
        writer = 0,
        tl = 0,
        seo = 0,
        bonusPool = 0,
        partyFund = 0,
        notes = "",
      } = item;

      if (!category || !saleType) {
        continue;
      }

      // Safe numeric parsing and round to 2 decimal places
      const cleanLinker = Math.max(0, Number(linker) || 0);
      const cleanWriter = Math.max(0, Number(writer) || 0);
      const cleanTl = Math.max(0, Number(tl) || 0);
      const cleanSeo = Math.max(0, Number(seo) || 0);
      const cleanBonusPool = Math.max(0, Number(bonusPool) || 0);
      const cleanPartyFund = Math.max(0, Number(partyFund) || 0);

      const calculatedTotal = parseFloat(
        (cleanLinker + cleanWriter + cleanTl + cleanSeo + cleanBonusPool + cleanPartyFund).toFixed(2)
      );

      const updated = await prisma.commissionSetting.upsert({
        where: {
          category_saleType: {
            category,
            saleType,
          },
        },
        update: {
          rateType,
          currency,
          linker: cleanLinker,
          writer: cleanWriter,
          tl: cleanTl,
          seo: cleanSeo,
          bonusPool: cleanBonusPool,
          partyFund: cleanPartyFund,
          total: calculatedTotal,
          notes: notes ? String(notes) : null,
          updatedById: userId,
        },
        create: {
          category,
          saleType,
          rateType,
          currency,
          linker: cleanLinker,
          writer: cleanWriter,
          tl: cleanTl,
          seo: cleanSeo,
          bonusPool: cleanBonusPool,
          partyFund: cleanPartyFund,
          total: calculatedTotal,
          notes: notes ? String(notes) : null,
          updatedById: userId,
        },
      });

      updatedResults.push(updated);
    }

    return NextResponse.json({
      success: true,
      message: "Commission settings updated successfully",
      data: updatedResults,
    });
  } catch (err: any) {
    console.error("[PUT /api/commission-settings]", err);
    return NextResponse.json(
      { error: err.message || "Failed to update commission settings" },
      { status: 500 }
    );
  }
}
