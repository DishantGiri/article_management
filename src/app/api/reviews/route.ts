import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/reviews — team lead submits review/suggestion
export async function POST(req: NextRequest) {
  try {
    const { articleId, reviewedById, suggestion, approved } = await req.json();
    if (!articleId || !reviewedById) {
      return NextResponse.json({ error: "articleId and reviewedById are required" }, { status: 400 });
    }

    const review = await prisma.articleReview.create({
      data: {
        articleId: parseInt(articleId),
        reviewedById: parseInt(reviewedById),
        suggestion: suggestion || null,
        approved: approved ?? false,
      },
      include: { reviewedBy: { select: { name: true } } },
    });

    // If there's a suggestion, notify the writer
    if (suggestion) {
      const article = await prisma.article.findUnique({
        where: { id: parseInt(articleId) },
        select: { writerId: true },
      });
      if (article?.writerId) {
        await prisma.notification.create({
          data: {
            recipientId: article.writerId,
            senderId: parseInt(reviewedById),
            type: "ARTICLE_SUGGESTION",
            message: `Team Lead left feedback on your article: "${suggestion}"`,
          },
        });
      }
    }

    return NextResponse.json(review, { status: 201 });
  } catch (err) {
    console.error("[POST /api/reviews]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/reviews
export async function GET() {
  const reviews = await prisma.articleReview.findMany({
    include: {
      article: { include: { product: { select: { name: true } }, writer: { select: { name: true } } } },
      reviewedBy: { select: { name: true } },
    },
    orderBy: { reviewedAt: "desc" },
  });
  return NextResponse.json(reviews);
}
