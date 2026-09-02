import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// PATCH /api/commissions/[id] — Toggle payment status or update notes
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const saleId = parseInt(id);
    if (isNaN(saleId)) {
      return NextResponse.json({ error: "Invalid sale ID" }, { status: 400 });
    }

    const body = await req.json();
    const { paymentStatus, notes, saleDate } = body;

    const data: any = {};
    if (paymentStatus) {
      data.paymentStatus = paymentStatus === "PAID" ? "PAID" : "PENDING";
      data.paidAt = data.paymentStatus === "PAID" ? new Date() : null;
    }
    if (notes !== undefined) {
      data.notes = notes?.trim() || null;
    }
    if (saleDate) {
      const parsed = new Date(saleDate);
      if (!isNaN(parsed.getTime())) {
        data.saleDate = parsed;
      }
    }

    const updated = await prisma.commissionSale.update({
      where: { id: saleId },
      data,
    });

    return NextResponse.json({
      message: "Sale record updated successfully",
      sale: updated,
    });
  } catch (err: any) {
    console.error("[PATCH /api/commissions/[id]]", err);
    return NextResponse.json(
      { error: err.message || "Failed to update sale" },
      { status: 500 }
    );
  }
}

// DELETE /api/commissions/[id] — Delete a recorded sale entry
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const saleId = parseInt(id);
    if (isNaN(saleId)) {
      return NextResponse.json({ error: "Invalid sale ID" }, { status: 400 });
    }

    await prisma.commissionSale.delete({
      where: { id: saleId },
    });

    return NextResponse.json({
      message: "Sale record deleted successfully",
    });
  } catch (err: any) {
    console.error("[DELETE /api/commissions/[id]]", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete sale" },
      { status: 500 }
    );
  }
}
