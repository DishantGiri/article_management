import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/articles/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const article = await prisma.article.findUnique({
    where: { id: parseInt(id) },
    include: {
      product: {
        include: {
          site: true,
          category: true,
          addedBy: { select: { name: true } },
          linkLogs: {
            include: { geos: true, addedBy: { select: { name: true } } },
            orderBy: { addedAt: "desc" },
          },
        },
      },
      writer: { select: { id: true, name: true } },
      reviews: {
        include: { reviewedBy: { select: { id: true, name: true } } },
        orderBy: { reviewedAt: "desc" },
      },
      specialApproval: {
        include: { approvedBy: { select: { name: true } } },
      },
    },
  });

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }
  return NextResponse.json(article);
}

// PATCH /api/articles/[id] — update status, writer, article link
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, articleLink, writerId } = body;

    const existing = await prisma.article.findUnique({ where: { id: parseInt(id) } });
    if (!existing) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Business rules
    if (status === "IN_PROGRESS" && writerId) {
      // Check writer doesn't already have an in-progress article
      const inProgress = await prisma.article.findFirst({
        where: { writerId: parseInt(writerId), status: "IN_PROGRESS", id: { not: parseInt(id) } },
      });
      if (inProgress) {
        return NextResponse.json(
          { error: "You already have an article In Progress. Complete it before starting another." },
          { status: 400 }
        );
      }
    }

    if (status === "COMPLETED" && !articleLink && !existing.articleLink) {
      // Check if special approval exists
      const approval = await prisma.specialApproval.findUnique({ where: { articleId: parseInt(id) } });
      if (!approval) {
        return NextResponse.json(
          { error: "Article Link is required to mark as Completed, or request Team Lead approval." },
          { status: 400 }
        );
      }
    }

    // Calculate writing time if completing
    let writingTimeMin: number | undefined;
    let completedAt: Date | undefined;
    let productCreatedAt: Date | undefined;

    if (status === "COMPLETED" && existing.startedAt) {
      completedAt = new Date();
      writingTimeMin = Math.round((completedAt.getTime() - existing.startedAt.getTime()) / 60000);
      productCreatedAt = completedAt;
    }

    const updated = await prisma.article.update({
      where: { id: parseInt(id) },
      data: {
        ...(status ? { status } : {}),
        ...(writerId ? { writerId: parseInt(writerId) } : {}),
        ...(articleLink !== undefined ? { articleLink } : {}),
        ...(status === "IN_PROGRESS" && !existing.startedAt ? { startedAt: new Date() } : {}),
        ...(completedAt ? { completedAt } : {}),
        ...(writingTimeMin !== undefined ? { writingTimeMin } : {}),
        ...(productCreatedAt ? { productCreatedAt } : {}),
      },
      include: {
        product: { select: { name: true } },
        writer: { select: { name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/articles/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
