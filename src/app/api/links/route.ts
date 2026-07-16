import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/links?productId=X&userId=Y
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  const userId = searchParams.get("userId");

  let allowedSiteIds: number[] | undefined = undefined;

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { role: true, allowLinkLogAccess: true },
    });
    if (user?.role === "WRITER" && !user.allowLinkLogAccess) {
      return NextResponse.json({ error: "Access Denied: Writers do not have access to Link Logs unless allowed separately by the Admin Department." }, { status: 403 });
    }
    
    // Team lead restrictions
    if (user?.role === "TEAM_LEAD") {
      const accesses = await prisma.siteAccess.findMany({
        where: { userId: parseInt(userId) },
        select: { siteId: true },
      });
      allowedSiteIds = accesses.map((a) => a.siteId);
    }
  }

  const links = await prisma.linkLog.findMany({
    where: {
      ...(productId ? { productId: parseInt(productId) } : {}),
      ...(allowedSiteIds !== undefined ? { product: { siteId: { in: allowedSiteIds } } } : {}),
    },
    include: {
      geos: true,
      addedBy: { select: { name: true } },
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
    const body = await req.json();
    const { productId, addedById, bridgePageLink, buyLink, affiliateName, affiliateLink, geos, status, linkerRemarks } = body;

    if (!productId || !addedById || !affiliateName || !affiliateLink) {
      return NextResponse.json({ error: "productId, addedById, affiliateName, affiliateLink are required" }, { status: 400 });
    }

    // Fix 1: Compulsory Geo selection
    if (!geos || !Array.isArray(geos) || geos.length === 0) {
      return NextResponse.json({ error: "At least one GEO must be selected." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(addedById) },
      select: { role: true, allowLinkLogAccess: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    if (user.role === "WRITER" && !user.allowLinkLogAccess) {
      return NextResponse.json({ error: "Access Denied: Writers do not have access to Link Logs unless allowed separately by the Admin Department." }, { status: 403 });
    }

    if (user.role !== "LINKER" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
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

    const link = await prisma.linkLog.create({
      data: {
        productId: parseInt(productId),
        addedById: parseInt(addedById),
        bridgePageLink: bridgePageLink || null,
        buyLink: buyLink || null,
        affiliateName,
        affiliateLink,
        status: status || "REQUESTED",
        linkerRemarks: linkerRemarks || null,
        geos: {
          create: (geos as string[] || []).map((geo: string) => ({ geo })),
        },
      },
      include: { geos: true, addedBy: { select: { name: true } } },
    });

    // Log creation history
    await prisma.linkHistory.create({
      data: {
        linkLogId: link.id,
        updatedById: parseInt(addedById),
        newBridgeLink: link.bridgePageLink,
        newBuyLink: link.buyLink,
        newAffiliateLink: link.affiliateLink,
        newStatus: link.status,
        newRemarks: link.linkerRemarks,
      },
    });

    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    console.error("[POST /api/links]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
