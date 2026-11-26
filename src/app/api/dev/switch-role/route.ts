import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { delByPattern } from "@/lib/redis";

type UserRole = "SUPER_ADMIN" | "ADMIN" | "LINKER" | "WRITER" | "TEAM_LEAD" | "PRODUCT_RESEARCHER" | "GUEST";

const VALID_ROLES = new Set<string>([
  "SUPER_ADMIN",
  "ADMIN",
  "LINKER",
  "WRITER",
  "TEAM_LEAD",
  "PRODUCT_RESEARCHER",
  "GUEST",
]);

export async function POST(req: NextRequest) {
  // Only allow this API in development mode on localhost
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Forbidden in production" }, { status: 403 });
  }

  const host = req.headers.get("host") || "";
  if (!host.includes("localhost") && !host.includes("127.0.0.1")) {
    return NextResponse.json({ error: "Forbidden: Localhost development only" }, { status: 403 });
  }

  try {
    const { userId, role } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const targetId = String(userId).trim();
    const upperRole = role ? String(role).trim().toUpperCase() : null;
    if (upperRole && !VALID_ROLES.has(upperRole)) {
      return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 });
    }
    const nextRole = upperRole as UserRole | null;

    // Check if user exists. If not, auto-create a mock user with that ID so the developer switch doesn't fail after a seed/reset.
    const existingUser = await prisma.user.findUnique({ where: { id: targetId } });
    let updatedUser;
    if (!existingUser) {
      updatedUser = await prisma.user.create({
        data: {
          id: targetId,
          name: `Dev User ${userId}`,
          email: `devuser${userId}@example.com`,
          role: nextRole,
          approved: true,
        },
      });
    } else {
      updatedUser = await prisma.user.update({
        where: { id: targetId },
        data: {
          role: nextRole,
        },
      });

      if (!nextRole || nextRole === "ADMIN" || nextRole === "SUPER_ADMIN" || nextRole === "GUEST") {
        await prisma.siteAccess.deleteMany({ where: { userId: targetId } });
      } else {
        await prisma.siteAccess.updateMany({
          where: { userId: targetId },
          data: {
            role: nextRole,
            roles: nextRole,
            canAddProduct: nextRole === "LINKER" || nextRole === "PRODUCT_RESEARCHER",
            canAddLink: nextRole === "LINKER",
            canWrite: nextRole === "WRITER",
            canReview: nextRole === "TEAM_LEAD",
          },
        });
      }
    }

    await Promise.all([delByPattern("users:*"), delByPattern("dashboard:*")]);

    return NextResponse.json({ success: true, role: updatedUser.role });
  } catch (err: any) {
    console.error("Error in dev switch-role API:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
