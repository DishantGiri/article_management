/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Download, MoreHorizontal, CheckCircle2, PlayCircle, FileText, Activity, Flame } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";

interface Article {
  id: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "APPROVED" | "REDO";
  priority: "LOW" | "MEDIUM" | "HIGH";
  updatedAt: string;
  articleLink?: string;
  product: { 
    id: number; 
    name: string; 
    remarks?: string | null;
    site: { name: string }; 
    category: { name: string };
    linkLogs?: { linkerRemarks?: string | null; addedAt: string }[];
  };
  writer?: { id: number; name: string };
  history?: { notes?: string | null; updatedAt: string }[];
}

function PriorityBadge({ priority }: { priority: "LOW" | "MEDIUM" | "HIGH" }) {
  if (priority === "HIGH") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
      <Flame className="w-2.5 h-2.5" /> HIGH
    </span>
  );
  if (priority === "LOW") return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">LOW</span>
  );
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">MED</span>
  );
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700 border border-slate-200/50",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border border-blue-200/50",
  COMPLETED: "bg-indigo-50 text-indigo-700 border border-indigo-200/50",
  APPROVED: "bg-emerald-50 text-emerald-700 border border-emerald-200/50",
  REDO: "bg-rose-50 text-rose-700 border border-rose-200/50",
};

const generateSlug = (productName: string) => {
  return productName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
};

function ArticlesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [statusFilter, setStatusFilter] = useState("");
  const [writerFilter, setWriterFilter] = useState("");
  const [siteFilter, setSiteFilter] = useState("");

  const [currentUserRole, setCurrentUserRole] = useState("WRITER");
  const [stats, setStats] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [updatingArticle, setUpdatingArticle] = useState<Article | null>(null);
  const [updateLink, setUpdateLink] = useState("");
  const [submittingUpdate, setSubmittingUpdate] = useState(false);
  const [selectedRemarks, setSelectedRemarks] = useState<{ writer: string; linker: string; productName: string } | null>(null);
  const { data: session } = useSession();

  const handleStartRevision = async (articleId: number) => {
    const callerId = session?.user?.id || currentUserId;
    if (!callerId) return;
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redoStarted: true, callerId: Number(callerId) }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Revision started! Timer is running.");
      router.push("/");
    } catch (e: any) {
      toast.error(e.message || "Failed to start revision");
    }
  };

  useEffect(() => {
    if (!session?.user?.id) return;
    const stored = session.user.id;
    const uRole = session.user.role || "WRITER";
    setCurrentUserRole(uRole);
    setCurrentUserId(stored);

    Promise.all([
      fetch(`/api/articles?userId=${stored}`).then((r) => r.json()),
      fetch(`/api/dashboard?userId=${stored}`).then((r) => r.json()),
    ]).then(([articlesData, dashboardData]) => {
      setArticles(Array.isArray(articlesData) ? articlesData : []);
      setStats(dashboardData);
    }).finally(() => setLoading(false));
  }, [session?.user?.id]);

  const uniqueWriters = Array.from(new Set(articles.map((a) => a.writer?.name).filter(Boolean))) as string[];
  const uniqueSites = Array.from(new Set(articles.map((a) => a.product.site.name).filter(Boolean))) as string[];

  const filtered = articles.filter((a) => {
    const matchSearch =
      a.product.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.writer?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      a.product.site.name.toLowerCase().includes(search.toLowerCase());

    const matchStatus = !statusFilter || a.status === statusFilter;
    const matchWriter = !writerFilter || a.writer?.name === writerFilter;
    const matchSite = !siteFilter || a.product.site.name === siteFilter;

    return matchSearch && matchStatus && matchWriter && matchSite;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderPagination = () => {
    const pages = [];
    for (let i = 1; i <= Math.min(5, totalPages); i++) pages.push(i);
    return (
      <div className="flex items-center justify-between mt-4 py-3 px-2 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-400">
          Showing {filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}
        </p>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="w-7 h-7 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-50"
          >
            &lt;
          </button>
          {pages.map(p => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold ${
                currentPage === p 
                  ? "bg-indigo-500 text-white border border-indigo-500 shadow-sm" 
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          ))}
          <button 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="w-7 h-7 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-50"
          >
            &gt;
          </button>
        </div>
      </div>
    );
  };

  const getWriterRemarks = (article: any) => {
    if (!article.history || !Array.isArray(article.history)) return "";
    for (const h of article.history) {
      if (h.notes && h.notes.includes("Writer remarks:")) {
        const parts = h.notes.split("Writer remarks:");
        const remarks = parts[parts.length - 1].trim();
        if (remarks) return remarks;
      }
    }
    return "";
  };

  const getLinkerRemarks = (article: any) => {
    const logs = article.product?.linkLogs || [];
    const latestLogWithRemarks = logs.find((l: any) => l.linkerRemarks);
    const linkerRemark = latestLogWithRemarks?.linkerRemarks;
    const productRemark = article.product?.remarks;
    if (linkerRemark && productRemark) {
      return `${linkerRemark} (Product: ${productRemark})`;
    }
    if (linkerRemark) return linkerRemark;
    if (productRemark) return productRemark;
    return "";
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Product", "Site", "Category", "Writer", "Status", "Article Link", "Date", "Writer Remarks", "Linker Remarks"];
    const rows = filtered.map((a) => [
      a.id.toString(),
      a.product.name,
      a.product.site.name,
      a.product.category.name,
      a.writer?.name || "Unassigned",
      a.status,
      a.articleLink || "",
      new Date(a.updatedAt).toLocaleDateString(),
      getWriterRemarks(a),
      getLinkerRemarks(a)
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${(val || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `articles_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const ensureExternalUrl = (url: string | null | undefined) => {
    if (!url) return "";
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const hasActiveAssignment = articles.some(
    (art) => art.writer?.id === currentUserId && (art.status === "IN_PROGRESS" || art.status === "REDO")
  );

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-[#f8fafc]" suppressHydrationWarning>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Articles</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">All article submissions and their statuses</p>
        </div>
        <div>
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 shadow-sm transition flex items-center gap-2 cursor-pointer">
            <Download className="w-4 h-4 text-slate-500" />
            Export
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      {stats && (currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "TEAM_LEAD") && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32 relative">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500"><CheckCircle2 className="w-4 h-4" /></div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">↑ 8%</span>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.general.completedArticles || 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Completed Articles</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mb-2"><PlayCircle className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.general.inProgressArticles || 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">In Progress</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 mb-2"><FileText className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.general.pendingArticles || 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Pending Articles</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-500 mb-2"><Activity className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.superAdmin?.avgWritingTime || "0.0"}h</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Avg Writing Time</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex items-center gap-3 mt-6 mb-2">
        {/* Search */}
        <div className="relative flex-1 max-w-sm bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search articles..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-2 border-none text-sm focus:outline-none focus:ring-0 bg-transparent placeholder-slate-400 font-medium text-slate-700"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="APPROVED">Approved</option>
          <option value="REDO">Redo / Needs Changes</option>
        </select>

        {/* Writer Filter */}
        <select
          value={writerFilter}
          onChange={(e) => { setWriterFilter(e.target.value); setCurrentPage(1); }}
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="">All Writers</option>
          {uniqueWriters.map((writer) => (
            <option key={writer} value={writer}>{writer}</option>
          ))}
        </select>

        {/* Site Filter */}
        <select
          value={siteFilter}
          onChange={(e) => { setSiteFilter(e.target.value); setCurrentPage(1); }}
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="">All Sites</option>
          {uniqueSites.map((site) => (
            <option key={site} value={site}>{site}</option>
          ))}
        </select>
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-slate-500 font-medium">No articles found</p>
          </div>
        ) : (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[22%]">Product</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[18%]">Site</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[15%]">Writer</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[8%]">Priority</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[10%]">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[10%]">Date</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center w-[12%]">Remarks</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center w-[5%]">Link</th>
                  {(currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "TEAM_LEAD" || currentUserRole === "WRITER") && (
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left w-[10%]">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map((a: any) => {
                  const status = a.status || "PENDING";
                  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.PENDING;
                  const writerRemarks = getWriterRemarks(a);
                  const linkerRemarks = getLinkerRemarks(a);
                  
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-4 py-3.5">
                        <span className="text-[13px] font-semibold text-slate-800">{a.product.name}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-[13px] font-medium text-slate-600">{a.product.site.name}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        {a.writer?.name ? (
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] font-bold">
                              {getInitials(a.writer.name)}
                            </div>
                            <span className="text-[12px] font-semibold text-slate-600">{a.writer.name}</span>
                          </div>
                        ) : (
                          <span className="text-[12px] font-medium text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <PriorityBadge priority={(a as any).priority || "MEDIUM"} />
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${statusColor}`}>
                          {status === "IN_PROGRESS" ? "In Progress" : status.charAt(0) + status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-[12px] font-medium text-slate-500">
                          {new Date(a.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                      {/* Writer's and Linker's Remarks cell */}
                      <td className="px-4 py-3.5 text-center">
                        {(writerRemarks || linkerRemarks) ? (
                          <button
                            onClick={() => setSelectedRemarks({ writer: writerRemarks, linker: linkerRemarks, productName: a.product.name })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-500 hover:text-indigo-650 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-[10px] font-bold cursor-pointer shadow-sm"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View
                          </button>
                        ) : (
                          <span className="text-slate-300 font-semibold text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {a.articleLink ? (
                          <a href={ensureExternalUrl(a.articleLink)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-600 transition">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          </a>
                        ) : (
                          <span className="text-[12px] font-bold text-slate-300">--</span>
                        )}
                      </td>
                      {(currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "TEAM_LEAD") && (
                        <td className="px-4 py-3.5">
                          <Link
                            href={`/articles/${a.id}-${generateSlug(a.product.name)}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Review
                          </Link>
                        </td>
                      )}
                      {currentUserRole === "WRITER" && (
                        <td className="px-4 py-3.5">
                          {status === "PENDING" && (
                            <button
                              disabled={hasActiveAssignment}
                              onClick={async () => {
                                if (!currentUserId) return;
                                try {
                                  const res = await fetch(`/api/articles/${a.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ status: "IN_PROGRESS", writerId: currentUserId, callerId: currentUserId }),
                                  });
                                  if (res.ok) {
                                    toast.success("Started writing! Redirecting to dashboard...");
                                    router.push("/");
                                  } else {
                                    const err = await res.json();
                                    toast.error(err.error || "Failed to start writing");
                                  }
                                } catch {
                                  toast.error("Failed to start writing");
                                }
                              }}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold whitespace-nowrap transition-all ${
                                !hasActiveAssignment
                                  ? "bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
                              }`}
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                              Write
                            </button>
                          )}
                          {status === "IN_PROGRESS" && a.writer?.id === currentUserId && (
                            <button
                              onClick={() => {
                                setUpdatingArticle(a);
                                setUpdateLink(a.articleLink || "");
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all text-[11px] font-bold whitespace-nowrap cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Update
                            </button>
                          )}
                          {status === "REDO" && a.writer?.id === currentUserId && (
                            <>
                              {!a.startedAt ? (
                                <button
                                  onClick={() => handleStartRevision(a.id)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all text-[11px] font-bold whitespace-nowrap cursor-pointer"
                                >
                                  <PlayCircle className="w-3.5 h-3.5" />
                                  Start Revision
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setUpdatingArticle(a);
                                    setUpdateLink(a.articleLink || "");
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all text-[11px] font-bold whitespace-nowrap cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Update
                                </button>
                              )}
                            </>
                          )}
                          {a.writer?.id !== currentUserId && (status === "IN_PROGRESS" || status === "REDO" || status === "COMPLETED" || status === "APPROVED") && (
                            <span className="text-[11px] font-medium text-slate-400">Locked</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {renderPagination()}
          </div>
        )}
      </div>

      {/* Writer update modal */}
      {updatingArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-1">
                {updatingArticle.status === "REDO" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                    Needs Changes
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                    In Progress
                  </span>
                )}
                {(updatingArticle as any).priority === "HIGH" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                    <Flame className="w-2.5 h-2.5" /> HIGH PRIORITY
                  </span>
                )}
              </div>
              <h2 className="text-[15px] font-bold text-slate-900">{updatingArticle.product.name}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{updatingArticle.product.site.name}</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Updated Article Link
                </label>
                <input
                  type="url"
                  value={updateLink}
                  onChange={(e) => setUpdateLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setUpdatingArticle(null); setUpdateLink(""); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  disabled={submittingUpdate || !updateLink.trim()}
                  onClick={async () => {
                    if (!updateLink.trim() || !currentUserId) return;
                    setSubmittingUpdate(true);
                    try {
                      const res = await fetch(`/api/articles/${updatingArticle.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          articleLink: updateLink,
                          status: "COMPLETED",
                          callerId: currentUserId,
                        }),
                      });
                      if (!res.ok) {
                        const d = await res.json();
                        toast.error(d.error || "Failed to update article.");
                        return;
                      }
                      toast.success("Article updated and marked as completed!");
                      setUpdatingArticle(null);
                      setUpdateLink("");
                      // Refresh articles list
                      const refreshed = await fetch(`/api/articles?userId=${currentUserId}`).then(r => r.json());
                      setArticles(Array.isArray(refreshed) ? refreshed : []);
                    } catch {
                      toast.error("Something went wrong.");
                    } finally {
                      setSubmittingUpdate(false);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingUpdate ? "Submitting..." : "Submit Update"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* View Remarks Modal */}
      {selectedRemarks && (
        <div 
          onClick={() => setSelectedRemarks(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Remarks: {selectedRemarks.productName}</h2>
              <button onClick={() => setSelectedRemarks(null)} className="text-slate-400 hover:text-slate-600 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {selectedRemarks.writer && (
                <div className="space-y-1">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">WRITER REMARKS</span>
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap leading-relaxed">
                    {selectedRemarks.writer}
                  </p>
                </div>
              )}
              {selectedRemarks.linker && (
                <div className="space-y-1">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200">LINKER REMARKS</span>
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap leading-relaxed">
                    {selectedRemarks.linker}
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex justify-end">
              <button
                onClick={() => setSelectedRemarks(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ArticlesPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20 min-h-screen">
        <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    }>
      <ArticlesContent />
    </Suspense>
  );
}
