import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/users/[id] — update user details, role, and site access
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, role, siteIds, allowLinkLogAccess, creatorId, teamLeadId, approved } = body;

    // Get creator role
    let creatorRole = "ADMIN";
    if (creatorId) {
      const creator = await prisma.user.findUnique({
        where: { id: Number(creatorId) },
        select: { role: true },
      });
      if (creator) {
        creatorRole = creator.role || "";
      }
    }

    // Get target user role
    const targetUser = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: { role: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Cannot modify SUPER_ADMIN users (except themselves)
    if (targetUser.role === "SUPER_ADMIN" && Number(creatorId) !== parseInt(id)) {
      return NextResponse.json({ error: "Cannot modify other Super Admin users." }, { status: 403 });
    }

    // Only SUPER_ADMIN can modify ADMIN users
    if (targetUser.role === "ADMIN" && creatorRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only Super Admins can modify Admin user roles." }, { status: 403 });
    }

    // Only SUPER_ADMIN can assign ADMIN role, and nobody can assign SUPER_ADMIN role
    if (role === "SUPER_ADMIN" && targetUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Cannot assign Super Admin role." }, { status: 403 });
    }
    if (role === "ADMIN" && creatorRole !== "SUPER_ADMIN") {
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
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get("creatorId");

    let creatorRole = "ADMIN";
    if (creatorId) {
      const creator = await prisma.user.findUnique({
        where: { id: Number(creatorId) },
        select: { role: true },
      });
      if (creator) {
        creatorRole = creator.role || "";
      }
    }

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
    if (targetUser.role === "ADMIN" && creatorRole !== "SUPER_ADMIN") {
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
