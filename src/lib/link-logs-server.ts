import { prisma } from "@/lib/prisma";
import { getUserAuthorizedSiteIds, isAdmin } from "@/lib/permissions";

export const LINK_LOG_INCLUDE = {
  geos: true,
  addedBy: { select: { id: true, name: true, role: true, email: true } },
  updatedBy: { select: { id: true, name: true, role: true, email: true } },
  product: {
    select: {
      name: true,
      slug: true,
      site: { select: { id: true, name: true, url: true, bridgeUrl: true } },
      article: { select: { articleLink: true } },
    },
  },
} as const;

export type LinkLogAuthScope =
  | { allowed: false; status: number; error: string }
  | { allowed: true; allowedSiteIds: string[] | undefined };

export async function getLinkLogsAuthScope(
  userId: string,
  userRole: string
): Promise<LinkLogAuthScope> {
  if (userRole === "WRITER") {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { allowLinkLogAccess: true },
    });
    if (!dbUser?.allowLinkLogAccess) {
      return {
        allowed: false,
        status: 403,
        error:
          "Access Denied: Writers do not have access to Link Logs unless allowed separately by the Admin Department.",
      };
    }
  }

  let allowedSiteIds: string[] | undefined = undefined;
  if (!isAdmin(userRole)) {
    const authorizedSites = await getUserAuthorizedSiteIds(userId, userRole, "ADD_LINK");
    if (authorizedSites !== null) {
      allowedSiteIds = authorizedSites;
    }
  }

  return { allowed: true, allowedSiteIds };
}

export interface LinkLogFilterParams {
  allowedSiteIds?: string[];
  productId?: string | null;
  status?: string | null;
  search?: string | null;
  exact?: boolean;
  addedById?: string | null;
  addedByName?: string | null;
  siteName?: string | null;
  siteId?: string | null;
  deadOnly?: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

export function buildLinkLogWhere(params: LinkLogFilterParams): any {
  const andConditions: any[] = [];

  if (params.allowedSiteIds !== undefined) {
    andConditions.push({ product: { siteId: { in: params.allowedSiteIds } } });
  }
  if (params.productId && params.productId.trim()) {
    andConditions.push({ productId: params.productId.trim() });
  }
  if (params.siteId && params.siteId.trim()) {
    andConditions.push({ product: { siteId: params.siteId.trim() } });
  }
  if (params.siteName && params.siteName.trim() && params.siteName !== "ALL") {
    andConditions.push({ product: { site: { name: params.siteName.trim() } } });
  }

  if (params.addedById && params.addedById.trim() && params.addedById !== "ALL") {
    andConditions.push({ addedById: params.addedById.trim() });
  } else if (params.addedByName && params.addedByName.trim() && params.addedByName !== "ALL") {
    andConditions.push({ addedBy: { name: params.addedByName.trim() } });
  }

  if (params.deadOnly) {
    andConditions.push({
      status: "ISSUE",
      OR: [
        { linkerRemarks: { contains: "dead" } },
        { linkerRemarks: { contains: "down" } },
        { linkerRemarks: { contains: "404" } },
        { linkerRemarks: { contains: "broken" } },
      ],
    });
  } else if (params.status && params.status.trim() && params.status !== "ALL") {
    const cleanStatus = params.status.trim().toUpperCase();
    if (cleanStatus === "ISSUE") {
      andConditions.push({ status: { in: ["ISSUE", "NEED_TO_CHECK"] } });
    } else {
      andConditions.push({ status: cleanStatus });
    }
  }

  if (params.startDate && params.startDate.trim()) {
    const s = new Date(params.startDate);
    if (!isNaN(s.getTime())) {
      s.setHours(0, 0, 0, 0);
      andConditions.push({ addedAt: { gte: s } });
    }
  }
  if (params.endDate && params.endDate.trim()) {
    const e = new Date(params.endDate);
    if (!isNaN(e.getTime())) {
      e.setHours(23, 59, 59, 999);
      andConditions.push({ addedAt: { lte: e } });
    }
  }

  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    if (params.exact) {
      andConditions.push({
        OR: [
          { product: { name: { equals: q } } },
          { product: { slug: { equals: q } } },
        ],
      });
    } else {
      andConditions.push({
        OR: [
          { id: q },
          { productId: q },
          { affiliateName: { contains: q } },
          { linkerRemarks: { contains: q } },
          { product: { name: { contains: q } } },
          { product: { slug: { contains: q } } },
          { product: { site: { name: { contains: q } } } },
          { geos: { some: { OR: [{ affiliateName: { contains: q } }, { geo: { contains: q } }] } } },
          { addedBy: { name: { contains: q } } },
        ],
      });
    }
  }

  return andConditions.length > 0 ? { AND: andConditions } : {};
}

/**
 * Consolidates multiple LinkLog rows for the same `productId` into a single card payload
 * matching the Link Logs table & UserLinksView card shape.
 */
export function consolidateProductLinkLogs(rawArr: any[]): any[] {
  const map = new Map<string, any>();

  for (const item of rawArr) {
    const key = item.productId ? `prod-${item.productId}` : `link-${item.id}`;
    if (!map.has(key)) {
      map.set(key, {
        ...item,
        allLinkIds: [item.id],
        geos: [
          ...(item.geos || []).map((g: any) => ({
            ...g,
            affiliateLink: g.affiliateLink || item.affiliateLink || "",
            affiliateName: g.affiliateName || item.affiliateName || "",
          })),
        ],
      });
    } else {
      const existing = map.get(key)!;
      if (!existing.allLinkIds.includes(item.id)) {
        existing.allLinkIds.push(item.id);
      }
      if (!existing.bridgePageLink && item.bridgePageLink) {
        existing.bridgePageLink = item.bridgePageLink;
      }
      if (!existing.buyLink && item.buyLink) {
        existing.buyLink = item.buyLink;
      }
      if (!existing.affiliateLink && item.affiliateLink) {
        existing.affiliateLink = item.affiliateLink;
      }
      if (!existing.affiliateName && item.affiliateName) {
        existing.affiliateName = item.affiliateName;
      }
      if (item.linkerRemarks && !existing.linkerRemarks?.includes(item.linkerRemarks)) {
        existing.linkerRemarks = existing.linkerRemarks
          ? `${existing.linkerRemarks}\n${item.linkerRemarks}`
          : item.linkerRemarks;
      }
      for (const g of item.geos || []) {
        const existingGeoIndex = existing.geos.findIndex((eg: any) => eg.geo === g.geo);
        if (existingGeoIndex === -1) {
          existing.geos.push({
            ...g,
            affiliateLink: g.affiliateLink || item.affiliateLink || "",
            affiliateName: g.affiliateName || item.affiliateName || "",
          });
        } else {
          if (!existing.geos[existingGeoIndex].affiliateLink && (g.affiliateLink || item.affiliateLink)) {
            existing.geos[existingGeoIndex].affiliateLink = g.affiliateLink || item.affiliateLink;
          }
          if (!existing.geos[existingGeoIndex].affiliateName && (g.affiliateName || item.affiliateName)) {
            existing.geos[existingGeoIndex].affiliateName = g.affiliateName || item.affiliateName;
          }
        }
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Fetches one server-paginated slice of consolidated-per-product LinkLogs.
 * Only fetches full rows + geos for the current page's productIds.
 */
export async function fetchPaginatedConsolidatedLinks(
  filterParams: LinkLogFilterParams,
  page: number,
  limit: number
) {
  let where = buildLinkLogWhere(filterParams);

  // If exact=true had no exact product match, mirror legacy UI fallback to contains match
  if (filterParams.exact && filterParams.search?.trim()) {
    const exactMatchCount = await prisma.product.count({
      where: { linkLogs: { some: where } },
    });
    if (exactMatchCount === 0) {
      where = buildLinkLogWhere({ ...filterParams, exact: false });
    }
  }

  const [total, groupedPage] = await Promise.all([
    prisma.product.count({ where: { linkLogs: { some: where } } }),
    prisma.linkLog.groupBy({
      by: ["productId"],
      where,
      _max: { addedAt: true },
      orderBy: { _max: { addedAt: "desc" } },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const pageProductIds = groupedPage.map((g) => g.productId);
  if (pageProductIds.length === 0) {
    return {
      items: [],
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  const rawRows = await prisma.linkLog.findMany({
    where: {
      AND: [where, { productId: { in: pageProductIds } }],
    },
    include: LINK_LOG_INCLUDE,
    orderBy: { addedAt: "desc" },
  });

  const consolidated = consolidateProductLinkLogs(rawRows);
  const byProductId = new Map<string, any>();
  for (const item of consolidated) {
    if (!byProductId.has(item.productId)) {
      byProductId.set(item.productId, item);
    }
  }

  // Preserve exact page ordering from groupBy (_max.addedAt DESC)
  const orderedItems = pageProductIds
    .map((pid) => byProductId.get(pid))
    .filter(Boolean);

  return {
    items: orderedItems,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
