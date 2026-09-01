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
    const { name, categoryIds, excludedSiteIds, trendLink, trendLevel, affiliateName, previewLink, remarks, productCategory } = body;
    const excludedSet = new Set(Array.isArray(excludedSiteIds) ? excludedSiteIds.map(Number) : []);

    // Basic validation
    if (!name || !categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return NextResponse.json(
        { error: "name and categoryIds array are required" },
        { status: 400 }
      );
    }

    const activeUserId = session.user.id;
    const activeUserRole = session.user.role;

    if (
      activeUserRole !== "LINKER" &&
      activeUserRole !== "ADMIN" &&
      activeUserRole !== "SUPER_ADMIN" &&
      activeUserRole !== "WRITER"
    ) {
      return NextResponse.json(
        { error: "Only Linkers, Admins, Super Admins, and Writers can add products." },
        { status: 403 }
      );
    }

    const trimmedName = name.trim();

    // Check if a product with the same name already exists in the system
    const existingProducts = await prisma.product.findMany({
      where: {
        OR: [
          { name: trimmedName },
          { name: trimmedName.toLowerCase() },
          { name: trimmedName.toUpperCase() },
        ],
      },
      include: {
        addedBy: { select: { name: true } },
        article: {
          select: {
            writer: { select: { name: true } },
          },
        },
      },
      orderBy: { addedAt: "desc" },
    });

    const matchingProducts = existingProducts.filter(
      (p) => p.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (matchingProducts.length > 0) {
      const writers = Array.from(
        new Set(matchingProducts.map((p) => p.article?.writer?.name).filter(Boolean))
      );
      const addedBys = Array.from(
        new Set(matchingProducts.map((p) => p.addedBy?.name).filter(Boolean))
      );

      const writerPart = writers.join(", ");
      const addedByPart = addedBys.join(", ");

      let errorMsg = "";
      if (addedByPart && writerPart && addedByPart !== writerPart) {
        errorMsg = `This product has been already added by ${addedByPart} or writer ${writerPart}.`;
      } else if (writerPart && (!addedByPart || addedByPart === writerPart)) {
        errorMsg = `This product has been already added by writer ${writerPart}.`;
      } else {
        errorMsg = `This product has been already added by ${addedByPart || "another user"}.`;
      }

      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    // If activeUser is WRITER, filter only sites the writer has access to
    let allowedSiteIds: number[] | null = null;
    if (activeUserRole === "WRITER") {
      const accesses = await prisma.siteAccess.findMany({
        where: { userId: activeUserId },
        select: { siteId: true },
      });
      allowedSiteIds = accesses.map((a) => a.siteId);
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
        if (excludedSet.has(site.id)) {
          continue;
        }
        if (allowedSiteIds !== null && !allowedSiteIds.includes(site.id)) {
          continue;
        }
        productsToCreate.push({
          name: trimmedName,
          siteId: site.id,
          categoryId: cat.id,
          productCategory: productCategory && typeof productCategory === "string" ? productCategory.trim() : null,
          trendLink: trendLink || null,
          trendLevel: trendLevel || "HIGH",
          affiliateName: affiliateName || null,
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

    // Auto-create LinkLog if affiliateName was provided
    if (affiliateName && affiliateName.trim()) {
      for (const p of createdProducts) {
        const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const buyUrl = p.site.url ? `${p.site.url.replace(/\/+$/, "")}/${slug}` : null;

        await prisma.linkLog.create({
          data: {
            productId: p.id,
            addedById: activeUserId,
            affiliateName: affiliateName.trim(),
            affiliateLink: p.previewLink || p.trendLink || "",
            bridgePageLink: null,
            buyLink: buyUrl,
            status: "REQUESTED",
            linkerRemarks: p.remarks || null,
          },
        });
      }
    }

    // Notify writers who have access to the sites of these products
    for (const p of createdProducts) {
      const accesses = await prisma.siteAccess.findMany({
        where: { siteId: p.siteId, user: { role: "WRITER" } },
        select: { userId: true },
      });
      for (const access of accesses) {
        if (access.userId === activeUserId) continue; // Skip logged-in user who added the product
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
      site: { select: { id: true, name: true, url: true } },
      category: { select: { id: true, name: true } },
      addedBy: { select: { id: true, name: true } },
      article: { select: { id: true, status: true, writer: { select: { id: true, name: true } } } },
      linkLogs: { include: { geos: true } },
    },
    orderBy: { addedAt: "desc" },
  });

  return NextResponse.json(products);
}
