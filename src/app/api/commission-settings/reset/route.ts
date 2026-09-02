import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DEFAULT_COMMISSION_TIERS } from "../route";

// POST /api/commission-settings/reset — Reset all commission settings to defaults (Super Admin only)
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only Super Admin can reset commission settings" },
        { status: 403 }
      );
    }

    const userId = Number(session.user.id);
    const resetResults = [];

    for (const tier of DEFAULT_COMMISSION_TIERS) {
      const updated = await prisma.commissionSetting.upsert({
        where: {
          category_saleType: {
            category: tier.category,
            saleType: tier.saleType,
          },
        },
        update: {
          ...tier,
          updatedById: userId,
        },
        create: {
          ...tier,
          updatedById: userId,
        },
      });
      resetResults.push(updated);
    }

    return NextResponse.json({
      success: true,
      message: "Commission settings reset to defaults successfully",
      data: resetResults,
    });
  } catch (err: any) {
    console.error("[POST /api/commission-settings/reset]", err);
    return NextResponse.json(
      { error: err.message || "Failed to reset commission settings" },
      { status: 500 }
    );
  }
}
