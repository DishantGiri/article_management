import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { consolidateLinkLogs } from "@/lib/utils";
import { cached } from "@/lib/redis";

// GET /api/articles - list articles with server-side pagination & filtering
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const writerId = searchParams.get("writerId");
  const writer = searchParams.get("writer");
  const status = searchParams.get("status");
  const productId = searchParams.get("productId");
  const siteId = searchParams.get("siteId");
  const site = searchParams.get("site");
  const search = searchParams.get("search");
  const exact = searchParams.get("exact") === "true" || searchParams.get("exact") === "1";
  const all = searchParams.get("all") === "true" || searchParams.get("all") === "1";

  // Pagination parameters
  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");
  const isPaginated = !all && (pageParam !== null || limitParam !== null);
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitParam || "10", 10) || 10));

  const userId = String(session.user.id);
  const userRole = session.user.role;

  const rawRoles: string[] = (session.user as any)?.roles || [];
  const candidateRoles: string[] = [...rawRoles, userRole || ""].filter(Boolean);
  const normalizedUserRoles = Array.from(new Set(candidateRoles.map((r) => r.toUpperCase())));
  const requestedRole = searchParams.get("role") || searchParams.get("viewRole") || req.cookies.get("active_workspace_role")?.value;
  const effectiveRole = (requestedRole && (normalizedUserRoles.includes(requestedRole.toUpperCase()) || userRole === "SUPER_ADMIN" || userRole === "ADMIN"))
    ? requestedRole.toUpperCase()
    : (userRole || "");

  const whereConditions: any[] = [];

  if (effectiveRole === "TEAM_LEAD") {
    const accesses = await prisma.siteAccess.findMany({
      where: { userId },
      select: { siteId: true },
    });
    const siteIds = accesses.map((a) => a.siteId);
    whereConditions.push({
      product: { siteId: { in: siteIds } },
      OR: [
        { writerId: userId },
        { writer: { teamLeadId: userId } },
        { status: "PENDING" },
      ],
    });
  } else if (effectiveRole === "WRITER") {
    const accesses = await prisma.siteAccess.findMany({
      where: { userId },
      select: { siteId: true },
    });
    const siteIds = accesses.map((a) => a.siteId);
    whereConditions.push({
      OR: [
        { product: { siteId: { in: siteIds } } },
        { writerId: userId },
      ],
    });
  }

  if (writerId) {
    whereConditions.push({ writerId: writerId.trim() });
  } else if (writer && writer.trim()) {
    const trimmedWriter = writer.trim();
    whereConditions.push({
      OR: [
        { writerId: trimmedWriter },
        { writer: { name: trimmedWriter } },
      ],
    });
  }

  if (siteId) {
    whereConditions.push({ product: { siteId: siteId.trim() } });
  } else if (site && site.trim()) {
    const trimmedSite = site.trim();
    whereConditions.push({
      OR: [
        { product: { siteId: trimmedSite } },
        { product: { site: { name: trimmedSite } } },
      ],
    });
  }

  if (productId) {
    whereConditions.push({ productId: productId.trim() });
  }

  if (status && status.trim()) {
    const cleanStatus = status.trim().toUpperCase();
    if (cleanStatus === "NO_LINKS") {
      whereConditions.push({
        OR: [
          { articleLink: { not: null } },
          { status: { in: ["APPROVED", "COMPLETED"] } },
        ],
        product: {
          linkLogs: {
            none: {
              OR: [
                { affiliateLink: { not: "" } },
                { geos: { some: {} } },
              ],
            },
          },
        },
      });
    } else if (["PENDING", "IN_PROGRESS", "COMPLETED", "APPROVED", "REDO", "REDIRECTED"].includes(cleanStatus)) {
      whereConditions.push({ status: cleanStatus });
    }
  }

  if (search && search.trim()) {
    const q = search.trim();
    if (exact) {
      whereConditions.push({
        OR: [
          { product: { name: { equals: q } } },
          { product: { slug: { equals: q } } },
        ],
      });
    } else {
      const searchConditions: any[] = [
        { id: q },
        { productId: q },
        { product: { name: { contains: q } } },
        { product: { slug: { contains: q } } },
        { writer: { name: { contains: q } } },
        { product: { site: { name: { contains: q } } } },
      ];
      whereConditions.push({ OR: searchConditions });
    }
  }

  const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

  const includeQuery = {
    product: {
      include: {
        site: { select: { id: true, name: true, url: true, allowCountrySpecific: true } },
        category: { select: { id: true, name: true } },
        addedBy: { select: { id: true, name: true } },
        linkLogs: {
          include: { geos: true },
          orderBy: { addedAt: "desc" as const },
          take: 5,
        },
      },
    },
    writer: { select: { id: true, name: true } },
    reviews: {
      include: { reviewedBy: { select: { name: true } } },
      orderBy: { reviewedAt: "desc" as const },
      take: 1,
    },
    history: {
      select: { notes: true, updatedAt: true },
      orderBy: { updatedAt: "desc" as const },
      take: 2,
    },
  };

  const cacheKey = `articles:${effectiveRole}:${userId || 0}:${isPaginated ? `p${page}_l${limit}` : "all"}:${search || "none"}:${status || "none"}:${writerId || writer || "none"}:${siteId || site || "none"}:${productId || "none"}:${exact ? "1" : "0"}`;

  const result = await cached(cacheKey, 60, async () => {
    if (isPaginated) {
      const [total, list] = await Promise.all([
        prisma.article.count({ where }),
        prisma.article.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          include: includeQuery,
          orderBy: { updatedAt: "desc" },
        }),
      ]);

      for (const a of list) {
        if (a.product?.linkLogs) {
          (a.product as any).linkLogs = consolidateLinkLogs(a.product.linkLogs);
        }
      }

      return {
        articles: list,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } else {
      const list = await prisma.article.findMany({
        where,
        include: includeQuery,
        orderBy: { updatedAt: "desc" },
      });

      for (const a of list) {
        if (a.product?.linkLogs) {
          (a.product as any).linkLogs = consolidateLinkLogs(a.product.linkLogs);
        }
      }

      return list;
    }
  });

  return NextResponse.json(result);
}
