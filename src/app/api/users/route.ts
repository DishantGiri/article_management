import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// GET /api/users - list all users with their accesses
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only Admin or Super Admin can view all users list
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // If Admin (and not Super Admin), filter out Super Admin users
  const whereClause = session.user.role === "ADMIN" ? { role: { not: "SUPER_ADMIN" as const } } : {};

  const users = await prisma.user.findMany({
    where: whereClause,
    include: {
      siteAccess: {
        include: { site: { select: { id: true, name: true } } },
      },
      teamLead: { select: { id: true, name: true } },
      teamMembers: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(users);
}

// POST /api/users - create a new user and optionally setup site access
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, email, role, siteIds, allowLinkLogAccess, teamLeadId, approved, hasLeftCompany, commissionToPartyFund } = body;

    const trimmedName = typeof name === "string" ? name.trim() : "";
    const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!trimmedName && !trimmedEmail) {
      return NextResponse.json({ error: "Name and email address are required" }, { status: 400 });
    }
    if (!trimmedName) {
      return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    }
    if (!trimmedEmail) {
      return NextResponse.json({ error: "Email address is required" }, { status: 400 });
    }
    if (!role) {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmedEmail)) {
      return NextResponse.json({ error: "Invalid email format. Please provide a valid email address." }, { status: 400 });
    }

    if (!trimmedEmail.endsWith("@fishtailinfosolutions.com")) {
      return NextResponse.json({ error: "Email must belong to the @fishtailinfosolutions.com corporate domain." }, { status: 400 });
    }

    const creatorRole = session.user.role || "";

    // Only SUPER_ADMIN can create ADMIN or SUPER_ADMIN users
    if ((role === "ADMIN" || role === "SUPER_ADMIN") && creatorRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: `Only Super Admins can create ${role === "SUPER_ADMIN" ? "Super Admin" : "Admin"} users.` }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({ where: { email: trimmedEmail } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    }

    let finalHasLeft = Boolean(hasLeftCompany);
    if (finalHasLeft && approved === true) {
      return NextResponse.json(
        { error: "A former employee (who has left the company) cannot be granted active login access." },
        { status: 400 }
      );
    }
    let finalApproved = finalHasLeft ? false : (typeof approved === 'boolean' ? approved : true);
    let finalCommToParty = finalHasLeft ? false : Boolean(commissionToPartyFund);

    let siteAccessCreate = undefined;
    if (Array.isArray(body.siteAccess) && body.siteAccess.length > 0) {
      siteAccessCreate = {
        create: body.siteAccess.map((sa: any) => {
          const rolesArr = Array.isArray(sa.roles)
            ? sa.roles
            : typeof sa.roles === "string"
            ? sa.roles.split(",").map((s: string) => s.trim()).filter(Boolean)
            : [];
          const primaryRole = sa.role || rolesArr[0] || (role as any) || "WRITER";
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
    } else if (siteIds && Array.isArray(siteIds) && siteIds.length > 0) {
      siteAccessCreate = {
        create: siteIds.map((siteId: number) => ({
          siteId: Number(siteId),
          role: (role as any) || "WRITER",
          roles: (role as any) || "WRITER",
          canAddProduct: role === "LINKER" || role === "PRODUCT_RESEARCHER",
          canAddLink: role === "LINKER",
          canWrite: role === "WRITER",
          canReview: role === "TEAM_LEAD",
        })),
      };
    }

    const user = await prisma.user.create({
      data: {
        name: trimmedName,
        email: trimmedEmail,
        role: role as "SUPER_ADMIN" | "ADMIN" | "LINKER" | "WRITER" | "TEAM_LEAD" | "PRODUCT_RESEARCHER",
        allowLinkLogAccess: role === "WRITER" ? !!allowLinkLogAccess : false,
        ...(role === "WRITER" && teamLeadId
          ? { teamLead: { connect: { id: Number(teamLeadId) } } }
          : {}),
        approved: finalApproved,
        hasLeftCompany: finalHasLeft,
        commissionToPartyFund: finalCommToParty,
        siteAccess: siteAccessCreate,
      },
      include: {
        siteAccess: { include: { site: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error("[POST /api/users]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
