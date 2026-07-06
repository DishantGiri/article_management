import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/dashboard — aggregate stats
export async function GET() {
  const [
    totalProducts,
    pendingArticles,
    inProgressArticles,
    completedArticles,
    totalLinks,
    requestedLinks,
    acceptedLinks,
    issueLinks,
    recentProducts,
    recentArticles,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.article.count({ where: { status: "PENDING" } }),
    prisma.article.count({ where: { status: "IN_PROGRESS" } }),
    prisma.article.count({ where: { status: "COMPLETED" } }),
    prisma.linkLog.count(),
    prisma.linkLog.count({ where: { status: "REQUESTED" } }),
    prisma.linkLog.count({ where: { status: "ACCEPTED" } }),
    prisma.linkLog.count({ where: { status: "ISSUE" } }),
    prisma.product.findMany({
      take: 5,
      orderBy: { addedAt: "desc" },
      include: {
        site: { select: { name: true } },
        category: { select: { name: true } },
        addedBy: { select: { name: true } },
        article: { select: { status: true } },
      },
    }),
    prisma.article.findMany({
      take: 5,
      orderBy: { updatedAt: "desc" },
      where: { status: { in: ["IN_PROGRESS", "COMPLETED"] } },
      include: {
        product: { select: { name: true } },
        writer: { select: { name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    products: { total: totalProducts },
    articles: {
      pending: pendingArticles,
      inProgress: inProgressArticles,
      completed: completedArticles,
      total: pendingArticles + inProgressArticles + completedArticles,
    },
    links: {
      total: totalLinks,
      requested: requestedLinks,
      accepted: acceptedLinks,
      issue: issueLinks,
    },
    recentProducts,
    recentArticles,
  });
}
