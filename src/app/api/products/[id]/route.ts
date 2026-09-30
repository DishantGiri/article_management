import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/products/[id] - retrieve product details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        site: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        addedBy: { select: { name: true } },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (err) {
    console.error("[GET /api/products/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/products/[id] - update product details
export async function PATCH(
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
    const canUpdate =
      role === "LINKER" ||
      role === "ADMIN" ||
      role === "SUPER_ADMIN" ||
      role === "PRODUCT_RESEARCHER" ||
      userRoles.includes("LINKER") ||
      userRoles.includes("ADMIN") ||
      userRoles.includes("SUPER_ADMIN") ||
      userRoles.includes("PRODUCT_RESEARCHER");

    if (!canUpdate) {
      return NextResponse.json(
        { error: "Access Denied: Only Linkers, Product Researchers, Admins, and Super Admins can update products." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const {
      name,
      slug,
      siteId,
      categoryId,
      productCategory,
      trendLink,
      trendLevel,
      affiliateName,
      previewLink,
      remarks,
      isNative,
      source,
      allProductIds,
    } = body;

    const existing = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: { site: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (name !== undefined) {
      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return NextResponse.json(
          { error: "Product name must be at least 2 characters." },
          { status: 400 }
        );
      }
    }

    const oldName = existing.name.trim();
    const targetName = name !== undefined ? name.trim() : oldName;
    const explicitIds = Array.isArray(allProductIds)
      ? allProductIds.map(Number).filter((n) => !isNaN(n))
      : [];

    // Find all sibling product records representing this product across all sites
    const siblingProducts = await prisma.product.findMany({
      where: {
        OR: [
          ...(explicitIds.length > 0 ? [{ id: { in: explicitIds } }] : []),
          { id: parseInt(id) },
          { name: oldName },
          { name: oldName.toLowerCase() },
          { name: oldName.toUpperCase() },
        ],
      },
      select: {
        id: true,
        siteId: true,
        name: true,
        site: { select: { id: true, name: true } },
      },
    });

    const siblingIds = Array.from(new Set(siblingProducts.map((p) => p.id)));
    const siblingSiteIds = Array.from(new Set(siblingProducts.map((p) => p.siteId)));

    const isRenaming = targetName.toLowerCase() !== oldName.toLowerCase();
    const isSingleProduct = siblingIds.length <= 1;
    const targetSiteId = siteId !== undefined ? Number(siteId) : existing.siteId;
    const isSiteChanging = isSingleProduct && targetSiteId !== existing.siteId;

    if (isRenaming) {
      // Check if targetName already exists on any of the sites this product is on
      const conflictProducts = await prisma.product.findMany({
        where: {
          id: { notIn: siblingIds },
          siteId: { in: siblingSiteIds },
          OR: [
            { name: targetName },
            { name: targetName.toLowerCase() },
            { name: targetName.toUpperCase() },
          ],
        },
        include: {
          site: { select: { name: true } },
          addedBy: { select: { name: true } },
        },
      });

      const matching = conflictProducts.filter(
        (p) => p.name.trim().toLowerCase() === targetName.toLowerCase()
      );

      if (matching.length > 0) {
        const addedByName = matching[0].addedBy?.name;
        const siteName = matching[0].site?.name;
        const siteSuffix = siteName ? ` on site ${siteName}` : "";
        const errorMsg = `Product "${targetName}" already added by linker ${addedByName || "another linker"}${siteSuffix}.`;

        return NextResponse.json({ error: errorMsg }, { status: 400 });
      }
    }

    if (isSiteChanging) {
      // Check if targetName already exists on the new site
      const conflictOnNewSite = await prisma.product.findMany({
        where: {
          id: { notIn: siblingIds },
          siteId: targetSiteId,
          OR: [
            { name: targetName },
            { name: targetName.toLowerCase() },
            { name: targetName.toUpperCase() },
          ],
        },
        include: {
          site: { select: { name: true } },
          addedBy: { select: { name: true } },
        },
      });

      const matching = conflictOnNewSite.filter(
        (p) => p.name.trim().toLowerCase() === targetName.toLowerCase()
      );

      if (matching.length > 0) {
        const addedByName = matching[0].addedBy?.name;
        const siteName = matching[0].site?.name;
        return NextResponse.json(
          {
            error: `Product "${targetName}" already exists on site ${siteName || targetSiteId} (added by ${
              addedByName || "another user"
            }).`,
          },
          { status: 400 }
        );
      }
    }

    const sanitizedSlug =
      slug !== undefined
        ? slug
          ? slug
              .trim()
              .toLowerCase()
              .replace(/[^\w\s-]/g, "")
              .replace(/[\s_-]+/g, "-")
              .replace(/^-+|-+$/g, "")
          : null
        : name !== undefined
        ? targetName
            .toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .replace(/[\s_-]+/g, "-")
            .replace(/^-+|-+$/g, "")
        : undefined;

    const updateData: any = {
      ...(name !== undefined ? { name: targetName } : {}),
      ...(sanitizedSlug !== undefined ? { slug: sanitizedSlug } : {}),
      ...(categoryId !== undefined ? { categoryId: Number(categoryId) } : {}),
      ...(productCategory !== undefined ? { productCategory: productCategory ? productCategory.trim() : null } : {}),
      ...(source !== undefined ? { source: source ? source.trim() : null } : {}),
      ...(isNative !== undefined ? { isNative: Boolean(isNative) } : {}),
      ...(trendLink !== undefined ? { trendLink: trendLink || null } : {}),
      ...(trendLevel !== undefined ? { trendLevel: trendLevel || "HIGH" } : {}),
      ...(affiliateName !== undefined ? { affiliateName: affiliateName || null } : {}),
      ...(previewLink !== undefined ? { previewLink: previewLink || null } : {}),
      ...(remarks !== undefined ? { remarks: remarks || null } : {}),
    };

    if (isSingleProduct && isSiteChanging) {
      updateData.siteId = targetSiteId;
    }

    // Synchronize all instances of this product across all sites
    await prisma.product.updateMany({
      where: { id: { in: siblingIds } },
      data: updateData,
    });

    // If product name changed, also update denormalized productName on SpecialApproval
    if (isRenaming) {
      const articles = await prisma.article.findMany({
        where: { productId: { in: siblingIds } },
        select: { id: true },
      });
      if (articles.length > 0) {
        await prisma.specialApproval.updateMany({
          where: { articleId: { in: articles.map((a) => a.id) } },
          data: { productName: targetName },
        });
      }
    }

    const updated = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        site: { select: { name: true } },
        category: { select: { name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/products/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/products/[id] - delete a product (and cascade-deleted related articles and links)
export async function DELETE(
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
    const canDelete =
      role === "LINKER" ||
      role === "ADMIN" ||
      role === "SUPER_ADMIN" ||
      role === "PRODUCT_RESEARCHER" ||
      userRoles.includes("LINKER") ||
      userRoles.includes("ADMIN") ||
      userRoles.includes("SUPER_ADMIN") ||
      userRoles.includes("PRODUCT_RESEARCHER");

    if (!canDelete) {
      return NextResponse.json(
        { error: "Access Denied: Only Linkers, Product Researchers, Admins, and Super Admins can delete products." },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await prisma.product.findUnique({ where: { id: parseInt(id) } });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const oldName = existing.name.trim();
    const { searchParams } = new URL(req.url);
    const deleteSingle = searchParams.get("single") === "true";

    if (deleteSingle) {
      await prisma.product.delete({
        where: { id: parseInt(id) },
      });
    } else {
      // Find all sibling products with same name across sites and delete them
      const siblingProducts = await prisma.product.findMany({
        where: {
          OR: [
            { name: oldName },
            { name: oldName.toLowerCase() },
            { name: oldName.toUpperCase() },
          ],
        },
        select: { id: true },
      });
      const siblingIds = siblingProducts.map((p) => p.id);

      await prisma.product.deleteMany({
        where: { id: { in: siblingIds } },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/products/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
