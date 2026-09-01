import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/notices/pending — retrieve unacknowledged notices for the session user matching their role
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = Number(session.user.id);
    const currentUserRole = session.user.role;

    // Find notices where:
    // 1. Current user has NOT acknowledged yet
    // 2. The notice targetRoles is either "ALL", null, or contains current user's role
    const pendingNotices = await prisma.notice.findMany({
      where: {
        OR: [
          { targetRoles: null },
          { targetRoles: "ALL" },
          ...(currentUserRole ? [{ targetRoles: { contains: currentUserRole } }] : []),
        ],
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

    return NextResponse.json(pendingNotices);
  } catch (err: any) {
    console.error("[GET /api/notices/pending]", err);
    return NextResponse.json({ error: err.message || "Failed to fetch pending notices" }, { status: 500 });
  }
}
