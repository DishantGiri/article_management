/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    const userRole = session.user.role || "WRITER";

    // ─────────────────────────────────────────────
    // 1. DATES (LAST 6 MONTHS)
    // ─────────────────────────────────────────────
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const d = new Date();

    const getEmptyMonthTrend = () => {
      const map = new Map<string, number>();
      for (let i = 5; i >= 0; i--) {
        const past = new Date(d.getFullYear(), d.getMonth() - i, 1);
        map.set(monthNames[past.getMonth()], 0);
      }
      return map;
    };

    // ─────────────────────────────────────────────
    // 2. WRITER REPORT DATA
    // ─────────────────────────────────────────────
    let articleFilter: any = {};
    if (userRole === "WRITER") {
      articleFilter = { writerId: userId };
    } else if (userRole === "TEAM_LEAD") {
      articleFilter = {
        OR: [
          { writerId: userId },
          { writer: { teamLeadId: userId } },
        ],
      };
    } else if (userRole === "LINKER") {
      articleFilter = { id: -1 }; // Linkers don't write articles
    }

    const articles = await prisma.article.findMany({
      where: articleFilter,
      include: {
        writer: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, name: true, site: { select: { name: true } } } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const totalArticles = articles.length;
    const completedArticles = articles.filter((a) => a.status === "COMPLETED").length;
    const inProgressArticles = articles.filter((a) => a.status === "IN_PROGRESS").length;
    const completionRate = totalArticles === 0 ? 0 : Math.round((completedArticles / totalArticles) * 100);

    const articleTrendMap = getEmptyMonthTrend();
    articles.forEach((a) => {
      const monthStr = monthNames[a.updatedAt.getMonth()];
      if (articleTrendMap.has(monthStr)) {
        articleTrendMap.set(monthStr, (articleTrendMap.get(monthStr) || 0) + 1);
      }
    });
    const articleMonthlyTrend = Array.from(articleTrendMap.entries()).map(([month, articles]) => ({ month, articles }));

    let artInProgress = 0;
    let artPending = 0;
    let artRedo = 0;
    articles.forEach((a) => {
      if (a.status === "IN_PROGRESS") artInProgress++;
      else if (a.status === "PENDING") artPending++;
      else if (a.status === "REDO") artRedo++;
    });

    const articleStatusDistribution = [
      { name: "Completed", value: completedArticles, color: "#10b981" },
      { name: "In Progress", value: artInProgress, color: "#6366f1" },
      { name: "Pending", value: artPending, color: "#f59e0b" },
      { name: "Redo", value: artRedo, color: "#ef4444" },
    ].filter((s) => s.value > 0);

    if (articleStatusDistribution.length === 0) {
      articleStatusDistribution.push({ name: "No Data", value: 1, color: "#e2e8f0" });
    }

    // Writer Productivity Map
    const writerMap = new Map();
    let totalMins = 0;
    let totalCompletedWithTime = 0;

    articles.forEach((a) => {
      if (a.writer) {
        if (!writerMap.has(a.writer.id)) {
          writerMap.set(a.writer.id, {
            id: a.writer.id,
            writer: a.writer.name,
            email: a.writer.email,
            articles: 0,
            completed: 0,
            inProgress: 0,
            totalTimeMin: 0,
            status: "Active",
            performance: 0,
            avgTime: "0.0",
          });
        }
        const w = writerMap.get(a.writer.id);
        w.articles += 1;
        if (a.status === "COMPLETED") {
          w.completed += 1;
        } else if (a.status === "IN_PROGRESS") {
          w.inProgress += 1;
        }
        if (a.writingTimeMin) {
          w.totalTimeMin += a.writingTimeMin;
        }
      }
      if (a.status === "COMPLETED" && a.writingTimeMin) {
        totalMins += a.writingTimeMin;
        totalCompletedWithTime++;
      }
    });

    const writerProductivity = Array.from(writerMap.values()).map((w) => {
      w.performance = w.articles > 0 ? Math.round((w.completed / w.articles) * 100) : 0;
      w.avgTime = w.completed > 0 ? (w.totalTimeMin / w.completed / 60).toFixed(1) : "0.0";
      return w;
    });
    writerProductivity.sort((a, b) => b.performance - a.performance);

    const avgWritingTime = totalCompletedWithTime > 0 ? (totalMins / totalCompletedWithTime / 60).toFixed(1) : "0.0";

    const writerReport = {
      metrics: {
        totalArticles,
        completedArticles,
        inProgressArticles,
        avgWritingTime,
        completionRate,
      },
      monthlyTrend: articleMonthlyTrend,
      statusDistribution: articleStatusDistribution,
      writerProductivity,
      recentArticles: articles.slice(0, 30).map((a) => ({
        id: a.id,
        productName: a.product?.name || "Untitled",
        siteName: a.product?.site?.name || "Unassigned",
        status: a.status,
        writingTimeMin: a.writingTimeMin,
        completedAt: a.completedAt,
        articleLink: a.articleLink,
        writerName: a.writer?.name,
      })),
    };

    // ─────────────────────────────────────────────
    // 3. LINKER REPORT DATA
    // ─────────────────────────────────────────────
    let linkFilter: any = {};
    if (userRole === "LINKER") {
      linkFilter = { addedById: userId };
    } else if (userRole === "WRITER") {
      linkFilter = { id: -1 }; // Writers don't manage links
    }

    const [links, productsAddedCount] = await Promise.all([
      prisma.linkLog.findMany({
        where: linkFilter,
        include: {
          addedBy: { select: { id: true, name: true, email: true } },
          product: { select: { id: true, name: true, site: { select: { name: true } } } },
        },
        orderBy: { addedAt: "desc" },
      }),
      userRole === "LINKER"
        ? prisma.product.count({ where: { addedById: userId } })
        : prisma.product.count(),
    ]);

    const totalLinks = links.length;
    const acceptedLinks = links.filter((l) => l.status === "ACCEPTED").length;
    const requestedLinks = links.filter((l) => l.status === "REQUESTED").length;
    const issueLinks = links.filter((l) => l.status === "ISSUE").length;

    const linkTrendMap = getEmptyMonthTrend();
    links.forEach((l) => {
      const monthStr = monthNames[l.addedAt.getMonth()];
      if (linkTrendMap.has(monthStr)) {
        linkTrendMap.set(monthStr, (linkTrendMap.get(monthStr) || 0) + 1);
      }
    });
    const linkMonthlyTrend = Array.from(linkTrendMap.entries()).map(([month, linksCount]) => ({ month, links: linksCount }));

    const linkStatusMap: Record<string, number> = {};
    const affiliateMap: Record<string, number> = {};

    links.forEach((l) => {
      linkStatusMap[l.status] = (linkStatusMap[l.status] || 0) + 1;
      if (l.affiliateName) {
        affiliateMap[l.affiliateName] = (affiliateMap[l.affiliateName] || 0) + 1;
      }
    });

    const statusColors: Record<string, string> = {
      ACCEPTED: "#10b981",
      REQUESTED: "#3b82f6",
      ISSUE: "#ef4444",
      CANCELED: "#64748b",
      NEED_TO_CHECK: "#f59e0b",
      REDIRECTED: "#8b5cf6",
      PRESELL_PAGE: "#06b6d4",
    };

    const linkStatusDistribution = Object.entries(linkStatusMap).map(([name, value]) => ({
      name,
      value,
      color: statusColors[name] || "#94a3b8",
    }));

    if (linkStatusDistribution.length === 0) {
      linkStatusDistribution.push({ name: "No Links", value: 1, color: "#e2e8f0" });
    }

    const affiliateColors = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#f97316"];
    const affiliateDistribution = Object.entries(affiliateMap)
      .slice(0, 7)
      .map(([name, value], i) => ({
        name,
        value,
        color: affiliateColors[i % affiliateColors.length],
      }));

    if (affiliateDistribution.length === 0) {
      affiliateDistribution.push({ name: "No Affiliates", value: 1, color: "#e2e8f0" });
    }

    // Linker Productivity Map
    const linkerMap = new Map();
    links.forEach((l) => {
      if (l.addedBy) {
        if (!linkerMap.has(l.addedBy.id)) {
          linkerMap.set(l.addedBy.id, {
            id: l.addedBy.id,
            linker: l.addedBy.name,
            email: l.addedBy.email,
            links: 0,
            accepted: 0,
            issues: 0,
          });
        }
        const lm = linkerMap.get(l.addedBy.id);
        lm.links += 1;
        if (l.status === "ACCEPTED") lm.accepted += 1;
        if (l.status === "ISSUE") lm.issues += 1;
      }
    });

    const linkerProductivity = Array.from(linkerMap.values()).map((lm) => {
      lm.rate = lm.links > 0 ? Math.round((lm.accepted / lm.links) * 100) : 0;
      return lm;
    });
    linkerProductivity.sort((a, b) => b.links - a.links);

    const linkerReport = {
      metrics: {
        totalLinks,
        acceptedLinks,
        requestedLinks,
        issueLinks,
        productsAdded: productsAddedCount,
      },
      monthlyTrend: linkMonthlyTrend,
      statusDistribution: linkStatusDistribution,
      affiliateDistribution,
      linkerProductivity,
      recentLinks: links.slice(0, 30).map((l) => ({
        id: l.id,
        productName: l.product?.name || "Untitled",
        siteName: l.product?.site?.name || "Unassigned",
        affiliateName: l.affiliateName,
        status: l.status,
        addedAt: l.addedAt,
        addedByName: l.addedBy?.name,
      })),
    };

    // ─────────────────────────────────────────────
    // 4. TEAM LEAD REPORT DATA
    // ─────────────────────────────────────────────
    let teamLeadReport: any = null;
    if (userRole === "TEAM_LEAD" || userRole === "ADMIN" || userRole === "SUPER_ADMIN") {
      const [teamWriters, reviews] = await Promise.all([
        prisma.user.findMany({
          where: userRole === "TEAM_LEAD" ? { teamLeadId: userId, role: "WRITER" } : { role: "WRITER" },
          select: {
            id: true,
            name: true,
            email: true,
            articles: {
              select: {
                id: true,
                status: true,
                writingTimeMin: true,
                completedAt: true,
              },
            },
          },
        }),
        prisma.articleReview.findMany({
          where: userRole === "TEAM_LEAD" ? { reviewedById: userId } : {},
          include: {
            article: {
              select: {
                product: { select: { name: true } },
                writer: { select: { name: true } },
              },
            },
          },
          orderBy: { reviewedAt: "desc" },
          take: 30,
        }),
      ]);

      const totalReviews = reviews.length;
      const approvedReviews = reviews.filter((r) => r.approved).length;
      const redoReviews = totalReviews - approvedReviews;
      const reviewApprovalRate = totalReviews === 0 ? 0 : Math.round((approvedReviews / totalReviews) * 100);

      let teamCompletedArticles = 0;
      let teamTotalTime = 0;
      let teamCompletedWithTime = 0;

      const writerComparison = teamWriters.map((tw) => {
        const twCompleted = tw.articles.filter((a) => a.status === "COMPLETED").length;
        const twTotal = tw.articles.length;
        let twTime = 0;
        let twTimeCount = 0;

        tw.articles.forEach((a) => {
          if (a.status === "COMPLETED" && a.writingTimeMin) {
            twTime += a.writingTimeMin;
            twTimeCount++;
            teamTotalTime += a.writingTimeMin;
            teamCompletedWithTime++;
          }
        });

        teamCompletedArticles += twCompleted;
        const avgHours = twTimeCount > 0 ? (twTime / twTimeCount / 60).toFixed(1) : "0.0";
        const rate = twTotal > 0 ? Math.round((twCompleted / twTotal) * 100) : 0;

        return {
          id: tw.id,
          name: tw.name,
          email: tw.email,
          totalArticles: twTotal,
          completed: twCompleted,
          avgTimeHours: avgHours,
          completionRate: rate,
        };
      });

      writerComparison.sort((a, b) => b.completed - a.completed);

      const teamAvgTime = teamCompletedWithTime > 0 ? (teamTotalTime / teamCompletedWithTime / 60).toFixed(1) : "0.0";

      teamLeadReport = {
        metrics: {
          teamWritersCount: teamWriters.length,
          teamArticlesCompleted: teamCompletedArticles,
          teamAvgWritingTime: teamAvgTime,
          reviewsConducted: totalReviews,
          approvedCount: approvedReviews,
          redoCount: redoReviews,
          approvalRate: reviewApprovalRate,
        },
        writerComparison,
        recentReviews: reviews.map((r) => ({
          id: r.id,
          productName: r.article?.product?.name || "Article",
          writerName: r.article?.writer?.name || "Writer",
          approved: r.approved,
          suggestion: r.suggestion,
          reviewedAt: r.reviewedAt,
        })),
      };
    }

    return NextResponse.json({
      user: {
        id: userId,
        role: userRole,
        name: session.user.name,
      },
      // Keep metrics, monthlyTrend, statusDistribution, writerProductivity at top-level for backward compatibility
      metrics: writerReport.metrics,
      monthlyTrend: writerReport.monthlyTrend,
      statusDistribution: writerReport.statusDistribution,
      writerProductivity: writerReport.writerProductivity,

      // Enhanced report domains
      writerReport,
      linkerReport,
      teamLeadReport,
    });
  } catch (err: any) {
    console.error("[GET /api/reports]", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
