/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Download, MoreHorizontal, CheckCircle2, PlayCircle, FileText, Activity, Flame, RotateCcw, Clock, Check, X, UserPlus, Flag } from "lucide-react";
import { useSession } from "next-auth/react";
import CustomSelect from "@/components/CustomSelect";
import { toast } from "react-hot-toast";
import LoadingScreen from "@/components/LoadingScreen";

interface Article {
  id: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "APPROVED" | "REDO";
  priority: "LOW" | "MEDIUM" | "HIGH";
  updatedAt: string;
  articleLink?: string;
  specialApprovalRequested?: boolean;
  specialApprovalRequestReason?: string | null;
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

  const [currentUserRole, setCurrentUserRole] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [updatingArticle, setUpdatingArticle] = useState<Article | null>(null);
  const [updateLink, setUpdateLink] = useState("");
  const [updateReason, setUpdateReason] = useState("");
  const [submittingUpdate, setSubmittingUpdate] = useState(false);
  const [requestingUpdateArticle, setRequestingUpdateArticle] = useState<Article | null>(null);
  const [requestEditReason, setRequestEditReason] = useState("");
  const [submittingEditRequest, setSubmittingEditRequest] = useState(false);
  const [flaggingArticle, setFlaggingArticle] = useState<Article | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [flagInstructions, setFlagInstructions] = useState<string>("");
  const [teamMembers, setTeamMembers] = useState<{ id: number; name: string; email: string }[]>([]);
  const [submittingFlag, setSubmittingFlag] = useState(false);
  const [selectedRemarks, setSelectedRemarks] = useState<{ writer: string; linker: string; productName: string } | null>(null);
  const [selectedArticleIds, setSelectedArticleIds] = useState<number[]>([]);
  const [bulkApproving, setBulkApproving] = useState(false);
  const { data: session, status: sessionStatus } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isManager = currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "TEAM_LEAD";

  const fetchArticlesList = async () => {
    const uid = session?.user?.id || currentUserId;
    if (!uid) return;
    try {
      const res = await fetch(`/api/articles?userId=${uid}`);
      const data = await res.json();
      if (Array.isArray(data)) setArticles(data);
    } catch {
      // ignore
    }
  };

  const handleSendEditRequest = async () => {
    if (!requestingUpdateArticle || !requestEditReason.trim() || !currentUserId) return;
    setSubmittingEditRequest(true);
    try {
      const res = await fetch(`/api/articles/${requestingUpdateArticle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specialApprovalRequested: true,
          specialApprovalRequestReason: requestEditReason.trim(),
          callerId: currentUserId,
        }),
      });
      if (res.ok) {
        toast.success("Edit request submitted to Team Lead for approval!");
        setRequestingUpdateArticle(null);
        setRequestEditReason("");
        fetchArticlesList();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to submit edit request");
      }
    } catch {
      toast.error("Failed to submit edit request");
    } finally {
      setSubmittingEditRequest(false);
    }
  };

  const handleFlagApprovedArticle = async () => {
    if (!flaggingArticle || !selectedAssignee || !currentUserId) return;
    setSubmittingFlag(true);
    try {
      const res = await fetch(`/api/articles/${flaggingArticle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flagForUpdate: true,
          writerId: Number(selectedAssignee),
          status: "IN_PROGRESS",
          suggestion: flagInstructions.trim(),
          callerId: currentUserId,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const assignedUser = teamMembers.find((m) => m.id === Number(selectedAssignee));
      toast.success(`Flag raised! Article unlocked and assigned to ${assignedUser?.name || "writer"} for update.`);
      setFlaggingArticle(null);
      setFlagInstructions("");
      setSelectedAssignee("");
      fetchArticlesList();
    } catch (e: any) {
      toast.error(e.message || "Failed to flag article for update");
    } finally {
      setSubmittingFlag(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedArticleIds.length === 0 || bulkApproving) return;
    setBulkApproving(true);
    try {
      const promises = selectedArticleIds.map((articleId) =>
        fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            articleId,
            reviewedById: currentUserId,
            approved: true,
            suggestion: "Bulk approved by Team Lead",
          }),
        }).then((r) => r.json())
      );

      await Promise.all(promises);
      toast.success(`Successfully approved ${selectedArticleIds.length} article(s)!`);
      setSelectedArticleIds([]);
      const stored = session?.user?.id || currentUserId;
      if (stored) {
        const res = await fetch(`/api/articles?userId=${stored}`);
        const data = await res.json();
        if (Array.isArray(data)) setArticles(data);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to bulk approve articles");
    } finally {
      setBulkApproving(false);
    }
  };

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

    if (uRole === "TEAM_LEAD") {
      fetch(`/api/team-members?userId=${stored}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setTeamMembers(data.map((m: any) => ({ id: m.id, name: m.name, email: m.email })));
          }
        })
        .catch(() => {});
    } else if (uRole === "ADMIN" || uRole === "SUPER_ADMIN") {
      fetch(`/api/users`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setTeamMembers(
              data.filter((u: any) => u.role === "WRITER").map((m: any) => ({ id: m.id, name: m.name, email: m.email }))
            );
          }
        })
        .catch(() => {});
    }

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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 py-3 px-2 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-400">
          Showing {filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}
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
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer"
            title="Previous Page"
          >
            &lt;
          </button>

          {start > 1 && (
            <button
              onClick={() => setCurrentPage(start - 1)}
              className="text-xs font-bold text-slate-400 hover:text-[#6D8196] px-1 cursor-pointer"
              title="Previous 5 Pages"
            >
              ...
            </button>
          )}

          {pages.map(p => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentPage === p 
                  ? "bg-[#6D8196] text-white border border-[#6D8196] shadow-xs" 
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          ))}

          {end < totalPages && (
            <button
              onClick={() => setCurrentPage(end + 1)}
              className="text-xs font-bold text-slate-400 hover:text-[#6D8196] px-1 cursor-pointer"
              title="Next 5 Pages"
            >
              ...
            </button>
          )}

          <button 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer"
            title="Next Page"
          >
            &gt;
          </button>
          <button 
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="px-2.5 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer"
            title="Last Page"
          >
            Last
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

  if (!mounted || sessionStatus === "loading") {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] flex items-center justify-center" suppressHydrationWarning>
        <LoadingScreen
          message="Loading articles studio..."
          subtext="Fetching editorial pipeline & review status"
          size="md"
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] text-[#4A4A4A]" suppressHydrationWarning>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#4A4A4A] tracking-tight">Articles</h1>
          <p className="text-[#737373] text-sm mt-0.5 font-medium">All article submissions and their statuses</p>
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

      {/* Tabs Selector for Articles */}
      <div className="flex border-b border-[#CBCBCB]/60 mb-5 gap-2">
        <button
          onClick={() => {
            setWriterFilter("");
            setStatusFilter("");
            setCurrentPage(1);
          }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            !writerFilter && !statusFilter
              ? "border-[#6D8196] text-[#6D8196] font-bold"
              : "border-transparent text-slate-500 hover:text-[#4A4A4A]"
          }`}
        >
          All Articles
        </button>

        {currentUserRole === "TEAM_LEAD" && (
          <button
            onClick={() => {
              setWriterFilter("");
              setStatusFilter("COMPLETED");
              setCurrentPage(1);
            }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === "COMPLETED" && !writerFilter
                ? "border-[#6D8196] text-[#6D8196] font-bold"
                : "border-transparent text-slate-500 hover:text-[#4A4A4A]"
            }`}
          >
            <span>Check Articles</span>
            {articles.filter((a) => a.status === "COMPLETED").length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 rounded-full">
                {articles.filter((a) => a.status === "COMPLETED").length}
              </span>
            )}
          </button>
        )}


        {session?.user?.name && (
          <button
            onClick={() => {
              setWriterFilter(session.user.name || "");
              setStatusFilter("");
              setCurrentPage(1);
            }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              writerFilter === session.user.name && !statusFilter
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-[#4A4A4A]"
            }`}
          >
            <span>My Articles</span>
            {articles.filter((a) => a.writer?.id === currentUserId || a.writer?.name === session?.user?.name).length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 rounded-full">
                {articles.filter((a) => a.writer?.id === currentUserId || a.writer?.name === session?.user?.name).length}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => {
            setStatusFilter("IN_PROGRESS");
            setCurrentPage(1);
          }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            statusFilter === "IN_PROGRESS"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-[#4A4A4A]"
          }`}
        >
          In Progress
        </button>

        <button
          onClick={() => {
            setStatusFilter("COMPLETED");
            setCurrentPage(1);
          }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            statusFilter === "COMPLETED"
              ? "border-emerald-600 text-emerald-600 font-bold"
              : "border-transparent text-slate-500 hover:text-[#4A4A4A]"
          }`}
        >
          Completed
        </button>

        <button
          onClick={() => {
            setStatusFilter("REDO");
            setCurrentPage(1);
          }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            statusFilter === "REDO"
              ? "border-rose-600 text-rose-600 font-bold"
              : "border-transparent text-slate-500 hover:text-[#4A4A4A]"
          }`}
        >
          Revisions
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex items-center gap-3 mt-4 mb-2">
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
        <CustomSelect
          value={statusFilter}
          onChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}
          placeholder="All Statuses"
          className="min-w-[130px]"
          options={[
            { value: "", label: "All Statuses" },
            { value: "PENDING", label: "Pending" },
            { value: "IN_PROGRESS", label: "In Progress" },
            { value: "COMPLETED", label: "Completed" },
            { value: "APPROVED", label: "Approved" },
            { value: "REDO", label: "Redo / Needs Changes" },
          ]}
        />

        {/* Writer Filter */}
        <CustomSelect
          value={writerFilter}
          onChange={(val) => { setWriterFilter(val); setCurrentPage(1); }}
          placeholder="All Writers"
          className="min-w-[130px]"
          options={[
            { value: "", label: "All Writers" },
            ...uniqueWriters.map((w) => ({ value: w, label: w })),
          ]}
        />

        {/* Site Filter */}
        <CustomSelect
          value={siteFilter}
          onChange={(val) => { setSiteFilter(val); setCurrentPage(1); }}
          placeholder="All Sites"
          className="min-w-[130px]"
          options={[
            { value: "", label: "All Sites" },
            ...uniqueSites.map((s) => ({ value: s, label: s })),
          ]}
        />
      </div>

      {/* Bulk Actions Bar */}
      {selectedArticleIds.length > 0 && isManager && (
        <div className="mb-4 p-3.5 bg-white border border-[#6D8196]/40 rounded-2xl flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full bg-[#6D8196] text-white text-xs font-bold shadow-2xs">
              {selectedArticleIds.length}
            </span>
            <span className="text-xs font-bold text-[#4A4A4A]">article(s) selected for review</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedArticleIds([])}
              className="px-3 py-1.5 text-xs font-bold text-[#737373] hover:text-[#4A4A4A] transition cursor-pointer"
            >
              Clear Selection
            </button>
            <button
              onClick={handleBulkApprove}
              disabled={bulkApproving}
              className="px-4 py-2 bg-[#6D8196] hover:bg-[#5A6D81] text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4" />
              {bulkApproving ? "Approving..." : `Approve Selected (${selectedArticleIds.length})`}
            </button>
          </div>
        </div>
      )}

      {/* Table Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-4">
        {loading ? (
          <div className="py-12">
            <LoadingScreen
              message="Loading articles queue..."
              subtext="Synchronizing drafts, submissions, and editorial review statuses"
              size="md"
            />
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
                  {isManager && (
                    <th className="px-3 py-3 w-[4%] text-center">
                      <input
                        type="checkbox"
                        checked={
                          paginated.length > 0 &&
                          paginated.filter((a: any) => a.status !== "APPROVED").length > 0 &&
                          paginated
                            .filter((a: any) => a.status !== "APPROVED")
                            .every((a: any) => selectedArticleIds.includes(a.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            const eligibleIds = paginated
                              .filter((a: any) => a.status !== "APPROVED")
                              .map((a: any) => a.id);
                            setSelectedArticleIds((prev) => Array.from(new Set([...prev, ...eligibleIds])));
                          } else {
                            const pageIds = paginated.map((a: any) => a.id);
                            setSelectedArticleIds((prev) => prev.filter((id) => !pageIds.includes(id)));
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-[#6D8196] focus:ring-[#6D8196] cursor-pointer"
                        title="Select all unapproved on current page"
                      />
                    </th>
                  )}
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
                  const isSelected = selectedArticleIds.includes(a.id);
                  
                  return (
                    <tr key={a.id} className={`hover:bg-slate-50/50 transition-colors group ${isSelected ? "bg-[#FAF9F5]" : ""}`}>
                      {isManager && (
                        <td className="px-3 py-3.5 text-center">
                          {a.status !== "APPROVED" ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedArticleIds((prev) =>
                                  prev.includes(a.id) ? prev.filter((id) => id !== a.id) : [...prev, a.id]
                                );
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-[#6D8196] focus:ring-[#6D8196] cursor-pointer"
                            />
                          ) : (
                            <span className="text-emerald-600 font-bold text-xs" title="Already Approved">✓</span>
                          )}
                        </td>
                      )}
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
                      {(currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "TEAM_LEAD" || currentUserRole === "WRITER") && (
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* If current user is the assigned writer of this article */}
                            {a.writer?.id === currentUserId && (
                              <>
                                {status === "IN_PROGRESS" && (
                                  <button
                                    onClick={() => {
                                      setUpdatingArticle(a);
                                      setUpdateLink(a.articleLink || "");
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#6D8196]/30 bg-[#6D8196]/15 text-[#3D4F61] hover:bg-[#6D8196]/25 transition-all text-[11px] font-bold whitespace-nowrap cursor-pointer shadow-2xs"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    Update
                                  </button>
                                )}
                                {status === "REDO" && (
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

                                {/* Approved / Completed article edit request flow for assigned writer */}
                                {(status === "APPROVED" || status === "COMPLETED") && (
                                  <>
                                    {a.specialApprovalRequested ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                                        <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                                        Edit Requested (Pending TL)
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setRequestingUpdateArticle(a);
                                          setRequestEditReason("");
                                        }}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all text-[11px] font-bold whitespace-nowrap cursor-pointer shadow-2xs"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Request Edit
                                      </button>
                                    )}
                                  </>
                                )}
                              </>
                            )}

                            {/* Write button for PENDING articles: ONLY for regular WRITERS */}
                            {status === "PENDING" && currentUserRole === "WRITER" && (!a.writer || a.writer.id === currentUserId) && (
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
                                      toast.success("Started writing! Redirecting to workspace...");
                                      router.push("/?tab=write");
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
                                    ? "bg-[#6D8196] text-white hover:bg-[#5A6D81] cursor-pointer shadow-xs"
                                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                }`}
                              >
                                <PlayCircle className="w-3.5 h-3.5" />
                                Write
                              </button>
                            )}

                            {/* Manager Actions (Super Admin, Admin, Team Lead) */}
                            {(currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "TEAM_LEAD") && (
                              <>
                                {a.specialApprovalRequested && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        const res = await fetch("/api/approvals", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({
                                            articleId: a.id,
                                            reason: a.specialApprovalRequestReason || "Approved edit request",
                                            action: "APPROVE",
                                          }),
                                        });
                                        if (!res.ok) throw new Error("Failed to approve update request");
                                        toast.success(`Unlocked article for ${a.writer?.name || "writer"} to edit!`);
                                        fetchArticlesList();
                                      } catch (e: any) {
                                        toast.error(e.message || "Failed to approve update");
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-all text-[11px] font-bold whitespace-nowrap cursor-pointer shadow-2xs"
                                    title={a.specialApprovalRequestReason ? `Writer note: "${a.specialApprovalRequestReason}"` : "Approve writer's edit request"}
                                  >
                                    <Check className="w-3 h-3 stroke-[3]" />
                                    Approve Edit
                                  </button>
                                )}

                                {/* Flag for Update: on APPROVED articles only, Team Lead can assign a writer to update it */}
                                {status === "APPROVED" && (
                                  <button
                                    onClick={() => {
                                      setFlaggingArticle(a);
                                      setSelectedAssignee(a.writer ? String(a.writer.id) : "");
                                      setFlagInstructions("");
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:border-amber-300 transition-all text-[11px] font-bold whitespace-nowrap cursor-pointer shadow-2xs"
                                    title="Raise flag to writer that this approved article needs an update"
                                  >
                                    <Flag className="w-3.5 h-3.5 text-amber-600" />
                                    Flag for Update
                                  </button>
                                )}

                                <Link
                                  href={`/articles/${a.id}-${generateSlug(a.product.name)}`}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#CBCBCB] bg-white text-[#4A4A4A] hover:text-[#6D8196] hover:border-[#6D8196] hover:bg-[#FAF9F5] transition-all text-[11px] font-semibold whitespace-nowrap cursor-pointer shadow-2xs"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Review
                                </Link>
                              </>
                            )}

                            {/* Locked indicator for Writers when not their article */}
                            {currentUserRole === "WRITER" && a.writer?.id !== currentUserId && (status === "IN_PROGRESS" || status === "REDO" || status === "COMPLETED" || status === "APPROVED") && (
                              <span className="text-[11px] font-medium text-slate-400">Locked</span>
                            )}
                          </div>
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
                  Updated Article Link <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  value={updateLink}
                  onChange={(e) => setUpdateLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                />
              </div>

              {currentUserRole === "WRITER" && updatingArticle.status !== "REDO" && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    Reason for Update <span className="text-rose-500">* (Admin / Super Admin Approval Required)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={updateReason}
                    onChange={(e) => setUpdateReason(e.target.value)}
                    placeholder="Provide a clear reason why this article link is being updated..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition resize-none font-medium"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setUpdatingArticle(null); setUpdateLink(""); setUpdateReason(""); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  disabled={submittingUpdate || !updateLink.trim() || (currentUserRole === "WRITER" && updatingArticle.status !== "REDO" && !updateReason.trim())}
                  onClick={async () => {
                    if (!updateLink.trim() || !currentUserId) return;
                    const isWriterRequestingUpdate = currentUserRole === "WRITER" && updatingArticle.status !== "REDO";
                    if (isWriterRequestingUpdate && !updateReason.trim()) {
                      toast.error("Please provide a reason for the update.");
                      return;
                    }
                    setSubmittingUpdate(true);
                    try {
                      const res = await fetch(`/api/articles/${updatingArticle.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          articleLink: updateLink,
                          ...(isWriterRequestingUpdate ? {
                            specialApprovalRequested: true,
                            specialApprovalRequestReason: updateReason.trim(),
                            notes: `Requested update approval: ${updateReason.trim()}`
                          } : {
                            status: "COMPLETED",
                          }),
                          callerId: currentUserId,
                        }),
                      });
                      if (!res.ok) {
                        const d = await res.json();
                        toast.error(d.error || "Failed to update article.");
                        return;
                      }
                      toast.success(
                        isWriterRequestingUpdate
                          ? "Update request submitted! Admin/SuperAdmin approval pending."
                          : "Article updated successfully!"
                      );
                      setUpdatingArticle(null);
                      setUpdateLink("");
                      setUpdateReason("");
                      // Refresh articles list
                      const refreshed = await fetch(`/api/articles?userId=${currentUserId}`).then(r => r.json());
                      setArticles(Array.isArray(refreshed) ? refreshed : []);
                    } catch {
                      toast.error("Something went wrong.");
                    } finally {
                      setSubmittingUpdate(false);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submittingUpdate ? "Submitting..." : (currentUserRole === "WRITER" && updatingArticle.status !== "REDO") ? "Request Approval" : "Submit Update"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Edit Permission Modal on Approved Article */}
      {requestingUpdateArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-indigo-600" />
                  Request Edit on Approved Article
                </h3>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Team Lead permission required to reopen approved articles
                </p>
              </div>
              <button
                onClick={() => {
                  setRequestingUpdateArticle(null);
                  setRequestEditReason("");
                }}
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Article</span>
                <p className="text-xs font-bold text-slate-900 mt-0.5">{requestingUpdateArticle.product.name}</p>
                <p className="text-[11px] text-slate-500 font-medium">{requestingUpdateArticle.product.site.name}</p>
              </div>

              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-relaxed font-medium">
                Once submitted, your Team Lead will receive this request. Once approved by your Team Lead, this article will be unlocked so you can make and resubmit the necessary revisions.
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Reason for Update / Changes Needed <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={requestEditReason}
                  onChange={(e) => setRequestEditReason(e.target.value)}
                  placeholder="Explain why this approved article needs updating (e.g. broken link, product detail correction, new guidelines)..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition resize-none font-medium placeholder-slate-400"
                />
              </div>

              <div className="flex gap-2.5 pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setRequestingUpdateArticle(null);
                    setRequestEditReason("");
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendEditRequest}
                  disabled={submittingEditRequest || !requestEditReason.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-[#6D8196] hover:bg-[#5A6D81] text-white font-bold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                >
                  {submittingEditRequest ? "Submitting..." : "Send Request to TL"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flag Approved Article for Update Modal */}
      {flaggingArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Flag className="w-4 h-4 text-amber-600" />
                  Flag Approved Article for Update
                </h3>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Raise a flag to writer that this approved article requires revisions
                </p>
              </div>
              <button
                onClick={() => {
                  setFlaggingArticle(null);
                  setSelectedAssignee("");
                  setFlagInstructions("");
                }}
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Product Info */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Article</span>
                <p className="text-sm font-bold text-slate-900">{flaggingArticle.product.name}</p>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px] font-bold text-slate-700">
                    {flaggingArticle.product.site.name}
                  </span>
                  <span>·</span>
                  <span>Original Writer: <strong className="text-slate-700">{flaggingArticle.writer?.name || "Unassigned"}</strong></span>
                </div>
              </div>

              {/* Writer Assignment */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Assign Update To Writer <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  <option value="">-- Choose Writer --</option>
                  {flaggingArticle.writer && !teamMembers.some((m) => m.id === flaggingArticle.writer?.id) && (
                    <option value={flaggingArticle.writer.id}>
                      {flaggingArticle.writer.name} (Original Author)
                    </option>
                  )}
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} {flaggingArticle.writer?.id === member.id ? "(Original Author)" : `(${member.email})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Instructions / Reason for Update */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Update Instructions & Feedback <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={flagInstructions}
                  onChange={(e) => setFlagInstructions(e.target.value)}
                  placeholder="Specify what needs to be updated (e.g. broken article link, price changes, client requests new GEO link)..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition resize-none font-medium placeholder-slate-400"
                />
              </div>

              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 leading-relaxed font-medium">
                This will unlock the article back to <strong>In Progress</strong> for the selected writer, log your instructions, and notify them immediately.
              </div>

              <div className="flex gap-2.5 pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setFlaggingArticle(null);
                    setSelectedAssignee("");
                    setFlagInstructions("");
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFlagApprovedArticle}
                  disabled={submittingFlag || !selectedAssignee || !flagInstructions.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                >
                  {submittingFlag ? "Raising Flag..." : "Raise Flag & Unlock"}
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
