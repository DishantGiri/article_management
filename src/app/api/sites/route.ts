import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/sites?categoryId=123  or  GET /api/sites  (all)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");

    const sites = await prisma.site.findMany({
      where: categoryId ? { categories: { some: { id: parseInt(categoryId) } } } : undefined,
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

// POST /api/sites — create a new site
export async function POST(req: NextRequest) {
  try {
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
