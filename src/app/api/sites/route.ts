import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { slugifySite } from "@/lib/siteUtils";
import { cached, delByPattern } from "@/lib/redis";

// GET /api/sites?categoryId=123  or  GET /api/sites  (all authorized)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role;
    const userId = Number(session?.user?.id);

    const { searchParams } = new URL(req.url);
    const rawRoles: string[] = (session?.user as any)?.roles || [];
    const candidateRoles: string[] = [...rawRoles, userRole || ""].filter(Boolean);
    const normalizedUserRoles = Array.from(new Set(candidateRoles.map((r) => r.toUpperCase())));
    const requestedRole = searchParams.get("role") || searchParams.get("viewRole") || req.cookies.get("active_workspace_role")?.value;
    const effectiveRole = (requestedRole && (normalizedUserRoles.includes(requestedRole.toUpperCase()) || userRole === "SUPER_ADMIN" || userRole === "ADMIN"))
      ? requestedRole.toUpperCase()
      : (userRole || "");

    const categoryId = searchParams.get("categoryId");
    const cacheKey = `sites:${effectiveRole}:${userId || 0}:${categoryId || "all"}`;

    const formatted = await cached(cacheKey, 300, async () => {
      let allowedSiteIds: number[] | undefined = undefined;
      // WRITER and TEAM_LEAD can only view their assigned sites
      if (effectiveRole === "WRITER" || effectiveRole === "TEAM_LEAD") {
        const accesses = await prisma.siteAccess.findMany({
          where: { userId },
          select: { siteId: true },
        });
        allowedSiteIds = accesses.map((a) => a.siteId);
      }

      const [sites, linkCountsRaw] = await Promise.all([
        prisma.site.findMany({
          where: {
            ...(categoryId ? { categories: { some: { id: parseInt(categoryId) } } } : {}),
            ...(allowedSiteIds !== undefined ? { id: { in: allowedSiteIds } } : {}),
            name: { notIn: ["Product Research", "Product Research Hub"] },
          },
          select: {
            id: true,
            name: true,
            url: true,
            bridgeUrl: true,
            allowCountrySpecific: true,
            categories: {
              select: { id: true, name: true }
            },
            _count: {
              select: {
                products: true,
                categories: true
              }
            },
          },
          orderBy: { name: "asc" },
        }),
        prisma.$queryRaw<Array<{ siteId: number; linkCount: bigint }>>`
          SELECT p.siteId, COUNT(l.id) AS linkCount
          FROM LinkLog l
          INNER JOIN Product p ON l.productId = p.id
          GROUP BY p.siteId
        `,
      ]);

      const linkCountBySite = new Map<number, number>();
      for (const row of linkCountsRaw) {
        linkCountBySite.set(Number(row.siteId), Number(row.linkCount));
      }

      return sites.map(site => {
        const linksCount = linkCountBySite.get(site.id) ?? 0;
        const validCategories = site.categories.filter(
          (c) => c.name && !/^(n\/?a|none|null|na)$/i.test(c.name.trim())
        );
        return {
          id: site.id,
          name: site.name,
          slug: slugifySite(site.name),
          url: site.url,
          bridgeUrl: site.bridgeUrl,
          allowCountrySpecific: site.allowCountrySpecific ?? false,
          categories: validCategories,
          productsCount: site._count.products,
          categoriesCount: validCategories.length,
          linksCount: linksCount
        };
      });
    });

    return NextResponse.json(formatted);
  } catch (err: any) {
    console.error("[GET /api/sites]", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

// POST /api/sites - create a new site (Admin / Super Admin / Linker)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "LINKER") {
      return NextResponse.json({ error: "Forbidden: Site creation is restricted to Admin and Linker roles" }, { status: 403 });
    }

    const body = await req.json();
    const { name, url, bridgeUrl, categoryIds, allowCountrySpecific } = body;

    const trimmedName = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";

    if (!trimmedName) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9 ]+$/.test(trimmedName)) {
      return NextResponse.json(
        { error: "Special characters are not allowed. Only letters, numbers, and spaces are permitted for site names." },
        { status: 400 }
      );
    }

    const trimmedBridgeUrl = typeof bridgeUrl === "string" ? bridgeUrl.trim() : null;

    const site = await prisma.site.create({
      data: {
        name: trimmedName,
        url: typeof url === "string" && url.trim() ? url.trim() : null,
        bridgeUrl: trimmedBridgeUrl || null,
        allowCountrySpecific: Boolean(allowCountrySpecific),
        categories: {
          connect: Array.isArray(categoryIds) ? categoryIds.map((id: number) => ({ id })) : []
        }
      },
    });

    await delByPattern("sites:*");
    await delByPattern("dashboard:*");

    return NextResponse.json(site, { status: 201 });
  } catch (err) {
    console.error("[POST /api/sites]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
