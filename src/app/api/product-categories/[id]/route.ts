import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// PUT /api/product-categories/[id] — update product category (Superadmin, Admin, Linker)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "LINKER") {
      return NextResponse.json(
        { error: "Forbidden: Restricted to Super Admin, Admin, and Linker" },
        { status: 403 }
      );
    }

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const { name } = await req.json();
    const cleanName = (name || "").trim();
    if (!cleanName) return NextResponse.json({ error: "Category name is required" }, { status: 400 });

    const updatedCategory = await prisma.productCategory.update({
      where: { id },
      data: { name: cleanName },
    });

    return NextResponse.json(updatedCategory);
  } catch (err: any) {
    console.error("[PUT /api/product-categories/[id]]", err);
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Product category name already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/product-categories/[id] — delete product category (Superadmin, Admin, Linker)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "LINKER") {
      return NextResponse.json(
        { error: "Forbidden: Restricted to Super Admin, Admin, and Linker" },
        { status: 403 }
      );
    }

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    await prisma.productCategory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/product-categories/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
