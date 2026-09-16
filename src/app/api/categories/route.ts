import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/categories - fetch all global categories
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: { sites: true, products: true }
        }
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(categories);
  } catch (err) {
    console.error("[GET /api/categories]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/categories - create a new global category (Admin / Super Admin only)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "LINKER") {
      return NextResponse.json({ error: "Forbidden: Category creation is restricted to Admin and Linker roles" }, { status: 403 });
    }

    const { name } = await req.json();
    const cleanName = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";

    if (!cleanName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9 ]+$/.test(cleanName)) {
      return NextResponse.json(
        { error: "Special characters are not allowed. Only letters, numbers, and spaces are permitted for product type names." },
        { status: 400 }
      );
    }

    const category = await prisma.category.create({
      data: { name: cleanName },
    });

    return NextResponse.json(category);
  } catch (err: any) {
    console.error("[POST /api/categories]", err);
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Category already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
