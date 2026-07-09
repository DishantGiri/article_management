import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check: Only SUPER_ADMIN and ADMIN
    const user = await prisma.user.findUnique({
      where: { id: Number(session.user.id) },
      select: { role: true },
    });

    if (user?.role !== "SUPER_ADMIN" && user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    const history = await prisma.articleHistory.findMany({
      include: {
        updatedBy: {
          select: { id: true, name: true, role: true, email: true },
        },
        article: {
          include: {
            product: {
              select: { id: true, name: true, site: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(history);
  } catch (err) {
    console.error("[GET /api/history]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
