import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRealtimeNotification } from "@/lib/notifier";

// PATCH /api/links/[id] — update link details / status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      status,
      bridgePageLink,
      buyLink,
      linkerRemarks,
      productId,
      affiliateName,
      affiliateLink,
      geos,
      callerId,
      teamLeadId,
    } = body;

    const activeUserId = callerId || teamLeadId;
    if (activeUserId) {
      const user = await prisma.user.findUnique({
        where: { id: Number(activeUserId) },
        select: { role: true, allowLinkLogAccess: true },
      });
      if (user?.role === "WRITER" && !user.allowLinkLogAccess) {
        return NextResponse.json({ error: "Access Denied: Writers do not have access to Link Logs unless allowed separately by the Admin Department." }, { status: 403 });
      }
    }

    const existing = await prisma.linkLog.findUnique({ where: { id: parseInt(id) } });
    if (!existing) return NextResponse.json({ error: "Link not found" }, { status: 404 });

    const updatedBridge = bridgePageLink !== undefined ? bridgePageLink : existing.bridgePageLink;

    if (status === "ACCEPTED" && !updatedBridge) {
      return NextResponse.json(
        { error: "Bridge Page Link must be present before setting status to Accepted." },
        { status: 400 }
      );
    }

    // If geos are being updated, delete old geos first
    if (geos && Array.isArray(geos)) {
      await prisma.linkGeo.deleteMany({
        where: { linkLogId: parseInt(id) },
      });
    }

    const updated = await prisma.linkLog.update({
      where: { id: parseInt(id) },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(bridgePageLink !== undefined ? { bridgePageLink: bridgePageLink || null } : {}),
        ...(buyLink !== undefined ? { buyLink: buyLink || null } : {}),
        ...(linkerRemarks !== undefined ? { linkerRemarks: linkerRemarks || null } : {}),
        ...(productId !== undefined ? { productId: Number(productId) } : {}),
        ...(affiliateName !== undefined ? { affiliateName } : {}),
        ...(affiliateLink !== undefined ? { affiliateLink } : {}),
        ...(geos && Array.isArray(geos)
          ? {
              geos: {
                create: geos.map((geo: string) => ({ geo })),
              },
            }
          : {}),
      },
      include: { geos: true },
    });

    const { issueMessage } = body;
    if (issueMessage && teamLeadId) {
      const notif = await prisma.notification.create({
        data: {
          recipientId: existing.addedById,
          senderId: parseInt(teamLeadId),
          type: "LINK_ISSUE",
          message: `Team Lead flagged an issue with link "${existing.affiliateName}": "${issueMessage}"`,
        },
      });
      await sendRealtimeNotification(existing.addedById, notif);
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/links/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/links/[id] — delete link log
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const callerId = searchParams.get("callerId");

    const callerIdNum = Number(callerId);
    if (callerIdNum) {
      const user = await prisma.user.findUnique({
        where: { id: callerIdNum },
        select: { role: true },
      });
      if (!user || (user.role !== "LINKER" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
        return NextResponse.json(
          { error: "Access Denied: Only Linkers, Admins, and Super Admins can delete links." },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json({ error: "callerId is required" }, { status: 400 });
    }

    const existing = await prisma.linkLog.findUnique({ where: { id: parseInt(id) } });
    if (!existing) return NextResponse.json({ error: "Link not found" }, { status: 404 });

    await prisma.linkLog.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/links/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/links/[id]?userId=X
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { role: true, allowLinkLogAccess: true },
    });
    if (user?.role === "WRITER" && !user.allowLinkLogAccess) {
      return NextResponse.json({ error: "Access Denied: Writers do not have access to Link Logs unless allowed separately by the Admin Department." }, { status: 403 });
    }
  }

  const link = await prisma.linkLog.findUnique({
    where: { id: parseInt(id) },
    include: { geos: true, addedBy: { select: { name: true } }, product: { select: { name: true } } },
  });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(link);
}

