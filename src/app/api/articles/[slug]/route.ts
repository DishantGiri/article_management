import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import moment from "moment";
import { sendRealtimeNotification } from "@/lib/notifier";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// GET /api/articles/[slug]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug: rawSlug } = await params;
  const id = parseInt(rawSlug.split("-")[0]);

  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      product: {
        include: {
          site: true,
          category: true,
          addedBy: { select: { name: true } },
          linkLogs: {
            include: { geos: true, addedBy: { select: { name: true } } },
            orderBy: { addedAt: "desc" },
          },
        },
      },
      writer: { select: { id: true, name: true, teamLeadId: true } },
      reviews: {
        include: { reviewedBy: { select: { id: true, name: true } } },
        orderBy: { reviewedAt: "desc" },
      },
      specialApproval: {
        include: { approvedBy: { select: { name: true } } },
      },
      history: {
        include: { updatedBy: { select: { id: true, name: true } } },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  // Authorize check: only WRITER is restricted by SiteAccess
  const userId = session.user.id;
  const userRole = session.user.role;

  if (userRole === "WRITER") {
    const access = await prisma.siteAccess.findUnique({
      where: {
        userId_siteId: {
          userId,
          siteId: article.product.siteId,
        },
      },
    });
    if (!access) {
      return NextResponse.json({ error: "You are not assigned to this site" }, { status: 403 });
    }
  }

  return NextResponse.json(article);
}

// PATCH /api/articles/[slug] — update status, writer, article link, priority, special approval request
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug: rawSlug } = await params;
    const id = parseInt(rawSlug.split("-")[0]);
    const body = await req.json();
    const { status, articleLink, writerId, priority, specialApprovalRequested, specialApprovalRequestReason, notes, redoStarted } = body;

    const activeUserId = session.user.id;
    const activeUserRole = session.user.role || "";

    const existing = await prisma.article.findUnique({
      where: { id },
      include: { product: true }
    });
    if (!existing) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Site access check: only WRITER is restricted by SiteAccess
    if (activeUserRole === "WRITER") {
      const access = await prisma.siteAccess.findUnique({
        where: {
          userId_siteId: {
            userId: activeUserId,
            siteId: existing.product.siteId,
          },
        },
      });
      if (!access) {
        return NextResponse.json({ error: "You are not assigned to this site" }, { status: 403 });
      }
    }

    // Prevent writer/team lead from editing someone else's article (unless the caller is the writer's team lead)
    if ((activeUserRole === "WRITER" || activeUserRole === "TEAM_LEAD") && existing.writerId && existing.writerId !== activeUserId) {
      const writer = await prisma.user.findUnique({
        where: { id: existing.writerId },
        select: { teamLeadId: true },
      });
      const isCallerTeamLead = writer && writer.teamLeadId === activeUserId;
      if (activeUserRole === "WRITER" || !isCallerTeamLead) {
        return NextResponse.json({ error: "This article is already in progress or completed by another writer." }, { status: 403 });
      }
    }

    // Priority change check: only TEAM_LEAD, ADMIN, or SUPER_ADMIN
    if (priority !== undefined) {
      if (activeUserRole !== "TEAM_LEAD" && activeUserRole !== "ADMIN" && activeUserRole !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Only Team Leads and Admins can change article priority." }, { status: 403 });
      }
    }

    // Business rules
    if (status === "IN_PROGRESS" && writerId) {
      if (activeUserRole !== "WRITER" && activeUserRole !== "TEAM_LEAD") {
        return NextResponse.json(
          { error: "Only Writers and Team Leads can write articles." },
          { status: 403 }
        );
      }
      // Check writer doesn't already have an in-progress article
      const inProgress = await prisma.article.findFirst({
        where: { writerId: parseInt(writerId), status: "IN_PROGRESS", id: { not: id } },
      });
      if (inProgress) {
        return NextResponse.json(
          { error: "You already have an article In Progress. Complete it before starting another." },
          { status: 400 }
        );
      }
    }

    if (status === "COMPLETED" && !articleLink && !existing.articleLink) {
      // Check if special approval exists
      const approval = await prisma.specialApproval.findUnique({ where: { articleId: id } });
      if (!approval) {
        return NextResponse.json(
          { error: "Article Link is required to mark as Completed, or request Team Lead approval." },
          { status: 400 }
        );
      }
    }

    // Calculate writing time if completing
    let writingTimeMin: number | undefined;
    let updateTimeMin: number | undefined;
    let completedAt: Date | undefined;
    let productCreatedAt: Date | undefined;

    if (status === "COMPLETED" && existing.startedAt) {
      completedAt = new Date();
      const elapsedMin = Math.round((completedAt.getTime() - existing.startedAt.getTime()) / 60000);
      if (existing.status === "REDO") {
        updateTimeMin = (existing.updateTimeMin || 0) + elapsedMin;
      } else {
        writingTimeMin = elapsedMin;
      }
      productCreatedAt = completedAt;
    }

    const updated = await prisma.article.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(writerId ? { writerId: parseInt(writerId) } : {}),
        ...(articleLink !== undefined ? { articleLink } : {}),
        ...(priority !== undefined ? { priority: priority as "LOW" | "MEDIUM" | "HIGH" } : {}),
        ...(specialApprovalRequested !== undefined ? { specialApprovalRequested } : {}),
        ...(specialApprovalRequestReason !== undefined ? { specialApprovalRequestReason } : {}),
        ...(status === "COMPLETED" ? { specialApprovalRequested: false, specialApprovalRequestReason: null } : {}),
        ...(status === "IN_PROGRESS" && !existing.startedAt ? { startedAt: new Date() } : {}),
        ...(status === "REDO" ? { startedAt: null } : {}),
        ...(redoStarted && existing.status === "REDO" && !existing.startedAt ? { startedAt: new Date() } : {}),
        ...(completedAt ? { completedAt } : {}),
        ...(writingTimeMin !== undefined ? { writingTimeMin } : {}),
        ...(updateTimeMin !== undefined ? { updateTimeMin } : {}),
        ...(productCreatedAt ? { productCreatedAt } : {}),
      },
      include: {
        product: {
          include: {
            site: true,
            category: true,
            addedBy: { select: { name: true } },
            linkLogs: {
              include: { geos: true, addedBy: { select: { name: true } } },
              orderBy: { addedAt: "desc" },
            },
          },
        },
        writer: { select: { id: true, name: true } },
        reviews: {
          include: { reviewedBy: { select: { id: true, name: true } } },
          orderBy: { reviewedAt: "desc" },
        },
        specialApproval: {
          include: { approvedBy: { select: { name: true } } },
        },
      },
    });

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
          message: `Article for ${updated.product.name} is now ${updated.status}`,
          id: updated.id,
          createdAt: new Date().toISOString(),
          data: updated,
        }),
      }).catch((e) => console.error("WS Notification failed", e));
    } catch (e) {}

    // Notify Team Lead if Writer completed the article
    if (status === "COMPLETED" && existing.status !== "COMPLETED") {
      try {
        const writerIdToQuery = updated.writerId || existing.writerId;
        if (writerIdToQuery) {
          const writerUser = await prisma.user.findUnique({
            where: { id: writerIdToQuery },
            select: { teamLeadId: true },
          });
          if (writerUser?.teamLeadId) {
            const notif = await prisma.notification.create({
              data: {
                recipientId: writerUser.teamLeadId,
                senderId: writerIdToQuery,
                type: "ARTICLE_SUGGESTION",
                message: `${updated.writer?.name || "A writer"} completed the article for "${updated.product.name}". Please review it.`,
              },
            });
            await sendRealtimeNotification(writerUser.teamLeadId, notif);
          }
        }
      } catch (notifErr) {
        console.error("Failed to notify Team Lead:", notifErr);
      }
    }

    // Record to Article History
    try {
      const changeNotes: string[] = [];
      if (existing.status !== updated.status) {
        changeNotes.push(`Status changed from ${existing.status} to ${updated.status}`);
      }
      if (existing.articleLink !== updated.articleLink) {
        changeNotes.push(`Article Link updated to ${updated.articleLink || "none"}`);
      }
      if (existing.writerId !== updated.writerId) {
        const newWriterName = updated.writer?.name || "none";
        changeNotes.push(`Writer changed to ${newWriterName}`);
      }
      if (existing.priority !== updated.priority) {
        changeNotes.push(`Priority changed from ${existing.priority} to ${updated.priority}`);
      }
      if (existing.specialApprovalRequested !== updated.specialApprovalRequested) {
        changeNotes.push(updated.specialApprovalRequested ? "Requested special approval" : "Cleared special approval request");
      }

      if (changeNotes.length > 0 || notes) {
        const finalNotes = notes
          ? `${changeNotes.join(", ")}${changeNotes.length > 0 ? ". " : ""}Writer remarks: ${notes}`
          : changeNotes.join(", ");

        await prisma.articleHistory.create({
          data: {
            articleId: updated.id,
            updatedById: Number(activeUserId),
            oldStatus: existing.status,
            newStatus: updated.status,
            oldLink: existing.articleLink,
            newLink: updated.articleLink,
            notes: finalNotes,
          },
        });
      }
    } catch (historyErr) {
      console.error("Failed to write article history:", historyErr);
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/articles/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
