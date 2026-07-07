import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/users — list all users with their accesses
export async function GET() {
  const users = await prisma.user.findMany({
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

// POST /api/users — create a new user and optionally setup site access
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, role, siteIds, allowLinkLogAccess, creatorId, teamLeadId } = body;

    // Use provided password or fallback to default
    const finalPassword = password || "DefaultPass123!";

    if (!name || !email || !role) {
      return NextResponse.json({ error: "name, email, and role are required" }, { status: 400 });
    }

    // Get creator role
    let creatorRole = "ADMIN";
    if (creatorId) {
      const creator = await prisma.user.findUnique({
        where: { id: Number(creatorId) },
        select: { role: true },
      });
      if (creator) {
        creatorRole = creator.role;
      }
    }

    // Only SUPER_ADMIN can create ADMIN
    if (role === "ADMIN" && creatorRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only Super Admins can create Admin users." }, { status: 403 });
    }
    
    // Nobody can create a new SUPER_ADMIN from the UI
    if (role === "SUPER_ADMIN") {
      return NextResponse.json({ error: "Cannot create Super Admin users." }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: finalPassword,
        role: role as "SUPER_ADMIN" | "ADMIN" | "LINKER" | "WRITER" | "TEAM_LEAD",
        allowLinkLogAccess: role === "WRITER" ? !!allowLinkLogAccess : false,
        teamLeadId: role === "WRITER" && teamLeadId ? Number(teamLeadId) : null,
        siteAccess: (role === "WRITER" || role === "TEAM_LEAD") && siteIds && Array.isArray(siteIds)
          ? {
              create: siteIds.map((siteId: number) => ({ siteId })),
            }
          : undefined,
      },
      include: {
        siteAccess: { include: { site: { select: { name: true } } } },
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error("[POST /api/users]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
