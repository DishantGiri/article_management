import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { broadcastRealtimeNotification } from "@/lib/notifier";
import { NoticeCategory } from "@/generated/prisma/client";

// GET /api/notices — retrieve notices with category filter & read state
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = Number(session.user.id);
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    const where: any = {};

    if (category && category !== "ALL") {
      where.category = category as NoticeCategory;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { title: { contains: q } },
        { content: { contains: q } },
      ];
    }

    const notices = await prisma.notice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: { id: true, name: true, role: true, image: true },
        },
        acknowledgments: {
          where: { userId: currentUserId },
          select: { id: true, readAt: true },
        },
        _count: {
          select: { acknowledgments: true },
        },
      },
    });

    const formatted = notices.map((notice) => ({
      id: notice.id,
      title: notice.title,
      content: notice.content,
      category: notice.category,
      createdAt: notice.createdAt,
      updatedAt: notice.updatedAt,
      createdBy: notice.createdBy,
      isRead: notice.acknowledgments.length > 0,
      readAt: notice.acknowledgments[0]?.readAt || null,
      totalAcknowledgments: notice._count.acknowledgments,
    }));

    return NextResponse.json(formatted);
  } catch (err: any) {
    console.error("[GET /api/notices]", err);
    return NextResponse.json({ error: err.message || "Failed to fetch notices" }, { status: 500 });
  }
}

// POST /api/notices — create a new notice (Admin / Super Admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only Admins and Super Admins can publish notices." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { title, content, category } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Notice title is required" }, { status: 400 });
    }

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Notice content is required" }, { status: 400 });
    }

    const validCategories = ["IMPORTANT", "GENERAL", "SUGGESTION", "URGENT", "ANNOUNCEMENT"];
    const targetCategory = validCategories.includes(category) ? (category as NoticeCategory) : NoticeCategory.GENERAL;

    const created = await prisma.notice.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        category: targetCategory,
        createdById: Number(session.user.id),
      },
      include: {
        createdBy: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    // Broadcast notice via real-time WebSocket to all active users
    await broadcastRealtimeNotification({
      type: "NOTICE_PUBLISHED",
      message: `New Notice: ${created.title}`,
      senderId: Number(session.user.id),
      data: {
        id: created.id,
        title: created.title,
        content: created.content,
        category: created.category,
        createdAt: created.createdAt,
        createdBy: created.createdBy,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/notices]", err);
    return NextResponse.json({ error: err.message || "Failed to create notice" }, { status: 500 });
  }
}
