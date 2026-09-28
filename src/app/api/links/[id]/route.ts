import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRealtimeNotification, broadcastRealtimeNotification } from "@/lib/notifier";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// PATCH /api/links/[id] - update link details / status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeUserId = Number(session.user.id);
    const activeUserRole = session.user.role;

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
    } = body;

    const { countryLinks, issueMessage } = body;

    const isReportingIssue = Boolean(
      issueMessage ||
      (status === "ISSUE" && !buyLink && !bridgePageLink && !affiliateLink && (!countryLinks || countryLinks.length === 0) && (!geos || geos.length === 0)) ||
      (status === "ISSUE" && (activeUserRole === "TEAM_LEAD" || activeUserRole === "WRITER" || activeUserRole === "PRODUCT_RESEARCHER"))
    );

    if (activeUserRole === "TEAM_LEAD" && !isReportingIssue) {
      return NextResponse.json({ error: "Access Denied: Team Leads cannot modify links. Only Linkers can manage links." }, { status: 403 });
    }
    if (activeUserRole === "WRITER" && !isReportingIssue) {
      const dbUser = await prisma.user.findUnique({
        where: { id: activeUserId },
        select: { allowLinkLogAccess: true },
      });
      if (!dbUser?.allowLinkLogAccess) {
        return NextResponse.json({ error: "Access Denied: Writers do not have access to Link Logs unless allowed separately by the Admin Department." }, { status: 403 });
      }
    }
    if (activeUserRole === "PRODUCT_RESEARCHER" && !isReportingIssue) {
      return NextResponse.json({ error: "Access Denied: Product Researchers cannot modify links." }, { status: 403 });
    }

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

    const targetStatus = status ? (STATUS_MAP[status] || status) : undefined;

    if (targetStatus && !VALID_LINK_STATUSES.includes(targetStatus)) {
      return NextResponse.json(
        { error: `Invalid status '${status}'. Allowed values are: ${VALID_LINK_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const existing = await prisma.linkLog.findUnique({
      where: { id: parseInt(id) },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            site: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!existing) return NextResponse.json({ error: "Link not found" }, { status: 404 });

    const updatedBridge = bridgePageLink !== undefined ? (bridgePageLink ? String(bridgePageLink).trim() : null) : existing.bridgePageLink;
    const updatedBuy = buyLink !== undefined ? (buyLink ? String(buyLink).trim() : null) : existing.buyLink;

    if (!isReportingIssue) {
      if (!updatedBridge) {
        return NextResponse.json(
          { error: "Bridge Page Link is required before saving changes." },
          { status: 400 }
        );
      }

      if (!updatedBuy) {
        return NextResponse.json(
          { error: "Buy Link is required before saving changes." },
          { status: 400 }
        );
      }
    }

    let geosToSet: Array<{ geo: string; affiliateLink?: string; affiliateName?: string }> | null = null;
    if (countryLinks && Array.isArray(countryLinks)) {
      geosToSet = countryLinks.map((c: any) => ({
        geo: String(c.geo || "").trim().toUpperCase(),
        affiliateLink: String(c.affiliateLink || "").trim(),
        affiliateName: String(c.affiliateName || "").trim() || undefined,
      })).filter((item: any) => Boolean(item.geo));
    } else if (geos && Array.isArray(geos)) {
      geosToSet = geos.map((g: any) => {
        const geoStr = (typeof g === "string" ? g : g?.geo || "").trim().toUpperCase();
        const affLink = (typeof g === "object" && g?.affiliateLink ? String(g.affiliateLink) : "").trim();
        const affName = (typeof g === "object" && g?.affiliateName ? String(g.affiliateName) : "").trim();
        return { geo: geoStr, affiliateLink: affLink || undefined, affiliateName: affName || undefined };
      }).filter((item: any) => Boolean(item.geo));
    }

    if (geosToSet !== null) {
      await prisma.linkGeo.deleteMany({
        where: { linkLogId: parseInt(id) },
      });
    }

    let targetAffiliateName = affiliateName !== undefined ? affiliateName : existing.affiliateName;
    if (!targetAffiliateName && geosToSet && geosToSet.length > 0) {
      const distinctNames = Array.from(new Set(geosToSet.map((g) => g.affiliateName).filter(Boolean)));
      if (distinctNames.length > 0) {
        targetAffiliateName = distinctNames.join(", ");
      }
    }

    // Determine if issue is being raised or resolved
    const isRaisingIssue = Boolean(issueMessage) || (targetStatus === "ISSUE" && existing.status !== "ISSUE");
    const isResolvingIssue = existing.status === "ISSUE" && targetStatus !== undefined && targetStatus !== "ISSUE";

    const caller = await prisma.user.findUnique({
      where: { id: Number(activeUserId) },
      select: { name: true, role: true },
    });
    const callerLabel = caller
      ? `${caller.name} (${caller.role ? caller.role.replace("_", " ") : "USER"})`
      : "User";

    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // Format remarks if issue is reported
    let formattedRemarks = linkerRemarks !== undefined ? (linkerRemarks ? linkerRemarks.trim() : null) : existing.linkerRemarks;
    if (isRaisingIssue) {
      const issueText = (issueMessage || linkerRemarks || "Link issue reported").trim();
      const currentRemarks = existing.linkerRemarks || "";
      formattedRemarks = `[Flagged by ${callerLabel} • ${dateStr}]: ${issueText}${currentRemarks ? `\n${currentRemarks}` : ""}`;
    }

    const updated = await prisma.linkLog.update({
      where: { id: parseInt(id) },
      data: {
        ...(activeUserId && !isReportingIssue ? { updatedById: Number(activeUserId) } : {}),
        ...(targetStatus !== undefined ? { status: targetStatus as any } : isRaisingIssue ? { status: "ISSUE" } : {}),
        ...(bridgePageLink !== undefined ? { bridgePageLink: updatedBridge } : {}),
        ...(buyLink !== undefined ? { buyLink: updatedBuy } : {}),
        ...(formattedRemarks !== undefined ? { linkerRemarks: formattedRemarks } : {}),
        ...(productId !== undefined ? { productId: Number(productId) } : {}),
        ...(targetAffiliateName !== undefined ? { affiliateName: targetAffiliateName } : {}),
        ...(affiliateLink !== undefined ? { affiliateLink } : {}),
        ...(geosToSet !== null
          ? {
            geos: {
              create: geosToSet.map((item) => ({
                geo: item.geo,
                affiliateLink: item.affiliateLink || affiliateLink || existing.affiliateLink,
                affiliateName: item.affiliateName || targetAffiliateName || existing.affiliateName,
              })),
            },
          }
          : {}),
      },
      include: {
        geos: true,
        product: {
          select: {
            id: true,
            name: true,
            site: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Record History Log
    const hasChanges =
      updated.bridgePageLink !== existing.bridgePageLink ||
      updated.buyLink !== existing.buyLink ||
      updated.affiliateName !== existing.affiliateName ||
      updated.affiliateLink !== existing.affiliateLink ||
      updated.status !== existing.status ||
      updated.linkerRemarks !== existing.linkerRemarks ||
      geosToSet !== null ||
      isRaisingIssue;

    if (hasChanges && activeUserId) {
      await prisma.linkHistory.create({
        data: {
          linkLogId: updated.id,
          updatedById: Number(activeUserId),
          oldBridgeLink: existing.bridgePageLink,
          newBridgeLink: updated.bridgePageLink,
          oldBuyLink: existing.buyLink,
          newBuyLink: updated.buyLink,
          oldAffiliateLink: existing.affiliateLink,
          newAffiliateLink: updated.affiliateLink,
          oldStatus: existing.status,
          newStatus: updated.status,
          oldRemarks: existing.linkerRemarks,
          newRemarks: updated.linkerRemarks,
        },
      });
    }

    const productName = updated.product?.name || existing.product?.name || "Product";
    const siteName = (updated.product?.site?.name || existing.product?.site?.name)
      ? ` (${updated.product?.site?.name || existing.product?.site?.name})`
      : "";

    // 1. NOTIFICATIONS FOR LINK ISSUE RAISED
    if (isRaisingIssue) {
      try {
        const issueReason = (issueMessage || linkerRemarks || "Flagged issue with link").trim();
        const notifMessage = `${callerLabel} reported an issue with link for "${productName}"${siteName}: "${issueReason}"`;

        const allUsers = await prisma.user.findMany({ select: { id: true } });
        for (const u of allUsers) {
          try {
            const notif = await prisma.notification.create({
              data: {
                recipientId: u.id,
                senderId: Number(activeUserId),
                type: "LINK_ISSUE",
                message: notifMessage,
              },
            });
            await sendRealtimeNotification(u.id, notif);
          } catch (e) {
            console.error("Failed to notify user for link issue:", u.id, e);
          }
        }

        await broadcastRealtimeNotification({
          senderId: Number(activeUserId),
          message: notifMessage,
          type: "LINK_ISSUE",
          data: { linkLogId: existing.id, productId: existing.productId },
        });
      } catch (notifErr) {
        console.error("Failed to send link issue notifications:", notifErr);
      }
    }

    // 2. NOTIFICATIONS FOR LINK ISSUE FIXED / RESOLVED
    if (isResolvingIssue) {
      try {
        const notifMessage = `Link issue for "${productName}"${siteName} has been resolved by ${callerLabel}. The product link is now updated and active.`;

        // Notify ALL users in the system so everyone knows the link is unblocked
        const allUsers = await prisma.user.findMany({
          select: { id: true },
        });

        for (const u of allUsers) {
          try {
            const notif = await prisma.notification.create({
              data: {
                recipientId: u.id,
                senderId: Number(activeUserId),
                type: "LINK_ISSUE",
                message: notifMessage,
              },
            });
            await sendRealtimeNotification(u.id, notif);
          } catch (e) {
            console.error("Failed to notify user of link resolution:", u.id, e);
          }
        }

        await broadcastRealtimeNotification({
          senderId: Number(activeUserId),
          message: notifMessage,
          type: "LINK_ISSUE",
          data: {
            linkLogId: existing.id,
            resolved: true,
            productId: existing.productId,
          },
        });
      } catch (resErr) {
        console.error("Failed to process link resolution notification:", resErr);
      }
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/links/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Support both PUT and PATCH methods
export const PUT = PATCH;

// DELETE /api/links/[id] - delete link log
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "LINKER" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Access Denied: Only Linkers, Admins, and Super Admins can delete links." },
        { status: 403 }
      );
    }

    const { id } = await params;

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

// GET /api/links/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (session.user.role === "WRITER") {
    const user = await prisma.user.findUnique({
      where: { id: Number(session.user.id) },
      select: { allowLinkLogAccess: true },
    });
    if (!user?.allowLinkLogAccess) {
      return NextResponse.json({ error: "Access Denied: Writers do not have access to Link Logs unless allowed separately by the Admin Department." }, { status: 403 });
    }
  }

  const link = await prisma.linkLog.findUnique({
    where: { id: parseInt(id) },
    include: {
      geos: true,
      addedBy: { select: { name: true } },
      product: {
        select: {
          name: true,
          site: { select: { name: true } }
        }
      }
    },
  });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(link);
}

