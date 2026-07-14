import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/articles — list articles
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const writerId = searchParams.get("writerId");
  const status = searchParams.get("status");
  const productId = searchParams.get("productId");
  const userIdStr = searchParams.get("userId");

  let allowedFilter: any = {};

  if (userIdStr) {
    const userId = parseInt(userIdStr);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role === "TEAM_LEAD") {
      allowedFilter = {
        OR: [
          { writerId: userId },
          { writer: { teamLeadId: userId } },
          { status: "PENDING" }
        ]
      };
    } else if (user?.role === "WRITER") {
      const accesses = await prisma.siteAccess.findMany({
        where: { userId },
        select: { siteId: true },
      });
      const siteIds = accesses.map((a) => a.siteId);
      allowedFilter = {
        product: { siteId: { in: siteIds } }
      };
    }
  }

  const articles = await prisma.article.findMany({
    where: {
      ...(writerId ? { writerId: parseInt(writerId) } : {}),
      ...(status ? { status: status as "PENDING" | "IN_PROGRESS" | "COMPLETED" | "APPROVED" | "REDO" } : {}),
      ...(productId ? { productId: parseInt(productId) } : {}),
      ...allowedFilter,
    },
    include: {
      product: {
        include: {
          site: { select: { id: true, name: true } },
          category: { select: { name: true } },
          linkLogs: {
            select: { linkerRemarks: true, addedAt: true },
            orderBy: { addedAt: "desc" }
          }
        },
      },
      writer: { select: { id: true, name: true } },
      reviews: {
        include: { reviewedBy: { select: { name: true } } },
        orderBy: { reviewedAt: "desc" },
        take: 1,
      },
      history: {
        select: { notes: true, updatedAt: true },
        orderBy: { updatedAt: "desc" }
      }
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(articles);
}
