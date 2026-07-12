import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRealtimeNotification } from "@/lib/notifier";

// POST /api/products/import — Import products from parsed CSV
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { products, addedById } = body;

    if (!products || !Array.isArray(products) || !addedById) {
      return NextResponse.json(
        { error: "products array and addedById are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(addedById) },
      select: { role: true },
    });

    if (!user || (user.role !== "LINKER" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json(
        { error: "Only Linkers, Admins, and Super Admins can import products." },
        { status: 403 }
      );
    }

    const importedProducts = [];
    const errors = [];

    for (let i = 0; i < products.length; i++) {
      const row = products[i];
      const rowNum = i + 1;

      if (!row.name || !row.siteName || !row.categoryName) {
        errors.push(`Row ${rowNum}: Name, Site Name, and Category Name are required.`);
        continue;
      }

      try {
        // Find or create Category
        let category = await prisma.category.findUnique({
          where: { name: row.categoryName },
        });
        if (!category) {
          category = await prisma.category.create({
            data: { name: row.categoryName },
          });
        }

        // Find or create Site
        let site = await prisma.site.findFirst({
          where: { name: row.siteName },
        });
        if (!site) {
          site = await prisma.site.create({
            data: { name: row.siteName },
          });
        }

        // Ensure Site and Category are connected (many-to-many)
        const siteWithCategories = await prisma.site.findUnique({
          where: { id: site.id },
          include: { categories: { select: { id: true } } },
        });
        const hasCategory = siteWithCategories?.categories.some((c) => c.id === category.id);

        if (!hasCategory) {
          await prisma.site.update({
            where: { id: site.id },
            data: {
              categories: {
                connect: { id: category.id },
              },
            },
          });
        }

        // Create the product
        const newProduct = await prisma.product.create({
          data: {
            name: row.name,
            siteId: site.id,
            categoryId: category.id,
            trendLink: row.trendLink || null,
            previewLink: row.previewLink || null,
            remarks: row.remarks || null,
            addedById: Number(addedById),
          },
          include: {
            site: { select: { name: true, url: true } },
            category: { select: { name: true } },
            addedBy: { select: { name: true } },
          },
        });

        // Auto-create a PENDING article
        await prisma.article.create({
          data: { productId: newProduct.id, status: "PENDING" },
        });

        // Notify writers who have access to this site
        const accesses = await prisma.siteAccess.findMany({
          where: { siteId: site.id, user: { role: "WRITER" } },
          select: { userId: true },
        });

        for (const access of accesses) {
          const notif = await prisma.notification.create({
            data: {
              recipientId: access.userId,
              senderId: Number(addedById),
              type: "PRODUCT_ADDED",
              message: `New product "${newProduct.name}" has been added to site "${site.name}".`,
            },
          });
          await sendRealtimeNotification(access.userId, notif);
        }

        importedProducts.push(newProduct);
      } catch (rowErr: any) {
        errors.push(`Row ${rowNum}: Failed to import product due to: ${rowErr.message}`);
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      importedCount: importedProducts.length,
      errors,
    });
  } catch (err: any) {
    console.error("[POST /api/products/import]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
