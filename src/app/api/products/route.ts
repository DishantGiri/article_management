import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRealtimeNotification } from "@/lib/notifier";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// POST /api/products  — create a new product
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, categoryIds, trendLink, previewLink, remarks } = body;

    // Basic validation
    if (!name || !categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return NextResponse.json(
        { error: "name and categoryIds array are required" },
        { status: 400 }
      );
    }

    const activeUserId = session.user.id;
    const activeUserRole = session.user.role;

    if (activeUserRole !== "LINKER" && activeUserRole !== "ADMIN" && activeUserRole !== "SUPER_ADMIN") {
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
          addedById: activeUserId,
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
            senderId: activeUserId,
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
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("siteId");
  const categoryId = searchParams.get("categoryId");

  let allowedSiteIds: number[] | undefined = undefined;
  let onlyPending = false;

  const userId = session.user.id;
  const userRole = session.user.role;

  if (userRole === "WRITER") {
    onlyPending = true;
    const accesses = await prisma.siteAccess.findMany({
      where: { userId },
      select: { siteId: true },
    });
    allowedSiteIds = accesses.map((a) => a.siteId);
  }

  const products = await prisma.product.findMany({
    where: {
      ...(siteId ? { siteId: parseInt(siteId) } : {}),
      ...(categoryId ? { categoryId: parseInt(categoryId) } : {}),
      ...(allowedSiteIds !== undefined ? { siteId: { in: allowedSiteIds } } : {}),
      ...(onlyPending ? { article: { status: "PENDING" } } : {}),
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
