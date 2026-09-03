import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// GET /api/links?productId=X
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");

  let allowedSiteIds: number[] | undefined = undefined;

  const userId = session.user.id;
  const userRole = session.user.role;
  const allowLinkLogAccess = session.user.approved && session.user.role !== "WRITER"; // Standard check or check DB user

  // Check database for allowLinkLogAccess flag for WRITER
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, allowLinkLogAccess: true },
  });

  if (dbUser?.role === "WRITER" && !dbUser.allowLinkLogAccess) {
    return NextResponse.json({ error: "Access Denied: Writers do not have access to Link Logs unless allowed separately by the Admin Department." }, { status: 403 });
  }
  
  // Team lead restrictions
  if (dbUser?.role === "TEAM_LEAD") {
    const accesses = await prisma.siteAccess.findMany({
      where: { userId },
      select: { siteId: true },
    });
    allowedSiteIds = accesses.map((a) => a.siteId);
  }

  const links = await prisma.linkLog.findMany({
    where: {
      ...(productId ? { productId: parseInt(productId) } : {}),
      ...(allowedSiteIds !== undefined ? { product: { siteId: { in: allowedSiteIds } } } : {}),
    },
    include: {
      geos: true,
      addedBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
      product: { 
        select: { 
          name: true, 
          site: { select: { name: true } },
          article: { select: { articleLink: true } } 
        } 
      },
    },
    orderBy: { addedAt: "desc" },
  });
  return NextResponse.json(links);
}

// POST /api/links — create a new link log entry
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { productId, bridgePageLink, buyLink, affiliateName, affiliateLink, affiliateEntries, geos, status, linkerRemarks } = body;

    const VALID_LINK_STATUSES = [
      "REQUESTED",
      "ACCEPTED",
      "CANCELED",
      "ISSUE",
      "NEED_TO_CHECK",
      "PRESELL_PAGE",
      "REDIRECTED",
    ];

    const STATUS_MAP: Record<string, string> = {
      PENDING: "REQUESTED",
      Pending: "REQUESTED",
      REJECTED: "CANCELED",
      Rejected: "CANCELED",
    };

    const targetStatus = status ? (STATUS_MAP[status] || status) : "REQUESTED";

    if (!VALID_LINK_STATUSES.includes(targetStatus)) {
      return NextResponse.json(
        { error: `Invalid status '${status}'. Allowed values are: ${VALID_LINK_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const entriesToCreate: Array<{ affiliateName: string; affiliateLink: string; geos?: string[] }> =
      Array.isArray(affiliateEntries) && affiliateEntries.length > 0
        ? affiliateEntries
        : affiliateName && affiliateLink
        ? [{ affiliateName, affiliateLink }]
        : [];

    if (!productId || entriesToCreate.length === 0) {
      return NextResponse.json({ error: "productId and at least one affiliate network entry (affiliateName & affiliateLink) are required" }, { status: 400 });
    }

    for (const entry of entriesToCreate) {
      if (!entry.affiliateName?.trim() || !entry.affiliateLink?.trim()) {
        return NextResponse.json({ error: "Affiliate Name and Affiliate Link are required for all network entries." }, { status: 400 });
      }
    }

    // Fix 1: Compulsory Geo selection
    const hasPerEntryGeos = entriesToCreate.some((e) => Array.isArray(e.geos) && e.geos.length > 0);
    if ((!geos || !Array.isArray(geos) || geos.length === 0) && !hasPerEntryGeos) {
      return NextResponse.json({ error: "At least one GEO must be selected." }, { status: 400 });
    }

    const uniqueGeos = Array.from(
      new Set((geos as string[] || []).map((g: string) => String(g).trim()).filter(Boolean))
    );

    if (uniqueGeos.length === 0 && !hasPerEntryGeos) {
      return NextResponse.json({ error: "At least one valid GEO must be selected." }, { status: 400 });
    }

    const addedById = session.user.id;

    const dbUser = await prisma.user.findUnique({
      where: { id: addedById },
      select: { role: true, allowLinkLogAccess: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    if (dbUser.role === "WRITER" && !dbUser.allowLinkLogAccess) {
      return NextResponse.json({ error: "Access Denied: Writers do not have access to Link Logs unless allowed separately by the Admin Department." }, { status: 403 });
    }

    if (dbUser.role === "TEAM_LEAD") {
      return NextResponse.json(
        { error: "Access Denied: Team Leads cannot add links. Only Linkers can add links." },
        { status: 403 }
      );
    }

    if (dbUser.role !== "LINKER" && dbUser.role !== "ADMIN" && dbUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Access Denied: Only Linkers can add links." },
        { status: 403 }
      );
    }

    // Business rule: status ACCEPTED requires bridgePageLink
    if (targetStatus === "ACCEPTED" && !bridgePageLink?.trim()) {
      return NextResponse.json({ error: "Bridge Page Link is required before setting status to Accepted." }, { status: 400 });
    }

    // Business rule: buyLink requires bridgePageLink
    if (buyLink && !bridgePageLink?.trim()) {
      return NextResponse.json({ error: "Bridge Page Link is required before adding a Buy Link." }, { status: 400 });
    }

    const createdLinks = await prisma.$transaction(
      entriesToCreate.map((entry) => {
        const itemGeos = Array.isArray(entry.geos) && entry.geos.length > 0
          ? Array.from(new Set(entry.geos.map((g) => String(g).trim()).filter(Boolean)))
          : uniqueGeos;

        return prisma.linkLog.create({
          data: {
            productId: parseInt(productId),
            addedById: addedById,
            bridgePageLink: bridgePageLink?.trim() || null,
            buyLink: buyLink?.trim() || null,
            affiliateName: entry.affiliateName.trim(),
            affiliateLink: entry.affiliateLink.trim(),
            status: targetStatus as any,
            linkerRemarks: linkerRemarks?.trim() || null,
            geos: {
              create: itemGeos.map((geo: string) => ({ geo })),
            },
          },
          include: { geos: true, addedBy: { select: { name: true } } },
        });
      })
    );

    // Log creation history for each created link log
    await prisma.$transaction(
      createdLinks.map((link) =>
        prisma.linkHistory.create({
          data: {
            linkLogId: link.id,
            updatedById: addedById,
            newBridgeLink: link.bridgePageLink,
            newBuyLink: link.buyLink,
            newAffiliateLink: link.affiliateLink,
            newStatus: link.status,
            newRemarks: link.linkerRemarks,
          },
        })
      )
    );

    return NextResponse.json(createdLinks.length === 1 ? createdLinks[0] : createdLinks, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/links]", err);
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Duplicate entry or GEO assignment" }, { status: 400 });
    }
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
