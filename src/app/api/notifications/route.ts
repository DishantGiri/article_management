import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/notifications?userId=X
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json([]);

  const notifications = await prisma.notification.findMany({
    where: { recipientId: parseInt(userId) },
    include: { sender: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json(notifications);
}

// PATCH /api/notifications — mark all read for a user
export async function PATCH(req: NextRequest) {
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  await prisma.notification.updateMany({
    where: { recipientId: parseInt(userId), isRead: false },
    data: { isRead: true },
  });
  return NextResponse.json({ success: true });
}
