/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRealtimeNotification } from "@/lib/notifier";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// POST /api/approvals — Team Lead approves/rejects edit request on an approved article
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, reason, action = "APPROVE" } = await req.json();
    if (!articleId) {
      return NextResponse.json({ error: "articleId is required" }, { status: 400 });
    }

    const approvedById = Number(session.user.id);
    const userRole = session.user.role;

    if (userRole !== "TEAM_LEAD" && userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only Team Leads or Admins can grant update approvals." }, { status: 403 });
    }

    const article = await prisma.article.findUnique({
      where: { id: parseInt(articleId) },
      include: {
        product: { select: { name: true } },
        writer: { select: { id: true, name: true, teamLeadId: true } },
      },
    });
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });

    if (userRole === "TEAM_LEAD" && article.writerId && article.writerId !== approvedById) {
      if (article.writer?.teamLeadId && article.writer.teamLeadId !== approvedById) {
        return NextResponse.json({ error: "Access denied: This writer is not assigned to your team." }, { status: 403 });
      }
    }

    const approverName = session.user.name || "Team Lead";

    // ─── ACTION: REJECT UPDATE REQUEST ─────────────────────────────
    if (action === "REJECT") {
      await prisma.article.update({
        where: { id: parseInt(articleId) },
        data: {
          specialApprovalRequested: false,
          specialApprovalRequestReason: null,
        },
      });

      // Audit log in ArticleHistory
      await prisma.articleHistory.create({
        data: {
          articleId: parseInt(articleId),
          updatedById: approvedById,
          oldStatus: article.status,
          newStatus: article.status,
          notes: `Update request rejected by ${approverName}. Note: ${reason || "Declined"}`,
        },
      });

      // Notify the writer
      if (article.writer?.id) {
        const notif = await prisma.notification.create({
          data: {
            recipientId: article.writer.id,
            senderId: approvedById,
            type: "ARTICLE_SUGGESTION",
            message: `Your request to update the article for "${article.product.name}" was DECLINED by Team Lead ${approverName}. Reason: ${reason || "No reason provided"}`,
          },
        });
        await sendRealtimeNotification(article.writer.id, notif);
      }

      return NextResponse.json({ success: true, rejected: true }, { status: 200 });
    }

    // ─── ACTION: APPROVE UPDATE REQUEST (Reopen Article) ───────────
    const approval = await prisma.specialApproval.upsert({
      where: { articleId: parseInt(articleId) },
      create: {
        articleId: parseInt(articleId),
        approvedById: approvedById,
        writerName: article.writer?.name || "Unknown",
        productName: article.product.name,
        reason: reason || "Approved for update and revisions",
      },
      update: {
        approvedById: approvedById,
        writerName: article.writer?.name || "Unknown",
        productName: article.product.name,
        reason: reason || "Approved for update and revisions",
        approvedAt: new Date(),
      },
    });

    // Reopen article to IN_PROGRESS so the writer can now edit and resubmit
    const updated = await prisma.article.update({
      where: { id: parseInt(articleId) },
      data: {
        status: "IN_PROGRESS",
        startedAt: new Date(),
        specialApprovalRequested: false,
        specialApprovalRequestReason: null,
      },
      include: {
        product: { select: { name: true } },
        writer: { select: { id: true, name: true } },
      },
    });

    // Audit log in ArticleHistory
    await prisma.articleHistory.create({
      data: {
        articleId: parseInt(articleId),
        updatedById: approvedById,
        oldStatus: article.status,
        newStatus: "IN_PROGRESS",
        notes: `Update request approved by ${approverName}. Article unlocked for writer ${article.writer?.name || ""}. Reason: ${reason || "Approved for revisions"}`,
      },
    });

    // Notify the writer
    if (article.writer?.id) {
      const notif = await prisma.notification.create({
        data: {
          recipientId: article.writer.id,
          senderId: approvedById,
          type: "APPROVAL_GRANTED",
          message: `Your request to update the approved article for "${article.product.name}" was APPROVED by Team Lead ${approverName}. The article is now unlocked for you to edit.`,
        },
      });
      await sendRealtimeNotification(article.writer.id, notif);
    }

    // Broadcast status change to connected clients
    try {
      const baseUrl = (process.env.NEXTAUTH_URL || process.env.SITE_URL || process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || "3022"}`).replace(/\/$/, "");
      const secret = process.env.NEXTAUTH_SECRET;
      fetch(`${baseUrl}/notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${secret}`,
        },
        body: JSON.stringify({
          broadcast: true,
          type: "ARTICLE_STATUS_UPDATED",
          id: updated.id,
          createdAt: new Date().toISOString(),
          data: updated,
        }),
      }).catch(() => {});
    } catch {
      // Ignore broadcast errors
    }

    return NextResponse.json(approval, { status: 200 });
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

  const userId = Number(session.user.id);
  const userRole = session.user.role;
  if (userRole !== "TEAM_LEAD" && userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const approvals = await prisma.specialApproval.findMany({
    where: userRole === "TEAM_LEAD" ? {
      OR: [
        { approvedById: userId },
        { article: { writer: { teamLeadId: userId } } },
      ],
    } : {},
    include: { approvedBy: { select: { name: true } } },
    orderBy: { approvedAt: "desc" },
  });
  return NextResponse.json(approvals);
}
