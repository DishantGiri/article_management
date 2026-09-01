/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Download,
  Copy,
  Calendar as CalendarIcon,
  FileText,
  CheckCircle2,
  Clock,
  TrendingUp,
  Link2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  Wrench,
  Package,
  Layers,
  Check,
  ChevronRight,
  Filter,
} from "lucide-react";
import { toast } from "react-hot-toast";
import LoadingScreen from "@/components/LoadingScreen";
import { ChartPieInteractive } from "@/components/ChartPieInteractive";
import { ChartLineLabelCustom } from "@/components/ChartLineLabelCustom";

export default function ReportsPage() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Date range filters
  const [preset, setPreset] = useState<"today" | "yesterday" | "this_week" | "this_month" | "all">("this_month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // For Admin / Super Admin to view other users (TL/Writer/Linker cannot change target user)
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Helper to format date YYYY-MM-DD in local time
  const formatYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Initialize date range based on preset
  const applyPreset = useCallback((p: "today" | "yesterday" | "this_week" | "this_month" | "all") => {
    setPreset(p);
    const now = new Date();
    if (p === "today") {
      const todayStr = formatYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (p === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = formatYMD(yesterday);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (p === "this_week") {
      const day = now.getDay();
      const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diffToMonday));
      setStartDate(formatYMD(monday));
      setEndDate(formatYMD(new Date()));
    } else if (p === "this_month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(now));
    } else if (p === "all") {
      setStartDate("");
      setEndDate("");
    }
  }, []);

  // Fetch report data
  const fetchReport = useCallback(
    async (start?: string, end?: string, uId?: string) => {
      setGenerating(true);
      try {
        const params = new URLSearchParams();
        if (start) params.set("startDate", start);
        if (end) params.set("endDate", end);
        if (uId) params.set("userId", uId);

        const res = await fetch(`/api/reports?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to load report");
        }
        const data = await res.json();
        setReportData(data);
        if (!selectedUserId && data.targetUser?.id) {
          setSelectedUserId(String(data.targetUser.id));
        }
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || "Failed to generate report");
      } finally {
        setLoading(false);
        setGenerating(false);
      }
    },
    [selectedUserId]
  );

  // Initial load: this month
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const startStr = formatYMD(firstDay);
    const endStr = formatYMD(now);
    setStartDate(startStr);
    setEndDate(endStr);
    fetchReport(startStr, endStr);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = () => {
    fetchReport(startDate, endDate, selectedUserId);
  };

  if (loading || !reportData) {
    return (
      <div className="flex justify-center items-center min-h-[75vh]">
        <LoadingScreen
          message="Loading your work report..."
          subtext="Gathering verified articles, links, and operational logs"
          size="lg"
        />
      </div>
    );
  }

  const caller = reportData.caller;
  const targetUser = reportData.targetUser;
  const reports = reportData.reportData;
  const selectableUsers = reportData.selectableUsers || [];

  // Determine active view mode based on target user role
  const targetRole = targetUser?.role || "WRITER";
  const isWriter = targetRole === "WRITER";
  const isTeamLead = targetRole === "TEAM_LEAD";
  const isLinker = targetRole === "LINKER";
  const isAdminTarget = targetRole === "ADMIN" || targetRole === "SUPER_ADMIN";

  // ─────────────────────────────────────────────
  // COPY FORMATTED WORK REPORT TO CLIPBOARD
  // ─────────────────────────────────────────────
  const handleCopyReport = () => {
    const periodLabel =
      startDate && endDate
        ? `${startDate} to ${endDate}`
        : startDate
        ? `From ${startDate}`
        : endDate
        ? `Until ${endDate}`
        : "All Time";

    let text = `Work Report — ${targetUser?.name || "User"} (${(targetRole || "USER").replace("_", " ")})\nPeriod: ${periodLabel}\n\n`;

    if (isWriter || (isAdminTarget && reports.writer?.newArticles.length > 0)) {
      text += `📝 NEW ARTICLES (${reports.writer.newArticles.length}):\n`;
      if (reports.writer.newArticles.length === 0) {
        text += `  (No new articles)\n`;
      } else {
        reports.writer.newArticles.forEach((a: any) => {
          text += `  - ${a.productName} (${a.siteName}): ${a.articleLink || "No Link Yet"}${
            a.writingTimeMin ? ` [${a.writingTimeMin} mins]` : ""
          }\n`;
        });
      }

      text += `\n🔄 UPDATES (${reports.writer.updates.length}):\n`;
      if (reports.writer.updates.length === 0) {
        text += `  (No updates)\n`;
      } else {
        reports.writer.updates.forEach((u: any) => {
          text += `  - ${u.productName} (${u.siteName}): ${u.articleLink || "No Link"} — ${u.notes}\n`;
        });
      }

      text += `\n🛠️ FIXES (${reports.writer.fixes.length}):\n`;
      if (reports.writer.fixes.length === 0) {
        text += `  (No fixes)\n`;
      } else {
        reports.writer.fixes.forEach((f: any) => {
          text += `  - ${f.productName} (${f.siteName}): ${f.articleLink || "No Link"} — ${f.notes}\n`;
        });
      }
    }

    if (isTeamLead) {
      text += `📝 NEW ARTICLES (${reports.teamLead.newArticles.length}):\n`;
      if (reports.teamLead.newArticles.length === 0) {
        text += `  (No new articles written)\n`;
      } else {
        reports.teamLead.newArticles.forEach((a: any) => {
          text += `  - ${a.productName} (${a.siteName}): ${a.articleLink || "No Link"}\n`;
        });
      }

      text += `\n🔍 REVIEWS CONDUCTED (${reports.teamLead.reviews.length}):\n`;
      if (reports.teamLead.reviews.length === 0) {
        text += `  (No reviews conducted)\n`;
      } else {
        reports.teamLead.reviews.forEach((r: any) => {
          text += `  - [${r.verdict}] ${r.productName} (${r.writerName}): ${r.articleLink || "No Link"} — Remarks: ${r.suggestion}\n`;
        });
      }
    }

    if (isLinker) {
      text += `📦 PRODUCTS ADDED (${reports.linker.productsAdded.length}):\n`;
      if (reports.linker.productsAdded.length === 0) {
        text += `  (No products added)\n`;
      } else {
        reports.linker.productsAdded.forEach((p: any) => {
          text += `  - ${p.name} (${p.siteName} / ${p.categoryName})\n`;
        });
      }

      text += `\n🔗 ADDED LINKS ON PRODUCTS (${reports.linker.linksAdded.length}):\n`;
      if (reports.linker.linksAdded.length === 0) {
        text += `  (No links configured)\n`;
      } else {
        reports.linker.linksAdded.forEach((l: any) => {
          text += `  - ${l.productName} (${l.siteName}): Bridge: ${l.bridgePageLink || "—"} | Buy: ${l.buyLink || "—"} | Affiliate: ${l.affiliateName} [${l.status}]\n`;
        });
      }

      text += `\n⚙️ OTHER WORK & MODIFICATIONS (${reports.linker.otherWork.length}):\n`;
      if (reports.linker.otherWork.length === 0) {
        text += `  (No modifications)\n`;
      } else {
        reports.linker.otherWork.forEach((o: any) => {
          text += `  - ${o.productName} (${o.siteName}): ${o.notes}\n`;
        });
      }
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Work report copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  // ─────────────────────────────────────────────
  // EXPORT CSV
  // ─────────────────────────────────────────────
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];

    if (isWriter) {
      headers = ["Type", "Product", "Site", "Article Link", "Date", "Status / Notes", "Writing Time (Min)"];
      (reports.writer.newArticles || []).forEach((a: any) => {
        rows.push(["New Article", a.productName, a.siteName, a.articleLink || "", new Date(a.date).toLocaleDateString(), a.status, a.writingTimeMin ? String(a.writingTimeMin) : ""]);
      });
      (reports.writer.updates || []).forEach((u: any) => {
        rows.push(["Update", u.productName, u.siteName, u.articleLink || "", new Date(u.date).toLocaleDateString(), u.notes, ""]);
      });
      (reports.writer.fixes || []).forEach((f: any) => {
        rows.push(["Fix", f.productName, f.siteName, f.articleLink || "", new Date(f.date).toLocaleDateString(), f.notes, ""]);
      });
    } else if (isTeamLead) {
      headers = ["Type", "Product", "Site", "Writer", "Verdict", "Article Link", "Feedback", "Date"];
      (reports.teamLead.newArticles || []).forEach((a: any) => {
        rows.push(["New Article", a.productName, a.siteName, targetUser.name, a.status, a.articleLink || "", "", new Date(a.date).toLocaleDateString()]);
      });
      (reports.teamLead.reviews || []).forEach((r: any) => {
        rows.push(["Review", r.productName, r.siteName, r.writerName, r.verdict, r.articleLink || "", r.suggestion, new Date(r.reviewedAt).toLocaleDateString()]);
      });
    } else if (isLinker) {
      headers = ["Type", "Product / Name", "Site", "Affiliate / Category", "Bridge Page Link", "Buy Link", "Status / Notes", "Date"];
      (reports.linker.productsAdded || []).forEach((p: any) => {
        rows.push(["Product Added", p.name, p.siteName, p.categoryName, "", "", "Created", new Date(p.createdAt).toLocaleDateString()]);
      });
      (reports.linker.linksAdded || []).forEach((l: any) => {
        rows.push(["Add Link on Product", l.productName, l.siteName, l.affiliateName, l.bridgePageLink || "", l.buyLink || "", l.status, new Date(l.addedAt).toLocaleDateString()]);
      });
      (reports.linker.otherWork || []).forEach((o: any) => {
        rows.push(["Link Update", o.productName, o.siteName, "", o.newBridgeLink || "", "", o.notes, new Date(o.updatedAt).toLocaleDateString()]);
      });
    }

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((val) => `"${(val || "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `work_report_${(targetUser?.name || "user").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV file downloaded!");
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] text-[#4A4A4A]" suppressHydrationWarning>
      {/* ─── HEADER & ACTIONS ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-[#4A4A4A] tracking-tight">Work Report</h1>
            <span className="px-2.5 py-0.5 text-[11px] sm:text-xs font-extrabold bg-[#6D8196]/10 text-[#3D4F61] border border-[#6D8196]/20 rounded-full uppercase">
              {targetUser?.name || "User"} · {(targetRole || "USER").replace("_", " ")}
            </span>
          </div>
          <p className="text-[#737373] text-xs sm:text-sm font-medium">
            Generate and export your verified daily or periodic work summary with all article links and logs
          </p>
        </div>

        {/* Action Buttons: Copy & Export */}
        <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={handleCopyReport}
            className="w-full sm:w-auto justify-center px-3 sm:px-4 py-2 bg-white border border-[#CBCBCB] hover:border-[#6D8196] text-[#4A4A4A] rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-50 shadow-2xs transition flex items-center gap-2 cursor-pointer"
            title="Copy formatted work report to clipboard"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <Copy className="w-4 h-4 text-[#6D8196] shrink-0" />}
            <span className="truncate">{copied ? "Copied!" : "Copy Report"}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="w-full sm:w-auto justify-center px-3 sm:px-4 py-2 bg-white border border-[#CBCBCB] hover:border-[#6D8196] text-[#4A4A4A] rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-50 shadow-2xs transition flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#6D8196] shrink-0" />
            <span className="truncate">Export CSV</span>
          </button>
        </div>
      </div>

      {/* ─── REPORT GENERATOR TOOLBAR ─────────────────────────────────── */}
      <div className="bg-white border border-[#CBCBCB]/70 rounded-2xl p-3.5 sm:p-5 shadow-2xs mb-6 sm:mb-8 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-[11px] sm:text-xs font-bold text-[#737373] uppercase tracking-wider mr-1 flex items-center gap-1 w-full sm:w-auto mb-1 sm:mb-0">
              <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
              Period:
            </span>
            {[
              { id: "today", label: "Today" },
              { id: "yesterday", label: "Yesterday" },
              { id: "this_week", label: "This Week" },
              { id: "this_month", label: "This Month" },
              { id: "all", label: "All Time" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id as any)}
                className={`flex-1 sm:flex-initial text-center justify-center px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  preset === p.id
                    ? "bg-[#6D8196] text-white shadow-2xs"
                    : "bg-[#FAF9F5] text-[#737373] hover:text-[#4A4A4A] border border-[#CBCBCB]/60 hover:bg-slate-100"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* User selector for Admins only */}
          {(caller.role === "SUPER_ADMIN" || caller.role === "ADMIN") && selectableUsers.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full lg:w-auto">
              <span className="text-[11px] sm:text-xs font-bold text-[#737373] uppercase tracking-wider whitespace-nowrap">
                Inspect User:
              </span>
              <select
                value={selectedUserId}
                onChange={(e) => {
                  setSelectedUserId(e.target.value);
                  fetchReport(startDate, endDate, e.target.value);
                }}
                className="w-full sm:w-auto px-3 py-1.5 rounded-xl border border-[#CBCBCB] bg-white text-xs font-bold text-[#4A4A4A] focus:outline-none focus:ring-1 focus:ring-[#6D8196] shadow-2xs cursor-pointer"
              >
                {selectableUsers.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role ? u.role.replace("_", " ") : "NO ROLE"})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Date Inputs & Generate Button */}
        <div className="pt-3 border-t border-[#CBCBCB]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 w-full">
              <label className="text-xs font-bold text-[#737373] w-12 sm:w-auto shrink-0">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPreset("all");
                }}
                className="flex-1 w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#CBCBCB] bg-[#FAF9F5] text-[#4A4A4A] focus:outline-none focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 w-full">
              <label className="text-xs font-bold text-[#737373] w-12 sm:w-auto shrink-0">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPreset("all");
                }}
                className="flex-1 w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#CBCBCB] bg-[#FAF9F5] text-[#4A4A4A] focus:outline-none focus:bg-white"
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full sm:w-auto justify-center px-4 py-2 bg-[#6D8196] hover:bg-[#5A6D81] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
            <span>{generating ? "Generating..." : "Generate Report"}</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 1. WRITER WORK REPORT SECTION */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {(isWriter || (isAdminTarget && reports.writer)) && (
        <div className="space-y-6 sm:space-y-8 animate-fadeIn">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 flex items-center justify-center mb-2 sm:mb-3">
                <FileText className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl sm:text-3xl font-extrabold text-[#4A4A4A]">{reports.writer.metrics.totalNew}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-[#737373] uppercase tracking-wider mt-0.5 sm:mt-1">New Articles</p>
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-50 flex items-center justify-center mb-2 sm:mb-3">
                <RefreshCw className="w-4 h-4 text-sky-600" />
              </div>
              <div>
                <h3 className="text-xl sm:text-3xl font-extrabold text-[#4A4A4A]">{reports.writer.metrics.totalUpdates}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-[#737373] uppercase tracking-wider mt-0.5 sm:mt-1">Articles Updated</p>
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 flex items-center justify-center mb-2 sm:mb-3">
                <Wrench className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h3 className="text-xl sm:text-3xl font-extrabold text-[#4A4A4A]">{reports.writer.metrics.totalFixes}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-[#737373] uppercase tracking-wider mt-0.5 sm:mt-1">Redos Fixed</p>
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-2 sm:mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl sm:text-3xl font-extrabold text-[#4A4A4A]">{reports.writer.metrics.completedArticles}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-[#737373] uppercase tracking-wider mt-0.5 sm:mt-1">Verified Completed</p>
              </div>
            </div>
          </div>

          {/* Visual Analytics Graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartPieInteractive
              data={reports.writer.statusDistribution || []}
              title="Article Pipeline Distribution"
              description="Active workflow state breakdown across assigned articles"
              centerLabel="Articles"
            />
            <ChartLineLabelCustom
              data={reports.writer.monthlyTrend || []}
              title="Writing Output Trend"
              description="Articles written over the last 6 months"
            />
          </div>

          {/* Section A: New Articles */}
          <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-2xs overflow-hidden">
            <div className="p-3.5 px-4 sm:p-4 sm:px-6 border-b border-[#CBCBCB]/40 flex items-center justify-between bg-[#FAF9F5]/60">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-[#4A4A4A]">New Articles</h2>
                <span className="px-2 py-0.5 text-xs font-extrabold bg-indigo-100/60 text-indigo-700 rounded-full">
                  {reports.writer.newArticles.length}
                </span>
              </div>
              <span className="text-xs text-[#737373] font-medium hidden sm:inline">All articles written in this period</span>
            </div>

            {reports.writer.newArticles.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-xs text-[#737373]">No new articles recorded for this period.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {reports.writer.newArticles.map((item: any) => (
                  <div key={item.id} className="p-3.5 px-4 sm:p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF9F5] transition-colors">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#4A4A4A] break-words">{item.productName}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#6D8196]/10 text-[#3D4F61] border border-[#6D8196]/20">
                          {item.siteName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === "COMPLETED" || item.status === "APPROVED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#737373] flex-wrap">
                        <span>Date: {new Date(item.date).toLocaleDateString()}</span>
                        {item.writingTimeMin && (
                          <span>Writing Time: {Math.round(item.writingTimeMin / 60)}h {item.writingTimeMin % 60}m</span>
                        )}
                      </div>
                    </div>

                    <div className="w-full sm:w-auto">
                      {item.articleLink ? (
                        <a
                          href={item.articleLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-3.5 py-2 sm:py-1.5 rounded-xl bg-white border border-[#CBCBCB] hover:border-[#6D8196] hover:bg-[#FAF9F5] text-xs font-bold text-[#4A4A4A] shadow-2xs transition cursor-pointer"
                        >
                          <span>Article Link</span>
                          <ExternalLink className="w-3.5 h-3.5 text-[#6D8196]" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 italic block sm:inline text-center sm:text-left">No link assigned</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section B: Updates */}
          <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-2xs overflow-hidden">
            <div className="p-3.5 px-4 sm:p-4 sm:px-6 border-b border-[#CBCBCB]/40 flex items-center justify-between bg-[#FAF9F5]/60">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 font-bold">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-[#4A4A4A]">Updates</h2>
                <span className="px-2 py-0.5 text-xs font-extrabold bg-sky-100/60 text-sky-700 rounded-full">
                  {reports.writer.updates.length}
                </span>
              </div>
              <span className="text-xs text-[#737373] font-medium hidden sm:inline">Articles updated or revisions submitted</span>
            </div>

            {reports.writer.updates.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-xs text-[#737373]">No article updates recorded for this period.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {reports.writer.updates.map((item: any) => (
                  <div key={item.id} className="p-3.5 px-4 sm:p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF9F5] transition-colors">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#4A4A4A] break-words">{item.productName}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#6D8196]/10 text-[#3D4F61] border border-[#6D8196]/20">
                          {item.siteName}
                        </span>
                      </div>
                      <p className="text-xs text-[#737373] line-clamp-2">{item.notes}</p>
                      <p className="text-[11px] text-slate-400">Updated on {new Date(item.date).toLocaleDateString()}</p>
                    </div>

                    <div className="w-full sm:w-auto">
                      {item.articleLink ? (
                        <a
                          href={item.articleLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-3.5 py-2 sm:py-1.5 rounded-xl bg-white border border-[#CBCBCB] hover:border-[#6D8196] hover:bg-[#FAF9F5] text-xs font-bold text-[#4A4A4A] shadow-2xs transition cursor-pointer"
                        >
                          <span>Article Link</span>
                          <ExternalLink className="w-3.5 h-3.5 text-[#6D8196]" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 italic block sm:inline text-center sm:text-left">No link</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section C: Fixes */}
          <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-2xs overflow-hidden">
            <div className="p-3.5 px-4 sm:p-4 sm:px-6 border-b border-[#CBCBCB]/40 flex items-center justify-between bg-[#FAF9F5]/60">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 font-bold">
                  <Wrench className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-[#4A4A4A]">Fixes (Redos Addressed)</h2>
                <span className="px-2 py-0.5 text-xs font-extrabold bg-amber-100/60 text-amber-700 rounded-full">
                  {reports.writer.fixes.length}
                </span>
              </div>
              <span className="text-xs text-[#737373] font-medium hidden sm:inline">Articles reworked after reviewer feedback</span>
            </div>

            {reports.writer.fixes.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-xs text-[#737373]">No redo fixes recorded for this period.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {reports.writer.fixes.map((item: any) => (
                  <div key={item.id} className="p-3.5 px-4 sm:p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF9F5] transition-colors">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#4A4A4A] break-words">{item.productName}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#6D8196]/10 text-[#3D4F61] border border-[#6D8196]/20">
                          {item.siteName}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Fixed
                        </span>
                      </div>
                      <p className="text-xs text-[#737373] line-clamp-2">{item.notes}</p>
                      <p className="text-[11px] text-slate-400">Fixed on {new Date(item.date).toLocaleDateString()}</p>
                    </div>

                    <div className="w-full sm:w-auto">
                      {item.articleLink ? (
                        <a
                          href={item.articleLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-3.5 py-2 sm:py-1.5 rounded-xl bg-white border border-[#CBCBCB] hover:border-[#6D8196] hover:bg-[#FAF9F5] text-xs font-bold text-[#4A4A4A] shadow-2xs transition cursor-pointer"
                        >
                          <span>Article Link</span>
                          <ExternalLink className="w-3.5 h-3.5 text-[#6D8196]" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 italic block sm:inline text-center sm:text-left">No link</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 2. TEAM LEAD WORK REPORT SECTION */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {isTeamLead && reports.teamLead && (
        <div className="space-y-6 sm:space-y-8 animate-fadeIn">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 flex items-center justify-center mb-2 sm:mb-3">
                <FileText className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl sm:text-3xl font-extrabold text-[#4A4A4A]">{reports.teamLead.metrics.totalNewArticles}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-[#737373] uppercase tracking-wider mt-0.5 sm:mt-1">Articles Written</p>
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-50 flex items-center justify-center mb-2 sm:mb-3">
                <ShieldCheck className="w-4 h-4 text-sky-600" />
              </div>
              <div>
                <h3 className="text-xl sm:text-3xl font-extrabold text-[#4A4A4A]">{reports.teamLead.metrics.totalReviews}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-[#737373] uppercase tracking-wider mt-0.5 sm:mt-1">Reviews Conducted</p>
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-2 sm:mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl sm:text-3xl font-extrabold text-[#4A4A4A]">{reports.teamLead.metrics.approvedReviews}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-[#737373] uppercase tracking-wider mt-0.5 sm:mt-1">Articles Approved</p>
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-50 flex items-center justify-center mb-2 sm:mb-3">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div>
                <h3 className="text-xl sm:text-3xl font-extrabold text-[#4A4A4A]">{reports.teamLead.metrics.redoReviews}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-[#737373] uppercase tracking-wider mt-0.5 sm:mt-1">Redos Requested</p>
              </div>
            </div>
          </div>

          {/* Visual Analytics Graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <ChartPieInteractive
              data={reports.teamLead.statusDistribution || []}
              title="Review Decision Distribution"
              description="Approval and redo request breakdown for reviewed articles"
              centerLabel="Reviews"
            />
            <ChartLineLabelCustom
              data={reports.teamLead.monthlyTrend || []}
              title="Review Activity Trend"
              description="Reviews conducted over the last 6 months"
            />
          </div>

          {/* Section A: New Articles Written by TL */}
          {reports.teamLead.newArticles.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-2xs overflow-hidden">
              <div className="p-3.5 px-4 sm:p-4 sm:px-6 border-b border-[#CBCBCB]/40 flex items-center justify-between bg-[#FAF9F5]/60">
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-bold text-[#4A4A4A]">New Articles Written</h2>
                  <span className="px-2 py-0.5 text-xs font-extrabold bg-indigo-100/60 text-indigo-700 rounded-full">
                    {reports.teamLead.newArticles.length}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {reports.teamLead.newArticles.map((item: any) => (
                  <div key={item.id} className="p-3.5 px-4 sm:p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF9F5] transition-colors">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#4A4A4A] break-words">{item.productName}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#6D8196]/10 text-[#3D4F61] border border-[#6D8196]/20">
                          {item.siteName}
                        </span>
                      </div>
                      <p className="text-xs text-[#737373]">Date: {new Date(item.date).toLocaleDateString()}</p>
                    </div>

                    <div className="w-full sm:w-auto">
                      {item.articleLink ? (
                        <a
                          href={item.articleLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-3.5 py-2 sm:py-1.5 rounded-xl bg-white border border-[#CBCBCB] hover:border-[#6D8196] hover:bg-[#FAF9F5] text-xs font-bold text-[#4A4A4A] shadow-2xs transition cursor-pointer"
                        >
                          <span>Article Link</span>
                          <ExternalLink className="w-3.5 h-3.5 text-[#6D8196]" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 italic block sm:inline text-center sm:text-left">No link</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section B: Reviewed Articles */}
          <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-2xs overflow-hidden">
            <div className="p-3.5 px-4 sm:p-4 sm:px-6 border-b border-[#CBCBCB]/40 flex items-center justify-between bg-[#FAF9F5]/60">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-[#4A4A4A]">Reviewed Articles</h2>
                <span className="px-2 py-0.5 text-xs font-extrabold bg-sky-100/60 text-sky-700 rounded-full">
                  {reports.teamLead.reviews.length}
                </span>
              </div>
              <span className="text-xs text-[#737373] font-medium hidden sm:inline">Articles inspected and evaluated</span>
            </div>

            {reports.teamLead.reviews.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-xs text-[#737373]">No reviews conducted in this period.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {reports.teamLead.reviews.map((item: any) => (
                  <div key={item.id} className="p-3.5 px-4 sm:p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF9F5] transition-colors">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#4A4A4A] break-words">{item.productName}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#6D8196]/10 text-[#3D4F61] border border-[#6D8196]/20">
                          {item.siteName}
                        </span>
                        <span className="text-xs text-[#737373]">Writer: <strong className="text-[#4A4A4A]">{item.writerName}</strong></span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.approved
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {item.verdict}
                        </span>
                      </div>
                      <p className="text-xs text-[#737373] line-clamp-2">Remarks: {item.suggestion}</p>
                      <p className="text-[11px] text-slate-400">Reviewed on {new Date(item.reviewedAt).toLocaleDateString()}</p>
                    </div>

                    <div className="w-full sm:w-auto">
                      {item.articleLink ? (
                        <a
                          href={item.articleLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-3.5 py-2 sm:py-1.5 rounded-xl bg-white border border-[#CBCBCB] hover:border-[#6D8196] hover:bg-[#FAF9F5] text-xs font-bold text-[#4A4A4A] shadow-2xs transition cursor-pointer"
                        >
                          <span>Article Link</span>
                          <ExternalLink className="w-3.5 h-3.5 text-[#6D8196]" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 italic block sm:inline text-center sm:text-left">No link</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 3. LINKER WORK REPORT SECTION */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {isLinker && reports.linker && (
        <div className="space-y-6 sm:space-y-8 animate-fadeIn">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 flex items-center justify-center mb-2 sm:mb-3">
                <Package className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl sm:text-3xl font-extrabold text-[#4A4A4A]">{reports.linker.metrics.totalProductsAdded}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-[#737373] uppercase tracking-wider mt-0.5 sm:mt-1">Products Added</p>
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-50 flex items-center justify-center mb-2 sm:mb-3">
                <Link2 className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h3 className="text-xl sm:text-3xl font-extrabold text-[#4A4A4A]">{reports.linker.metrics.totalLinksAdded}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-[#737373] uppercase tracking-wider mt-0.5 sm:mt-1">Links Configured</p>
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-2 sm:mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl sm:text-3xl font-extrabold text-[#4A4A4A]">{reports.linker.metrics.acceptedLinks}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-[#737373] uppercase tracking-wider mt-0.5 sm:mt-1">Accepted Links</p>
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#CBCBCB]/60 shadow-2xs flex flex-col justify-between">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-50 flex items-center justify-center mb-2 sm:mb-3">
                <Layers className="w-4 h-4 text-sky-600" />
              </div>
              <div>
                <h3 className="text-xl sm:text-3xl font-extrabold text-[#4A4A4A]">{reports.linker.metrics.totalUpdates}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-[#737373] uppercase tracking-wider mt-0.5 sm:mt-1">Other Updates</p>
              </div>
            </div>
          </div>

          {/* Visual Analytics Graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <ChartPieInteractive
              data={reports.linker.statusDistribution || []}
              title="Link Operations Distribution"
              description="Verification states across configured product links"
              centerLabel="Links"
            />
            <ChartLineLabelCustom
              data={reports.linker.monthlyTrend || []}
              title="Link Configuration Trend"
              description="Links configured over the last 6 months"
            />
          </div>

          {/* Section A: Products Added */}
          <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-2xs overflow-hidden">
            <div className="p-3.5 px-4 sm:p-4 sm:px-6 border-b border-[#CBCBCB]/40 flex items-center justify-between bg-[#FAF9F5]/60">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                  <Package className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-[#4A4A4A]">Products Added</h2>
                <span className="px-2 py-0.5 text-xs font-extrabold bg-indigo-100/60 text-indigo-700 rounded-full">
                  {reports.linker.productsAdded.length}
                </span>
              </div>
              <span className="text-xs text-[#737373] font-medium hidden sm:inline">New products registered in the pipeline</span>
            </div>

            {reports.linker.productsAdded.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-xs text-[#737373]">No products added in this period.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {reports.linker.productsAdded.map((item: any) => (
                  <div key={item.id} className="p-3.5 px-4 sm:p-4 sm:px-6 flex items-center justify-between gap-3 hover:bg-[#FAF9F5] transition-colors">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#4A4A4A] break-words">{item.name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#6D8196]/10 text-[#3D4F61] border border-[#6D8196]/20">
                          {item.siteName}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                          {item.categoryName}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">Added on {new Date(item.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section B: Links Added on Products */}
          <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-2xs overflow-hidden">
            <div className="p-3.5 px-4 sm:p-4 sm:px-6 border-b border-[#CBCBCB]/40 flex items-center justify-between bg-[#FAF9F5]/60">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 font-bold">
                  <Link2 className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-[#4A4A4A]">Links Added on Products</h2>
                <span className="px-2 py-0.5 text-xs font-extrabold bg-purple-100/60 text-purple-700 rounded-full">
                  {reports.linker.linksAdded.length}
                </span>
              </div>
              <span className="text-xs text-[#737373] font-medium hidden sm:inline">Affiliate & bridge links configured</span>
            </div>

            {reports.linker.linksAdded.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-xs text-[#737373]">No links added in this period.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {reports.linker.linksAdded.map((item: any) => (
                  <div key={item.id} className="p-3.5 px-4 sm:p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF9F5] transition-colors">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#4A4A4A] break-words">{item.productName}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#6D8196]/10 text-[#3D4F61] border border-[#6D8196]/20">
                          {item.siteName}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          {item.affiliateName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === "ACCEPTED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#737373] flex-wrap">
                        {item.bridgePageLink && <span>Bridge: <a href={item.bridgePageLink} target="_blank" rel="noreferrer" className="text-indigo-600 underline font-medium">Link</a></span>}
                        {item.buyLink && <span>Buy: <a href={item.buyLink} target="_blank" rel="noreferrer" className="text-emerald-600 underline font-medium">Link</a></span>}
                        {item.geos?.length > 0 && <span>GEOs: {item.geos.join(", ")}</span>}
                        <span>Date: {new Date(item.addedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section C: Other Work */}
          {reports.linker.otherWork.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-2xs overflow-hidden">
              <div className="p-3.5 px-4 sm:p-4 sm:px-6 border-b border-[#CBCBCB]/40 flex items-center justify-between bg-[#FAF9F5]/60">
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 font-bold">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-bold text-[#4A4A4A]">Other Work & Modifications</h2>
                  <span className="px-2 py-0.5 text-xs font-extrabold bg-sky-100/60 text-sky-700 rounded-full">
                    {reports.linker.otherWork.length}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {reports.linker.otherWork.map((item: any) => (
                  <div key={item.id} className="p-3.5 px-4 sm:p-4 sm:px-6 flex items-center justify-between gap-3 hover:bg-[#FAF9F5] transition-colors">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#4A4A4A] break-words">{item.productName}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#6D8196]/10 text-[#3D4F61] border border-[#6D8196]/20">
                          {item.siteName}
                        </span>
                      </div>
                      <p className="text-xs text-[#737373] break-words">{item.notes}</p>
                      <p className="text-[11px] text-slate-400">Date: {new Date(item.updatedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
