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
        hasLeftCompany: true,
        commissionToPartyFund: true,
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
    const { name, role, image, siteIds, allowLinkLogAccess, teamLeadId, approved, hasLeftCompany, commissionToPartyFund } = body;

    const callerId = Number(session.user.id);
    const callerRole = session.user.role || "";
    const isSelf = callerId === parseInt(id);
    const isAdmin = callerRole === "ADMIN" || callerRole === "SUPER_ADMIN";

    if (!isSelf && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Non-admin cannot modify role, approval, or site access
    if (!isAdmin && (role || approved !== undefined || siteIds !== undefined || allowLinkLogAccess !== undefined || hasLeftCompany !== undefined || commissionToPartyFund !== undefined)) {
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

    // Only SUPER_ADMIN can modify other SUPER_ADMIN users
    if (targetUser.role === "SUPER_ADMIN" && callerRole !== "SUPER_ADMIN" && !isSelf) {
      return NextResponse.json({ error: "Forbidden: Only Super Admins can modify Super Admin users." }, { status: 403 });
    }

    // Only SUPER_ADMIN can modify ADMIN users
    if (targetUser.role === "ADMIN" && callerRole !== "SUPER_ADMIN" && !isSelf) {
      return NextResponse.json({ error: "Only Super Admins can modify Admin user roles." }, { status: 403 });
    }

    // Only SUPER_ADMIN can assign ADMIN or SUPER_ADMIN role
    if ((role === "SUPER_ADMIN" || role === "ADMIN") && callerRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: `Only Super Admins can assign ${role === "SUPER_ADMIN" ? "Super Admin" : "Admin"} roles.` }, { status: 403 });
    }

    // Safety guard: ensure the platform has at least 1 Super Admin remaining if demoting
    if (targetUser.role === "SUPER_ADMIN" && role && role !== "SUPER_ADMIN") {
      const superAdminCount = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
      if (superAdminCount <= 1) {
        return NextResponse.json({ error: "Cannot change role: The system must maintain at least one Super Admin." }, { status: 400 });
      }
    }

    // Handle site access sync if siteIds is provided
    const newRole = role || targetUser.role;
    let siteAccessUpdate = undefined;
    if (siteIds !== undefined && Array.isArray(siteIds) && (newRole === "WRITER" || newRole === "TEAM_LEAD")) {
      siteAccessUpdate = {
        deleteMany: {}, // Clear existing
        create: siteIds.map((siteId: number) => ({ siteId: Number(siteId) })),
      };
    } else if (role && newRole !== "WRITER" && newRole !== "TEAM_LEAD") {
      siteAccessUpdate = { deleteMany: {} }; // Clear if role changed to non-writer/lead
    }

    // Resolve teamLeadId updates cleanly (supports migrating, unassigning, and role transitions)
    let resolvedTeamLeadId: number | null | undefined = undefined;
    if (newRole !== "WRITER") {
      resolvedTeamLeadId = null;
    } else if (teamLeadId !== undefined) {
      resolvedTeamLeadId = teamLeadId && teamLeadId !== "none" && teamLeadId !== "" ? Number(teamLeadId) : null;
    }

    if (hasLeftCompany === true && approved === true) {
      return NextResponse.json(
        { error: "A former employee (who has left the company) cannot be granted active login access." },
        { status: 400 }
      );
    }

    // Enforce mutual exclusion: if hasLeftCompany is true, approved must be false (and commissionToPartyFund false)
    // If approved is true, hasLeftCompany must be false
    let finalApproved = typeof approved === 'boolean' ? approved : undefined;
    let finalHasLeftCompany = typeof hasLeftCompany === 'boolean' ? hasLeftCompany : undefined;
    let finalCommissionToPartyFund = typeof commissionToPartyFund === 'boolean' ? commissionToPartyFund : undefined;

    if (finalHasLeftCompany === true) {
      finalApproved = false;
      finalCommissionToPartyFund = false;
    } else if (finalApproved === true) {
      finalHasLeftCompany = false;
    }

    const updated = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        ...(name ? { name } : {}),
        ...(image !== undefined ? { image } : {}),
        ...(role ? { role: role as "SUPER_ADMIN" | "ADMIN" | "LINKER" | "WRITER" | "TEAM_LEAD" } : {}),
        allowLinkLogAccess: newRole === "WRITER" ? (allowLinkLogAccess !== undefined ? !!allowLinkLogAccess : undefined) : false,
        ...(resolvedTeamLeadId !== undefined
          ? resolvedTeamLeadId
            ? { teamLead: { connect: { id: resolvedTeamLeadId } } }
            : { teamLead: { disconnect: true } }
          : {}),
        ...(finalApproved !== undefined ? { approved: finalApproved } : {}),
        ...(finalHasLeftCompany !== undefined ? { hasLeftCompany: finalHasLeftCompany } : {}),
        ...(finalCommissionToPartyFund !== undefined ? { commissionToPartyFund: finalCommissionToPartyFund } : {}),
        ...(siteAccessUpdate ? { siteAccess: siteAccessUpdate } : {}),
      },
      include: {
        siteAccess: { include: { site: { select: { id: true, name: true } } } },
        teamLead: { select: { id: true, name: true } },
        teamMembers: { select: { id: true, name: true } },
      },
    });

    // If commissionToPartyFund is turned on, divert any existing pending commissions for this user to Party Fund
    if (commissionToPartyFund === true) {
      const targetUserId = parseInt(id);
      const pendingSales = await prisma.commissionSale.findMany({
        where: {
          paymentStatus: "PENDING",
          OR: [
            { writerId: targetUserId, writerAmount: { gt: 0 } },
            { linkerId: targetUserId, linkerAmount: { gt: 0 } },
            { teamLeadId: targetUserId, tlAmount: { gt: 0 } },
          ],
        },
      });

      for (const sale of pendingSales) {
        let transfer = 0;
        const updateData: any = {};

        if (sale.writerId === targetUserId && sale.writerAmount > 0) {
          transfer += sale.writerAmount;
          updateData.writerAmount = 0;
          updateData.writerTransferredToParty = (sale.writerTransferredToParty || 0) + sale.writerAmount;
        }
        if (sale.linkerId === targetUserId && sale.linkerAmount > 0) {
          transfer += sale.linkerAmount;
          updateData.linkerAmount = 0;
        }
        if (sale.teamLeadId === targetUserId && sale.tlAmount > 0) {
          transfer += sale.tlAmount;
          updateData.tlAmount = 0;
        }

        if (transfer > 0) {
          updateData.partyAmount = sale.partyAmount + transfer;
          await prisma.commissionSale.update({
            where: { id: sale.id },
            data: updateData,
          });
        }
      }
    }

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
      if (callerRole !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Forbidden: Only Super Admins can delete Super Admin users." }, { status: 403 });
      }
      if (session.user.id === parseInt(id)) {
        return NextResponse.json({ error: "You cannot delete your own Super Admin account." }, { status: 400 });
      }
      const superAdminCount = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
      if (superAdminCount <= 1) {
        return NextResponse.json({ error: "Cannot delete: The system must maintain at least one Super Admin." }, { status: 400 });
      }
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
  } catch (err: any) {
    console.error("[DELETE /api/users/[id]]", err);
    if (err?.code === "P2003") {
      return NextResponse.json(
        { error: "Cannot delete user with associated work records (articles, links, products, or logs). Mark them as 'Left Company' instead." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
