import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// PATCH /api/affiliates/:id — update affiliate name
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "LINKER" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Access Denied: Only Admins, Super Admins, and Linkers can manage affiliates." },
        { status: 403 }
      );
    }

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const { name } = body;

    const trimmedName = name !== undefined ? name.trim().replace(/\s+/g, " ") : "";
    if (!trimmedName) {
      return NextResponse.json({ error: "Affiliate name is required" }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9 ]+$/.test(trimmedName)) {
      return NextResponse.json(
        { error: "Special characters are not allowed. Only letters, numbers, and spaces are permitted for affiliate names." },
        { status: 400 }
      );
    }

    if (trimmedName.length < 2 || trimmedName.length > 50) {
      return NextResponse.json(
        { error: "Affiliate name must be between 2 and 50 characters." },
        { status: 400 }
      );
    }

    const currentItem = await prisma.affiliateName.findUnique({
      where: { id },
    });

    if (!currentItem) {
      return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });
    }

    if (currentItem.name.trim() === trimmedName) {
      return NextResponse.json(
        { error: `Affiliate "${currentItem.name}" has no changes made.` },
        { status: 400 }
      );
    }

    const existing = await prisma.affiliateName.findFirst({
      where: {
        name: trimmedName,
        id: { not: id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Affiliate "${existing.name}" already exists` },
        { status: 400 }
      );
    }

    const updated = await prisma.affiliateName.update({
      where: { id },
      data: {
        name: trimmedName,
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
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "LINKER" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Access Denied: Only Admins, Super Admins, and Linkers can manage affiliates." },
        { status: 403 }
      );
    }

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    await prisma.affiliateName.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to delete affiliate" },
      { status: 500 }
    );
  }
}
