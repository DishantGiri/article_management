import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(session.user.id) },
      select: { role: true },
    });

    if (
      user?.role !== "SUPER_ADMIN" &&
      user?.role !== "ADMIN" &&
      user?.role !== "LINKER" &&
      user?.role !== "TEAM_LEAD"
    ) {
      return NextResponse.json({ error: "Forbidden: Access denied" }, { status: 403 });
    }

    const [articleHistories, linkHistories] = await Promise.all([
      prisma.articleHistory.findMany({
        include: {
          updatedBy: { select: { id: true, name: true, role: true, email: true } },
          article: {
            include: {
              product: {
                select: { id: true, name: true, site: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.linkHistory.findMany({
        include: {
          updatedBy: { select: { id: true, name: true, role: true, email: true } },
          linkLog: {
            include: {
              product: {
                select: { id: true, name: true, site: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const formattedArticles = articleHistories.map((h) => ({
      id: `art-${h.id}`,
      type: "ARTICLE",
      updatedById: h.updatedById,
      updatedBy: h.updatedBy,
      productName: h.article?.product?.name || "Unknown Product",
      siteName: h.article?.product?.site?.name || "Unknown Site",
      oldStatus: h.oldStatus,
      newStatus: h.newStatus,
      oldLink: h.oldLink,
      newLink: h.newLink,
      notes: h.notes,
      updatedAt: h.updatedAt.toISOString(),
    }));

    const formattedLinks = linkHistories.map((h) => {
      const oldL = h.oldBridgeLink || h.oldBuyLink || h.oldAffiliateLink;
      const newL = h.newBridgeLink || h.newBuyLink || h.newAffiliateLink;
      const noteDetails =
        h.newRemarks ||
        (h.oldStatus && h.newStatus
          ? `Status changed from ${h.oldStatus} to ${h.newStatus}`
          : "Link log updated");

      return {
        id: `link-${h.id}`,
        type: "LINK",
        updatedById: h.updatedById,
        updatedBy: h.updatedBy,
        productName: h.linkLog?.product?.name || "Unknown Product",
        siteName: h.linkLog?.product?.site?.name || "Unknown Site",
        oldStatus: h.oldStatus,
        newStatus: h.newStatus,
        oldLink: oldL,
        newLink: newL,
        notes: noteDetails,
        updatedAt: h.updatedAt.toISOString(),
      };
    });

    const combined = [...formattedArticles, ...formattedLinks].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return NextResponse.json(combined);
  } catch (err: any) {
    console.error("[GET /api/history]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
