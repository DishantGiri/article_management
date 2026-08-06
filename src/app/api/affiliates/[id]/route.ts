import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function hasPermission(userId?: number) {
  if (!userId) return true;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return (
    user?.role === "LINKER" ||
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN"
  );
}

// PATCH /api/affiliates/:id — update affiliate details (name, defaultUrl, subIdPattern)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const { name, defaultUrl, subIdPattern, callerId } = body;

    if (callerId && !(await hasPermission(Number(callerId)))) {
      return NextResponse.json(
        { error: "Access Denied: Only Admins, Super Admins, and Linkers can manage affiliates." },
        { status: 403 }
      );
    }

    const updated = await prisma.affiliateName.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(defaultUrl !== undefined ? { defaultUrl: defaultUrl?.trim() || null } : {}),
        ...(subIdPattern !== undefined ? { subIdPattern: subIdPattern?.trim() || null } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update affiliate" },
      { status: 500 }
    );
  }
}

// DELETE /api/affiliates/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const callerId = searchParams.get("callerId");

    if (callerId && !(await hasPermission(Number(callerId)))) {
      return NextResponse.json(
        { error: "Access Denied: Only Admins, Super Admins, and Linkers can manage affiliates." },
        { status: 403 }
      );
    }

    await prisma.affiliateName.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to delete affiliate" },
      { status: 500 }
    );
  }
}
