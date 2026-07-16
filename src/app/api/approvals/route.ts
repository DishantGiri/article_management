import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRealtimeNotification } from "@/lib/notifier";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// POST /api/approvals — team lead grants special completion without article link
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, reason } = await req.json();
    if (!articleId || !reason) {
      return NextResponse.json({ error: "articleId and reason are required" }, { status: 400 });
    }

    const approvedById = session.user.id;
    const userRole = session.user.role;

    if (userRole !== "TEAM_LEAD" && userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only Team Leads or Admins can grant special approvals." }, { status: 403 });
    }

    const article = await prisma.article.findUnique({
      where: { id: parseInt(articleId) },
      include: { product: { select: { name: true } }, writer: { select: { id: true, name: true } } },
    });
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });

    const approval = await prisma.specialApproval.create({
      data: {
        articleId: parseInt(articleId),
        approvedById: approvedById,
        writerName: article.writer?.name || "Unknown",
        productName: article.product.name,
        reason,
      },
    });

    // Reset approval request flags on the article
    await prisma.article.update({
      where: { id: parseInt(articleId) },
      data: {
        specialApprovalRequested: false,
        specialApprovalRequestReason: null,
      },
    });

    // Notify the writer
    if (article.writer?.id) {
      const notif = await prisma.notification.create({
        data: {
          recipientId: article.writer.id,
          senderId: approvedById,
          type: "APPROVAL_GRANTED",
          message: `Special approval granted for "${article.product.name}". Reason: ${reason}`,
        },
      });
      await sendRealtimeNotification(article.writer.id, notif);
    }

    return NextResponse.json(approval, { status: 201 });
  } catch (err) {
    console.error("[POST /api/approvals]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/approvals
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = session.user.role;
  if (userRole !== "TEAM_LEAD" && userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const approvals = await prisma.specialApproval.findMany({
    include: { approvedBy: { select: { name: true } } },
    orderBy: { approvedAt: "desc" },
  });
  return NextResponse.json(approvals);
}
