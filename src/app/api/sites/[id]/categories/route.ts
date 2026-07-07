import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/sites/[id]/categories
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const siteId = parseInt(id);

  if (isNaN(siteId)) {
    return NextResponse.json({ error: "Invalid site ID" }, { status: 400 });
  }

  const categories = await prisma.category.findMany({
    where: { sites: { some: { id: siteId } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(categories);
}
