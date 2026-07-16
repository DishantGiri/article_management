import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const history = await prisma.linkHistory.findMany({
      where: { linkLogId: parseInt(id) },
      include: {
        updatedBy: { select: { name: true, role: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(history);
  } catch (err) {
    console.error("[GET /api/links/:id/history]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
