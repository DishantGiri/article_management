import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Calculate date range for bulk payout time periods
function getDateRangeForPeriod(period?: string, customStart?: string, customEnd?: string) {
  const now = new Date();
  if (period === "daily") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
  } else if (period === "weekly") {
    const dayOfWeek = now.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    const start = new Date(now);
    start.setDate(now.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  } else if (period === "monthly") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  } else if (customStart || customEnd) {
    const start = customStart ? new Date(customStart) : undefined;
    if (start) start.setHours(0, 0, 0, 0);
    const end = customEnd ? new Date(customEnd) : undefined;
    if (end) end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  return { start: undefined, end: undefined };
}

// POST /api/commissions/users/payout
// Handles:
// 1. User Payout: { userId } -> Settles only this user's role earnings without affecting others
// 2. Product Payout: { productId, roles?: ("WRITER"|"LINKER"|"TEAM_LEAD")[] } -> Settles specific product roles
// 3. Bulk Time-Period Payout: { timePeriod: "daily"|"weekly"|"monthly"|"custom", startDate?, endDate?, roles? }
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only Admin can authorize commission payouts" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { userId, productId, timePeriod, startDate, endDate, roles = ["WRITER", "LINKER", "TEAM_LEAD"] } = body;

    const now = new Date();
    let settledSalesCount = 0;
    let settledAmount = 0;

    // ─────────────────────────────────────────────────────────────────────────
    // CASE 1: PRODUCT-BASED PAYOUT
    // ─────────────────────────────────────────────────────────────────────────
    if (productId) {
      const pId = parseInt(productId);
      const sales = await prisma.commissionSale.findMany({
        where: {
          productId: pId,
          OR: [
            { paymentStatus: "PENDING" },
            { writerPaid: false, writerAmount: { gt: 0 } },
            { linkerPaid: false, linkerAmount: { gt: 0 } },
            { tlPaid: false, tlAmount: { gt: 0 } },
          ],
        },
      });

      for (const sale of sales) {
        const updateData: any = {};
        let salePaidPortion = 0;

        const payWriter = roles.includes("WRITER") && sale.writerId && !sale.writerPaid && sale.writerAmount > 0;
        const payLinker = roles.includes("LINKER") && sale.linkerId && !sale.linkerPaid && sale.linkerAmount > 0;
        const payTl = roles.includes("TEAM_LEAD") && sale.teamLeadId && !sale.tlPaid && sale.tlAmount > 0;

        if (payWriter) {
          updateData.writerPaid = true;
          updateData.writerPaidAt = now;
          salePaidPortion += sale.writerAmount;
        }
        if (payLinker) {
          updateData.linkerPaid = true;
          updateData.linkerPaidAt = now;
          salePaidPortion += sale.linkerAmount;
        }
        if (payTl) {
          updateData.tlPaid = true;
          updateData.tlPaidAt = now;
          salePaidPortion += sale.tlAmount;
        }

        if (Object.keys(updateData).length > 0) {
          const finalWriterPaid = payWriter || sale.writerPaid || !sale.writerId || sale.writerAmount === 0;
          const finalLinkerPaid = payLinker || sale.linkerPaid || !sale.linkerId || sale.linkerAmount === 0;
          const finalTlPaid = payTl || sale.tlPaid || !sale.teamLeadId || sale.tlAmount === 0;

          if (finalWriterPaid && finalLinkerPaid && finalTlPaid) {
            updateData.paymentStatus = "PAID";
            updateData.paidAt = now;
          }

          await prisma.commissionSale.update({
            where: { id: sale.id },
            data: updateData,
          });

          settledSalesCount++;
          settledAmount += salePaidPortion;
        }
      }

      return NextResponse.json({
        message: `Successfully settled Rs. ${settledAmount.toFixed(2)} across ${settledSalesCount} sale(s) for this product!`,
        count: settledSalesCount,
        amount: settledAmount,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CASE 2: BULK PAYOUT BY TIME PERIOD
    // ─────────────────────────────────────────────────────────────────────────
    if (timePeriod) {
      const { start, end } = getDateRangeForPeriod(timePeriod, startDate, endDate);
      const dateFilter: any = {};
      if (start) dateFilter.gte = start;
      if (end) dateFilter.lte = end;

      const sales = await prisma.commissionSale.findMany({
        where: {
          ...(Object.keys(dateFilter).length > 0 ? { saleDate: dateFilter } : {}),
          OR: [
            { paymentStatus: "PENDING" },
            { writerPaid: false, writerAmount: { gt: 0 } },
            { linkerPaid: false, linkerAmount: { gt: 0 } },
            { tlPaid: false, tlAmount: { gt: 0 } },
          ],
        },
      });

      for (const sale of sales) {
        const updateData: any = {};
        let salePaidPortion = 0;

        const payWriter = roles.includes("WRITER") && sale.writerId && !sale.writerPaid && sale.writerAmount > 0;
        const payLinker = roles.includes("LINKER") && sale.linkerId && !sale.linkerPaid && sale.linkerAmount > 0;
        const payTl = roles.includes("TEAM_LEAD") && sale.teamLeadId && !sale.tlPaid && sale.tlAmount > 0;

        if (payWriter) {
          updateData.writerPaid = true;
          updateData.writerPaidAt = now;
          salePaidPortion += sale.writerAmount;
        }
        if (payLinker) {
          updateData.linkerPaid = true;
          updateData.linkerPaidAt = now;
          salePaidPortion += sale.linkerAmount;
        }
        if (payTl) {
          updateData.tlPaid = true;
          updateData.tlPaidAt = now;
          salePaidPortion += sale.tlAmount;
        }

        if (Object.keys(updateData).length > 0) {
          const finalWriterPaid = payWriter || sale.writerPaid || !sale.writerId || sale.writerAmount === 0;
          const finalLinkerPaid = payLinker || sale.linkerPaid || !sale.linkerId || sale.linkerAmount === 0;
          const finalTlPaid = payTl || sale.tlPaid || !sale.teamLeadId || sale.tlAmount === 0;

          if (finalWriterPaid && finalLinkerPaid && finalTlPaid) {
            updateData.paymentStatus = "PAID";
            updateData.paidAt = now;
          }

          await prisma.commissionSale.update({
            where: { id: sale.id },
            data: updateData,
          });

          settledSalesCount++;
          settledAmount += salePaidPortion;
        }
      }

      const periodLabel =
        timePeriod === "daily"
          ? "Today's"
          : timePeriod === "weekly"
          ? "This Week's"
          : timePeriod === "monthly"
          ? "This Month's"
          : "Selected Period";

      return NextResponse.json({
        message: `Bulk Payout complete: Settled Rs. ${settledAmount.toFixed(2)} across ${settledSalesCount} transaction(s) for ${periodLabel}!`,
        count: settledSalesCount,
        amount: settledAmount,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CASE 3: INDEPENDENT USER-BASED PAYOUT
    // ─────────────────────────────────────────────────────────────────────────
    if (userId) {
      const targetUserId = parseInt(userId);

      const sales = await prisma.commissionSale.findMany({
        where: {
          OR: [
            { writerId: targetUserId, writerPaid: false, writerAmount: { gt: 0 } },
            { linkerId: targetUserId, linkerPaid: false, linkerAmount: { gt: 0 } },
            { teamLeadId: targetUserId, tlPaid: false, tlAmount: { gt: 0 } },
            // Legacy fallback if paymentStatus is PENDING and role flags not yet updated
            { writerId: targetUserId, paymentStatus: "PENDING", writerAmount: { gt: 0 } },
            { linkerId: targetUserId, paymentStatus: "PENDING", linkerAmount: { gt: 0 } },
            { teamLeadId: targetUserId, paymentStatus: "PENDING", tlAmount: { gt: 0 } },
          ],
        },
      });

      for (const sale of sales) {
        const updateData: any = {};
        let salePaidPortion = 0;

        const isWriter = sale.writerId === targetUserId && !sale.writerPaid && sale.writerAmount > 0;
        const isLinker = sale.linkerId === targetUserId && !sale.linkerPaid && sale.linkerAmount > 0;
        const isTl = sale.teamLeadId === targetUserId && !sale.tlPaid && sale.tlAmount > 0;

        if (isWriter) {
          updateData.writerPaid = true;
          updateData.writerPaidAt = now;
          salePaidPortion += sale.writerAmount;
        }
        if (isLinker) {
          updateData.linkerPaid = true;
          updateData.linkerPaidAt = now;
          salePaidPortion += sale.linkerAmount;
        }
        if (isTl) {
          updateData.tlPaid = true;
          updateData.tlPaidAt = now;
          salePaidPortion += sale.tlAmount;
        }

        if (Object.keys(updateData).length > 0) {
          const finalWriterPaid = isWriter || sale.writerPaid || !sale.writerId || sale.writerAmount === 0;
          const finalLinkerPaid = isLinker || sale.linkerPaid || !sale.linkerId || sale.linkerAmount === 0;
          const finalTlPaid = isTl || sale.tlPaid || !sale.teamLeadId || sale.tlAmount === 0;

          if (finalWriterPaid && finalLinkerPaid && finalTlPaid) {
            updateData.paymentStatus = "PAID";
            updateData.paidAt = now;
          }

          await prisma.commissionSale.update({
            where: { id: sale.id },
            data: updateData,
          });

          settledSalesCount++;
          settledAmount += salePaidPortion;
        }
      }

      return NextResponse.json({
        message: `Successfully settled Rs. ${settledAmount.toFixed(2)} across ${settledSalesCount} commission item(s) for this user!`,
        count: settledSalesCount,
        amount: settledAmount,
      });
    }

    return NextResponse.json(
      { error: "Please specify a userId, productId, or timePeriod for payout" },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("[POST /api/commissions/users/payout]", err);
    return NextResponse.json(
      { error: err.message || "Payout processing failed" },
      { status: 500 }
    );
  }
}
