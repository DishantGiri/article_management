import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/links?productId=X
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");

  const links = await prisma.linkLog.findMany({
    where: productId ? { productId: parseInt(productId) } : undefined,
    include: {
      geos: true,
      addedBy: { select: { name: true } },
      product: { select: { name: true } },
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

    // Business rule: buyLink requires bridgePageLink
    if (buyLink && !bridgePageLink) {
      return NextResponse.json({ error: "Bridge Page Link must be added before Buy Link." }, { status: 400 });
    }

    // Business rule: status ACCEPTED requires bridgePageLink
    if (status === "ACCEPTED" && !bridgePageLink) {
      return NextResponse.json({ error: "Bridge Page Link is required before setting status to Accepted." }, { status: 400 });
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

    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    console.error("[POST /api/links]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
