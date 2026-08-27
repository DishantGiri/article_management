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

    const entriesToCreate: Array<{ affiliateName: string; affiliateLink: string }> =
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
    if (!geos || !Array.isArray(geos) || geos.length === 0) {
      return NextResponse.json({ error: "At least one GEO must be selected." }, { status: 400 });
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

    if (dbUser.role !== "LINKER" && dbUser.role !== "ADMIN" && dbUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Linkers, Admins, and Super Admins can add links." },
        { status: 403 }
      );
    }

    // Business rule: status ACCEPTED requires bridgePageLink
    if (status === "ACCEPTED" && !bridgePageLink) {
      return NextResponse.json({ error: "Bridge Page Link is required before setting status to Accepted." }, { status: 400 });
    }

    // Business rule: buyLink requires bridgePageLink
    if (buyLink && !bridgePageLink) {
      return NextResponse.json({ error: "Bridge Page Link is required before adding a Buy Link." }, { status: 400 });
    }

    const createdLinks = await prisma.$transaction(
      entriesToCreate.map((entry) =>
        prisma.linkLog.create({
          data: {
            productId: parseInt(productId),
            addedById: addedById,
            bridgePageLink: bridgePageLink || null,
            buyLink: buyLink || null,
            affiliateName: entry.affiliateName.trim(),
            affiliateLink: entry.affiliateLink.trim(),
            status: status || "REQUESTED",
            linkerRemarks: linkerRemarks || null,
            geos: {
              create: (geos as string[] || []).map((geo: string) => ({ geo })),
            },
          },
          include: { geos: true, addedBy: { select: { name: true } } },
        })
      )
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
  } catch (err) {
    console.error("[POST /api/links]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
