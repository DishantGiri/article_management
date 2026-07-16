import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRealtimeNotification } from "@/lib/notifier";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// POST /api/reviews — Team Lead submits a review remark (Approve or Redo)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, suggestion, approved, priority } = await req.json();

    if (articleId === undefined || approved === undefined) {
      return NextResponse.json(
        { error: "articleId and approved are required fields" },
        { status: 400 }
      );
    }

    const reviewedById = Number(session.user.id);
    const reviewerRole = session.user.role;

    if (reviewerRole !== "TEAM_LEAD" && reviewerRole !== "ADMIN" && reviewerRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Team Leads and Admins can submit article reviews." },
        { status: 403 }
      );
    }

    // Get reviewer details
    const reviewer = await prisma.user.findUnique({
      where: { id: reviewedById },
      select: { name: true },
    });

    if (!reviewer) {
      return NextResponse.json({ error: "Reviewer not found" }, { status: 404 });
    }

    // Validate article exists
    const article = await prisma.article.findUnique({
      where: { id: Number(articleId) },
      include: { product: true }
    });

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // 1. Create the ArticleReview entry
    const review = await prisma.articleReview.create({
      data: {
        articleId: Number(articleId),
        reviewedById: Number(reviewedById),
        suggestion: suggestion || null,
        approved: Boolean(approved),
      },
    });

    // 2. Determine new status
    const newStatus = approved ? "APPROVED" : "REDO";

    // 3. Update the Article status
    // On REDO: null out startedAt so timer does NOT auto-start — writer must click "Start Revision"
    const updatedArticle = await prisma.article.update({
      where: { id: Number(articleId) },
      data: {
        status: newStatus,
        ...(newStatus === "REDO" ? { startedAt: null } : {}),
        ...(priority && ["LOW", "MEDIUM", "HIGH"].includes(priority)
          ? { priority: priority as "LOW" | "MEDIUM" | "HIGH" }
          : {}),
      },
      include: {
        product: { select: { name: true } },
        writer: { select: { id: true, name: true } },
      },
    });

    // 4. Log to ArticleHistory
    try {
      await prisma.articleHistory.create({
        data: {
          articleId: Number(articleId),
          updatedById: Number(reviewedById),
          oldStatus: article.status,
          newStatus: newStatus,
          notes: approved
            ? `Approved by ${reviewer.name}. Feedback: ${suggestion || "none"}`
            : `Redo requested by ${reviewer.name}. Feedback: ${suggestion || "none"}`,
        },
      });
    } catch (historyErr) {
      console.error("Failed to log article history on review:", historyErr);
    }

    // 5. Notify the writer of the review
    if (updatedArticle.writerId) {
      try {
        const notifMessage = approved
          ? `Your article for "${updatedArticle.product.name}" was APPROVED by Team Lead ${reviewer.name}.`
          : `Changes requested on your article for "${updatedArticle.product.name}" by Team Lead ${reviewer.name}. Remark: ${suggestion || "No remarks provided"}`;

        const notif = await prisma.notification.create({
          data: {
            recipientId: updatedArticle.writerId,
            senderId: Number(reviewedById),
            type: "ARTICLE_SUGGESTION",
            message: notifMessage,
          },
        });
        await sendRealtimeNotification(updatedArticle.writerId, notif);
      } catch (notifErr) {
        console.error("Failed to send notification to writer:", notifErr);
      }
    }

    // 6. Broadcast general status update via WebSockets
    try {
      const port = process.env.PORT || "3022";
      const secret = process.env.NEXTAUTH_SECRET;
      fetch(`http://localhost:${port}/notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${secret}`
        },
        body: JSON.stringify({
          broadcast: true,
          type: "ARTICLE_STATUS_UPDATED",
          message: `Article for ${updatedArticle.product.name} was reviewed: ${newStatus}`,
          id: updatedArticle.id,
          createdAt: new Date().toISOString(),
          data: updatedArticle,
        }),
      }).catch((e) => console.error("WS Notification failed", e));
    } catch (e) {}

    return NextResponse.json({ success: true, review, article: updatedArticle });
  } catch (err) {
    console.error("[POST /api/reviews]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
