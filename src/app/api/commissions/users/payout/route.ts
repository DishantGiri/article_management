import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// POST /api/commissions/users/payout — Batch mark all pending sales as PAID for a user
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Restrict payout action to Admins or Super Admins
    if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only Admin can authorize commission payouts" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const targetUserId = parseInt(userId);

    // Update all pending sales where this user is writer, linker, or team lead
    const result = await prisma.commissionSale.updateMany({
      where: {
        paymentStatus: "PENDING",
        OR: [
          { writerId: targetUserId },
          { linkerId: targetUserId },
          { teamLeadId: targetUserId },
        ],
      },
      data: {
        paymentStatus: "PAID",
        paidAt: new Date(),
      },
    });

    return NextResponse.json({
      message: `Successfully settled ${result.count} commission items!`,
      count: result.count,
    });
  } catch (err: any) {
    console.error("[POST /api/commissions/users/payout]", err);
    return NextResponse.json(
      { error: err.message || "Payout processing failed" },
      { status: 500 }
    );
  }
}
