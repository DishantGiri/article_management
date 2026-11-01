import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action, ids } = await req.json();

    if (action === "clear-all") {
      // Clear all Trendmap products.
      // ONLY removes from TrendmapProduct; NEVER removes or affects the catalog Product table!
      const res = await prisma.trendmapProduct.deleteMany({});
      return NextResponse.json({
        success: true,
        message: `Cleared all ${res.count} products from Trendmap`,
        count: res.count,
      });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No product IDs provided" }, { status: 400 });
    }

    const numericIds = ids.map((id) => Number(id)).filter((id) => !isNaN(id));

    if (action === "delete") {
      // Remove selected items from Trendmap.
      // ONLY removes from TrendmapProduct; NEVER removes or affects the catalog Product table!
      const res = await prisma.trendmapProduct.deleteMany({
        where: { id: { in: numericIds } },
      });
      return NextResponse.json({
        success: true,
        message: `Removed ${res.count} product(s) from Trendmap`,
        count: res.count,
      });
    }

    if (action === "mark-added") {
      const selected = await prisma.trendmapProduct.findMany({
        where: { id: { in: numericIds } },
        select: { name: true },
      });
      const names = Array.from(new Set(selected.map((s) => s.name.trim()).filter(Boolean)));
      const res = await prisma.trendmapProduct.updateMany({
        where: {
          OR: [
            { id: { in: numericIds } },
            ...(names.length > 0 ? [{ name: { in: names } }] : []),
          ],
        },
        data: { addedToCatalog: true, status: "ADDED" },
      });
      return NextResponse.json({ success: true, count: res.count });
    }

    if (action === "mark-pending") {
      const selected = await prisma.trendmapProduct.findMany({
        where: { id: { in: numericIds } },
        select: { name: true },
      });
      const names = Array.from(new Set(selected.map((s) => s.name.trim()).filter(Boolean)));
      const res = await prisma.trendmapProduct.updateMany({
        where: {
          OR: [
            { id: { in: numericIds } },
            ...(names.length > 0 ? [{ name: { in: names } }] : []),
          ],
        },
        data: { addedToCatalog: false, status: "PENDING" },
      });
      return NextResponse.json({ success: true, count: res.count });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Batch operation failed", details: error.message },
      { status: 500 }
    );
  }
}
