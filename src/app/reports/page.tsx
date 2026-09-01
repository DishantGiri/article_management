/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import {
  Download,
  FileText,
  CheckCircle2,
  Clock,
  TrendingUp,
  Link2,
  Users,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { ChartPieInteractive } from "@/components/ChartPieInteractive";
import { ChartLineLabelCustom } from "@/components/ChartLineLabelCustom";
import { toast } from "react-hot-toast";
import LoadingScreen from "@/components/LoadingScreen";

export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"writer" | "linker" | "team">("writer");

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        if (d?.user?.role === "LINKER") {
          setActiveTab("linker");
        } else if (d?.user?.role === "TEAM_LEAD") {
          setActiveTab("team");
        } else {
          setActiveTab("writer");
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load work report data");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="flex justify-center items-center min-h-[75vh]">
        <LoadingScreen
          message="Loading work reports..."
          subtext="Aggregating productivity and operational work statistics"
          size="lg"
        />
      </div>
    );
  }

  const role = data.user?.role || "WRITER";
  const writerReport = data.writerReport;
  const linkerReport = data.linkerReport;
  const teamLeadReport = data.teamLeadReport;

  // ─────────────────────────────────────────────
  // CSV EXPORT LOGIC
  // ─────────────────────────────────────────────
  const handleExportCSV = () => {
    if (activeTab === "writer" && writerReport) {
      const headers = ["Article / Product", "Site", "Writer", "Status", "Writing Time (Min)", "Completed At"];
      const rows = (writerReport.recentArticles || []).map((a: any) => [
        a.productName,
        a.siteName,
        a.writerName || data.user?.name || "N/A",
        a.status,
        a.writingTimeMin ? a.writingTimeMin.toString() : "0",
        a.completedAt ? new Date(a.completedAt).toLocaleDateString() : "Pending",
      ]);
      downloadCSV(`writer_work_report_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    } else if (activeTab === "linker" && linkerReport) {
      const headers = ["Product", "Site", "Affiliate Network", "Status", "Configured By", "Date Added"];
      const rows = (linkerReport.recentLinks || []).map((l: any) => [
        l.productName,
        l.siteName,
        l.affiliateName || "—",
        l.status,
        l.addedByName || data.user?.name || "N/A",
        new Date(l.addedAt).toLocaleDateString(),
      ]);
      downloadCSV(`linker_work_report_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    } else if (activeTab === "team" && teamLeadReport) {
      const headers = ["Team Writer", "Email", "Total Articles", "Completed Articles", "Avg Time (Hours)", "Completion Rate (%)"];
      const rows = (teamLeadReport.writerComparison || []).map((w: any) => [
        w.name,
        w.email,
        w.totalArticles.toString(),
        w.completed.toString(),
        w.avgTimeHours,
        w.completionRate.toString(),
      ]);
      downloadCSV(`team_lead_work_report_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    }
  };

  const downloadCSV = (filename: string, headers: string[], rows: string[][]) => {
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((val) => `"${(val || "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Work report CSV exported successfully!");
  };

  // Determine available tabs based on user role
  const availableTabs: Array<{ id: "writer" | "linker" | "team"; label: string; icon: any }> = [];

  if (role === "SUPER_ADMIN" || role === "ADMIN") {
    availableTabs.push(
      { id: "writer", label: "Writing Work Reports", icon: FileText },
      { id: "linker", label: "Link Operations Reports", icon: Link2 },
      { id: "team", label: "Team Performance Reports", icon: Users }
    );
  } else if (role === "TEAM_LEAD") {
    availableTabs.push(
      { id: "team", label: "Team Performance Report", icon: Users },
      { id: "writer", label: "Writing Work Report", icon: FileText }
    );
  } else if (role === "LINKER") {
    availableTabs.push({ id: "linker", label: "Link Work Report", icon: Link2 });
  } else if (role === "WRITER") {
    availableTabs.push({ id: "writer", label: "Writing Work Report", icon: FileText });
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] text-[#4A4A4A]" suppressHydrationWarning>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-2xl font-bold text-[#4A4A4A] tracking-tight">Work Reports</h1>
            <span className="px-2.5 py-0.5 text-xs font-extrabold bg-[#6D8196]/10 text-[#3D4F61] border border-[#6D8196]/20 rounded-full uppercase">
              {role.replace("_", " ")}
            </span>
          </div>
          <p className="text-[#737373] text-sm font-medium">
            Detailed operational metrics, velocity tracking, and completed work analytics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-white border border-[#CBCBCB] text-[#4A4A4A] rounded-xl text-sm font-semibold hover:bg-slate-50 shadow-2xs transition flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#6D8196]" />
            Export Work Report
          </button>
        </div>
      </div>

      {/* Tabs Row (Only shown if user has multiple accessible sections) */}
      {availableTabs.length > 1 ? (
        <div className="flex items-center gap-2 border-b border-[#CBCBCB]/60 pb-3 mb-6 overflow-x-auto">
          {availableTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-[#6D8196] text-white shadow-xs"
                    : "bg-white border border-[#CBCBCB] text-[#737373] hover:text-[#4A4A4A] hover:bg-slate-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-6">
          <div className="px-3.5 py-1.5 rounded-lg bg-white border border-[#CBCBCB] text-xs font-bold text-[#4A4A4A] flex items-center gap-2 shadow-2xs">
            {activeTab === "writer" && <FileText className="w-3.5 h-3.5 text-[#6D8196]" />}
            {activeTab === "linker" && <Link2 className="w-3.5 h-3.5 text-[#6D8196]" />}
            {activeTab === "team" && <Users className="w-3.5 h-3.5 text-[#6D8196]" />}
            <span>Work Report Section</span>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 1. WRITING WORK REPORT SECTION */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === "writer" && writerReport && (
        <div className="space-y-6 animate-fadeIn">
          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center mb-3">
                <FileText className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-3xl font-extrabold text-[#4A4A4A]">{writerReport.metrics.totalArticles}</h3>
                <p className="text-xs font-bold text-[#737373] uppercase tracking-wider mt-1">Total Pipeline</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-3xl font-extrabold text-[#4A4A4A]">{writerReport.metrics.completedArticles}</h3>
                <p className="text-xs font-bold text-[#737373] uppercase tracking-wider mt-1">Articles Completed</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center mb-3">
                <Clock className="w-4 h-4 text-sky-600" />
              </div>
              <div>
                <h3 className="text-3xl font-extrabold text-[#4A4A4A]">{writerReport.metrics.avgWritingTime}h</h3>
                <p className="text-xs font-bold text-[#737373] uppercase tracking-wider mt-1">Avg Writing Time</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-3xl font-extrabold text-[#4A4A4A]">{writerReport.metrics.completionRate}%</h3>
                <p className="text-xs font-bold text-[#737373] uppercase tracking-wider mt-1">Completion Rate</p>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="w-full">
              <ChartLineLabelCustom
                data={writerReport.monthlyTrend}
                title="Monthly Articles Velocity"
                description="Articles produced over the last 6 months"
              />
            </div>
            <div className="w-full">
              <ChartPieInteractive
                data={writerReport.statusDistribution}
                title="Article Status Distribution"
                description="Breakdown of articles by current workflow state"
              />
            </div>
          </div>

          {/* Writer Productivity Table (for TL / Admin) */}
          {(role === "SUPER_ADMIN" || role === "ADMIN" || role === "TEAM_LEAD") &&
            writerReport.writerProductivity?.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-2xs overflow-hidden">
                <div className="p-5 px-6 border-b border-[#CBCBCB]/40 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#4A4A4A]">Writer Productivity Breakdown</h3>
                  <span className="text-xs font-semibold text-[#737373]">
                    {writerReport.writerProductivity.length} Writer(s)
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-[#FAF9F5] border-b border-[#CBCBCB]/30">
                        <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Writer</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Articles</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Avg Time</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Performance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {writerReport.writerProductivity.map((writer: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[#FAF9F5] transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-[13px] font-bold text-[#4A4A4A]">{writer.writer}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[13px] font-medium text-[#737373]">{writer.email}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[13px] font-semibold text-[#4A4A4A]">
                              {writer.completed} / {writer.articles}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[13px] font-semibold text-[#4A4A4A]">{writer.avgTime}h</span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                writer.status === "Active"
                                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200/60"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {writer.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#6D8196] rounded-full"
                                  style={{ width: `${writer.performance}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-bold text-[#4A4A4A]">{writer.performance}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          {/* Recent Articles Log Table */}
          <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-2xs overflow-hidden">
            <div className="p-5 px-6 border-b border-[#CBCBCB]/40 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#4A4A4A]">Completed & Active Articles Work History</h3>
              <span className="text-xs font-semibold text-[#737373]">
                {writerReport.recentArticles?.length || 0} Recent Entries
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#FAF9F5] border-b border-[#CBCBCB]/30">
                    <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Site</th>
                    {role !== "WRITER" && (
                      <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Writer</th>
                    )}
                    <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Writing Time</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Completed Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {writerReport.recentArticles?.map((art: any) => (
                    <tr key={art.id} className="hover:bg-[#FAF9F5] transition-colors">
                      <td className="px-6 py-3.5 font-bold text-[13px] text-[#4A4A4A]">
                        {art.productName}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#6D8196]/10 text-[#3D4F61] border border-[#6D8196]/20">
                          {art.siteName}
                        </span>
                      </td>
                      {role !== "WRITER" && (
                        <td className="px-6 py-3.5 text-[13px] font-medium text-slate-700">
                          {art.writerName || "—"}
                        </td>
                      )}
                      <td className="px-6 py-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            art.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : art.status === "IN_PROGRESS"
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              : art.status === "REDO"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {art.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-[13px] font-medium text-[#737373]">
                        {art.writingTimeMin ? `${Math.round(art.writingTimeMin / 60)}h ${art.writingTimeMin % 60}m` : "—"}
                      </td>
                      <td className="px-6 py-3.5 text-[12px] text-[#737373]">
                        {art.completedAt ? new Date(art.completedAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 2. LINK OPERATIONS REPORT SECTION */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === "linker" && linkerReport && (
        <div className="space-y-6 animate-fadeIn">
          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center mb-3">
                <Link2 className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h3 className="text-3xl font-extrabold text-[#4A4A4A]">{linkerReport.metrics.totalLinks}</h3>
                <p className="text-xs font-bold text-[#737373] uppercase tracking-wider mt-1">Configured Links</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-3xl font-extrabold text-[#4A4A4A]">{linkerReport.metrics.acceptedLinks}</h3>
                <p className="text-xs font-bold text-[#737373] uppercase tracking-wider mt-1">Accepted & Verified</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center mb-3">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div>
                <h3 className="text-3xl font-extrabold text-[#4A4A4A]">{linkerReport.metrics.issueLinks}</h3>
                <p className="text-xs font-bold text-[#737373] uppercase tracking-wider mt-1">Flagged Issues</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center mb-3">
                <Layers className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-3xl font-extrabold text-[#4A4A4A]">{linkerReport.metrics.productsAdded}</h3>
                <p className="text-xs font-bold text-[#737373] uppercase tracking-wider mt-1">Products Created</p>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="w-full">
              <ChartLineLabelCustom
                data={linkerReport.monthlyTrend.map((m: any) => ({ month: m.month, articles: m.links }))}
                title="Monthly Link Configuration Velocity"
                description="Link log additions over the last 6 months"
              />
            </div>
            <div className="w-full">
              <ChartPieInteractive
                data={linkerReport.statusDistribution}
                title="Link Status Breakdown"
                description="Distribution of link logs by verification status"
              />
            </div>
          </div>

          {/* Linker Output Breakdown (for Admin/Super Admin) */}
          {(role === "SUPER_ADMIN" || role === "ADMIN") && linkerReport.linkerProductivity?.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-2xs overflow-hidden">
              <div className="p-5 px-6 border-b border-[#CBCBCB]/40 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#4A4A4A]">Linker Operations Breakdown</h3>
                <span className="text-xs font-semibold text-[#737373]">
                  {linkerReport.linkerProductivity.length} Linker(s)
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#FAF9F5] border-b border-[#CBCBCB]/30">
                      <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Linker</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Total Links</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Accepted</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Issues</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Acceptance Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {linkerReport.linkerProductivity.map((lm: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#FAF9F5] transition-colors">
                        <td className="px-6 py-4 font-bold text-[13px] text-[#4A4A4A]">{lm.linker}</td>
                        <td className="px-6 py-4 text-[13px] text-[#737373]">{lm.email}</td>
                        <td className="px-6 py-4 font-semibold text-[13px] text-[#4A4A4A]">{lm.links}</td>
                        <td className="px-6 py-4 font-semibold text-[13px] text-emerald-600">{lm.accepted}</td>
                        <td className="px-6 py-4 font-semibold text-[13px] text-rose-600">{lm.issues}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {lm.rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Links History */}
          <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-2xs overflow-hidden">
            <div className="p-5 px-6 border-b border-[#CBCBCB]/40 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#4A4A4A]">Configured Link History Log</h3>
              <span className="text-xs font-semibold text-[#737373]">
                {linkerReport.recentLinks?.length || 0} Recent Entries
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#FAF9F5] border-b border-[#CBCBCB]/30">
                    <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Site</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Affiliate</th>
                    {role !== "LINKER" && (
                      <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Configured By</th>
                    )}
                    <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Date Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {linkerReport.recentLinks?.map((link: any) => (
                    <tr key={link.id} className="hover:bg-[#FAF9F5] transition-colors">
                      <td className="px-6 py-3.5 font-bold text-[13px] text-[#4A4A4A]">
                        {link.productName}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#6D8196]/10 text-[#3D4F61] border border-[#6D8196]/20">
                          {link.siteName}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-[13px] font-medium text-slate-700">
                        {link.affiliateName || "—"}
                      </td>
                      {role !== "LINKER" && (
                        <td className="px-6 py-3.5 text-[13px] font-medium text-slate-700">
                          {link.addedByName || "—"}
                        </td>
                      )}
                      <td className="px-6 py-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            link.status === "ACCEPTED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : link.status === "ISSUE"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {link.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-[12px] text-[#737373]">
                        {new Date(link.addedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 3. TEAM PERFORMANCE REPORT SECTION */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === "team" && teamLeadReport && (
        <div className="space-y-6 animate-fadeIn">
          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center mb-3">
                <Users className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-3xl font-extrabold text-[#4A4A4A]">{teamLeadReport.metrics.teamWritersCount}</h3>
                <p className="text-xs font-bold text-[#737373] uppercase tracking-wider mt-1">Assigned Team Writers</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-3xl font-extrabold text-[#4A4A4A]">{teamLeadReport.metrics.teamArticlesCompleted}</h3>
                <p className="text-xs font-bold text-[#737373] uppercase tracking-wider mt-1">Team Completed Articles</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center mb-3">
                <ShieldCheck className="w-4 h-4 text-sky-600" />
              </div>
              <div>
                <h3 className="text-3xl font-extrabold text-[#4A4A4A]">{teamLeadReport.metrics.reviewsConducted}</h3>
                <p className="text-xs font-bold text-[#737373] uppercase tracking-wider mt-1">Reviews Conducted</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-3xl font-extrabold text-[#4A4A4A]">{teamLeadReport.metrics.approvalRate}%</h3>
                <p className="text-xs font-bold text-[#737373] uppercase tracking-wider mt-1">Review Approval Rate</p>
              </div>
            </div>
          </div>

          {/* Team Member Comparison Table */}
          <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-2xs overflow-hidden">
            <div className="p-5 px-6 border-b border-[#CBCBCB]/40 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#4A4A4A]">Team Writers Performance Ranking</h3>
              <span className="text-xs font-semibold text-[#737373]">
                {teamLeadReport.writerComparison?.length || 0} Member(s)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#FAF9F5] border-b border-[#CBCBCB]/30">
                    <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Writer</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Articles</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Avg Time</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Completion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teamLeadReport.writerComparison?.map((w: any) => (
                    <tr key={w.id} className="hover:bg-[#FAF9F5] transition-colors">
                      <td className="px-6 py-4 font-bold text-[13px] text-[#4A4A4A]">{w.name}</td>
                      <td className="px-6 py-4 text-[13px] text-[#737373]">{w.email}</td>
                      <td className="px-6 py-4 font-semibold text-[13px] text-[#4A4A4A]">
                        {w.completed} / {w.totalArticles}
                      </td>
                      <td className="px-6 py-4 font-semibold text-[13px] text-[#4A4A4A]">{w.avgTimeHours}h</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#6D8196] rounded-full"
                              style={{ width: `${w.completionRate}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-[#4A4A4A]">{w.completionRate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Reviews Conducted Log */}
          <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-2xs overflow-hidden">
            <div className="p-5 px-6 border-b border-[#CBCBCB]/40 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#4A4A4A]">Recent Reviews Conducted</h3>
              <span className="text-xs font-semibold text-[#737373]">
                {teamLeadReport.recentReviews?.length || 0} Reviews
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#FAF9F5] border-b border-[#CBCBCB]/30">
                    <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Writer</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Verdict</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Feedback / Notes</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-[#737373] uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teamLeadReport.recentReviews?.map((r: any) => (
                    <tr key={r.id} className="hover:bg-[#FAF9F5] transition-colors">
                      <td className="px-6 py-3.5 font-bold text-[13px] text-[#4A4A4A]">{r.productName}</td>
                      <td className="px-6 py-3.5 text-[13px] font-medium text-slate-700">{r.writerName}</td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            r.approved
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {r.approved ? "Approved" : "Redo Requested"}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-[12px] text-[#737373] max-w-xs truncate" title={r.suggestion}>
                        {r.suggestion || "No remarks"}
                      </td>
                      <td className="px-6 py-3.5 text-[12px] text-[#737373]">
                        {new Date(r.reviewedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
