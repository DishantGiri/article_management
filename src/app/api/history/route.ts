/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(session.user.id) },
      select: { role: true },
    });

    if (
      user?.role !== "SUPER_ADMIN" &&
      user?.role !== "ADMIN" &&
      user?.role !== "LINKER" &&
      user?.role !== "TEAM_LEAD"
    ) {
      return NextResponse.json({ error: "Forbidden: Access denied" }, { status: 403 });
    }

    const [articleHistories, linkHistories] = await Promise.all([
      prisma.articleHistory.findMany({
        include: {
          updatedBy: { select: { id: true, name: true, role: true, email: true } },
          article: {
            include: {
              writer: { select: { id: true, name: true, role: true, email: true } },
              product: {
                select: { id: true, name: true, site: { select: { name: true } } },
              },
              reviews: {
                include: { reviewedBy: { select: { id: true, name: true, role: true, email: true } } },
                orderBy: { reviewedAt: "desc" },
              },
              specialApproval: {
                include: { approvedBy: { select: { id: true, name: true, role: true, email: true } } },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.linkHistory.findMany({
        include: {
          updatedBy: { select: { id: true, name: true, role: true, email: true } },
          linkLog: {
            include: {
              addedBy: { select: { id: true, name: true, role: true, email: true } },
              product: {
                select: { id: true, name: true, site: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const formattedArticles = articleHistories.map((h) => {
      let actionType = "ARTICLE_UPDATE";
      let actionLabel = "Article Modified";
      let suggestion: string | null = null;

      // Identify TL Suggestion / Redo
      if (h.newStatus === "REDO") {
        actionType = "TL_SUGGESTION";
        actionLabel = "TL Suggestion (Redo)";
        if (h.notes?.includes("Feedback:")) {
          suggestion = h.notes.split("Feedback:")[1]?.trim() || null;
        } else {
          // Look in reviews for matching review around updatedAt or latest unapproved review
          const matchingReview =
            h.article?.reviews?.find(
              (r) => !r.approved && Math.abs(new Date(r.reviewedAt).getTime() - new Date(h.updatedAt).getTime()) < 60000
            ) || h.article?.reviews?.find((r) => !r.approved);
          suggestion = matchingReview?.suggestion || null;
        }
      } else if (h.newStatus === "APPROVED") {
        actionType = "ARTICLE_APPROVAL";
        actionLabel = "Article Approved";
        if (h.notes?.includes("Feedback:")) {
          suggestion = h.notes.split("Feedback:")[1]?.trim() || null;
        }
      } else if (h.oldStatus === "REDO" && h.newStatus === "COMPLETED") {
        actionType = "REVISION_SUBMITTED";
        actionLabel = "Revision Resubmitted";
      } else if (h.oldStatus === "IN_PROGRESS" && h.newStatus === "COMPLETED") {
        actionType = "ARTICLE_COMPLETED";
        actionLabel = "Article Submitted";
      } else if (h.oldStatus === "PENDING" && h.newStatus === "IN_PROGRESS") {
        actionType = "WRITING_STARTED";
        actionLabel = "Started Writing";
      } else if (h.oldLink !== h.newLink && h.newLink) {
        actionType = "LINK_UPDATED";
        actionLabel = "Doc Link Updated";
      }

      // Determine approvedBy
      let approvedBy: any = null;
      if (h.newStatus === "APPROVED") {
        approvedBy = h.updatedBy;
      } else {
        const approvedReview = h.article?.reviews?.find((r) => r.approved);
        if (approvedReview) {
          approvedBy = approvedReview.reviewedBy;
        } else if (h.article?.specialApproval?.approvedBy) {
          approvedBy = h.article.specialApproval.approvedBy;
        }
      }

      return {
        id: `art-${h.id}`,
        type: "ARTICLE",
        actionType,
        actionLabel,
        updatedById: h.updatedById,
        updatedBy: h.updatedBy,
        writtenBy: h.article?.writer || null,
        approvedBy: approvedBy,
        productName: h.article?.product?.name || "Unknown Product",
        siteName: h.article?.product?.site?.name || "Unknown Site",
        oldStatus: h.oldStatus,
        newStatus: h.newStatus,
        oldLink: h.oldLink,
        newLink: h.newLink,
        notes: h.notes,
        suggestion,
        updatedAt: h.updatedAt.toISOString(),
      };
    });

    const formattedLinks = linkHistories.map((h) => {
      const oldL = h.oldBridgeLink || h.oldBuyLink || h.oldAffiliateLink;
      const newL = h.newBridgeLink || h.newBuyLink || h.newAffiliateLink;
      const noteDetails =
        h.newRemarks ||
        (h.oldStatus && h.newStatus
          ? `Status changed from ${h.oldStatus} to ${h.newStatus}`
          : "Link log updated");

      return {
        id: `link-${h.id}`,
        type: "LINK",
        actionType: "LINK_LOG",
        actionLabel: "Link Log Update",
        updatedById: h.updatedById,
        updatedBy: h.updatedBy,
        writtenBy: h.linkLog?.addedBy || null,
        approvedBy: null,
        productName: h.linkLog?.product?.name || "Unknown Product",
        siteName: h.linkLog?.product?.site?.name || "Unknown Site",
        oldStatus: h.oldStatus,
        newStatus: h.newStatus,
        oldLink: oldL,
        newLink: newL,
        notes: noteDetails,
        suggestion: null,
        updatedAt: h.updatedAt.toISOString(),
      };
    });

    const combined = [...formattedArticles, ...formattedLinks].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return NextResponse.json(combined);
  } catch (err: any) {
    console.error("[GET /api/history]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
