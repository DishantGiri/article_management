import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST /api/users/[id]/access — assign site access to a writer
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const callerRole = session.user.role;
    if (callerRole !== "ADMIN" && callerRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden: Only Admins and Super Admins can assign site access." }, { status: 403 });
    }

    const { id } = await params;
    const { siteId } = await req.json();

    if (!siteId) {
      return NextResponse.json({ error: "siteId is required" }, { status: 400 });
    }

    const access = await prisma.siteAccess.upsert({
      where: {
        userId_siteId: {
          userId: parseInt(id),
          siteId: parseInt(siteId),
        },
      },
      update: {},
      create: {
        userId: parseInt(id),
        siteId: parseInt(siteId),
      },
      include: { site: true },
    });

    return NextResponse.json(access);
  } catch (err) {
    console.error("[POST /api/users/[id]/access]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/users/[id]/access — revoke site access from a writer
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const callerRole = session.user.role;
    if (callerRole !== "ADMIN" && callerRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden: Only Admins and Super Admins can revoke site access." }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("siteId");

    if (!siteId) {
      return NextResponse.json({ error: "siteId required in query parameters" }, { status: 400 });
    }

    await prisma.siteAccess.delete({
      where: {
        userId_siteId: {
          userId: parseInt(id),
          siteId: parseInt(siteId),
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/users/[id]/access]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
