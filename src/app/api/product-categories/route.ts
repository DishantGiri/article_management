import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/product-categories — fetch all product categories
export async function GET() {
  try {
    const categories = await prisma.productCategory.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json(categories);
  } catch (err) {
    console.error("[GET /api/product-categories]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/product-categories — create a new product category (Superadmin, Admin, Linker)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "LINKER") {
      return NextResponse.json(
        { error: "Forbidden: Category creation is restricted to Super Admin, Admin, and Linker roles" },
        { status: 403 }
      );
    }

    const { name } = await req.json();
    const cleanName = (name || "").trim();

    if (!cleanName) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    const category = await prisma.productCategory.create({
      data: { name: cleanName },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/product-categories]", err);
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Product category already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
