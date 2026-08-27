import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/notifications?userId=X
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json([]);

  const limitParam = searchParams.get("limit");
  const take = limitParam ? parseInt(limitParam) : undefined;

  // Restrict to the past 1 month (30 days)
  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  const notifications = await prisma.notification.findMany({
    where: { 
      recipientId: parseInt(userId),
      createdAt: { gte: oneMonthAgo }
    },
    include: { sender: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    ...(take ? { take } : {}),
  });
  return NextResponse.json(notifications);
}

// PATCH /api/notifications — mark all read for a user, or a single notification
export async function PATCH(req: NextRequest) {
  const { userId, notificationId } = await req.json();

  if (notificationId) {
    await prisma.notification.update({
      where: { id: parseInt(notificationId) },
      data: { isRead: true },
    });
    return NextResponse.json({ success: true });
  }

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  await prisma.notification.updateMany({
    where: { recipientId: parseInt(userId), isRead: false },
    data: { isRead: true },
  });
  return NextResponse.json({ success: true });
}
