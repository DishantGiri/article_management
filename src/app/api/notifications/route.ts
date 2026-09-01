import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/notifications — get notifications for the authenticated session user
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authenticatedUserId = Number(session.user.id);
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const take = limitParam ? parseInt(limitParam) : undefined;

  // Restrict to the past 1 month (30 days)
  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  const notifications = await prisma.notification.findMany({
    where: { 
      recipientId: authenticatedUserId,
      createdAt: { gte: oneMonthAgo }
    },
    include: { sender: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    ...(take ? { take } : {}),
  });

  return NextResponse.json(notifications);
}

// PATCH /api/notifications — mark read for the authenticated user
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authenticatedUserId = Number(session.user.id);
  const body = await req.json();
  const { notificationId } = body;

  if (notificationId) {
    await prisma.notification.updateMany({
      where: {
        id: parseInt(notificationId),
        recipientId: authenticatedUserId, // Enforce ownership
      },
      data: { isRead: true },
    });
    return NextResponse.json({ success: true });
  }

  await prisma.notification.updateMany({
    where: {
      recipientId: authenticatedUserId,
      isRead: false,
    },
    data: { isRead: true },
  });

  return NextResponse.json({ success: true });
}
