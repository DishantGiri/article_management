import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userIdStr = searchParams.get("userId");

    if (!userIdStr) {
      return NextResponse.json({ error: "userId parameter is required" }, { status: 400 });
    }

    const teamLeadId = parseInt(userIdStr);

    // Validate that the requestor is a Team Lead or Admin
    const requestor = await prisma.user.findUnique({
      where: { id: teamLeadId },
      select: { role: true },
    });

    if (!requestor || (requestor.role !== "TEAM_LEAD" && requestor.role !== "ADMIN" && requestor.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch team members (writers) and their completed/approved articles
    const teamMembers = await prisma.user.findMany({
      where: { teamLeadId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        articles: {
          where: { status: { in: ["COMPLETED", "APPROVED"] } },
          select: {
            id: true,
            writingTimeMin: true,
            completedAt: true,
            product: { select: { name: true } }
          },
          orderBy: { completedAt: "desc" }
        }
      }
    });

    // Process stats for each team member
    const processedMembers = teamMembers.map((member) => {
      const completedArticles = member.articles;
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
        stats: {
          totalArticles,
          avgWritingTimeMin,
          avgArticlesPerDay,
          avgArticlesPerWeek,
        },
        recentArticles: completedArticles.slice(0, 5).map(a => ({
          id: a.id,
          productName: a.product.name,
          completedAt: a.completedAt,
          writingTimeMin: a.writingTimeMin
        }))
      };
    });

    return NextResponse.json(processedMembers);
  } catch (error) {
    console.error("[GET /api/team-members]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
