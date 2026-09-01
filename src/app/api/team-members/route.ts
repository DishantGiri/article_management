import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const callerId = Number(session.user.id);
    const callerRole = session.user.role;

    if (callerRole !== "TEAM_LEAD" && callerRole !== "ADMIN" && callerRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    let teamLeadId = callerId;
    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get("userId");

    // Only Admin or Super Admin can inspect another team lead's members
    if ((callerRole === "ADMIN" || callerRole === "SUPER_ADMIN") && requestedUserId) {
      teamLeadId = parseInt(requestedUserId);
    }

    // Fetch team members (writers) and their articles
    const teamMembers = await prisma.user.findMany({
      where: { teamLeadId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        articles: {
          select: {
            id: true,
            status: true,
            writingTimeMin: true,
            startedAt: true,
            completedAt: true,
            product: { select: { name: true } },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    // Process stats for each team member
    const processedMembers = teamMembers.map((member) => {
      const completedArticles = member.articles.filter(
        (a) => a.status === "COMPLETED" || a.status === "APPROVED"
      );
      const activeArticle = member.articles.find(
        (a) => a.status === "IN_PROGRESS" || a.status === "REDO"
      );
      const totalArticles = completedArticles.length;

      // Calculate average writing time
      const articlesWithTime = completedArticles.filter(
        (a) => a.writingTimeMin !== null && a.writingTimeMin !== undefined
      );
      const totalWritingTime = articlesWithTime.reduce((sum, a) => sum + (a.writingTimeMin || 0), 0);
      const avgWritingTimeMin = articlesWithTime.length > 0 ? Math.round(totalWritingTime / articlesWithTime.length) : 0;

      // Calculate time spans since account creation
      const daysSinceCreated = Math.max(
        1,
        Math.ceil((Date.now() - new Date(member.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      );
      const weeksSinceCreated = Math.max(1, daysSinceCreated / 7);

      const avgArticlesPerDay = Number((totalArticles / daysSinceCreated).toFixed(2));
      const avgArticlesPerWeek = Number((totalArticles / weeksSinceCreated).toFixed(2));

      return {
        id: member.id,
        name: member.name,
        email: member.email,
        createdAt: member.createdAt,
        activeArticle: activeArticle
          ? {
              id: activeArticle.id,
              productName: activeArticle.product.name,
              status: activeArticle.status,
              startedAt: activeArticle.startedAt,
            }
          : null,
        stats: {
          totalArticles,
          avgWritingTimeMin,
          avgArticlesPerDay,
          avgArticlesPerWeek,
        },
        recentArticles: completedArticles.slice(0, 5).map((a) => ({
          id: a.id,
          productName: a.product.name,
          completedAt: a.completedAt,
          writingTimeMin: a.writingTimeMin,
        })),
      };
    });

    return NextResponse.json(processedMembers);
  } catch (error) {
    console.error("[GET /api/team-members]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
