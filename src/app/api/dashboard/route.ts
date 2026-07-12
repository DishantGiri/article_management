/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/dashboard?userId=X — role-aware stats
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userIdStr = searchParams.get("userId");

    let role = "ADMIN";
    let allowedSiteIds: number[] = [];
    let userId = 1;

    if (userIdStr) {
      userId = parseInt(userIdStr);
      if (isNaN(userId)) userId = 1;
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (user) {
        role = user.role || "";
      }
    }

    // Fetch writer & team lead site access
    if (role === "WRITER" || role === "TEAM_LEAD") {
      const accesses = await prisma.siteAccess.findMany({
        where: { userId },
        select: { siteId: true },
      });
      allowedSiteIds = accesses.map((a) => a.siteId);
    }

    const [
      totalProducts,
      pendingArticles,
      inProgressArticles,
      completedArticles,
      totalLinks,
      requestedLinks,
      acceptedLinks,
      issueLinks,
      recentProducts,
      recentArticles,
      unlinkedProducts,
      writerPendingArticles,
      writerInProgressArticles,
      writerCompletedArticles,
      linkerProducts,
      linkerLinks,
    ] = await Promise.all([
      // General counts
      prisma.product.count(),
      prisma.article.count({ where: { status: "PENDING" } }),
      prisma.article.count({ where: { status: { in: ["IN_PROGRESS", "REDO"] } } }),
      prisma.article.count({ where: { status: { in: ["COMPLETED", "APPROVED"] } } }),
      prisma.linkLog.count(),
      prisma.linkLog.count({ where: { status: "REQUESTED" } }),
      prisma.linkLog.count({ where: { status: "ACCEPTED" } }),
      prisma.linkLog.count({ where: { status: "ISSUE" } }),

      // General recent products
      prisma.product.findMany({
        take: 5,
        orderBy: { addedAt: "desc" },
        include: {
          site: { select: { name: true } },
          category: { select: { name: true } },
          addedBy: { select: { name: true } },
          article: { select: { status: true } },
        },
      }),

      // General recent articles
      prisma.article.findMany({
        take: 5,
        orderBy: { updatedAt: "desc" },
        where: { status: { in: ["IN_PROGRESS", "COMPLETED", "APPROVED", "REDO"] } },
        include: {
          product: { select: { name: true } },
          writer: { select: { name: true } },
        },
      }),

      // Unlinked products (Alerts for Linkers/Admins)
      prisma.product.findMany({
        where: { linkLogs: { none: {} } },
        select: { id: true, name: true, site: { select: { name: true } } },
        take: 5,
      }),

      // WRITER & TEAM_LEAD: Pending articles on their assigned sites
      role === "WRITER" || role === "TEAM_LEAD"
        ? prisma.article.findMany({
            where: {
              status: "PENDING",
              ...(role === "WRITER" ? { product: { siteId: { in: allowedSiteIds } } } : {}),
            },
            include: {
              product: {
                include: { 
                  site: { select: { name: true } }, 
                  category: { select: { name: true } },
                  linkLogs: { include: { geos: true } }
                },
              },
            },
            take: 10,
          })
        : Promise.resolve([]),

      // ANY ROLE: User's own In-Progress articles
      prisma.article.findMany({
        where: { writerId: userId, status: { in: ["IN_PROGRESS", "REDO"] } },
        include: {
          reviews: {
            orderBy: { reviewedAt: 'desc' },
            take: 1,
            include: { reviewedBy: { select: { name: true } } }
          },
          product: {
            include: { 
              site: { select: { name: true } }, 
              category: { select: { name: true } },
              linkLogs: { include: { geos: true } }
            },
          },
        },
      }),

      // ANY ROLE: User's recently completed articles
      prisma.article.findMany({
        where: { writerId: userId, status: { in: ["COMPLETED", "APPROVED"] } },
        orderBy: { completedAt: "desc" },
        include: {
          product: {
            include: { site: { select: { name: true } } }
          }
        },
        take: 5,
      }),

      // LINKER: Products added by this linker
      role === "LINKER"
        ? prisma.product.findMany({
            where: { addedById: userId },
            include: {
              site: { select: { name: true } },
              category: { select: { name: true } },
              article: { select: { status: true } },
            },
            take: 5,
          })
        : Promise.resolve([]),

      // LINKER: Links added by this linker
      role === "LINKER"
        ? prisma.linkLog.findMany({
            where: { addedById: userId },
            include: {
              product: { select: { name: true } },
            },
            take: 5,
          })
        : Promise.resolve([]),
    ]);

    // ─────────────────────────────────────────────
    // ROLE SPECIFIC DATA FETCHING
    // ─────────────────────────────────────────────

    // ─── TEAM_LEAD specific data ───
    let teamLeadData = null;
    if (role === "TEAM_LEAD") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        pendingReviewArticles,
        completedTodayCount,
        specialApprovalsCount,
        teamLeadWriters,
        reviewQueueArticles,
      ] = await Promise.all([
        // Articles submitted (COMPLETED) waiting for team lead approval on their sites
        prisma.article.count({
          where: {
            status: "COMPLETED",
            product: allowedSiteIds.length > 0 ? { siteId: { in: allowedSiteIds } } : {},
          },
        }),

        // Articles approved today on their sites
        prisma.article.count({
          where: {
            status: "APPROVED",
            completedAt: { gte: today },
            product: allowedSiteIds.length > 0 ? { siteId: { in: allowedSiteIds } } : {},
          },
        }),

        // Articles with special approval requested on their sites
        prisma.article.count({
          where: {
            specialApprovalRequested: true,
            status: { notIn: ["APPROVED"] },
            product: allowedSiteIds.length > 0 ? { siteId: { in: allowedSiteIds } } : {},
          },
        }),

        // Writer performance: writers with completed articles on team lead's sites
        prisma.user.findMany({
          where: { role: "WRITER" },
          include: {
            _count: {
              select: {
                articles: {
                  where: {
                    status: { in: ["COMPLETED", "APPROVED"] },
                    ...(allowedSiteIds.length > 0 ? { product: { siteId: { in: allowedSiteIds } } } : {}),
                  },
                },
              },
            },
          },
        }),

        // Review queue: recent COMPLETED articles awaiting review
        prisma.article.findMany({
          where: {
            status: "COMPLETED",
            product: allowedSiteIds.length > 0 ? { siteId: { in: allowedSiteIds } } : {},
          },
          orderBy: { completedAt: "desc" },
          take: 6,
          include: {
            product: {
              include: {
                site: { select: { name: true } },
              },
            },
            writer: { select: { name: true } },
          },
        }),
      ]);

      teamLeadData = {
        pendingReview: pendingReviewArticles,
        completedToday: completedTodayCount,
        specialApprovals: specialApprovalsCount,
        issueLinks: issueLinks,
        writerPerformance: teamLeadWriters
          .map((w) => ({ name: w.name, completed: w._count.articles }))
          .sort((a, b) => b.completed - a.completed)
          .slice(0, 6),
        reviewQueue: reviewQueueArticles.map((a) => ({
          id: a.id,
          product: a.product.name,
          writer: a.writer?.name || "Unassigned",
          site: a.product.site.name,
          completedAt: a.completedAt,
        })),
      };
    }

    let superAdminData = null;
    let superAdminError = null;

    if (role === "SUPER_ADMIN" || role === "ADMIN") {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
          totalWriters, totalLinkers, totalTeamLeads,
          totalSites, totalCategories, affiliateNetworksGroup,
          deadLinks, issueLinksSuper, todaysProducts,
          completedArticlesList,
          allWriters,
          allProductsRecent,
          allArticlesRecent,
          allLinksRecent
        ] = await Promise.all([
          prisma.user.count({ where: { role: "WRITER" } }),
          prisma.user.count({ where: { role: "LINKER" } }),
          prisma.user.count({ where: { role: "TEAM_LEAD" } }),
          prisma.site.count(),
          prisma.category.count(),
          prisma.linkLog.groupBy({ by: ['affiliateName'] }),
          prisma.linkLog.count({ where: { status: "ISSUE", linkerRemarks: { contains: "dead" } } }),
          prisma.linkLog.count({ where: { status: "ISSUE" } }),
          prisma.product.count({ where: { addedAt: { gte: today } } }),
          prisma.article.findMany({ where: { status: { in: ["COMPLETED", "APPROVED"] }, writingTimeMin: { not: null } }, select: { writingTimeMin: true } }),
          prisma.user.findMany({ 
            where: { role: "WRITER" },
            include: { _count: { select: { articles: { where: { status: { in: ["COMPLETED", "APPROVED"] } } } } } }
          }),
          prisma.product.findMany({ take: 20, orderBy: { addedAt: 'desc' }, include: { addedBy: { select: { name: true } } } }),
          prisma.article.findMany({ take: 20, orderBy: { updatedAt: 'desc' }, include: { product: { select: { name: true } }, writer: { select: { name: true } } } }),
          prisma.linkLog.findMany({ take: 20, orderBy: { addedAt: 'desc' }, include: { product: { select: { name: true } }, addedBy: { select: { name: true } } } })
        ]);

        const avgWritingTime = completedArticlesList.length > 0 
          ? (completedArticlesList.reduce((acc, a) => acc + (a.writingTimeMin || 0), 0) / completedArticlesList.length) / 60 
          : 0;

        // --- Monthly Data (Mocked from actual DB if possible, but for now we aggregate the last 6 months from recent) ---
        // To do a real aggregation we fetch everything, but for a lightweight approach let's just group the recent ones
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthlyDataMap: Record<string, { name: string, articles: number, products: number }> = {};
        
        // Initialize last 6 months
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const key = monthNames[d.getMonth()];
          monthlyDataMap[key] = { name: key, articles: 0, products: 0 };
        }
        
        allProductsRecent.forEach(p => {
          const m = monthNames[p.addedAt.getMonth()];
          if (monthlyDataMap[m]) monthlyDataMap[m].products += 1;
        });
        
        allArticlesRecent.forEach(a => {
          const m = monthNames[a.updatedAt.getMonth()];
          if (monthlyDataMap[m]) monthlyDataMap[m].articles += 1;
        });

        const monthlyData = Object.values(monthlyDataMap);

        // --- Writer Performance ---
        const writerPerformance = allWriters.map(w => ({
          name: w.name,
          completed: w._count.articles
        })).sort((a, b) => b.completed - a.completed).slice(0, 6);

        // --- Recent Activity ---
        const activityMap = [
          ...allProductsRecent.map(p => ({
            id: `p_${p.id}`,
            type: "product_added",
            user: p.addedBy?.name || "System",
            item: p.name,
            date: p.addedAt
          })),
          ...allArticlesRecent.map(a => ({
            id: `a_${a.id}`,
            type: `article_${a.status.toLowerCase()}`,
            user: a.writer?.name || "Unassigned",
            item: a.product.name,
            date: a.updatedAt
          })),
          ...allLinksRecent.map(l => ({
            id: `l_${l.id}`,
            type: `link_${l.status.toLowerCase()}`,
            user: l.addedBy?.name || "Linker",
            item: l.product.name,
            date: l.addedAt
          }))
        ];
        
        activityMap.sort((a, b) => b.date.getTime() - a.date.getTime());
        const recentActivity = activityMap.slice(0, 10);

        superAdminData = {
          totalWriters, totalLinkers, totalTeamLeads,
          totalSites, totalCategories, affiliateNetworks: affiliateNetworksGroup.length,
          deadLinks, issueLinks: issueLinksSuper, todaysProducts,
          avgWritingTime: avgWritingTime.toFixed(1),
          monthlyData,
          writerPerformance,
          recentActivity
        };
      } catch (e: any) {
        console.error("Super Admin Fetch Error:", e);
        superAdminError = e.message;
      }
    }

    return NextResponse.json({
      role,
      general: {
        totalProducts,
        pendingArticles,
        inProgressArticles,
        completedArticles,
        totalLinks,
        requestedLinks,
        acceptedLinks,
        issueLinks,
      },
      superAdmin: superAdminData,
      superAdminError,
      teamLead: teamLeadData,
      recentProducts,
      recentArticles,
      unlinkedProducts,
      writerPendingArticles,
      writerInProgressArticles,
      writerCompletedArticles,
      linkerProducts,
      linkerLinks,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}
