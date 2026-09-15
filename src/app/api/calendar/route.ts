import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import moment from "moment";

const NPT_OFFSET = "+05:45";

/**
 * Returns a moment instance converted to Nepal Time (NPT, UTC+5:45)
 */
function toNpt(date?: Date | string | number | moment.Moment) {
  if (!date) return moment().utcOffset(NPT_OFFSET);
  return moment(date).utcOffset(NPT_OFFSET);
}

/**
 * Parse a YYYY-MM month string in NPT context
 */
function parseNptMonth(monthStr?: string | null) {
  if (monthStr && moment(monthStr, "YYYY-MM", true).isValid()) {
    return moment(monthStr, "YYYY-MM").utcOffset(NPT_OFFSET, true);
  }
  return toNpt().startOf("month");
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionUserId = Number(session.user.id);
    const sessionUserRole = session.user.role;

    const { searchParams } = new URL(req.url);
    const queryUserId = searchParams.get("userId");
    const monthParam = searchParams.get("month"); // e.g. "2026-09" or "2026-08"

    // Default target user is session user
    const targetUserId = queryUserId ? parseInt(queryUserId) : sessionUserId;

    // Fetch target user info
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        teamLeadId: true,
        createdAt: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Role-based Access Control:
    // SUPER_ADMIN: can view anyone
    // ADMIN: can view anyone EXCEPT SUPER_ADMIN (unless viewing self)
    // TEAM_LEAD: can view themselves and their assigned team members
    // WRITER / LINKER: can only view themselves
    if (sessionUserRole === "ADMIN") {
      if (targetUser.role === "SUPER_ADMIN" && targetUserId !== sessionUserId) {
        return NextResponse.json(
          { error: "Access Denied: Admins cannot view Super Admin work calendars." },
          { status: 403 }
        );
      }
    } else if (sessionUserRole === "TEAM_LEAD") {
      const isSelf = targetUserId === sessionUserId;
      const isTeamMember = targetUser.teamLeadId === sessionUserId;
      if (!isSelf && !isTeamMember) {
        return NextResponse.json(
          { error: "Access Denied: You can only view calendars for your team members and yourself." },
          { status: 403 }
        );
      }
    } else if (sessionUserRole !== "SUPER_ADMIN") {
      // WRITER, LINKER, or other
      if (targetUserId !== sessionUserId) {
        return NextResponse.json(
          { error: "Access Denied: You can only view your own work calendar." },
          { status: 403 }
        );
      }
    }

    // Fetch list of users that the current session user is permitted to select
    let selectableUsers: Array<{ id: number; name: string; email: string; role: string | null }> = [];
    if (sessionUserRole === "SUPER_ADMIN") {
      selectableUsers = await prisma.user.findMany({
        where: { approved: true },
        select: { id: true, name: true, email: true, role: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      });
    } else if (sessionUserRole === "ADMIN") {
      selectableUsers = await prisma.user.findMany({
        where: {
          approved: true,
          role: { not: "SUPER_ADMIN" },
        },
        select: { id: true, name: true, email: true, role: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      });
    } else if (sessionUserRole === "TEAM_LEAD") {
      selectableUsers = await prisma.user.findMany({
        where: {
          approved: true,
          OR: [
            { id: sessionUserId },
            { teamLeadId: sessionUserId },
          ],
        },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      });
    } else {
      selectableUsers = [
        {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
        },
      ];
    }

    // Determine target month boundaries in NPT (Nepal Time, UTC+5:45)
    const nowNpt = toNpt();
    const currentMoment = parseNptMonth(monthParam);

    const startOfMonth = currentMoment.clone().startOf("month").toDate();
    const endOfMonth = currentMoment.clone().endOf("month").toDate();

    // Query all relevant work activities for targetUserId within the month
    const [
      articleHistories,
      articlesCompleted,
      articlesStarted,
      linkHistories,
      linksAdded,
      productsAdded,
      reviewsDone,
    ] = await Promise.all([
      // 1. Article status/link updates made by this user
      prisma.articleHistory.findMany({
        where: {
          updatedById: targetUserId,
          updatedAt: { gte: startOfMonth, lte: endOfMonth },
        },
        include: {
          article: {
            include: {
              product: {
                select: { id: true, name: true, site: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),

      // 2. Articles completed by this writer in this month
      prisma.article.findMany({
        where: {
          writerId: targetUserId,
          completedAt: { gte: startOfMonth, lte: endOfMonth },
        },
        include: {
          product: {
            select: { id: true, name: true, site: { select: { name: true } }, category: { select: { name: true } } },
          },
        },
        orderBy: { completedAt: "desc" },
      }),

      // 3. Articles started by this writer in this month
      prisma.article.findMany({
        where: {
          writerId: targetUserId,
          startedAt: { gte: startOfMonth, lte: endOfMonth },
        },
        include: {
          product: {
            select: { id: true, name: true, site: { select: { name: true } }, category: { select: { name: true } } },
          },
        },
        orderBy: { startedAt: "desc" },
      }),

      // 4. Link changes made by this user
      prisma.linkHistory.findMany({
        where: {
          updatedById: targetUserId,
          updatedAt: { gte: startOfMonth, lte: endOfMonth },
        },
        include: {
          linkLog: {
            include: {
              product: {
                select: { id: true, name: true, site: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),

      // 5. Links added by this linker
      prisma.linkLog.findMany({
        where: {
          addedById: targetUserId,
          addedAt: { gte: startOfMonth, lte: endOfMonth },
        },
        include: {
          product: {
            select: { id: true, name: true, site: { select: { name: true } } },
          },
        },
        orderBy: { addedAt: "desc" },
      }),

      // 6. Products added by this user
      prisma.product.findMany({
        where: {
          addedById: targetUserId,
          addedAt: { gte: startOfMonth, lte: endOfMonth },
        },
        include: {
          site: { select: { name: true } },
          category: { select: { name: true } },
        },
        orderBy: { addedAt: "desc" },
      }),

      // 7. Reviews done by this user (e.g. if Team Lead / Admin)
      prisma.articleReview.findMany({
        where: {
          reviewedById: targetUserId,
          reviewedAt: { gte: startOfMonth, lte: endOfMonth },
        },
        include: {
          article: {
            include: {
              product: {
                select: { id: true, name: true, site: { select: { name: true } } },
              },
              writer: { select: { name: true } },
            },
          },
        },
        orderBy: { reviewedAt: "desc" },
      }),
    ]);

    // Group activities by date string "YYYY-MM-DD" in NPT
    interface ActivityItem {
      id: string;
      time: string;
      category: "ARTICLE" | "LINK" | "PRODUCT" | "REVIEW";
      badge: string;
      title: string;
      subtitle: string;
      details?: string | null;
      status?: string | null;
      link?: string | null;
      durationMin?: number | null;
      rawTimestamp?: string;
    }

    const dailyActivities: Record<string, ActivityItem[]> = {};

    const addActivity = (dateObj: Date, item: ActivityItem) => {
      const dateKey = toNpt(dateObj).format("YYYY-MM-DD");
      if (!dailyActivities[dateKey]) {
        dailyActivities[dateKey] = [];
      }
      dailyActivities[dateKey].push(item);
    };

    // Process Completed Articles
    articlesCompleted.forEach((art) => {
      if (!art.completedAt) return;
      addActivity(art.completedAt, {
        id: `completed-${art.id}`,
        time: toNpt(art.completedAt).format("hh:mm A"),
        category: "ARTICLE",
        badge: "Article Completed",
        title: art.product.name,
        subtitle: `Site: ${art.product.site.name} • ${art.product.category.name}`,
        details: `Article finalized with status ${art.status}.`,
        status: art.status,
        link: art.articleLink,
        durationMin: art.writingTimeMin,
        rawTimestamp: art.completedAt.toISOString(),
      });
    });

    // Process Started Articles (only if distinct from completed timestamp on the same day in NPT)
    articlesStarted.forEach((art) => {
      if (!art.startedAt) return;
      const startedDay = toNpt(art.startedAt).format("YYYY-MM-DD");
      const completedDay = art.completedAt ? toNpt(art.completedAt).format("YYYY-MM-DD") : null;
      if (startedDay !== completedDay || !art.completedAt) {
        addActivity(art.startedAt, {
          id: `started-${art.id}`,
          time: toNpt(art.startedAt).format("hh:mm A"),
          category: "ARTICLE",
          badge: "Article Started",
          title: art.product.name,
          subtitle: `Site: ${art.product.site.name} • ${art.product.category.name}`,
          details: `Writing timer initiated. Current status: ${art.status}.`,
          status: art.status,
          rawTimestamp: art.startedAt.toISOString(),
        });
      }
    });

    // Target user role title helper
    const targetRoleTitle = targetUser.role === "SUPER_ADMIN"
      ? "Super Admin"
      : targetUser.role === "ADMIN"
        ? "Admin"
        : targetUser.role === "TEAM_LEAD"
          ? "Team Lead"
          : (targetUser.role || "User").replace("_", " ");

    const sanitizeActivityDetails = (text?: string | null): string | null => {
      if (!text) return null;
      if (targetUser.role === "ADMIN" || targetUser.role === "SUPER_ADMIN") {
        let result = text;
        if (targetUser.name) {
          const escaped = targetUser.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          result = result.replace(new RegExp(`Team Lead\\s+${escaped}`, "gi"), `${targetRoleTitle} ${targetUser.name}`);
        }
        result = result.replace(/\bFlagged for update by Team Lead\b/gi, `Flagged for update by ${targetRoleTitle}`);
        result = result.replace(/\bUpdate request (approved|rejected) by Team Lead\b/gi, `Update request $1 by ${targetRoleTitle}`);
        result = result.replace(/\bby Team Lead\b/gi, `by ${targetRoleTitle}`);
        return result;
      }
      return text;
    };

    // Process Article History / Revisions
    articleHistories.forEach((hist) => {
      const rawDetails = hist.notes || (hist.oldStatus && hist.newStatus ? `Status: ${hist.oldStatus} → ${hist.newStatus}` : "Updated article record");
      addActivity(hist.updatedAt, {
        id: `arthist-${hist.id}`,
        time: toNpt(hist.updatedAt).format("hh:mm A"),
        category: "ARTICLE",
        badge: hist.newStatus === "REDO" ? "Revision Required" : "Article Updated",
        title: hist.article.product.name,
        subtitle: `Site: ${hist.article.product.site.name}`,
        details: sanitizeActivityDetails(rawDetails),
        status: hist.newStatus,
        link: hist.newLink,
        rawTimestamp: hist.updatedAt.toISOString(),
      });
    });

    // Process Links Added
    linksAdded.forEach((link) => {
      addActivity(link.addedAt, {
        id: `linkadd-${link.id}`,
        time: toNpt(link.addedAt).format("hh:mm A"),
        category: "LINK",
        badge: "Link Added",
        title: `${link.affiliateName} Link`,
        subtitle: `Product: ${link.product.name} • Status: ${link.status}`,
        details: link.linkerRemarks || `Affiliate link recorded for ${link.product.name}`,
        status: link.status,
        link: link.affiliateLink || link.buyLink,
        rawTimestamp: link.addedAt.toISOString(),
      });
    });

    // Process Link Histories
    linkHistories.forEach((hist) => {
      addActivity(hist.updatedAt, {
        id: `linkhist-${hist.id}`,
        time: toNpt(hist.updatedAt).format("hh:mm A"),
        category: "LINK",
        badge: "Link Modified",
        title: `${hist.linkLog.affiliateName} Link Update`,
        subtitle: `Product: ${hist.linkLog.product.name}`,
        details: hist.newRemarks || (hist.oldStatus && hist.newStatus ? `Status: ${hist.oldStatus} → ${hist.newStatus}` : "Modified link log details"),
        status: hist.newStatus,
        link: hist.newAffiliateLink || hist.newBuyLink,
        rawTimestamp: hist.updatedAt.toISOString(),
      });
    });

    // Process Products Added
    productsAdded.forEach((prod) => {
      addActivity(prod.addedAt, {
        id: `prodadd-${prod.id}`,
        time: toNpt(prod.addedAt).format("hh:mm A"),
        category: "PRODUCT",
        badge: "Product Created",
        title: prod.name,
        subtitle: `Site: ${prod.site.name} • Category: ${prod.category.name}`,
        details: prod.remarks || `New product created and assigned for article generation.`,
        rawTimestamp: prod.addedAt.toISOString(),
      });
    });

    // Process Reviews Done
    reviewsDone.forEach((rev) => {
      const rawDetails = rev.suggestion || (rev.approved ? "Article approved by reviewer." : "Redo revision requested.");
      addActivity(rev.reviewedAt, {
        id: `rev-${rev.id}`,
        time: toNpt(rev.reviewedAt).format("hh:mm A"),
        category: "REVIEW",
        badge: rev.approved ? "Review Approved" : "Changes Requested",
        title: rev.article.product.name,
        subtitle: `Writer: ${rev.article.writer?.name || "Unassigned"} • Site: ${rev.article.product.site.name}`,
        details: sanitizeActivityDetails(rawDetails),
        status: rev.approved ? "APPROVED" : "REDO",
        rawTimestamp: rev.reviewedAt.toISOString(),
      });
    });

    // Construct response calendar days
    const totalDaysInMonth = currentMoment.daysInMonth();
    const todayStr = nowNpt.format("YYYY-MM-DD");

    let totalWorkingDays = 0;
    let totalNonWorkingDays = 0;
    const totalMonthArticles = articlesCompleted.length;
    const totalMonthLinks = linksAdded.length + linkHistories.length;
    const totalMonthWritingTime = articlesCompleted.reduce((acc, a) => acc + (a.writingTimeMin || 0), 0);

    const days = [];
    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
      const dayMoment = currentMoment.clone().date(dayNum);
      const dateKey = dayMoment.format("YYYY-MM-DD");
      const isPastOrToday = dayMoment.isSameOrBefore(nowNpt, "day");
      const isToday = dateKey === todayStr;
      const dayOfWeek = dayMoment.day(); // 0 = Sunday, 6 = Saturday

      const items = dailyActivities[dateKey] || [];
      // Sort items within each day chronologically descending (newest activity at the top)
      items.sort((a, b) => {
        if (a.rawTimestamp && b.rawTimestamp) {
          return new Date(b.rawTimestamp).getTime() - new Date(a.rawTimestamp).getTime();
        }
        return 0;
      });
      const hasWork = items.length > 0;

      if (isPastOrToday) {
        if (hasWork) {
          totalWorkingDays++;
        } else {
          totalNonWorkingDays++;
        }
      }

      days.push({
        date: dateKey,
        dayNumber: dayNum,
        dayOfWeek,
        isToday,
        isPast: dayMoment.isBefore(nowNpt, "day"),
        isFuture: dayMoment.isAfter(nowNpt, "day"),
        isWorkingDay: hasWork,
        activityCount: items.length,
        activities: items,
      });
    }

    return NextResponse.json({
      targetUser: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        image: targetUser.image,
      },
      currentMonth: currentMoment.format("YYYY-MM"),
      monthLabel: currentMoment.format("MMMM YYYY"),
      selectableUsers,
      summary: {
        totalWorkingDays,
        totalNonWorkingDays,
        totalArticlesCompleted: totalMonthArticles,
        totalLinksActioned: totalMonthLinks,
        totalWritingTimeMin: totalMonthWritingTime,
      },
      days,
    });
  } catch (err: any) {
    console.error("[GET /api/calendar]", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
