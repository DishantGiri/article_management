import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/articles — list articles
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const writerId = searchParams.get("writerId");
  const status = searchParams.get("status");
  const productId = searchParams.get("productId");

  const articles = await prisma.article.findMany({
    where: {
      ...(writerId ? { writerId: parseInt(writerId) } : {}),
      ...(status ? { status: status as "PENDING" | "IN_PROGRESS" | "COMPLETED" } : {}),
      ...(productId ? { productId: parseInt(productId) } : {}),
    },
    include: {
      product: {
        include: {
          site: { select: { name: true } },
          category: { select: { name: true } },
        },
      },
      writer: { select: { id: true, name: true } },
      reviews: {
        include: { reviewedBy: { select: { name: true } } },
        orderBy: { reviewedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(articles);
}
