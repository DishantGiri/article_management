import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isUserTargeted } from "@/lib/noticeUtils";

// GET /api/notices/pending — retrieve unacknowledged notices for the session user matching their role
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = Number(session.user.id);

    // Fetch user from DB to ensure most up-to-date role
    const dbUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { id: true, role: true },
    });

    const currentUserRole = dbUser?.role || session.user.role;
    if (!currentUserRole) {
      return NextResponse.json([]);
    }

    // Find all notices where current user has NOT acknowledged yet
    const pendingNotices = await prisma.notice.findMany({
      where: {
        acknowledgments: {
          none: {
            userId: currentUserId,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    // Filter strictly by targetRoles
    const filtered = pendingNotices.filter((n) => isUserTargeted(n.targetRoles, currentUserRole));

    return NextResponse.json(filtered);
  } catch (err: any) {
    console.error("[GET /api/notices/pending]", err);
    return NextResponse.json({ error: err.message || "Failed to fetch pending notices" }, { status: 500 });
  }
}
