import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  // Only allow this API in development mode
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Forbidden in production" }, { status: 403 });
  }

  try {
    const { userId, role } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Check if user exists. If not, auto-create a mock user with that ID so the developer switch doesn't fail after a seed/reset.
    const existingUser = await prisma.user.findUnique({ where: { id: Number(userId) } });
    let updatedUser;
    if (!existingUser) {
      updatedUser = await prisma.user.create({
        data: {
          id: Number(userId),
          name: `Dev User ${userId}`,
          email: `devuser${userId}@example.com`,
          role: role || null,
          approved: true,
        }
      });
    } else {
      updatedUser = await prisma.user.update({
        where: { id: Number(userId) },
        data: {
          role: role || null,
        },
      });
    }

    return NextResponse.json({ success: true, role: updatedUser.role });
  } catch (err: any) {
    console.error("Error in dev switch-role API:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
