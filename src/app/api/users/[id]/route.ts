import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// GET /api/users/[id] — get user profile details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const targetId = parseInt(id);
    const isSelf = session.user.id === targetId;
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    if (!isSelf && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        allowLinkLogAccess: true,
        approved: true,
        siteAccess: { select: { site: { select: { id: true, name: true } } } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Admins cannot view Super Admin profiles
    if (session.user.role === "ADMIN" && user.role === "SUPER_ADMIN" && !isSelf) {
      return NextResponse.json({ error: "Forbidden: Admins cannot view Super Admin users" }, { status: 403 });
    }

    return NextResponse.json(user);
  } catch (err) {
    console.error("[GET /api/users/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/users/[id] — update user details, role, and site access
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, role, image, siteIds, allowLinkLogAccess, teamLeadId, approved } = body;

    const callerId = Number(session.user.id);
    const callerRole = session.user.role || "";
    const isSelf = callerId === parseInt(id);
    const isAdmin = callerRole === "ADMIN" || callerRole === "SUPER_ADMIN";

    if (!isSelf && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Non-admin cannot modify role, approval, or site access
    if (!isAdmin && (role || approved !== undefined || siteIds !== undefined || allowLinkLogAccess !== undefined)) {
      return NextResponse.json({ error: "Forbidden: Only administrators can modify roles and permissions." }, { status: 403 });
    }

    // Get target user role
    const targetUser = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: { role: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Cannot modify SUPER_ADMIN users (except themselves for profile name/image)
    if (targetUser.role === "SUPER_ADMIN" && callerId !== parseInt(id)) {
      return NextResponse.json({ error: "Cannot modify other Super Admin users." }, { status: 403 });
    }

    // Only SUPER_ADMIN can modify ADMIN users
    if (targetUser.role === "ADMIN" && callerRole !== "SUPER_ADMIN" && !isSelf) {
      return NextResponse.json({ error: "Only Super Admins can modify Admin user roles." }, { status: 403 });
    }

    // Only SUPER_ADMIN can assign ADMIN role, and nobody can assign SUPER_ADMIN role
    if (role === "SUPER_ADMIN" && targetUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Cannot assign Super Admin role." }, { status: 403 });
    }
    if (role === "ADMIN" && callerRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only Super Admins can assign Admin roles." }, { status: 403 });
    }

    // Handle site access sync if siteIds is provided
    const newRole = role || targetUser.role;
    let siteAccessUpdate = undefined;
    if (siteIds && Array.isArray(siteIds) && (newRole === "WRITER" || newRole === "TEAM_LEAD")) {
      siteAccessUpdate = {
        deleteMany: {}, // Clear existing
        create: siteIds.map((siteId: number) => ({ siteId })),
      };
    } else if (newRole !== "WRITER" && newRole !== "TEAM_LEAD") {
      siteAccessUpdate = { deleteMany: {} }; // Clear if role changed to non-writer/lead
    }

    const updated = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        ...(name ? { name } : {}),
        ...(image !== undefined ? { image } : {}),
        ...(role ? { role: role as "SUPER_ADMIN" | "ADMIN" | "LINKER" | "WRITER" | "TEAM_LEAD" } : {}),
        allowLinkLogAccess: newRole === "WRITER" ? !!allowLinkLogAccess : false,
        teamLeadId: newRole === "WRITER" && teamLeadId ? Number(teamLeadId) : (newRole === "WRITER" ? undefined : null),
        ...(typeof approved === 'boolean' ? { approved } : {}),
        ...(siteAccessUpdate ? { siteAccess: siteAccessUpdate } : {}),
      },
      include: {
        siteAccess: { include: { site: { select: { id: true, name: true } } } },
        teamLead: { select: { id: true, name: true } },
        teamMembers: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/users/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/users/[id] — delete a user
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const callerRole = session.user.role || "";
    if (callerRole !== "ADMIN" && callerRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden: Only Admins and Super Admins can delete users." }, { status: 403 });
    }

    const { id } = await params;

    const targetUser = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: { role: true },
    });
    
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Delete restrictions
    if (targetUser.role === "SUPER_ADMIN") {
      return NextResponse.json({ error: "Cannot delete Super Admin users." }, { status: 403 });
    }
    if (targetUser.role === "ADMIN" && callerRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only Super Admins can delete Admin users." }, { status: 403 });
    }

    // Delete site access first due to foreign key
    await prisma.siteAccess.deleteMany({
      where: { userId: parseInt(id) }
    });

    await prisma.user.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/users/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
