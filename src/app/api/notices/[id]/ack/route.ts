import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST /api/notices/[id]/ack — record user acknowledgment ("I have read the message")
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: idStr } = await params;
    const noticeId = parseInt(idStr);
    if (isNaN(noticeId)) {
      return NextResponse.json({ error: "Invalid notice ID" }, { status: 400 });
    }

    const userId = Number(session.user.id);

    // Verify notice exists
    const notice = await prisma.notice.findUnique({
      where: { id: noticeId },
      select: { id: true, title: true },
    });

    if (!notice) {
      return NextResponse.json({ error: "Notice not found" }, { status: 404 });
    }

    const ack = await prisma.noticeAcknowledgment.upsert({
      where: {
        noticeId_userId: {
          noticeId,
          userId,
        },
      },
      update: {
        readAt: new Date(),
      },
      create: {
        noticeId,
        userId,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      acknowledgedAt: ack.readAt,
      noticeId,
      userId,
    });
  } catch (err: any) {
    console.error("[POST /api/notices/[id]/ack]", err);
    return NextResponse.json({ error: err.message || "Failed to acknowledge notice" }, { status: 500 });
  }
}
