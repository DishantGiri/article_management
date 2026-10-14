import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Dynamically normalizes notification messages so the author/sender label always matches the sender's current display name
export function normalizeNotificationMessage(
  message: string,
  sender?: { name?: string | null; role?: string | null } | null
): string {
  if (!sender?.name || !message) return message;
  const senderName = sender.name.trim();
  if (!senderName) return message;

  let normalized = message;

  // 1. "oldName (ROLE) reported an issue with link for..."
  normalized = normalized.replace(
    /^([^\s(]+)\s*\(((?:WRITER|TEAM LEAD|LINKER|ADMIN|SUPER ADMIN|PRODUCT RESEARCHER|USER)[^)]*)\)/i,
    `${senderName} ($2)`
  );

  // 2. "...has been resolved by oldName"
  normalized = normalized.replace(
    /(has been resolved by\s+)[^.]+?(\.|$)/i,
    `$1${senderName}$2`
  );

  // 3. "oldName requested article update approval for..."
  normalized = normalized.replace(
    /^([^\s]+)\s+(requested article update approval)/i,
    `${senderName} $2`
  );

  // 4. "Update Request: Writer oldName requested permission..."
  normalized = normalized.replace(
    /(Update Request:\s+Writer\s+)[^\s]+(\s+requested)/i,
    `$1${senderName}$2`
  );

  // 5. "oldName started writing the article for..."
  normalized = normalized.replace(
    /^([^\s]+)\s+(started writing the article)/i,
    `${senderName} $2`
  );

  // 6. "oldName completed the article for..."
  normalized = normalized.replace(
    /^([^\s]+)\s+(completed the article)/i,
    `${senderName} $2`
  );

  // 7. "ROLE oldName assigned you the article..."
  normalized = normalized.replace(
    /^(WRITER|TEAM LEAD|ADMIN|SUPER ADMIN|LINKER|PRODUCT RESEARCHER)\s+[^\s]+(\s+assigned you)/i,
    `$1 ${senderName}$2`
  );

  // 8. "New Article Available: ROLE oldName opened the article..."
  normalized = normalized.replace(
    /(New Article Available:\s+(?:WRITER|TEAM LEAD|ADMIN|SUPER ADMIN|LINKER|PRODUCT RESEARCHER)\s+)[^\s]+(\s+opened)/i,
    `$1${senderName}$2`
  );

  // 9. "Flag Raised: ROLE oldName flagged approved article..."
  normalized = normalized.replace(
    /(Flag Raised:\s+(?:WRITER|TEAM LEAD|ADMIN|SUPER ADMIN|LINKER|PRODUCT RESEARCHER)\s+)[^\s]+(\s+flagged)/i,
    `$1${senderName}$2`
  );

  // 10. "Document link updated: ROLE oldName updated the document link..."
  normalized = normalized.replace(
    /(Document link updated:\s+(?:WRITER|TEAM LEAD|ADMIN|SUPER ADMIN|LINKER|PRODUCT RESEARCHER)\s+)[^\s]+(\s+updated)/i,
    `$1${senderName}$2`
  );

  return normalized;
}

// GET /api/notifications - get notifications for the authenticated session user
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
    include: { sender: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    ...(take ? { take } : {}),
  });

  const formatted = notifications.map((n) => {
    const normalizedMessage = normalizeNotificationMessage(n.message, n.sender);
    if (normalizedMessage !== n.message) {
      // Heal legacy database record in background so stored DB messages stay synchronized
      prisma.notification
        .update({
          where: { id: n.id },
          data: { message: normalizedMessage },
        })
        .catch((err) => console.error("Notification auto-heal error:", err));
    }
    return {
      ...n,
      message: normalizedMessage,
    };
  });

  return NextResponse.json(formatted);
}

// PATCH /api/notifications - mark read for the authenticated user
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
