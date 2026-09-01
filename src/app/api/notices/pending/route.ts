import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/notices/pending — retrieve unacknowledged notices for the session user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = Number(session.user.id);

    // Find notices where current user has NOT acknowledged yet
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

    return NextResponse.json(pendingNotices);
  } catch (err: any) {
    console.error("[GET /api/notices/pending]", err);
    return NextResponse.json({ error: err.message || "Failed to fetch pending notices" }, { status: 500 });
  }
}
