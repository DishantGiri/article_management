import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/products/[id] — retrieve product details
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

// PATCH /api/products/[id] — update product details
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
    if (role !== "LINKER" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Access Denied: Only Linkers, Admins, and Super Admins can update products." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { name, slug, siteId, categoryId, productCategory, trendLink, trendLevel, affiliateName, previewLink, remarks } = body;

    const existing = await prisma.product.findUnique({ where: { id: parseInt(id) } });
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

    const targetName = name !== undefined ? name.trim() : existing.name.trim();
    const targetSiteId = siteId !== undefined ? Number(siteId) : existing.siteId;

    if (
      targetName.toLowerCase() !== existing.name.trim().toLowerCase() ||
      targetSiteId !== existing.siteId
    ) {
      const conflictProducts = await prisma.product.findMany({
        where: {
          id: { not: parseInt(id) },
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

      const matching = conflictProducts.filter(
        (p) => p.name.trim().toLowerCase() === targetName.toLowerCase()
      );

      if (matching.length > 0) {
        const addedByName = matching[0].addedBy?.name;
        const siteName = matching[0].site?.name;
        const siteSuffix = siteName ? ` on site ${siteName}` : " on this site";
        const errorMsg = `Already added by linker ${addedByName || "another linker"}${siteSuffix}.`;

        return NextResponse.json({ error: errorMsg }, { status: 400 });
      }
    }

    const updated = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(slug !== undefined
          ? {
              slug: slug
                ? slug.trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "")
                : null,
            }
          : {}),
        ...(siteId !== undefined ? { siteId: Number(siteId) } : {}),
        ...(categoryId !== undefined ? { categoryId: Number(categoryId) } : {}),
        ...(productCategory !== undefined ? { productCategory: productCategory ? productCategory.trim() : null } : {}),
        ...(trendLink !== undefined ? { trendLink: trendLink || null } : {}),
        ...(trendLevel !== undefined ? { trendLevel: trendLevel || "HIGH" } : {}),
        ...(affiliateName !== undefined ? { affiliateName: affiliateName || null } : {}),
        ...(previewLink !== undefined ? { previewLink: previewLink || null } : {}),
        ...(remarks !== undefined ? { remarks: remarks || null } : {}),
      },
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

// DELETE /api/products/[id] — delete a product (and cascade-deleted related articles and links)
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
    if (role !== "LINKER" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Access Denied: Only Linkers, Admins, and Super Admins can delete products." },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await prisma.product.findUnique({ where: { id: parseInt(id) } });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await prisma.product.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/products/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
