import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cached, delByPattern } from "@/lib/redis";
import { ALLOWED_PRODUCT_TYPES, normalizeProductTypeName } from "@/lib/product-types";

// GET /api/categories - fetch core product types (only Ecom and Nutra)
export async function GET() {
  try {
    const categories = await cached("lookup:categories:v2", 900, async () => {
      let existing = await prisma.category.findMany({
        where: { name: { in: [...ALLOWED_PRODUCT_TYPES] } },
        select: {
          id: true,
          name: true,
          _count: {
            select: { sites: true, products: true },
          },
        },
        orderBy: { name: "asc" },
      });

      if (existing.length < ALLOWED_PRODUCT_TYPES.length) {
        for (const typeName of ALLOWED_PRODUCT_TYPES) {
          const has = existing.some((c) => c.name.toLowerCase() === typeName.toLowerCase());
          if (!has) {
            await prisma.category.upsert({
              where: { name: typeName },
              update: {},
              create: { name: typeName },
            }).catch(() => {});
          }
        }
        existing = await prisma.category.findMany({
          where: { name: { in: [...ALLOWED_PRODUCT_TYPES] } },
          select: {
            id: true,
            name: true,
            _count: {
              select: { sites: true, products: true },
            },
          },
          orderBy: { name: "asc" },
        });
      }

      return existing;
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
    const userRoles: string[] = (session.user as any)?.roles || (role ? [role] : []);
    const canCreate =
      role === "SUPER_ADMIN" ||
      role === "ADMIN" ||
      role === "LINKER" ||
      role === "PRODUCT_RESEARCHER" ||
      userRoles.includes("SUPER_ADMIN") ||
      userRoles.includes("ADMIN") ||
      userRoles.includes("LINKER") ||
      userRoles.includes("PRODUCT_RESEARCHER");

    if (!canCreate) {
      return NextResponse.json({ error: "Forbidden: Category creation is restricted to Admin, Linker, and Product Researcher roles" }, { status: 403 });
    }

    const { name } = await req.json();
    const cleanName = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";

    if (!cleanName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (/^(n\/?a|none|null|na)$/i.test(cleanName)) {
      return NextResponse.json(
        { error: "Invalid category name. 'N/A' is not a valid category." },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9 &'\-/]+$/.test(cleanName)) {
      return NextResponse.json(
        { error: "Special characters are not allowed. Only letters, numbers, spaces, and (&, -, ', /) are permitted for product type names." },
        { status: 400 }
      );
    }

    const canonicalType = normalizeProductTypeName(cleanName);
    if (!canonicalType) {
      return NextResponse.json(
        { error: "Only 'Ecom' and 'Nutra' are allowed as Product Types. Please add other classifications under Product Categories." },
        { status: 400 }
      );
    }

    const category = await prisma.category.create({
      data: { name: canonicalType },
    });

    await delByPattern("lookup:categories:*");
    await delByPattern("dashboard:*");

    return NextResponse.json(category);
  } catch (err: any) {
    console.error("[POST /api/categories]", err);
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Product Type already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
