import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { cached } from "@/lib/redis";
import {
  LINK_LOG_INCLUDE,
  buildLinkLogWhere,
  consolidateProductLinkLogs,
  fetchPaginatedConsolidatedLinks,
  getLinkLogsAuthScope,
} from "@/lib/link-logs-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const userRole = session.user.role || "";
  const authScope = await getLinkLogsAuthScope(userId, userRole);
  if (!authScope.allowed) {
    return NextResponse.json({ error: authScope.error }, { status: authScope.status });
  }
  const allowedSiteIds = authScope.allowedSiteIds;
  const scopePrefix = isAdmin(userRole) ? "global" : `user:${userId}:${userRole}`;

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("targetUserId");
  const search = searchParams.get("search")?.trim() || "";
  const site = searchParams.get("site") || "ALL";
  const status = searchParams.get("status") || "ALL";
  const selectedUserId = searchParams.get("selectedUserId") || "ALL";
  const sortBy = (searchParams.get("sortBy") || "most-links") as "most-links" | "recent" | "name";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10", 10) || 10));
  const all = searchParams.get("all") === "true" || searchParams.get("all") === "1";

  // ── Mode 1: Paginated links for ONE expanded user ──────────────────────────
  if (targetUserId) {
    if (all) {
      const where = buildLinkLogWhere({
        allowedSiteIds,
        addedById: targetUserId,
        siteName: site,
        status,
        search,
      });
      const rawRows = await prisma.linkLog.findMany({
        where,
        include: LINK_LOG_INCLUDE,
        orderBy: { addedAt: "desc" },
        take: 1500,
      });
      return NextResponse.json({ items: consolidateProductLinkLogs(rawRows) });
    }

    const pageCacheKey = `links:byuser:items:${scopePrefix}:u=${targetUserId}:p${page}_l${limit}:s=${search}:site=${site}:st=${status}`;
    const data = await cached(pageCacheKey, 30, async () => {
      return fetchPaginatedConsolidatedLinks(
        {
          allowedSiteIds,
          addedById: targetUserId,
          siteName: site,
          status,
          search,
        },
        page,
        limit
      );
    });
    return NextResponse.json(data);
  }

  // ── Mode 2: Summary stats & paginated user cards ───────────────────────────
  const summaryCacheKey = `links:byuser:summary:${scopePrefix}:p${page}_l${limit}:s=${search}:su=${selectedUserId}:site=${site}:st=${status}:sort=${sortBy}`;

  const payload = await cached(summaryCacheKey, 30, async () => {
    const baseWhere = buildLinkLogWhere({ allowedSiteIds });

    const [
      totalUsersAgg,
      totalLinksCount,
      acceptedCount,
      pendingCount,
      issuesCount,
      allSitesRows,
    ] = await Promise.all([
      prisma.linkLog.groupBy({
        by: ["addedById"],
        where: baseWhere,
        _count: { _all: true },
        _max: { addedAt: true },
      }),
      prisma.product.count({ where: { linkLogs: { some: baseWhere } } }),
      prisma.product.count({
        where: { linkLogs: { some: { ...baseWhere, status: "ACCEPTED" } } },
      }),
      prisma.product.count({
        where: { linkLogs: { some: { ...baseWhere, status: "REQUESTED" } } },
      }),
      prisma.product.count({
        where: {
          linkLogs: {
            some: { ...baseWhere, status: { in: ["ISSUE", "NEED_TO_CHECK"] } },
          },
        },
      }),
      prisma.site.findMany({
        where: { products: { some: { linkLogs: { some: baseWhere } } } },
        select: { name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const allAdderIds = totalUsersAgg.map((g) => g.addedById).filter(Boolean);
    const adderUsers =
      allAdderIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: allAdderIds } },
            select: { id: true, name: true, role: true, email: true },
          })
        : [];
    const userById = new Map(adderUsers.map((u) => [u.id, u]));

    const allUsersForFilter = totalUsersAgg
      .map((g) => {
        const u = userById.get(g.addedById);
        return {
          userId: g.addedById,
          userName: u?.name?.trim() || "Unassigned",
          totalLinks: g._count._all,
        };
      })
      .sort((a, b) => b.totalLinks - a.totalLinks);

    // Build filtered aggregations per user
    const statusWhere = buildLinkLogWhere({
      allowedSiteIds,
      siteName: site,
      status,
      addedById: selectedUserId !== "ALL" ? selectedUserId : undefined,
    });
    const searchWhere = search
      ? buildLinkLogWhere({
          allowedSiteIds,
          siteName: site,
          status,
          addedById: selectedUserId !== "ALL" ? selectedUserId : undefined,
          search,
        })
      : statusWhere;

    const [statusByUser, searchTotalGroups, statusAndSearchGroups] = await Promise.all([
      prisma.linkLog.groupBy({
        by: ["addedById", "status"],
        where: statusWhere,
        _count: { _all: true },
      }),
      search
        ? prisma.linkLog.groupBy({
            by: ["addedById"],
            where: searchWhere,
            _count: { _all: true },
            _max: { addedAt: true },
          })
        : prisma.linkLog.groupBy({
            by: ["addedById"],
            where: statusWhere,
            _count: { _all: true },
            _max: { addedAt: true },
          }),
      search
        ? prisma.linkLog.groupBy({
            by: ["addedById", "status"],
            where: searchWhere,
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const qLower = search.toLowerCase();
    const baseStatsByUser = new Map<
      string,
      { accepted: number; requested: number; issue: number; total: number }
    >();
    for (const row of statusByUser) {
      const entry = baseStatsByUser.get(row.addedById) || {
        accepted: 0,
        requested: 0,
        issue: 0,
        total: 0,
      };
      const c = row._count._all;
      entry.total += c;
      if (row.status === "ACCEPTED") entry.accepted += c;
      else if (row.status === "REQUESTED") entry.requested += c;
      else if (row.status === "ISSUE" || row.status === "NEED_TO_CHECK") {
        entry.issue += c;
      }
      baseStatsByUser.set(row.addedById, entry);
    }

    const searchCountByUser = new Map<string, { count: number; latestDate: Date }>();
    for (const row of searchTotalGroups) {
      searchCountByUser.set(row.addedById, {
        count: row._count._all,
        latestDate: row._max.addedAt || new Date(0),
      });
    }

    const searchStatusByUser = new Map<
      string,
      { accepted: number; requested: number; issue: number }
    >();
    if (search) {
      for (const row of statusAndSearchGroups) {
        const entry = searchStatusByUser.get(row.addedById) || {
          accepted: 0,
          requested: 0,
          issue: 0,
        };
        const c = row._count._all;
        if (row.status === "ACCEPTED") entry.accepted += c;
        else if (row.status === "REQUESTED") entry.requested += c;
        else if (row.status === "ISSUE" || row.status === "NEED_TO_CHECK") {
          entry.issue += c;
        }
        searchStatusByUser.set(row.addedById, entry);
      }
    }

    const candidateUserIds =
      selectedUserId !== "ALL"
        ? allAdderIds.filter((id) => id === selectedUserId)
        : allAdderIds;

    const userCardsAll = candidateUserIds
      .map((uid) => {
        const u = userById.get(uid);
        const uName = u?.name?.trim() || "Unassigned";
        const baseAgg = totalUsersAgg.find((g) => g.addedById === uid);
        const baseStats = baseStatsByUser.get(uid) || {
          accepted: 0,
          requested: 0,
          issue: 0,
          total: 0,
        };
        const userNameMatchesSearch = qLower ? uName.toLowerCase().includes(qLower) : false;
        const matchedInfo = searchCountByUser.get(uid);

        const filteredCount = search
          ? userNameMatchesSearch
            ? baseStats.total
            : matchedInfo?.count || 0
          : baseStats.total;

        if (filteredCount === 0 && (search || site !== "ALL" || status !== "ALL")) {
          return null;
        }

        const matchedStatusStats =
          search && !userNameMatchesSearch
            ? searchStatusByUser.get(uid) || { accepted: 0, requested: 0, issue: 0 }
            : {
                accepted: baseStats.accepted,
                requested: baseStats.requested,
                issue: baseStats.issue,
              };

        return {
          userId: uid,
          userName: uName,
          userRole: u?.role || null,
          userEmail: u?.email || null,
          filteredCount,
          totalLinks: baseAgg?._count._all || baseStats.total,
          acceptedCount: matchedStatusStats.accepted,
          requestedCount: matchedStatusStats.requested,
          issueCount: matchedStatusStats.issue,
          latestDate: (
            matchedInfo?.latestDate ||
            baseAgg?._max.addedAt ||
            new Date(0)
          ).toISOString(),
          searchMatchedByUserName: userNameMatchesSearch,
        };
      })
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
      .sort((a, b) => {
        if (sortBy === "most-links") return b.filteredCount - a.filteredCount;
        if (sortBy === "recent") {
          return new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime();
        }
        return a.userName.localeCompare(b.userName);
      });

    const totalUsersFiltered = userCardsAll.length;
    const pagedUsers = userCardsAll.slice((page - 1) * limit, page * limit);

    // Fetch site chips ONLY for the visible page of user cards
    const usersWithSites = await Promise.all(
      pagedUsers.map(async (u) => {
        const sitesForUser = await prisma.site.findMany({
          where: {
            products: {
              some: {
                linkLogs: {
                  some: {
                    ...baseWhere,
                    addedById: u.userId,
                  },
                },
              },
            },
          },
          select: { name: true },
          orderBy: { name: "asc" },
        });
        return {
          ...u,
          sites: sitesForUser.map((s) => s.name),
        };
      })
    );

    return {
      summary: {
        totalUsers: totalUsersAgg.length,
        totalLinks: totalLinksCount,
        accepted: acceptedCount,
        pending: pendingCount,
        issues: issuesCount,
      },
      allUsersForFilter,
      allSites: allSitesRows.map((s) => s.name),
      users: usersWithSites,
      pagination: {
        total: totalUsersFiltered,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalUsersFiltered / limit)),
      },
    };
  });

  return NextResponse.json(payload);
}
