import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/products  — create a new product
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, siteId, categoryId, trendLink, previewLink, remarks, addedById } = body;

    // Basic validation
    if (!name || !siteId || !categoryId || !addedById) {
      return NextResponse.json(
        { error: "name, siteId, categoryId, and addedById are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(addedById) },
      select: { role: true },
    });

    if (!user || (user.role !== "LINKER" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json(
        { error: "Only Linkers, Admins, and Super Admins can add products." },
        { status: 403 }
      );
    }

    const site = await prisma.site.findUnique({
      where: { id: Number(siteId) },
      select: { id: true },
    });

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const product = await prisma.product.create({
      data: {
        name,
        siteId: Number(siteId),
        categoryId: Number(categoryId),
        trendLink: trendLink || null,
        previewLink: previewLink || null,
        remarks: remarks || null,
        addedById: Number(addedById),
      },
      include: {
        site: { select: { name: true } },
        category: { select: { name: true } },
        addedBy: { select: { name: true } },
      },
    });

    // Auto-create a PENDING article for the product
    await prisma.article.create({
      data: { productId: product.id, status: "PENDING" },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    console.error("[POST /api/products]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/products?siteId=1  — list products (optionally filtered by site, role site-access rules enforced)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("siteId");
  const categoryId = searchParams.get("categoryId");
  const userIdStr = searchParams.get("userId");

  let allowedSiteIds: number[] | undefined = undefined;

  if (userIdStr) {
    const userId = parseInt(userIdStr);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role === "WRITER" || user?.role === "TEAM_LEAD") {
      const accesses = await prisma.siteAccess.findMany({
        where: { userId },
        select: { siteId: true },
      });
      allowedSiteIds = accesses.map((a) => a.siteId);
    }
  }

  const products = await prisma.product.findMany({
    where: {
      ...(siteId ? { siteId: parseInt(siteId) } : {}),
      ...(categoryId ? { categoryId: parseInt(categoryId) } : {}),
      ...(allowedSiteIds !== undefined ? { siteId: { in: allowedSiteIds } } : {}),
    },
    include: {
      site: { select: { name: true } },
      category: { select: { name: true } },
      addedBy: { select: { name: true } },
      article: { select: { id: true, status: true } },
    },
    orderBy: { addedAt: "desc" },
  });

  return NextResponse.json(products);
}
