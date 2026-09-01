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
      writer: { select: { id: true, name: true, email: true, image: true, teamLeadId: true } },
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

  // Authorize check: WRITER is restricted by SiteAccess; TEAM_LEAD can only view team articles or pending pool
  const userId = Number(session.user.id);
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
  } else if (userRole === "TEAM_LEAD") {
    const isUnderTL =
      article.status === "PENDING" ||
      article.writerId === userId ||
      article.writer?.teamLeadId === userId;
    if (!isUnderTL) {
      return NextResponse.json({ error: "Access denied: This article is not under your team." }, { status: 403 });
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
    const { status, articleLink, writerId, priority, specialApprovalRequested, specialApprovalRequestReason, notes, redoStarted, suggestion } = body;

    const activeUserId = Number(session.user.id);
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

    // Prevent writer from editing someone else's active article (allow if PENDING so writer can pick it up)
    if (activeUserRole === "WRITER" && existing.writerId && existing.writerId !== activeUserId && existing.status !== "PENDING") {
      return NextResponse.json({ error: "This article is already in progress or assigned to another writer." }, { status: 403 });
    }

    // Prevent team lead from modifying an article that is assigned to a writer outside their team
    if (activeUserRole === "TEAM_LEAD" && existing.writerId && existing.writerId !== activeUserId && existing.status !== "PENDING") {
      const writer = await prisma.user.findUnique({
        where: { id: existing.writerId },
        select: { teamLeadId: true },
      });
      if (writer?.teamLeadId && writer.teamLeadId !== activeUserId) {
        return NextResponse.json({ error: "Access denied: This writer is not assigned to your team." }, { status: 403 });
      }
    }

    // Approval / Redo status change check: only TEAM_LEAD, ADMIN, or SUPER_ADMIN
    if ((status === "APPROVED" || status === "REDO") && !["TEAM_LEAD", "ADMIN", "SUPER_ADMIN"].includes(activeUserRole)) {
      return NextResponse.json({ error: "Only Team Leads and Admins can approve or request changes for articles." }, { status: 403 });
    }

    if ((status === "APPROVED" || status === "REDO") && existing.status === "REDO" && !redoStarted) {
      return NextResponse.json(
        { error: "A revision has already been requested. Please wait for the writer to fix the problem and resubmit before sending another command." },
        { status: 400 }
      );
    }

    if ((status === "APPROVED" || status === "REDO") && existing.status === "PENDING") {
      return NextResponse.json(
        { error: "Cannot review an article that is still pending and has not been written yet." },
        { status: 400 }
      );
    }

    if ((status === "APPROVED" || status === "REDO") && existing.status === "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Cannot review an article while the writer is actively working on it. Wait for completion." },
        { status: 400 }
      );
    }

    // Priority change check: only TEAM_LEAD, ADMIN, or SUPER_ADMIN
    if (priority !== undefined) {
      if (!["TEAM_LEAD", "ADMIN", "SUPER_ADMIN"].includes(activeUserRole)) {
        return NextResponse.json({ error: "Only Team Leads and Admins can change article priority." }, { status: 403 });
      }
    }

    // Business rules for starting an article
    if (status === "IN_PROGRESS" && writerId) {
      if (!["WRITER", "TEAM_LEAD", "ADMIN", "SUPER_ADMIN"].includes(activeUserRole)) {
        return NextResponse.json(
          { error: "You do not have permission to write articles." },
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

      // Check if this product or another product with the same name was already started or completed
      const currentProductName = existing.product?.name?.trim();
      if (currentProductName) {
        const otherArticles = await prisma.article.findMany({
          where: {
            id: { not: id },
            product: {
              name: currentProductName,
            },
            status: { in: ["IN_PROGRESS", "COMPLETED", "APPROVED"] },
          },
          include: {
            writer: { select: { name: true } },
            product: {
              include: {
                addedBy: { select: { name: true } },
              },
            },
          },
        });

        const duplicateArticle = otherArticles.find(
          (a) => a.product?.name?.trim().toLowerCase() === currentProductName.toLowerCase()
        );

        if (duplicateArticle) {
          const addedByName = duplicateArticle.product?.addedBy?.name;
          const writerName = duplicateArticle.writer?.name;

          let errorMsg = "";
          if (addedByName && writerName && addedByName !== writerName) {
            errorMsg = `This product has been already added by ${addedByName} or writer ${writerName}.`;
          } else if (writerName) {
            errorMsg = `This product has been already added by writer ${writerName}.`;
          } else {
            errorMsg = `This product has been already added by ${addedByName || "another user"}.`;
          }

          return NextResponse.json({ error: errorMsg }, { status: 400 });
        }
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
        ...(status === "REDO" ? { startedAt: null, specialApprovalRequested: false, specialApprovalRequestReason: null } : {}),
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
      const baseUrl = (process.env.NEXTAUTH_URL || process.env.SITE_URL || process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || "3022"}`).replace(/\/$/, "");
      const secret = process.env.NEXTAUTH_SECRET;
      fetch(`${baseUrl}/notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${secret}`
        },
        body: JSON.stringify({
          broadcast: true,
          type: "ARTICLE_STATUS_UPDATED",
          silent: true, // Silent state sync for table rows & dashboard counters; no alert/sound for other writers
          id: updated.id,
          createdAt: new Date().toISOString(),
          data: updated,
        }),
      }).catch((e) => console.error("WS Notification failed", e));
    } catch (e) {}

    // If status is changed to REDO or APPROVED by TL/Admin, record an ArticleReview entry
    if (status === "REDO" || (status === "APPROVED" && ["TEAM_LEAD", "ADMIN", "SUPER_ADMIN"].includes(activeUserRole))) {
      try {
        await prisma.articleReview.create({
          data: {
            articleId: id,
            reviewedById: activeUserId,
            suggestion: suggestion || notes || null,
            approved: status === "APPROVED",
          },
        });
      } catch (revErr) {
        console.error("Failed to create ArticleReview entry in PATCH:", revErr);
      }
    }

    // If article is marked as REDO / Changes requested, dispatch notification specifically to the writer
    if (status === "REDO") {
      try {
        const writerIdToNotify = updated.writerId || existing.writerId;
        if (writerIdToNotify && writerIdToNotify !== activeUserId) {
          const reviewer = await prisma.user.findUnique({
            where: { id: activeUserId },
            select: { name: true },
          });
          const reviewerName = reviewer?.name || session.user.name || "Team Lead";
          const feedbackRemark = suggestion || notes || "No specific remark provided. Please review and revise the article.";
          const notifMessage = `Changes requested on your article for "${updated.product.name}" by Team Lead ${reviewerName}. Remark: ${feedbackRemark}`;

          const notif = await prisma.notification.create({
            data: {
              recipientId: writerIdToNotify,
              senderId: activeUserId,
              type: "ARTICLE_SUGGESTION",
              message: notifMessage,
            },
          });
          await sendRealtimeNotification(writerIdToNotify, notif);
        }
      } catch (notifErr) {
        console.error("Failed to notify writer on REDO:", notifErr);
      }
    }

    // If article is APPROVED by Team Lead or Admin, notify the writer
    if (status === "APPROVED") {
      try {
        const writerIdToNotify = updated.writerId || existing.writerId;
        if (writerIdToNotify && writerIdToNotify !== activeUserId) {
          const reviewer = await prisma.user.findUnique({
            where: { id: activeUserId },
            select: { name: true },
          });
          const reviewerName = reviewer?.name || session.user.name || "Team Lead";
          const notifMessage = `Your article for "${updated.product.name}" was APPROVED by Team Lead ${reviewerName}.`;

          const notif = await prisma.notification.create({
            data: {
              recipientId: writerIdToNotify,
              senderId: activeUserId,
              type: "ARTICLE_SUGGESTION",
              message: notifMessage,
            },
          });
          await sendRealtimeNotification(writerIdToNotify, notif);
        }
      } catch (notifErr) {
        console.error("Failed to notify writer on APPROVED:", notifErr);
      }
    }

    // Notify Admins and Super Admins if Special Approval / Article Update Approval is requested
    if (specialApprovalRequested && !existing.specialApprovalRequested) {
      try {
        const admins = await prisma.user.findMany({
          where: { role: { in: ["ADMIN", "SUPER_ADMIN", "TEAM_LEAD"] } },
          select: { id: true },
        });
        const writerName = updated.writer?.name || session.user.name || "A writer";
        const reasonText = specialApprovalRequestReason || "No reason provided";
        for (const admin of admins) {
          const notif = await prisma.notification.create({
            data: {
              recipientId: admin.id,
              senderId: activeUserId,
              type: "ARTICLE_SUGGESTION",
              message: `${writerName} requested article update approval for "${updated.product.name}". Reason: ${reasonText}`,
            },
          });
          await sendRealtimeNotification(admin.id, notif);
        }
      } catch (notifErr) {
        console.error("Failed to notify Admins for approval request:", notifErr);
      }
    }

    // Notify Team Lead if Writer started the article (ONLY sent to Team Lead)
    const isStartingArticle =
      (status === "IN_PROGRESS" && existing.status !== "IN_PROGRESS") ||
      (redoStarted && existing.status === "REDO" && !existing.startedAt);

    if (isStartingArticle) {
      try {
        const writerIdToQuery = updated.writerId || existing.writerId || activeUserId;
        if (writerIdToQuery) {
          const writerUser = await prisma.user.findUnique({
            where: { id: writerIdToQuery },
            select: { name: true, teamLeadId: true },
          });
          const writerName = writerUser?.name || updated.writer?.name || session.user.name || "A writer";

          if (writerUser?.teamLeadId) {
            if (writerUser.teamLeadId !== activeUserId) {
              const notif = await prisma.notification.create({
                data: {
                  recipientId: writerUser.teamLeadId,
                  senderId: writerIdToQuery,
                  type: "ARTICLE_SUGGESTION",
                  message: `${writerName} started writing the article for "${updated.product.name}".`,
                },
              });
              await sendRealtimeNotification(writerUser.teamLeadId, notif);
            }
          } else {
            // Fallback: If writer has no specific team lead assigned, notify all Team Leads
            const teamLeads = await prisma.user.findMany({
              where: { role: "TEAM_LEAD" },
              select: { id: true },
            });
            for (const tl of teamLeads) {
              if (tl.id !== activeUserId) {
                const notif = await prisma.notification.create({
                  data: {
                    recipientId: tl.id,
                    senderId: writerIdToQuery,
                    type: "ARTICLE_SUGGESTION",
                    message: `${writerName} started writing the article for "${updated.product.name}".`,
                  },
                });
                await sendRealtimeNotification(tl.id, notif);
              }
            }
          }
        }
      } catch (notifErr) {
        console.error("Failed to notify Team Lead on article start:", notifErr);
      }
    }

    // Notify Team Lead if Writer requested permission to update an approved/old article
    if (specialApprovalRequested === true && !existing.specialApprovalRequested) {
      try {
        const writerIdToQuery = updated.writerId || existing.writerId || activeUserId;
        if (writerIdToQuery) {
          const writerUser = await prisma.user.findUnique({
            where: { id: writerIdToQuery },
            select: { name: true, teamLeadId: true },
          });
          const writerName = writerUser?.name || updated.writer?.name || session.user.name || "A writer";
          const reasonText = specialApprovalRequestReason || "Requested edit permission on approved article";

          const notifPayload = {
            senderId: writerIdToQuery,
            type: "ARTICLE_SUGGESTION" as const,
            message: `Update Request: Writer ${writerName} requested permission to edit approved article "${updated.product.name}". Reason: ${reasonText}`,
          };

          if (writerUser?.teamLeadId) {
            if (writerUser.teamLeadId !== activeUserId) {
              const notif = await prisma.notification.create({
                data: {
                  recipientId: writerUser.teamLeadId,
                  ...notifPayload,
                },
              });
              await sendRealtimeNotification(writerUser.teamLeadId, notif);
            }
          } else {
            const teamLeads = await prisma.user.findMany({
              where: { role: "TEAM_LEAD" },
              select: { id: true },
            });
            for (const tl of teamLeads) {
              if (tl.id !== activeUserId) {
                const notif = await prisma.notification.create({
                  data: {
                    recipientId: tl.id,
                    ...notifPayload,
                  },
                });
                await sendRealtimeNotification(tl.id, notif);
              }
            }
          }
        }
      } catch (notifErr) {
        console.error("Failed to notify Team Lead on update request:", notifErr);
      }
    }

    // Notify Team Lead if Writer completed the article (ONLY sent to Team Lead)
    if (status === "COMPLETED" && existing.status !== "COMPLETED") {
      try {
        const writerIdToQuery = updated.writerId || existing.writerId || activeUserId;
        if (writerIdToQuery) {
          const writerUser = await prisma.user.findUnique({
            where: { id: writerIdToQuery },
            select: { name: true, teamLeadId: true },
          });
          const writerName = writerUser?.name || updated.writer?.name || session.user.name || "A writer";

          if (writerUser?.teamLeadId) {
            if (writerUser.teamLeadId !== activeUserId) {
              const notif = await prisma.notification.create({
                data: {
                  recipientId: writerUser.teamLeadId,
                  senderId: writerIdToQuery,
                  type: "ARTICLE_SUGGESTION",
                  message: `${writerName} completed the article for "${updated.product.name}". Please review it.`,
                },
              });
              await sendRealtimeNotification(writerUser.teamLeadId, notif);
            }
          } else {
            // Fallback: If writer has no specific team lead assigned, notify all Team Leads
            const teamLeads = await prisma.user.findMany({
              where: { role: "TEAM_LEAD" },
              select: { id: true },
            });
            for (const tl of teamLeads) {
              if (tl.id !== activeUserId) {
                const notif = await prisma.notification.create({
                  data: {
                    recipientId: tl.id,
                    senderId: writerIdToQuery,
                    type: "ARTICLE_SUGGESTION",
                    message: `${writerName} completed the article for "${updated.product.name}". Please review it.`,
                  },
                });
                await sendRealtimeNotification(tl.id, notif);
              }
            }
          }
        }
      } catch (notifErr) {
        console.error("Failed to notify Team Lead on article completion:", notifErr);
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
      if (status === "REDO" && suggestion) {
        changeNotes.push(`Feedback: ${suggestion}`);
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