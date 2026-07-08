import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Helper function to check roles
async function hasPermission(userId: number) {
  if (!userId) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return (
    user?.role === "LINKER" ||
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN"
  );
}

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
    const { id } = await params;
    const body = await req.json();
    const { name, siteId, categoryId, trendLink, previewLink, remarks, callerId } = body;

    const callerIdNum = Number(callerId);
    if (!callerIdNum || !(await hasPermission(callerIdNum))) {
      return NextResponse.json(
        { error: "Access Denied: Only Linkers, Admins, and Super Admins can update products." },
        { status: 403 }
      );
    }

    const existing = await prisma.product.findUnique({ where: { id: parseInt(id) } });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const updated = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(siteId !== undefined ? { siteId: Number(siteId) } : {}),
        ...(categoryId !== undefined ? { categoryId: Number(categoryId) } : {}),
        ...(trendLink !== undefined ? { trendLink: trendLink || null } : {}),
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
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const callerId = searchParams.get("callerId");

    const callerIdNum = Number(callerId);
    if (!callerIdNum || !(await hasPermission(callerIdNum))) {
      return NextResponse.json(
        { error: "Access Denied: Only Linkers, Admins, and Super Admins can delete products." },
        { status: 403 }
      );
    }

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
