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

    // Fetch site to get productType (auto-set on product)
    const site = await prisma.site.findUnique({
      where: { id: Number(siteId) },
      select: { productType: true },
    });

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const product = await prisma.product.create({
      data: {
        name,
        productType: site.productType,
        siteId: Number(siteId),
        categoryId: Number(categoryId),
        trendLink: trendLink || null,
        previewLink: previewLink || null,
        remarks: remarks || null,
        addedById: Number(addedById),
      },
      include: {
        site: { select: { name: true, productType: true } },
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

// GET /api/products?siteId=1  — list products (optionally filtered by site)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("siteId");
  const categoryId = searchParams.get("categoryId");
  const productType = searchParams.get("productType");

  const products = await prisma.product.findMany({
    where: {
      ...(siteId ? { siteId: parseInt(siteId) } : {}),
      ...(categoryId ? { categoryId: parseInt(categoryId) } : {}),
      ...(productType ? { productType: productType as "NUTRA" | "ECOM" } : {}),
    },
    include: {
      site: { select: { name: true } },
      category: { select: { name: true } },
      addedBy: { select: { name: true } },
    },
    orderBy: { addedAt: "desc" },
  });

  return NextResponse.json(products);
}
