import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/approvals — team lead grants special completion without article link
export async function POST(req: NextRequest) {
  try {
    const { articleId, approvedById, reason } = await req.json();
    if (!articleId || !approvedById || !reason) {
      return NextResponse.json({ error: "articleId, approvedById, and reason are required" }, { status: 400 });
    }

    const article = await prisma.article.findUnique({
      where: { id: parseInt(articleId) },
      include: { product: { select: { name: true } }, writer: { select: { id: true, name: true } } },
    });
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });

    const approval = await prisma.specialApproval.create({
      data: {
        articleId: parseInt(articleId),
        approvedById: parseInt(approvedById),
        writerName: article.writer?.name || "Unknown",
        productName: article.product.name,
        reason,
      },
    });

    // Notify the writer
    if (article.writer?.id) {
      await prisma.notification.create({
        data: {
          recipientId: article.writer.id,
          senderId: parseInt(approvedById),
          type: "APPROVAL_GRANTED",
          message: `Special approval granted for "${article.product.name}". Reason: ${reason}`,
        },
      });
    }

    return NextResponse.json(approval, { status: 201 });
  } catch (err) {
    console.error("[POST /api/approvals]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/approvals
export async function GET() {
  const approvals = await prisma.specialApproval.findMany({
    include: { approvedBy: { select: { name: true } } },
    orderBy: { approvedAt: "desc" },
  });
  return NextResponse.json(approvals);
}
