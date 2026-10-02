import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendRealtimeNotification } from "@/lib/notifier";

// GET /api/products/[id]/site-availability
// Returns all sites and indicates which ones have this product available
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
      return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
    }

    const baseProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        site: { select: { id: true, name: true, url: true } },
        category: { select: { id: true, name: true } },
        addedBy: { select: { id: true, name: true, role: true } },
        updatedBy: { select: { id: true, name: true, role: true } },
      },
    });

    if (!baseProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Retrieve all active sites
    const allSites = await prisma.site.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        url: true,
        allowCountrySpecific: true,
      },
    });

    // Find all products that match this product's name
    const trimmedName = baseProduct.name.trim();
    const existingProducts = await prisma.product.findMany({
      where: {
        OR: [
          { name: trimmedName },
          { name: trimmedName.toLowerCase() },
          { name: trimmedName.toUpperCase() },
        ],
      },
      include: {
        site: { select: { id: true, name: true, url: true } },
        category: { select: { id: true, name: true } },
        addedBy: { select: { id: true, name: true, role: true } },
        updatedBy: { select: { id: true, name: true, role: true } },
        article: {
          select: {
            id: true,
            status: true,
            writer: { select: { id: true, name: true } },
          },
        },
        linkLogs: {
          select: {
            id: true,
            status: true,
            affiliateName: true,
          },
        },
      },
      orderBy: { addedAt: "desc" },
    });

    // Group by siteId
    const siteProductMap = new Map<number, typeof existingProducts[0]>();
    for (const ep of existingProducts) {
      if (ep.siteId && !siteProductMap.has(ep.siteId)) {
        siteProductMap.set(ep.siteId, ep);
      }
    }

    const researchedTargetsLower = (baseProduct.targetSites || "")
      .toLowerCase()
      .split(/[,|]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const siteAvailability = allSites.map((site) => {
      const match = siteProductMap.get(site.id);
      const isTarget = researchedTargetsLower.some(
        (target) =>
          site.name.toLowerCase().includes(target) ||
          target.includes(site.name.toLowerCase())
      );

      return {
        siteId: site.id,
        siteName: site.name,
        siteUrl: site.url,
        isAvailable: Boolean(match),
        isResearchedTarget: isTarget,
        product: match
          ? {
              id: match.id,
              name: match.name,
              slug: match.slug,
              country: match.country,
              categoryId: match.categoryId,
              categoryName: match.category?.name,
              productCategory: match.productCategory,
              addedAt: match.addedAt,
              addedBy: match.addedBy?.name || "Unknown",
              addedByRole: match.addedBy?.role || null,
              addedToSiteBy: match.updatedBy?.name || null,
              addedToSiteByRole: match.updatedBy?.role || null,
              updatedAt: match.updatedAt,
              article: match.article
                ? {
                    id: match.article.id,
                    status: match.article.status,
                    writerName: match.article.writer?.name || "Unassigned",
                  }
                : null,
              linkCount: match.linkLogs.length,
            }
          : null,
      };
    });

    const totalSites = allSites.length;
    const availableCount = siteAvailability.filter((s) => s.isAvailable).length;

    return NextResponse.json({
      productName: baseProduct.name,
      baseProductId: baseProduct.id,
      isUnassigned: baseProduct.siteId === null || baseProduct.site?.name === "Product Research",
      targetSites: baseProduct.targetSites,
      researchedBy: baseProduct.addedBy?.name || null,
      researchedByRole: baseProduct.addedBy?.role || null,
      addedToSiteBy: baseProduct.updatedBy?.name || null,
      addedToSiteByRole: baseProduct.updatedBy?.role || null,
      totalSites,
      availableCount,
      missingCount: totalSites - availableCount,
      sites: siteAvailability,
    });
  } catch (err: any) {
    console.error("[GET /api/products/:id/site-availability]", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/products/[id]/site-availability
// Linker action to add/publish this product to a target site
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    const userRoles: string[] = (session.user as any)?.roles || (role ? [role] : []);
    const canAdd =
      role === "LINKER" ||
      role === "ADMIN" ||
      role === "SUPER_ADMIN" ||
      role === "PRODUCT_RESEARCHER" ||
      userRoles.includes("LINKER") ||
      userRoles.includes("ADMIN") ||
      userRoles.includes("SUPER_ADMIN") ||
      userRoles.includes("PRODUCT_RESEARCHER");

    if (!canAdd) {
      return NextResponse.json(
        { error: "Access Denied: Only Linkers, Product Researchers, and Admins can add products to sites." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
      return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
    }

    const body = await req.json();
    const { targetSiteId, targetSiteIds } = body;

    // Handle single or multiple site IDs
    const siteIdsToAdd: number[] = Array.isArray(targetSiteIds) && targetSiteIds.length > 0
      ? targetSiteIds.map(Number)
      : targetSiteId
      ? [Number(targetSiteId)]
      : [];

    if (siteIdsToAdd.length === 0) {
      return NextResponse.json(
        { error: "Target site ID(s) required." },
        { status: 400 }
      );
    }

    const sourceProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        site: true,
        addedBy: { select: { id: true, name: true, role: true } },
      },
    });

    if (!sourceProduct) {
      return NextResponse.json({ error: "Source product not found." }, { status: 404 });
    }

    const createdList: any[] = [];
    const errors: string[] = [];

    let activeUserId = Number(session.user.id) || sourceProduct.addedById;
    const existingUser = await prisma.user.findUnique({
      where: { id: activeUserId },
      select: { id: true },
    });
    if (!existingUser) {
      const fallbackUser = await prisma.user.findFirst({ select: { id: true } });
      if (fallbackUser) {
        activeUserId = fallbackUser.id;
      }
    }

    for (const sId of siteIdsToAdd) {
      const targetSite = await prisma.site.findUnique({
        where: { id: sId },
      });
      if (!targetSite) {
        errors.push(`Site #${sId} not found.`);
        continue;
      }

      // Check if product with same name already exists on this site
      const existing = await prisma.product.findFirst({
        where: {
          siteId: sId,
          name: { equals: sourceProduct.name.trim() },
        },
      });

      if (existing) {
        errors.push(`"${sourceProduct.name}" already exists on site "${targetSite.name}".`);
        continue;
      }

      // Find or connect category for this site
      let targetCategory = await prisma.category.findFirst({
        where: {
          id: sourceProduct.categoryId,
        },
        include: { sites: true },
      });

      if (!targetCategory) {
        targetCategory = await prisma.category.findFirst({
          where: { name: sourceProduct.category.name },
          include: { sites: true },
        });
      }

      // Connect category to this site if not connected
      if (targetCategory && !targetCategory.sites.some((s) => s.id === sId)) {
        await prisma.category.update({
          where: { id: targetCategory.id },
          data: {
            sites: { connect: { id: sId } },
          },
        });
      }

      const finalCategoryId = targetCategory ? targetCategory.id : sourceProduct.categoryId;

      // Create or assign product on target site
      let newProduct;
      if (sourceProduct.siteId === null && createdList.length === 0) {
        newProduct = await prisma.product.update({
          where: { id: sourceProduct.id },
          data: {
            siteId: sId,
            categoryId: finalCategoryId,
            updatedById: activeUserId,
          },
          include: {
            site: { select: { id: true, name: true, url: true } },
            category: { select: { id: true, name: true } },
            addedBy: { select: { id: true, name: true, role: true } },
            updatedBy: { select: { id: true, name: true, role: true } },
          },
        });
      } else {
        newProduct = await prisma.product.create({
          data: {
            name: sourceProduct.name,
            slug: sourceProduct.slug,
            country: sourceProduct.country,
            isNative: sourceProduct.isNative,
            source: sourceProduct.source,
            siteId: sId,
            targetSites: sourceProduct.targetSites,
            categoryId: finalCategoryId,
            productCategory: sourceProduct.productCategory,
            trendLink: sourceProduct.trendLink,
            trendLevel: sourceProduct.trendLevel,
            affiliateName: sourceProduct.affiliateName,
            previewLink: sourceProduct.previewLink,
            remarks: sourceProduct.remarks,
            // Preserve original researcher as addedBy and original research date
            addedById: sourceProduct.addedById,
            addedAt: sourceProduct.addedAt,
            // Record person who clicked "Add to Site" as updatedById
            updatedById: activeUserId,
          },
          include: {
            site: { select: { id: true, name: true, url: true } },
            category: { select: { id: true, name: true } },
            addedBy: { select: { id: true, name: true, role: true } },
            updatedBy: { select: { id: true, name: true, role: true } },
          },
        });
      }

      // Auto-create PENDING article for writers on that site
      const newArticle = await prisma.article.create({
        data: {
          productId: newProduct.id,
          status: "PENDING",
          country: newProduct.country || null,
        },
      });

      // Record in ArticleHistory for audit trail / site activity
      const adderName = session.user.name || "User";
      const originalResearcher = sourceProduct.addedBy?.name;
      await prisma.articleHistory.create({
        data: {
          articleId: newArticle.id,
          updatedById: activeUserId,
          newStatus: "PENDING",
          notes: `Product added to site "${targetSite.name}" by ${adderName}${
            originalResearcher ? ` (Researched by: ${originalResearcher})` : ""
          }`,
        },
      });

      // Send real-time notification to writers with access to this site
      const writerAccesses = await prisma.siteAccess.findMany({
        where: { siteId: sId, user: { role: "WRITER" } },
        select: { userId: true },
      });

      for (const wa of writerAccesses) {
        if (wa.userId === activeUserId) continue;
        const notif = await prisma.notification.create({
          data: {
            recipientId: wa.userId,
            senderId: activeUserId,
            type: "PRODUCT_ADDED",
            message: `New product "${newProduct.name}" added to site "${targetSite.name}". Assigned for writing.`,
          },
        });
        await sendRealtimeNotification(wa.userId, notif);
      }

      createdList.push({
        product: newProduct,
        article: newArticle,
        siteName: targetSite.name,
      });
    }

    if (createdList.length === 0 && errors.length > 0) {
      return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      createdCount: createdList.length,
      created: createdList,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error("[POST /api/products/:id/site-availability]", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
