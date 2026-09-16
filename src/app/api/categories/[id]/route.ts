import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "LINKER") {
      return NextResponse.json({ error: "Forbidden: Restricted to Super Admin, Admin, and Linker" }, { status: 403 });
    }

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const { name } = await req.json();
    const cleanName = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
    if (!cleanName) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    if (!/^[a-zA-Z0-9 ]+$/.test(cleanName)) {
      return NextResponse.json(
        { error: "Special characters are not allowed. Only letters, numbers, and spaces are permitted for product type names." },
        { status: 400 }
      );
    }

    const currentCategory = await prisma.category.findUnique({
      where: { id },
    });

    if (!currentCategory) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (currentCategory.name.trim() === cleanName) {
      return NextResponse.json({ error: "No changes made." }, { status: 400 });
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: { name: cleanName },
    });

    return NextResponse.json(updatedCategory);
  } catch (err: any) {
    console.error("[PUT /api/categories/[id]]", err);
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Category name already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "LINKER") {
      return NextResponse.json({ error: "Forbidden: Restricted to Super Admin, Admin, and Linker" }, { status: 403 });
    }

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    // Check if category has products
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (category._count.products > 0) {
      return NextResponse.json({ error: "Cannot delete category with associated products" }, { status: 400 });
    }

    await prisma.category.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/categories/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
