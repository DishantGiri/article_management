import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { validateUserName, sanitizeUserName } from "@/lib/user-validation";

// Cascades display name updates across all notifications, link logs, history records, and products
async function cascadeUserNameUpdate(
  userId: number,
  oldName: string,
  newName: string,
  email: string
) {
  const emailPrefix = email ? email.split("@")[0].trim() : "";
  const oldAliases = Array.from(
    new Set([oldName, emailPrefix].filter((n) => n && n !== newName))
  );

  if (oldAliases.length === 0) return;

  const replaceName = (text: string): string => {
    let result = text;
    for (const old of oldAliases) {
      if (!old || old.length < 2) continue;
      const escaped = old.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "gu");
      result = result.replace(regex, `$1${newName}$2`);
    }
    return result;
  };

  try {
    // 1. Notifications: where senderId === userId or message mentions old names
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { senderId: userId },
          ...oldAliases.map((alias) => ({ message: { contains: alias } })),
        ],
      },
      select: { id: true, message: true, senderId: true },
    });

    for (const notif of notifications) {
      let updatedMessage = replaceName(notif.message);
      if (notif.senderId === userId) {
        // Handle "oldName (ROLE) reported an issue..."
        updatedMessage = updatedMessage.replace(
          /^([^\s(]+)\s*\(((?:WRITER|TEAM LEAD|LINKER|ADMIN|SUPER ADMIN|PRODUCT RESEARCHER|USER)[^)]*)\)/i,
          `${newName} ($2)`
        );
        // Handle "...resolved by oldName"
        updatedMessage = updatedMessage.replace(
          /(has been resolved by\s+)[^.]+?(\.|$)/i,
          `$1${newName}$2`
        );
      }

      if (updatedMessage !== notif.message) {
        await prisma.notification.update({
          where: { id: notif.id },
          data: { message: updatedMessage },
        });
      }
    }

    // 2. LinkLog: remarks
    const linkLogs = await prisma.linkLog.findMany({
      where: {
        OR: [
          { addedById: userId },
          { updatedById: userId },
          ...oldAliases.map((alias) => ({ linkerRemarks: { contains: alias } })),
        ],
      },
      select: { id: true, linkerRemarks: true },
    });

    for (const log of linkLogs) {
      if (!log.linkerRemarks) continue;
      const updatedRemarks = replaceName(log.linkerRemarks);
      if (updatedRemarks !== log.linkerRemarks) {
        await prisma.linkLog.update({
          where: { id: log.id },
          data: { linkerRemarks: updatedRemarks },
        });
      }
    }

    // 3. LinkHistory: newRemarks and oldRemarks
    const linkHistories = await prisma.linkHistory.findMany({
      where: {
        OR: [
          { updatedById: userId },
          ...oldAliases.map((alias) => ({ newRemarks: { contains: alias } })),
          ...oldAliases.map((alias) => ({ oldRemarks: { contains: alias } })),
        ],
      },
      select: { id: true, newRemarks: true, oldRemarks: true },
    });

    for (const hist of linkHistories) {
      const updatedNew = hist.newRemarks ? replaceName(hist.newRemarks) : hist.newRemarks;
      const updatedOld = hist.oldRemarks ? replaceName(hist.oldRemarks) : hist.oldRemarks;
      if (updatedNew !== hist.newRemarks || updatedOld !== hist.oldRemarks) {
        await prisma.linkHistory.update({
          where: { id: hist.id },
          data: {
            ...(updatedNew !== hist.newRemarks ? { newRemarks: updatedNew } : {}),
            ...(updatedOld !== hist.oldRemarks ? { oldRemarks: updatedOld } : {}),
          },
        });
      }
    }

    // 4. ArticleHistory: notes
    const articleHistories = await prisma.articleHistory.findMany({
      where: {
        OR: [
          { updatedById: userId },
          ...oldAliases.map((alias) => ({ notes: { contains: alias } })),
        ],
      },
      select: { id: true, notes: true },
    });

    for (const ah of articleHistories) {
      if (!ah.notes) continue;
      const updatedNotes = replaceName(ah.notes);
      if (updatedNotes !== ah.notes) {
        await prisma.articleHistory.update({
          where: { id: ah.id },
          data: { notes: updatedNotes },
        });
      }
    }

    // 5. Product: remarks
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { addedById: userId },
          ...oldAliases.map((alias) => ({ remarks: { contains: alias } })),
        ],
      },
      select: { id: true, remarks: true },
    });

    for (const prod of products) {
      if (!prod.remarks) continue;
      const updatedRemarks = replaceName(prod.remarks);
      if (updatedRemarks !== prod.remarks) {
        await prisma.product.update({
          where: { id: prod.id },
          data: { remarks: updatedRemarks },
        });
      }
    }

    // 6. SpecialApproval: writerName
    await prisma.specialApproval.updateMany({
      where: {
        OR: [
          { article: { writerId: userId } },
          { writerName: { in: oldAliases } },
        ],
      },
      data: {
        writerName: newName,
      },
    });
  } catch (cascadeErr) {
    console.error("Failed to cascade user name update to logs and notifications:", cascadeErr);
  }
}

// GET /api/users/[id] - get user profile details
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
        image: true,
        role: true,
        allowLinkLogAccess: true,
        approved: true,
        hasLeftCompany: true,
        commissionToPartyFund: true,
        siteAccess: {
          select: {
            id: true,
            siteId: true,
            role: true,
            roles: true,
            canAddProduct: true,
            canAddLink: true,
            canWrite: true,
            canReview: true,
            site: { select: { id: true, name: true } },
          },
        },
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

// PATCH /api/users/[id] - update user details, role, and site access
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
    const { name, email, role, image, siteIds, allowLinkLogAccess, teamLeadId, approved, hasLeftCompany, commissionToPartyFund } = body;

    const callerId = Number(session.user.id);
    const callerRole = session.user.role || "";
    const isSelf = callerId === parseInt(id);
    const isAdmin = callerRole === "ADMIN" || callerRole === "SUPER_ADMIN";

    if (!isSelf && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get target user details first
    const targetUser = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Login email immutability: reject any attempt to modify login email
    if (email !== undefined && email !== null) {
      const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
      if (trimmedEmail && targetUser.email && trimmedEmail !== targetUser.email.toLowerCase()) {
        return NextResponse.json(
          { error: "Login email is managed via OAuth authentication and cannot be changed." },
          { status: 400 }
        );
      }
    }

    // Validate and sanitize name if provided
    let finalSanitizedName: string | undefined = undefined;
    if (name !== undefined) {
      if (typeof name !== "string") {
        return NextResponse.json({ error: "Full name must be a string." }, { status: 400 });
      }
      // Strict check on raw input: rejects numbers, symbols, and special characters (e.g. test1, @, #, etc.)
      const rawValidation = validateUserName(name);
      if (!rawValidation.isValid) {
        return NextResponse.json({ error: rawValidation.error }, { status: 400 });
      }
      finalSanitizedName = sanitizeUserName(name);
      const sanitizedValidation = validateUserName(finalSanitizedName);
      if (!sanitizedValidation.isValid) {
        return NextResponse.json({ error: sanitizedValidation.error }, { status: 400 });
      }
    }

    // Non-admin cannot modify role, approval, or site access
    if (!isAdmin && (role || approved !== undefined || siteIds !== undefined || allowLinkLogAccess !== undefined || hasLeftCompany !== undefined || commissionToPartyFund !== undefined)) {
      return NextResponse.json({ error: "Forbidden: Only administrators can modify roles and permissions." }, { status: 403 });
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

    const incomingSiteAccess = body.siteAccess;

    // Handle site access sync if siteAccess or siteIds is provided
    let resolvedRole = role;
    if (!resolvedRole && !targetUser.role) {
      if (incomingSiteAccess && Array.isArray(incomingSiteAccess) && incomingSiteAccess.length > 0) {
        const firstSa = incomingSiteAccess[0];
        const firstRoles = Array.isArray(firstSa.roles)
          ? firstSa.roles
          : typeof firstSa.roles === "string"
          ? firstSa.roles.split(",").map((s: string) => s.trim()).filter(Boolean)
          : [];
        resolvedRole = firstSa.role || firstRoles[0] || "WRITER";
      } else if (siteIds && Array.isArray(siteIds) && siteIds.length > 0) {
        resolvedRole = "WRITER";
      } else if (finalApproved === true) {
        resolvedRole = "WRITER";
      }
    }
    const newRole = resolvedRole || targetUser.role;
    let siteAccessUpdate = undefined;

    if (incomingSiteAccess !== undefined && Array.isArray(incomingSiteAccess)) {
      siteAccessUpdate = {
        deleteMany: {},
        create: incomingSiteAccess.map((sa: any) => {
          const rolesArr = Array.isArray(sa.roles)
            ? sa.roles
            : typeof sa.roles === "string"
            ? sa.roles.split(",").map((s: string) => s.trim()).filter(Boolean)
            : [];
          const primaryRole = sa.role || rolesArr[0] || newRole || "WRITER";
          const rolesStr = rolesArr.length > 0 ? rolesArr.join(",") : (sa.role || primaryRole);
          return {
            siteId: Number(sa.siteId),
            role: primaryRole,
            roles: rolesStr,
            canAddProduct: Boolean(sa.canAddProduct || rolesArr.includes("LINKER") || rolesArr.includes("PRODUCT_RESEARCHER") || primaryRole === "LINKER" || primaryRole === "PRODUCT_RESEARCHER"),
            canAddLink: Boolean(sa.canAddLink || rolesArr.includes("LINKER") || primaryRole === "LINKER"),
            canWrite: Boolean(sa.canWrite || rolesArr.includes("WRITER") || primaryRole === "WRITER"),
            canReview: Boolean(sa.canReview || rolesArr.includes("TEAM_LEAD") || primaryRole === "TEAM_LEAD"),
          };
        }),
      };
    } else if (siteIds !== undefined && Array.isArray(siteIds)) {
      siteAccessUpdate = {
        deleteMany: {},
        create: siteIds.map((siteId: number) => ({
          siteId: Number(siteId),
          role: newRole || "WRITER",
          roles: newRole || "WRITER",
          canAddProduct: newRole === "LINKER" || newRole === "PRODUCT_RESEARCHER",
          canAddLink: newRole === "LINKER",
          canWrite: newRole === "WRITER",
          canReview: newRole === "TEAM_LEAD",
        })),
      };
    }

    // Resolve teamLeadId updates cleanly (supports migrating, unassigning, and role transitions)
    let resolvedTeamLeadId: number | null | undefined = undefined;
    if (newRole !== "WRITER") {
      resolvedTeamLeadId = null;
    } else if (teamLeadId !== undefined) {
      resolvedTeamLeadId = teamLeadId && teamLeadId !== "none" && teamLeadId !== "" ? Number(teamLeadId) : null;
    }

    const updated = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        ...(finalSanitizedName ? { name: finalSanitizedName } : {}),
        ...(image !== undefined ? { image } : {}),
        ...(resolvedRole ? { role: resolvedRole as "SUPER_ADMIN" | "ADMIN" | "LINKER" | "WRITER" | "TEAM_LEAD" | "PRODUCT_RESEARCHER" } : {}),
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

    // Cascade display name update across notifications, link logs, history records, and products
    if (finalSanitizedName && targetUser.name && finalSanitizedName !== targetUser.name) {
      await cascadeUserNameUpdate(targetUser.id, targetUser.name, finalSanitizedName, targetUser.email || "");
    }

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

// DELETE /api/users/[id] - delete a user
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
