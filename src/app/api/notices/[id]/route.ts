import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NoticeCategory } from "@/generated/prisma/client";

// GET /api/notices/[id] — retrieve notice detail
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid notice ID" }, { status: 400 });
    }

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    const notice = await prisma.notice.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, role: true, image: true },
        },
        acknowledgments: {
          include: {
            user: {
              select: { id: true, name: true, role: true, email: true },
            },
          },
          orderBy: { readAt: "desc" },
        },
      },
    });

    if (!notice) {
      return NextResponse.json({ error: "Notice not found" }, { status: 404 });
    }

    const isRead = notice.acknowledgments.some((a) => a.userId === Number(session.user.id));

    return NextResponse.json({
      ...notice,
      isRead,
      // Only include full acknowledgment user list for admins
      acknowledgments: isAdmin ? notice.acknowledgments : undefined,
      totalAcknowledgments: notice.acknowledgments.length,
    });
  } catch (err: any) {
    console.error("[GET /api/notices/[id]]", err);
    return NextResponse.json({ error: err.message || "Failed to fetch notice" }, { status: 500 });
  }
}

// PUT /api/notices/[id] — edit notice (Admin / Super Admin only)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only Admins and Super Admins can edit notices." },
        { status: 403 }
      );
    }

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid notice ID" }, { status: 400 });
    }

    const body = await req.json();
    const { title, content, category, targetRoles, targetRole } = body;

    const validCategories = ["IMPORTANT", "GENERAL", "SUGGESTION", "URGENT", "ANNOUNCEMENT"];
    const targetCategory = validCategories.includes(category) ? (category as NoticeCategory) : undefined;

    let parsedTargetRoles: string | undefined = undefined;
    const rawRoles = targetRoles !== undefined ? targetRoles : targetRole;
    if (rawRoles !== undefined) {
      if (!rawRoles || rawRoles === "ALL") {
        parsedTargetRoles = "ALL";
      } else if (Array.isArray(rawRoles)) {
        const valid = rawRoles.filter((r) => r && r !== "ALL");
        parsedTargetRoles = valid.length > 0 ? valid.join(",") : "ALL";
      } else if (typeof rawRoles === "string") {
        parsedTargetRoles = rawRoles.trim() || "ALL";
      }
    }

    const updated = await prisma.notice.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(content !== undefined ? { content: content.trim() } : {}),
        ...(targetCategory ? { category: targetCategory } : {}),
        ...(parsedTargetRoles !== undefined ? { targetRoles: parsedTargetRoles } : {}),
      },
      include: {
        createdBy: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("[PUT /api/notices/[id]]", err);
    return NextResponse.json({ error: err.message || "Failed to update notice" }, { status: 500 });
  }
}

// DELETE /api/notices/[id] — delete notice (Admin / Super Admin only)
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
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only Admins and Super Admins can delete notices." },
        { status: 403 }
      );
    }

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid notice ID" }, { status: 400 });
    }

    await prisma.notice.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[DELETE /api/notices/[id]]", err);
    return NextResponse.json({ error: err.message || "Failed to delete notice" }, { status: 500 });
  }
}
