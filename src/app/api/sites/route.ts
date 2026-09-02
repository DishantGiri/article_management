import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { slugifySite } from "@/lib/siteUtils";

// GET /api/sites?categoryId=123  or  GET /api/sites  (all authorized)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    const userId = Number(session?.user?.id);

    let allowedSiteIds: number[] | undefined = undefined;
    // WRITER and TEAM_LEAD can only view their assigned sites
    if (role === "WRITER" || role === "TEAM_LEAD") {
      const accesses = await prisma.siteAccess.findMany({
        where: { userId },
        select: { siteId: true },
      });
      allowedSiteIds = accesses.map((a) => a.siteId);
    }

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");

    const sites = await prisma.site.findMany({
      where: {
        ...(categoryId ? { categories: { some: { id: parseInt(categoryId) } } } : {}),
        ...(allowedSiteIds !== undefined ? { id: { in: allowedSiteIds } } : {}),
      },
      select: { 
        id: true, 
        name: true, 
        url: true,
        categories: {
          select: { id: true, name: true }
        },
        _count: {
          select: {
            products: true,
            categories: true
          }
        },
        products: {
          select: {
            _count: {
              select: { linkLogs: true }
            }
          }
        }
      },
      orderBy: { name: "asc" },
    });

    const formatted = sites.map(site => {
      const linksCount = site.products.reduce((acc, p) => acc + p._count.linkLogs, 0);
      return {
        id: site.id,
        name: site.name,
        slug: slugifySite(site.name),
        url: site.url,
        categories: site.categories,
        productsCount: site._count.products,
        categoriesCount: site._count.categories,
        linksCount: linksCount
      };
    });

    return NextResponse.json(formatted);
  } catch (err: any) {
    console.error("[GET /api/sites]", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

// POST /api/sites — create a new site (Admin / Super Admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Site creation is restricted to Admin role" }, { status: 403 });
    }

    const body = await req.json();
    const { name, url, categoryIds } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const site = await prisma.site.create({
      data: {
        name,
        url,
        categories: {
          connect: Array.isArray(categoryIds) ? categoryIds.map((id: number) => ({ id })) : []
        }
      },
    });

    return NextResponse.json(site, { status: 201 });
  } catch (err) {
    console.error("[POST /api/sites]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
