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

    const callerId = Number(session.user.id);
    const callerRole = session.user.role || "WRITER";

    // ─────────────────────────────────────────────────────────────────────────
    // 1. PERMISSION CONSTRAINT:
    // "work report there tl cannot view the report, one user can own report"
    // TEAM_LEAD, WRITER, and LINKER can STRICTLY ONLY view their OWN report.
    // Only SUPER_ADMIN and ADMIN can specify a ?userId query param.
    // ─────────────────────────────────────────────────────────────────────────
    let targetUserId = callerId;
    const requestedUserId = req.nextUrl.searchParams.get("userId");

    if ((callerRole === "SUPER_ADMIN" || callerRole === "ADMIN") && requestedUserId) {
      targetUserId = Number(requestedUserId);
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. DATE FILTERING (FOR REPORT GENERATION)
    // ─────────────────────────────────────────────────────────────────────────
    const startDateParam = req.nextUrl.searchParams.get("startDate");
    const endDateParam = req.nextUrl.searchParams.get("endDate");

    let dateStart: Date | undefined = undefined;
    let dateEnd: Date | undefined = undefined;

    if (startDateParam) {
      dateStart = new Date(startDateParam.includes("T") ? startDateParam : `${startDateParam}T00:00:00.000Z`);
    }
    if (endDateParam) {
      dateEnd = new Date(endDateParam.includes("T") ? endDateParam : `${endDateParam}T23:59:59.999Z`);
    }

    const getDateFilter = (field: string) => {
      if (!dateStart && !dateEnd) return {};
      return {
        [field]: {
          ...(dateStart ? { gte: dateStart } : {}),
          ...(dateEnd ? { lte: dateEnd } : {}),
        },
      };
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 3. RETRIEVE WORK RECORDS FOR TARGET USER
    // ─────────────────────────────────────────────────────────────────────────

    // A. WRITER WORK: New Articles, Updates, Fixes
    const [userArticles, userArticleHistories] = await Promise.all([
      prisma.article.findMany({
        where: {
          writerId: targetUserId,
          ...getDateFilter("updatedAt"),
        },
        include: {
          product: {
            include: { site: { select: { id: true, name: true, url: true } } },
          },
          reviews: {
            select: { id: true, approved: true, suggestion: true, reviewedAt: true },
            orderBy: { reviewedAt: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.articleHistory.findMany({
        where: {
          updatedById: targetUserId,
          ...getDateFilter("updatedAt"),
        },
        include: {
          article: {
            include: {
              product: {
                include: { site: { select: { id: true, name: true, url: true } } },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    // Categorize Writer Work:
    // 1. Fixes (Redo resolutions)
    const fixedArticleIds = new Set<number>();
    const fixesList: any[] = [];

    userArticleHistories.forEach((h) => {
      const isRedoFix =
        h.oldStatus === "REDO" ||
        (h.notes && h.notes.toLowerCase().includes("redo")) ||
        (h.notes && h.notes.toLowerCase().includes("fix"));

      if (isRedoFix && h.article) {
        fixedArticleIds.add(h.article.id);
        fixesList.push({
          id: `fix-${h.id}`,
          articleId: h.article.id,
          productName: h.article.product?.name || "Untitled Product",
          siteName: h.article.product?.site?.name || "Unassigned Site",
          articleLink: h.newLink || h.article.articleLink || null,
          date: h.updatedAt,
          notes: h.notes || "Addressed redo feedback and updated article",
          writingTimeMin: h.article.writingTimeMin,
          status: h.newStatus || h.article.status,
        });
      }
    });

    // 2. Updates (Article content / link updates)
    const updatedArticleIds = new Set<number>();
    const updatesList: any[] = [];

    userArticleHistories.forEach((h) => {
      const isRedoFix =
        h.oldStatus === "REDO" ||
        (h.notes && h.notes.toLowerCase().includes("redo")) ||
        (h.notes && h.notes.toLowerCase().includes("fix"));

      const isUpdate =
        !isRedoFix &&
        (h.oldLink !== h.newLink ||
          (h.notes && h.notes.toLowerCase().includes("update")) ||
          (h.notes && h.notes.toLowerCase().includes("link updated")));

      if (isUpdate && h.article) {
        updatedArticleIds.add(h.article.id);
        updatesList.push({
          id: `update-${h.id}`,
          articleId: h.article.id,
          productName: h.article.product?.name || "Untitled Product",
          siteName: h.article.product?.site?.name || "Unassigned Site",
          articleLink: h.newLink || h.article.articleLink || null,
          oldLink: h.oldLink,
          date: h.updatedAt,
          notes: h.notes || "Updated article link/content",
          status: h.newStatus || h.article.status,
        });
      }
    });

    // 3. New Articles written
    const newArticlesList: any[] = [];
    userArticles.forEach((art) => {
      // If it's not strictly an update or fix entry, or was completed/in-progress in this period
      newArticlesList.push({
        id: `article-${art.id}`,
        articleId: art.id,
        productName: art.product?.name || "Untitled Product",
        siteName: art.product?.site?.name || "Unassigned Site",
        articleLink: art.articleLink || null,
        date: art.completedAt || art.startedAt || art.updatedAt,
        writingTimeMin: art.writingTimeMin,
        status: art.status,
      });
    });

    // B. TEAM LEAD WORK: New Articles, Reviews Conducted, Links
    const [teamLeadReviews, teamLeadSpecialApprovals] = await Promise.all([
      prisma.articleReview.findMany({
        where: {
          reviewedById: targetUserId,
          ...getDateFilter("reviewedAt"),
        },
        include: {
          article: {
            include: {
              product: {
                include: { site: { select: { id: true, name: true } } },
              },
              writer: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { reviewedAt: "desc" },
      }),
      prisma.specialApproval.findMany({
        where: {
          approvedById: targetUserId,
          ...getDateFilter("approvedAt"),
        },
        include: {
          article: {
            include: {
              product: {
                include: { site: { select: { id: true, name: true } } },
              },
            },
          },
        },
        orderBy: { approvedAt: "desc" },
      }),
    ]);

    const reviewedArticlesList = teamLeadReviews.map((r) => ({
      id: `review-${r.id}`,
      reviewId: r.id,
      articleId: r.article.id,
      productName: r.article.product?.name || "Untitled Product",
      siteName: r.article.product?.site?.name || "Unassigned Site",
      writerName: r.article.writer?.name || "Writer",
      articleLink: r.article.articleLink || null,
      approved: r.approved,
      verdict: r.approved ? "Approved" : "Redo Requested",
      suggestion: r.suggestion || "No remarks",
      reviewedAt: r.reviewedAt,
    }));

    // C. LINKER WORK: Products Added, Links Added on Products, Other Work
    const [linkerProducts, linkerLinks, linkerHistories] = await Promise.all([
      prisma.product.findMany({
        where: {
          addedById: targetUserId,
          ...getDateFilter("addedAt"),
        },
        include: {
          site: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
        },
        orderBy: { addedAt: "desc" },
      }),
      prisma.linkLog.findMany({
        where: {
          addedById: targetUserId,
          ...getDateFilter("addedAt"),
        },
        include: {
          product: {
            include: { site: { select: { id: true, name: true } } },
          },
          geos: true,
        },
        orderBy: { addedAt: "desc" },
      }),
      prisma.linkHistory.findMany({
        where: {
          updatedById: targetUserId,
          ...getDateFilter("updatedAt"),
        },
        include: {
          linkLog: {
            include: {
              product: {
                include: { site: { select: { id: true, name: true } } },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const productsAddedList = linkerProducts.map((p) => ({
      id: `prod-${p.id}`,
      productId: p.id,
      name: p.name,
      siteName: p.site?.name || "Unassigned Site",
      categoryName: p.category?.name || "Uncategorized",
      createdAt: p.addedAt,
    }));

    const linksAddedList = linkerLinks.map((l) => ({
      id: `link-${l.id}`,
      linkId: l.id,
      productId: l.productId,
      productName: l.product?.name || "Untitled Product",
      siteName: l.product?.site?.name || "Unassigned Site",
      affiliateName: l.affiliateName,
      affiliateLink: l.affiliateLink,
      bridgePageLink: l.bridgePageLink,
      buyLink: l.buyLink,
      status: l.status,
      geos: l.geos.map((g) => g.geo),
      addedAt: l.addedAt,
    }));

    const linkerOtherWorkList = linkerHistories.map((h) => ({
      id: `linkhist-${h.id}`,
      linkId: h.linkLogId,
      productName: h.linkLog?.product?.name || "Untitled Product",
      siteName: h.linkLog?.product?.site?.name || "Unassigned Site",
      oldStatus: h.oldStatus,
      newStatus: h.newStatus,
      oldBridgeLink: h.oldBridgeLink,
      newBridgeLink: h.newBridgeLink,
      notes: h.newRemarks || "Updated link configuration",
      updatedAt: h.updatedAt,
    }));

    // If caller is Admin/Super Admin, retrieve list of users so they can inspect any member's work report
    let selectableUsers: any[] = [];
    if (callerRole === "SUPER_ADMIN" || callerRole === "ADMIN") {
      selectableUsers = await prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      });
    }

    return NextResponse.json({
      caller: {
        id: callerId,
        role: callerRole,
        name: session.user.name,
      },
      targetUser: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
      },
      dateRange: {
        startDate: startDateParam || null,
        endDate: endDateParam || null,
      },
      selectableUsers,

      // Specific report sections formatted exactly for the user's role
      reportData: {
        writer: {
          newArticles: newArticlesList,
          updates: updatesList,
          fixes: fixesList,
          metrics: {
            totalNew: newArticlesList.length,
            totalUpdates: updatesList.length,
            totalFixes: fixesList.length,
            completedArticles: newArticlesList.filter((a) => a.status === "COMPLETED" || a.status === "APPROVED").length,
          },
        },
        teamLead: {
          newArticles: newArticlesList,
          reviews: reviewedArticlesList,
          specialApprovals: teamLeadSpecialApprovals.map((sa) => ({
            id: sa.id,
            productName: sa.productName,
            writerName: sa.writerName,
            reason: sa.reason,
            approvedAt: sa.approvedAt,
          })),
          metrics: {
            totalNewArticles: newArticlesList.length,
            totalReviews: reviewedArticlesList.length,
            approvedReviews: reviewedArticlesList.filter((r) => r.approved).length,
            redoReviews: reviewedArticlesList.filter((r) => !r.approved).length,
          },
        },
        linker: {
          productsAdded: productsAddedList,
          linksAdded: linksAddedList,
          otherWork: linkerOtherWorkList,
          metrics: {
            totalProductsAdded: productsAddedList.length,
            totalLinksAdded: linksAddedList.length,
            totalUpdates: linkerOtherWorkList.length,
            acceptedLinks: linksAddedList.filter((l) => l.status === "ACCEPTED").length,
          },
        },
      },
    });
  } catch (err: any) {
    console.error("[GET /api/reports]", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
