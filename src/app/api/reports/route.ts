import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const articles = await prisma.article.findMany({
      include: { writer: true },
    });

    const totalArticles = articles.length;
    const completedArticles = articles.filter(a => a.status === "COMPLETED").length;
    const completionRate = totalArticles === 0 ? 0 : Math.round((completedArticles / totalArticles) * 100);



    // Real Monthly Trend Logic
    const monthlyTrendMap = new Map<string, number>();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Initialize last 6 months
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const past = new Date(d.getFullYear(), d.getMonth() - i, 1);
      monthlyTrendMap.set(`${monthNames[past.getMonth()]}`, 0);
    }
    
    articles.forEach(a => {
      const monthStr = monthNames[a.updatedAt.getMonth()];
      if (monthlyTrendMap.has(monthStr)) {
        monthlyTrendMap.set(monthStr, monthlyTrendMap.get(monthStr)! + 1);
      }
    });

    const monthlyTrend = Array.from(monthlyTrendMap.entries()).map(([month, articles]) => ({ month, articles }));

    // Real Status Distribution
    let inProgress = 0, pending = 0;
    articles.forEach(a => {
      if (a.status === "IN_PROGRESS") inProgress++;
      else if (a.status === "PENDING") pending++;
    });
    
    const statusDistribution = [
      { name: "Completed", value: completedArticles, color: "#10b981" },
      { name: "Pending", value: pending, color: "#f59e0b" },
      { name: "In Progress", value: inProgress, color: "#6366f1" },
    ].filter(s => s.value > 0);

    if (statusDistribution.length === 0) {
      statusDistribution.push({ name: "No Data", value: 1, color: "#e2e8f0" });
    }

    // Real Writer Productivity
    const writerMap = new Map();
    articles.forEach(a => {
      if (a.writer) {
        if (!writerMap.has(a.writer.id)) {
          writerMap.set(a.writer.id, {
            writer: a.writer.name,
            email: a.writer.email,
            articles: 0,
            completed: 0,
            totalTimeMin: 0,
            status: "Active",
            performance: 0,
            avgTime: "0.0"
          });
        }
        const w = writerMap.get(a.writer.id);
        w.articles += 1;
        if (a.status === "COMPLETED") {
          w.completed += 1;
        }
        if (a.writingTimeMin) {
          w.totalTimeMin += a.writingTimeMin;
        }
      }
    });

    let writerProductivity = Array.from(writerMap.values()).map(w => {
      w.performance = w.articles > 0 ? Math.round((w.completed / w.articles) * 100) : 0;
      w.avgTime = w.completed > 0 ? (w.totalTimeMin / w.completed / 60).toFixed(1) : "0.0";
      return w;
    });
    
    // Sort by performance desc
    writerProductivity.sort((a, b) => b.performance - a.performance);

    // Calc global avg time
    let totalMins = 0;
    let totalCompleted = 0;
    articles.forEach(a => {
      if (a.status === "COMPLETED" && a.writingTimeMin) {
        totalMins += a.writingTimeMin;
        totalCompleted++;
      }
    });
    const avgWritingTime = totalCompleted > 0 ? (totalMins / totalCompleted / 60).toFixed(1) : "0.0";

    return NextResponse.json({
      metrics: {
        totalArticles,
        completedArticles,
        avgWritingTime,
        completionRate,
      },
      monthlyTrend,
      statusDistribution,
      writerProductivity
    });
  } catch (err) {
    console.error("[GET /api/reports]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
