import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRealtimeNotification } from "@/lib/notifier";

// POST /api/products  — create a new product
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, categoryIds, trendLink, previewLink, remarks, addedById } = body;

    // Basic validation
    if (!name || !categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0 || !addedById) {
      return NextResponse.json(
        { error: "name, categoryIds array, and addedById are required" },
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

    const categoriesWithSites = await prisma.category.findMany({
      where: { id: { in: categoryIds.map(Number) } },
      include: { sites: true },
    });

    if (categoriesWithSites.length === 0) {
      return NextResponse.json({ error: "No valid categories found" }, { status: 404 });
    }

    const productsToCreate = [];
    for (const cat of categoriesWithSites) {
      for (const site of cat.sites) {
        productsToCreate.push({
          name,
          siteId: site.id,
          categoryId: cat.id,
          trendLink: trendLink || null,
          previewLink: previewLink || null,
          remarks: remarks || null,
          addedById: Number(addedById),
        });
      }
    }

    if (productsToCreate.length === 0) {
      return NextResponse.json({ error: "No sites associated with the selected categories" }, { status: 400 });
    }

    const createdProducts = await prisma.$transaction(
      productsToCreate.map((p) =>
        prisma.product.create({
          data: p,
          include: {
            site: { select: { name: true, url: true } },
            category: { select: { name: true } },
            addedBy: { select: { name: true } },
          },
        })
      )
    );

    // Auto-create a PENDING article for each product
    await prisma.$transaction(
      createdProducts.map((p) =>
        prisma.article.create({
          data: { productId: p.id, status: "PENDING" },
        })
      )
    );

    // Notify writers who have access to the sites of these products
    for (const p of createdProducts) {
      const accesses = await prisma.siteAccess.findMany({
        where: { siteId: p.siteId, user: { role: "WRITER" } },
        select: { userId: true },
      });
      for (const access of accesses) {
        const notif = await prisma.notification.create({
          data: {
            recipientId: access.userId,
            senderId: Number(addedById),
            type: "PRODUCT_ADDED",
            message: `New product "${p.name}" has been added to site "${p.site.name}".`,
          },
        });
        await sendRealtimeNotification(access.userId, notif);
      }
    }

    return NextResponse.json(createdProducts, { status: 201 });
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
      site: { select: { name: true, url: true } },
      category: { select: { name: true } },
      addedBy: { select: { name: true } },
      article: { select: { id: true, status: true, writer: { select: { name: true } } } },
      linkLogs: { include: { geos: true } },
    },
    orderBy: { addedAt: "desc" },
  });

  return NextResponse.json(products);
}
