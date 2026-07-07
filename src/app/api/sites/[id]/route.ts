import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/sites/[id] — update site
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, url, categoryIds } = body;

    const updated = await prisma.site.update({
      where: { id: parseInt(id) },
      data: {
        ...(name ? { name } : {}),
        ...(url !== undefined ? { url } : {}),
        ...(Array.isArray(categoryIds) ? { categories: { set: categoryIds.map((cid: number) => ({ id: cid })) } } : {})
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/sites/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/sites/[id] — delete site
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.site.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/sites/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
