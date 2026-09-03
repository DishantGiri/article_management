/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import CustomSelect from "@/components/CustomSelect";
import DateRangePicker from "@/components/DateRangePicker";
import {
  Search,
  Clock,
  ArrowRight,
  FileText,
  Link2,
  AlertTriangle,
  CheckCircle2,
  PlayCircle,
  RotateCcw,
  User,
  ShieldCheck,
  Check,
  Globe,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useSession } from "next-auth/react";
import LoadingScreen from "@/components/LoadingScreen";

interface HistoryRecord {
  id: string;
  type: "ARTICLE" | "LINK";
  actionType:
    | "TL_SUGGESTION"
    | "ARTICLE_APPROVAL"
    | "ARTICLE_COMPLETED"
    | "REVISION_SUBMITTED"
    | "WRITING_STARTED"
    | "LINK_UPDATED"
    | "ARTICLE_UPDATE"
    | "LINK_LOG";
  actionLabel: string;
  updatedById: number;
  productName: string;
  siteName: string;
  oldStatus: string | null;
  newStatus: string | null;
  oldLink: string | null;
  newLink: string | null;
  notes: string | null;
  suggestion?: string | null;
  updatedAt: string;
  updatedBy: {
    id: number;
    name: string;
    role: string;
    email: string;
  };
  writtenBy?: {
    id: number;
    name: string;
    role: string;
    email: string;
  } | null;
  approvedBy?: {
    id: number;
    name: string;
    role: string;
    email: string;
  } | null;
}

const getInitials = (name?: string) => {
  if (!name) return "??";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
};

export default function HistoryPage() {
  const { data: session } = useSession();
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "ARTICLE" | "LINK">("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    if (!session?.user?.id) return;

    setLoading(true);
    fetch("/api/history")
      .then((r) => r.json())
      .then((data) => {
        setHistory(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [session?.user?.id]);

  const filtered = history.filter((record) => {
    // Type Filter
    if (typeFilter && record.type !== typeFilter) return false;

    // Action Filter
    if (actionFilter) {
      if (actionFilter === "TL_SUGGESTION" && record.actionType !== "TL_SUGGESTION") return false;
      if (actionFilter === "ARTICLE_APPROVAL" && record.actionType !== "ARTICLE_APPROVAL") return false;
      if (
        actionFilter === "ARTICLE_SUBMISSION" &&
        record.actionType !== "ARTICLE_COMPLETED" &&
        record.actionType !== "REVISION_SUBMITTED"
      )
        return false;
      if (actionFilter === "LINK_LOG" && record.actionType !== "LINK_LOG") return false;
    }

    // Search Filter
    const query = search.toLowerCase();
    const updaterName = record.updatedBy?.name?.toLowerCase() || "";
    const writerName = record.writtenBy?.name?.toLowerCase() || "";
    const approverName = record.approvedBy?.name?.toLowerCase() || "";
    const pName = record.productName?.toLowerCase() || "";
    const sName = record.siteName?.toLowerCase() || "";
    const nts = record.notes?.toLowerCase() || "";
    const sugg = record.suggestion?.toLowerCase() || "";

    const matchSearch =
      updaterName.includes(query) ||
      writerName.includes(query) ||
      approverName.includes(query) ||
      pName.includes(query) ||
      sName.includes(query) ||
      nts.includes(query) ||
      sugg.includes(query);

    // Date Filter
    let matchDate = true;
    if (startDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      const d = new Date(record.updatedAt);
      if (d < s) matchDate = false;
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      const d = new Date(record.updatedAt);
      if (d > e) matchDate = false;
    }

    return matchSearch && matchDate;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pageSize = 5;
    const currentBlock = Math.floor((currentPage - 1) / pageSize);
    const start = currentBlock * pageSize + 1;
    const end = Math.min(totalPages, start + pageSize - 1);

    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 py-3 px-4 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-400">
          Showing {filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} -{" "}
          {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-2.5 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer"
            title="First Page"
          >
            First
          </button>
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer"
            title="Previous Page"
          >
            &lt;
          </button>

          {start > 1 && (
            <button
              onClick={() => setCurrentPage(start - 1)}
              className="text-xs font-bold text-slate-400 hover:text-indigo-600 px-1 cursor-pointer"
              title="Previous 5 Pages"
            >
              ...
            </button>
          )}

          {pages.map((p) => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition cursor-pointer ${
                currentPage === p
                  ? "bg-[#6D8196] text-white shadow-2xs"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          ))}

          {end < totalPages && (
            <button
              onClick={() => setCurrentPage(end + 1)}
              className="text-xs font-bold text-slate-400 hover:text-indigo-600 px-1 cursor-pointer"
              title="Next 5 Pages"
            >
              ...
            </button>
          )}

          <button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer"
            title="Next Page"
          >
            &gt;
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-2.5 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer"
            title="Last Page"
          >
            Last
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1650px] mx-auto min-h-screen bg-[#FAF9F5] text-[#4A4A4A] space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">System Activity & Audit Log</h1>
          <p className="text-slate-500 text-xs mt-1 font-medium">
            Chronological audit of editorial reviews, writer submissions, team lead suggestions, and link logs
          </p>
        </div>

        {/* Quick Activity Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <button
            onClick={() => {
              setActionFilter("");
              setTypeFilter("");
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              !actionFilter && !typeFilter
                ? "bg-[#6D8196] text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            All Activity
          </button>

          <button
            onClick={() => {
              setActionFilter("TL_SUGGESTION");
              setTypeFilter("");
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              actionFilter === "TL_SUGGESTION"
                ? "bg-rose-600 text-white shadow-2xs"
                : "text-slate-600 hover:text-rose-700 hover:bg-rose-50"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>TL Suggestions & Redos</span>
            {history.filter((h) => h.actionType === "TL_SUGGESTION").length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  actionFilter === "TL_SUGGESTION" ? "bg-white text-rose-700" : "bg-rose-100 text-rose-700"
                }`}
              >
                {history.filter((h) => h.actionType === "TL_SUGGESTION").length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActionFilter("ARTICLE_APPROVAL");
              setTypeFilter("");
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              actionFilter === "ARTICLE_APPROVAL"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approvals</span>
          </button>

          <button
            onClick={() => {
              setActionFilter("ARTICLE_SUBMISSION");
              setTypeFilter("");
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              actionFilter === "ARTICLE_SUBMISSION"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "text-slate-600 hover:text-indigo-700 hover:bg-indigo-50"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Submissions</span>
          </button>

          <button
            onClick={() => {
              setActionFilter("LINK_LOG");
              setTypeFilter("");
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              actionFilter === "LINK_LOG"
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-slate-600 hover:text-blue-700 hover:bg-blue-50"
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Link Logs</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search writer, approver, updater, product, or suggestions..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196] bg-white placeholder-slate-400 text-slate-800 transition"
          />
        </div>

        {/* Type Filter */}
        <CustomSelect
          value={typeFilter}
          onChange={(val) => {
            setTypeFilter(val as any);
            setActionFilter("");
            setCurrentPage(1);
          }}
          placeholder="All Streams"
          className="min-w-[150px]"
          options={[
            { value: "", label: "All Activity Types" },
            { value: "ARTICLE", label: "Article Events" },
            { value: "LINK", label: "Link Log Events" },
          ]}
        />

        {/* Date Filter */}
        <div className="border-l border-slate-100 pl-3">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
              setCurrentPage(1);
            }}
            placeholder="Filter Date Range"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20">
            <LoadingScreen
              message="Loading audit activity..."
              subtext="Parsing writer submissions, team lead suggestions, and approvals"
              size="md"
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-20 text-center space-y-2">
            <Clock className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-slate-700 font-bold text-sm">No activity records found</p>
            <p className="text-slate-400 text-xs">Try adjusting your search criteria or date ranges.</p>
          </div>
        ) : (
          <div className="overflow-x-auto p-2">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3.5 w-[13%]">Type / Action</th>
                  <th className="px-4 py-3.5 w-[11%]">Date & Time</th>
                  <th className="px-4 py-3.5 w-[15%]">Product / Site</th>
                  <th className="px-4 py-3.5 w-[12%]">Written By</th>
                  <th className="px-4 py-3.5 w-[12%]">Updated By</th>
                  <th className="px-4 py-3.5 w-[12%]">Approved By</th>
                  <th className="px-4 py-3.5 w-[25%]">Modification & Suggestion Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/70 text-xs">
                {paginated.map((record) => {
                  const isRedoSuggestion = record.actionType === "TL_SUGGESTION";
                  const isApproval = record.actionType === "ARTICLE_APPROVAL";
                  const isCompleted = record.actionType === "ARTICLE_COMPLETED";
                  const isRevisionResubmitted = record.actionType === "REVISION_SUBMITTED";

                  // Extract writer remarks if present
                  const writerRemarks = record.notes?.includes("Writer remarks:")
                    ? record.notes.split("Writer remarks:")[1]?.trim()
                    : null;

                  return (
                    <tr
                      key={record.id}
                      className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition-colors group ${
                        isRedoSuggestion ? "bg-rose-50/20 dark:bg-rose-950/20" : isApproval ? "bg-emerald-50/15 dark:bg-emerald-950/20" : ""
                      }`}
                    >
                      {/* 1. Type / Action Badge */}
                      <td className="px-4 py-4 align-top">
                        {isRedoSuggestion ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 shadow-2xs whitespace-nowrap">
                            <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                            TL Suggestion (Redo)
                          </span>
                        ) : isApproval ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            Article Approved
                          </span>
                        ) : isCompleted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 whitespace-nowrap">
                            <FileText className="w-3 h-3 text-indigo-500" />
                            Article Submitted
                          </span>
                        ) : isRevisionResubmitted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950/70 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 whitespace-nowrap">
                            <RotateCcw className="w-3 h-3 text-cyan-500" />
                            Revision Resubmitted
                          </span>
                        ) : record.actionType === "WRITING_STARTED" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 whitespace-nowrap">
                            <PlayCircle className="w-3 h-3 text-blue-500" />
                            Started Writing
                          </span>
                        ) : record.type === "LINK" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                            <Link2 className="w-3 h-3 text-[#6D8196]" />
                            Link Log Update
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                            <FileText className="w-3 h-3 text-slate-500" />
                            Article Modified
                          </span>
                        )}
                      </td>

                      {/* 2. Date & Time */}
                      <td className="px-4 py-4 align-top whitespace-nowrap">
                        <p className="font-bold text-slate-800 dark:text-slate-100">
                          {new Date(record.updatedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                          {new Date(record.updatedAt).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </td>

                      {/* 3. Product / Site */}
                      <td className="px-4 py-4 align-top">
                        <p className="font-bold text-slate-900 dark:text-slate-100 leading-snug">{record.productName}</p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                          <Globe className="w-2.5 h-2.5 text-slate-400" />
                          {record.siteName}
                        </span>
                      </td>

                      {/* 4. Written By */}
                      <td className="px-4 py-4 align-top">
                        {record.writtenBy ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-extrabold shrink-0 shadow-2xs">
                              {getInitials(record.writtenBy.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">
                                {record.writtenBy.name}
                              </p>
                              <p className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                {record.writtenBy.role || "WRITER"}
                              </p>
                            </div>
                          </div>
                        ) : record.type === "LINK" ? (
                          <span className="text-[11px] text-slate-400 italic">N/A (Linker Stream)</span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* 5. Updated By */}
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-extrabold shrink-0 shadow-2xs ${
                              isRedoSuggestion
                                ? "bg-rose-100 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
                                : isApproval
                                ? "bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300"
                                : "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                            }`}
                          >
                            {getInitials(record.updatedBy?.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">
                              {record.updatedBy?.name || "System"}
                            </p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                              {record.updatedBy?.role ? record.updatedBy.role.replace("_", " ") : "USER"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* 6. Approved By */}
                      <td className="px-4 py-4 align-top">
                        {record.approvedBy ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[10px] font-extrabold shrink-0 shadow-2xs">
                              {getInitials(record.approvedBy.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">
                                {record.approvedBy.name}
                              </p>
                              <p className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-0.5">
                                <ShieldCheck className="w-2.5 h-2.5" /> Approved
                              </p>
                            </div>
                          </div>
                        ) : record.newStatus === "REDO" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                            Needs Revision
                          </span>
                        ) : record.type === "LINK" ? (
                          <span className="text-[11px] text-slate-400 italic">—</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                            Pending Approval
                          </span>
                        )}
                      </td>

                      {/* 7. Modification & Suggestion Details */}
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-2">
                          {/* SPECIAL DISPLAY: TL Suggestion on Call to Writer */}
                          {isRedoSuggestion && (
                            <div className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-rose-200 dark:border-rose-800/60 shadow-2xs space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                  TL Suggestion to {record.writtenBy?.name || "Writer"}
                                </span>
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950/90 text-rose-800 dark:text-rose-300 border border-transparent dark:border-rose-800/60">
                                  Action Required
                                </span>
                              </div>
                              <p className="text-xs text-rose-950 dark:text-rose-100 font-semibold leading-relaxed">
                                &quot;{record.suggestion || record.notes?.replace("Status changed from COMPLETED to REDO", "").replace("Feedback:", "").trim() || "Please revise article per team lead instructions."}&quot;
                              </p>
                            </div>
                          )}

                          {/* SPECIAL DISPLAY: Editorial Approval */}
                          {isApproval && (
                            <div className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-emerald-200 dark:border-emerald-800/60 shadow-2xs space-y-1">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                Approved by {record.updatedBy?.name} for {record.writtenBy?.name || "Writer"}
                              </span>
                              {record.suggestion && (
                                <p className="text-xs text-emerald-950 dark:text-emerald-100 font-medium">
                                  &quot;{record.suggestion}&quot;
                                </p>
                              )}
                            </div>
                          )}

                          {/* Status Transition Pill */}
                          {record.oldStatus && record.newStatus && !isRedoSuggestion && !isApproval && (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                              <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px]">
                                {record.oldStatus}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded text-[9px]">
                                {record.newStatus}
                              </span>
                            </div>
                          )}

                          {/* Writer remarks if present */}
                          {writerRemarks && (
                            <div className="p-2 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 font-medium">
                              <span className="font-bold text-indigo-800 block text-[10px] uppercase">
                                Writer Remarks:
                              </span>
                              &quot;{writerRemarks}&quot;
                            </div>
                          )}

                          {/* General notes for link logs or standard updates */}
                          {!isRedoSuggestion &&
                            !isApproval &&
                            record.notes &&
                            !record.notes.includes("Writer remarks:") && (
                              <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100 font-medium leading-relaxed">
                                {record.notes}
                              </div>
                            )}

                          {/* Link Updated */}
                          {record.oldLink !== record.newLink && record.newLink && (
                            <div className="text-[11px] text-blue-700 bg-blue-50/60 p-2 rounded-xl border border-blue-100 font-mono break-all truncate">
                              <span className="font-bold font-sans block text-[10px] uppercase text-blue-800">
                                Link Updated:
                              </span>
                              {record.newLink}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {renderPagination()}
          </div>
        )}
      </div>
    </div>
  );
}
