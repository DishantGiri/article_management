import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/geos
export async function GET() {
  try {
    const geos = await prisma.geo.findMany({ orderBy: { code: "asc" } });
    return NextResponse.json(geos);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch geos" }, { status: 500 });
  }
}

// POST /api/geos — create a new GEO (Superadmin, Admin, Linker)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "LINKER" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Access Denied: Only Admins, Super Admins, and Linkers can add GEOs." },
        { status: 403 }
      );
    }

    const { code } = await req.json();
    if (!code || !code.trim()) {
      return NextResponse.json({ error: "GEO code is required" }, { status: 400 });
    }
    const trimmed = code.trim().toUpperCase();

    const existing = await prisma.geo.findUnique({ where: { code: trimmed } });
    if (existing) return NextResponse.json(existing);

    const created = await prisma.geo.create({ data: { code: trimmed } });
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save geo" }, { status: 500 });
  }
}
