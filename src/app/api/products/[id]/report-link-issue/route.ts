import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRealtimeNotification, broadcastRealtimeNotification } from "@/lib/notifier";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
    }

    const body = await req.json();
    const { issueMessage } = body;
    if (!issueMessage || !issueMessage.trim()) {
      return NextResponse.json({ error: "Issue message is required" }, { status: 400 });
    }

    const activeUserId = Number(session.user.id);
    const caller = await prisma.user.findUnique({
      where: { id: activeUserId },
      select: { name: true, role: true },
    });

    const callerLabel = caller
      ? `${caller.name} (${caller.role ? caller.role.replace("_", " ") : "USER"})`
      : "User";

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        site: { select: { id: true, name: true } },
        linkLogs: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // If product has existing link logs, update them to ISSUE
    if (product.linkLogs && product.linkLogs.length > 0) {
      for (const log of product.linkLogs) {
        const currentRemarks = log.linkerRemarks || "";
        const formattedRemark = `[Flagged by ${callerLabel}]: ${issueMessage.trim()}${
          currentRemarks ? `\n${currentRemarks}` : ""
        }`;

        await prisma.linkLog.update({
          where: { id: log.id },
          data: {
            status: "ISSUE",
            linkerRemarks: formattedRemark,
            updatedById: activeUserId,
          },
        });

        await prisma.linkHistory.create({
          data: {
            linkLogId: log.id,
            updatedById: activeUserId,
            oldStatus: log.status,
            newStatus: "ISSUE",
            oldRemarks: currentRemarks,
            newRemarks: formattedRemark,
          },
        });
      }
    } else {
      // Create a new LinkLog in ISSUE status for this product
      const formattedRemark = `[Flagged by ${callerLabel}]: ${issueMessage.trim()}`;
      const newLog = await prisma.linkLog.create({
        data: {
          productId: product.id,
          addedById: activeUserId,
          affiliateName: product.affiliateName?.trim() || "General",
          affiliateLink: product.previewLink?.trim() || product.trendLink?.trim() || "",
          status: "ISSUE",
          linkerRemarks: formattedRemark,
        },
      });

      await prisma.linkHistory.create({
        data: {
          linkLogId: newLog.id,
          updatedById: activeUserId,
          newStatus: "ISSUE",
          newRemarks: formattedRemark,
        },
      });
    }

    // Send notifications to ALL users (Linkers, Writers, Team Leads, Admins, Super Admins)
    const allUsers = await prisma.user.findMany({
      select: { id: true },
    });

    const notifMessage = `⚠️ ${callerLabel} reported an issue with link for "${product.name}" (${product.site?.name || "Site"}): "${issueMessage.trim()}"`;

    for (const u of allUsers) {
      try {
        const notif = await prisma.notification.create({
          data: {
            recipientId: u.id,
            senderId: activeUserId,
            type: "LINK_ISSUE",
            message: notifMessage,
          },
        });
        await sendRealtimeNotification(u.id, notif);
      } catch (e) {
        console.error("Failed to send notification for link issue to user", u.id, e);
      }
    }

    // Also broadcast live to all connected WebSocket clients
    await broadcastRealtimeNotification({
      senderId: activeUserId,
      message: notifMessage,
      type: "LINK_ISSUE",
      data: { productId: product.id },
    });

    return NextResponse.json({ success: true, message: "Link issue reported successfully" });
  } catch (err) {
    console.error("[POST /api/products/[id]/report-link-issue]", err);
    return NextResponse.json({ error: "Failed to report link issue" }, { status: 500 });
  }
}
