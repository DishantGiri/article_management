"use client";

import { useEffect, useState } from "react";
import { Download, FileText, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { ChartPieInteractive } from "@/components/ChartPieInteractive";
import { ChartLineLabelCustom } from "@/components/ChartLineLabelCustom";
import { toast } from "react-hot-toast";

interface ReportData {
  metrics: {
    totalArticles: number;
    completedArticles: number;
    avgWritingTime: number;
    completionRate: number;
  };
  monthlyTrend: any[];
  statusDistribution: any[];
  writerProductivity: any[];
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#f8fafc]">
        <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  const handleExportCSV = () => {
    if (!data) return;
    const headers = ["Writer", "Email", "Articles Completed", "Avg Writing Time (Hours)", "Status", "Performance Score"];
    const rows = data.writerProductivity.map((w: any) => [
      w.writer,
      w.email,
      w.articles.toString(),
      w.avgTime.toString(),
      w.status,
      `${w.performance}%`
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${(val || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `writer_productivity_report_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exported successfully!");
  };

  const COLORS = data.statusDistribution.map((s: any) => s.color);

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reports & Analytics</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">Comprehensive performance reports</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 shadow-sm transition flex items-center gap-2 cursor-pointer">
            <Download className="w-4 h-4 text-slate-500" />
            Export CSV
          </button>
          <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 shadow-sm transition flex items-center gap-2">
            <Download className="w-4 h-4 text-slate-500" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center mb-3">
            <FileText className="w-4 h-4 text-indigo-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800">{data.metrics.totalArticles}</h3>
          <p className="text-xs font-semibold text-slate-400 mt-1">Total Articles</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="w-8 h-8 rounded bg-emerald-50 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800">{data.metrics.completedArticles}</h3>
          <p className="text-xs font-semibold text-slate-400 mt-1">Completed</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="w-8 h-8 rounded bg-sky-50 flex items-center justify-center mb-3">
            <Clock className="w-4 h-4 text-sky-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800">{data.metrics.avgWritingTime}h</h3>
          <p className="text-xs font-semibold text-slate-400 mt-1">Avg Writing Time</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="w-8 h-8 rounded bg-emerald-50 flex items-center justify-center mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800">{data.metrics.completionRate}%</h3>
          <p className="text-xs font-semibold text-slate-400 mt-1">Completion Rate</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly Articles Trend */}
        <div className="w-full">
          <ChartLineLabelCustom data={data.monthlyTrend} title="Monthly Articles Trend" description="Articles added over the last 6 months" />
        </div>

        {/* Status Distribution */}
        <div className="w-full">
          <ChartPieInteractive data={data.statusDistribution} title="Status Distribution" description="Current distribution of article statuses" />
        </div>
      </div>

      {/* Writer Productivity Report Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Writer Productivity Report</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Writer</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Articles</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Time</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.writerProductivity.map((writer: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-[13px] font-bold text-slate-700">{writer.writer}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[13px] font-medium text-slate-500">{writer.email}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[13px] font-semibold text-slate-700">{writer.articles}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[13px] font-semibold text-slate-700">{writer.avgTime}h</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${writer.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      {writer.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full" 
                        style={{ width: `${writer.performance}%` }}
                      ></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
