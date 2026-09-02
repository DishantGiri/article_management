"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  ExternalLink,
  Search,
  ArrowLeft,
  Calendar,
  User,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileText,
  Tag,
  ChevronRight,
  Sparkles,
  Layers,
  ArrowUpRight,
  Filter,
  X,
} from "lucide-react";
import SiteLogo from "@/components/SiteLogo";
import LoadingScreen from "@/components/LoadingScreen";
import DateRangePicker from "@/components/DateRangePicker";
import { useSession } from "next-auth/react";

interface SiteCategory {
  id: number;
  name: string;
}

interface SiteInfo {
  id: number;
  name: string;
  slug: string;
  url: string | null;
  categories: SiteCategory[];
  createdAt: string;
}

interface SiteStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  redo: number;
}

interface SiteArticle {
  id: number;
  articleName: string;
  articleLink: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "APPROVED" | "REDO";
  writer: {
    id: number;
    name: string;
    email: string;
    role: string;
    image?: string | null;
  } | null;
  dateOfPosting: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  addedAt: string;
  productCategory: string;
  productId: number;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  COMPLETED: {
    label: "Completed",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800/50",
    icon: CheckCircle2,
  },
  APPROVED: {
    label: "Approved",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800/50",
    icon: ShieldCheck,
  },
  IN_PROGRESS: {
    label: "In Progress",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800/50",
    icon: Clock,
  },
  PENDING: {
    label: "Pending",
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-600 dark:text-slate-300",
    border: "border-slate-300 dark:border-slate-700",
    icon: Clock,
  },
  REDO: {
    label: "Redo / Revision",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800/50",
    icon: RotateCcw,
  },
};

export default function SiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();

  const slugParam = Array.isArray(params?.slug) ? params.slug[0] : (params?.slug as string);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [site, setSite] = useState<SiteInfo | null>(null);
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [articles, setArticles] = useState<SiteArticle[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "title-asc">("date-desc");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [datePreset, setDatePreset] = useState<string>("ALL");

  const setPreset = (preset: "ALL" | "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "THIS_MONTH") => {
    setDatePreset(preset);
    const today = new Date();
    const formatDateInput = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    if (preset === "ALL") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "TODAY") {
      const formatted = formatDateInput(today);
      setStartDate(formatted);
      setEndDate(formatted);
    } else if (preset === "YESTERDAY") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const formatted = formatDateInput(y);
      setStartDate(formatted);
      setEndDate(formatted);
    } else if (preset === "LAST_7_DAYS") {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 7);
      setStartDate(formatDateInput(past7));
      setEndDate(formatDateInput(today));
    } else if (preset === "THIS_MONTH") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatDateInput(firstDay));
      setEndDate(formatDateInput(today));
    }
  };

  const clearDateRange = () => {
    setStartDate("");
    setEndDate("");
    setDatePreset("ALL");
  };

  useEffect(() => {
    if (!slugParam) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setAccessDenied(false);

    fetch(`/api/sites/${encodeURIComponent(slugParam)}`)
      .then(async (res) => {
        if (res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          if (isMounted) {
            setAccessDenied(true);
            setError(errData.error || "Access Denied: You are not assigned to this site.");
          }
          return null;
        }

        if (res.status === 404) {
          if (isMounted) setError("Site not found.");
          return null;
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to load site");
        }

        return res.json();
      })
      .then((data) => {
        if (!isMounted || !data) return;
        setSite(data.site);
        setStats(data.stats);
        setArticles(Array.isArray(data.articles) ? data.articles : []);
      })
      .catch((err: any) => {
        if (isMounted) {
          console.error("Error loading site detail:", err);
          setError(err.message || "An unexpected error occurred.");
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [slugParam]);

  // Articles filtered by date range
  const dateFilteredArticles = useMemo(() => {
    return articles.filter((art) => {
      if (!startDate && !endDate) return true;
      const postDateStr = art.dateOfPosting || art.completedAt || art.addedAt;
      if (!postDateStr) return false;
      const d = new Date(postDateStr);
      if (isNaN(d.getTime())) return false;
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (startDate && ymd < startDate) return false;
      if (endDate && ymd > endDate) return false;
      return true;
    });
  }, [articles, startDate, endDate]);

  // Dynamic stats calculated from dateFilteredArticles
  const statsDisplay = useMemo(() => {
    return {
      total: dateFilteredArticles.length,
      completed: dateFilteredArticles.filter((a) => a.status === "COMPLETED" || a.status === "APPROVED").length,
      inProgress: dateFilteredArticles.filter((a) => a.status === "IN_PROGRESS").length,
      pending: dateFilteredArticles.filter((a) => a.status === "PENDING").length,
      redo: dateFilteredArticles.filter((a) => a.status === "REDO").length,
    };
  }, [dateFilteredArticles]);

  // Filtered & Sorted Articles
  const filteredArticles = useMemo(() => {
    return dateFilteredArticles
      .filter((art) => {
        // Status filter: COMPLETED matches both COMPLETED and APPROVED articles
        if (statusFilter !== "ALL") {
          if (statusFilter === "COMPLETED") {
            if (art.status !== "COMPLETED" && art.status !== "APPROVED") return false;
          } else if (art.status !== statusFilter) {
            return false;
          }
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = art.articleName.toLowerCase().includes(q);
          const matchWriter = art.writer?.name?.toLowerCase().includes(q);
          const matchCategory = art.productCategory.toLowerCase().includes(q);
          const matchLink = art.articleLink?.toLowerCase().includes(q);
          if (!matchName && !matchWriter && !matchCategory && !matchLink) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "title-asc") {
          return a.articleName.localeCompare(b.articleName);
        }
        if (sortBy === "date-asc") {
          const dateA = a.dateOfPosting ? new Date(a.dateOfPosting).getTime() : 0;
          const dateB = b.dateOfPosting ? new Date(b.dateOfPosting).getTime() : 0;
          return dateA - dateB;
        }
        // date-desc default
        const dateA = a.dateOfPosting ? new Date(a.dateOfPosting).getTime() : new Date(a.updatedAt).getTime();
        const dateB = b.dateOfPosting ? new Date(b.dateOfPosting).getTime() : new Date(b.updatedAt).getTime();
        return dateB - dateA;
      });
  }, [dateFilteredArticles, statusFilter, searchQuery, sortBy]);

  // Format Date Helper
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] dark:bg-slate-950">
        <LoadingScreen
          message="Loading site articles..."
          subtext="Retrieving article records, writer assignments, and live URLs"
          size="lg"
        />
      </div>
    );
  }

  // Access Denied Screen (for unauthorized Writers and Team Leads)
  if (accessDenied) {
    return (
      <div className="p-6 sm:p-12 max-w-2xl mx-auto min-h-screen flex flex-col items-center justify-center text-center bg-[#FAF9F5] dark:bg-slate-950 text-[#4A4A4A] dark:text-slate-100">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-5 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#4A4A4A] dark:text-white">
          Access Restricted
        </h1>
        <p className="text-sm text-[#737373] dark:text-slate-400 mt-2 max-w-md font-medium leading-relaxed">
          {error || "You are not assigned to view articles for this site. Only administrators and assigned team members have access."}
        </p>
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => router.push("/sites")}
            className="px-5 py-2.5 rounded-xl bg-[#6D8196] hover:bg-[#5A6D81] text-white text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Authorized Sites
          </button>
        </div>
      </div>
    );
  }

  // Site Not Found Error
  if (error || !site) {
    return (
      <div className="p-6 sm:p-12 max-w-2xl mx-auto min-h-screen flex flex-col items-center justify-center text-center bg-[#FAF9F5] dark:bg-slate-950 text-[#4A4A4A] dark:text-slate-100">
        <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-500 flex items-center justify-center mb-5">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#4A4A4A] dark:text-white">
          Site Not Found
        </h1>
        <p className="text-sm text-[#737373] dark:text-slate-400 mt-2 max-w-md font-medium">
          The requested site could not be located. It may have been removed or renamed.
        </p>
        <button
          onClick={() => router.push("/sites")}
          className="mt-6 px-5 py-2.5 rounded-xl bg-[#6D8196] hover:bg-[#5A6D81] text-white text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          View All Sites
        </button>
      </div>
    );
  }

  const roleName = session?.user?.role || "USER";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] dark:bg-slate-950 text-[#4A4A4A] dark:text-slate-100 space-y-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#CBCBCB]/40 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#737373] dark:text-slate-400">
          <Link
            href="/sites"
            className="hover:text-[#4A4A4A] dark:hover:text-white transition flex items-center gap-1.5"
          >
            <Building2 className="w-3.5 h-3.5 text-[#6D8196]" />
            <span>Sites</span>
          </Link>
          <ChevronRight className="w-3 h-3 text-[#CBCBCB] dark:text-slate-600" />
          <span className="text-[#4A4A4A] dark:text-white font-bold">{site.name}</span>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#6D8196]/10 text-[#6D8196] dark:bg-[#6D8196]/30 dark:text-slate-200">
            /{site.slug}
          </span>
        </div>

        <button
          onClick={() => router.push("/sites")}
          className="self-start sm:self-auto px-3 py-1.5 rounded-lg border border-[#CBCBCB]/80 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-[#4A4A4A] dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-slate-800 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#6D8196]" />
          Back to Sites
        </button>
      </div>

      {/* Main Hero Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <SiteLogo url={site.url} name={site.name} className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 shadow-sm" />
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#4A4A4A] dark:text-white">
                  {site.name}
                </h1>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Site ID: #{site.id}
                </span>
                {roleName === "ADMIN" || roleName === "SUPER_ADMIN" ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Admin View (All Sites)
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Assigned Site Access
                  </span>
                )}
              </div>

              {site.url ? (
                <a
                  href={site.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6D8196] hover:text-[#4A4A4A] dark:text-sky-400 dark:hover:text-white hover:underline mt-1.5 transition"
                >
                  <span>{site.url}</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              ) : (
                <p className="text-xs text-[#737373] dark:text-slate-400 mt-1 italic">No domain URL configured</p>
              )}

              {/* Category Pills */}
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                {site.categories && site.categories.length > 0 ? (
                  site.categories.map((cat) => (
                    <span
                      key={cat.id}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FAF9F5] dark:bg-slate-800 text-[#4A4A4A] dark:text-slate-300 border border-[#CBCBCB]/70 dark:border-slate-700 flex items-center gap-1"
                    >
                      <Tag className="w-2.5 h-2.5 text-[#6D8196]" />
                      {cat.name}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-[#737373] dark:text-slate-500 italic">No product categories assigned</span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stat Counter Cards */}
          <div className="grid grid-cols-2 xs:grid-cols-4 gap-2.5 self-stretch md:self-auto shrink-0">
            <div className="p-3 rounded-xl bg-[#FAF9F5] dark:bg-slate-800/60 border border-[#CBCBCB]/50 dark:border-slate-700 text-center">
              <span className="text-lg sm:text-xl font-black text-[#4A4A4A] dark:text-white block">
                {statsDisplay.total}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#737373] dark:text-slate-400">
                Total Articles
              </span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-center">
              <span className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-300 block">
                {statsDisplay.completed}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700/80 dark:text-emerald-400">
                Completed
              </span>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-center">
              <span className="text-lg sm:text-xl font-black text-amber-700 dark:text-amber-300 block">
                {statsDisplay.inProgress}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700/80 dark:text-amber-400">
                Writing
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-100/60 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center">
              <span className="text-lg sm:text-xl font-black text-slate-700 dark:text-slate-300 block">
                {statsDisplay.pending}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Pending
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs space-y-3">
        {/* Row 1: Search & Sort */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#737373] dark:text-slate-400" />
            <input
              type="text"
              placeholder="Search articles by name, writer, or link..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-[#CBCBCB]/80 dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-800/80 text-[#4A4A4A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6D8196]/40 transition"
            />
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#737373] dark:text-slate-400 hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-[#FAF9F5] dark:bg-slate-800 border border-[#CBCBCB]/70 dark:border-slate-700 text-[#4A4A4A] dark:text-white focus:outline-none cursor-pointer shadow-2xs"
            >
              <option value="date-desc">Newest Posted</option>
              <option value="date-asc">Oldest Posted</option>
              <option value="title-asc">Title (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Row 2: Status Filter Tabs & Date Range Filter */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pt-2.5 border-t border-[#CBCBCB]/30 dark:border-slate-800/80">
          {/* Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                statusFilter === "ALL"
                  ? "bg-[#6D8196] text-white shadow-2xs"
                  : "bg-slate-100 dark:bg-slate-800 text-[#737373] dark:text-slate-300 hover:text-[#4A4A4A] dark:hover:text-white"
              }`}
            >
              All ({dateFilteredArticles.length})
            </button>

            {[
              { key: "COMPLETED", label: "Completed", icon: CheckCircle2 },
              { key: "IN_PROGRESS", label: "In Progress", icon: Clock },
              { key: "PENDING", label: "Pending", icon: Clock },
              { key: "REDO", label: "Redo / Revision", icon: RotateCcw },
            ].map(({ key: st, label, icon: Icon }) => {
              const count = dateFilteredArticles.filter((a) => {
                if (st === "COMPLETED") return a.status === "COMPLETED" || a.status === "APPROVED";
                return a.status === st;
              }).length;

              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    statusFilter === st
                      ? "bg-[#6D8196] text-white shadow-2xs"
                      : "bg-slate-100 dark:bg-slate-800 text-[#737373] dark:text-slate-300 hover:text-[#4A4A4A] dark:hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                  {count > 0 && <span className="opacity-70 text-[10px]">({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Date Range Picker & Presets */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Quick Presets */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl text-[11px] font-bold">
              <button
                onClick={() => setPreset("ALL")}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  datePreset === "ALL" && !startDate && !endDate
                    ? "bg-white dark:bg-slate-700 text-[#4A4A4A] dark:text-white shadow-2xs"
                    : "text-[#737373] dark:text-slate-400 hover:text-[#4A4A4A]"
                }`}
              >
                All Dates
              </button>
              <button
                onClick={() => setPreset("TODAY")}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  datePreset === "TODAY"
                    ? "bg-white dark:bg-slate-700 text-[#4A4A4A] dark:text-white shadow-2xs"
                    : "text-[#737373] dark:text-slate-400 hover:text-[#4A4A4A]"
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setPreset("YESTERDAY")}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  datePreset === "YESTERDAY"
                    ? "bg-white dark:bg-slate-700 text-[#4A4A4A] dark:text-white shadow-2xs"
                    : "text-[#737373] dark:text-slate-400 hover:text-[#4A4A4A]"
                }`}
              >
                Yesterday
              </button>
              <button
                onClick={() => setPreset("LAST_7_DAYS")}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  datePreset === "LAST_7_DAYS"
                    ? "bg-white dark:bg-slate-700 text-[#4A4A4A] dark:text-white shadow-2xs"
                    : "text-[#737373] dark:text-slate-400 hover:text-[#4A4A4A]"
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setPreset("THIS_MONTH")}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  datePreset === "THIS_MONTH"
                    ? "bg-white dark:bg-slate-700 text-[#4A4A4A] dark:text-white shadow-2xs"
                    : "text-[#737373] dark:text-slate-400 hover:text-[#4A4A4A]"
                }`}
              >
                This Month
              </button>
            </div>

            {/* Custom Date Range Picker */}
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(start, end) => {
                setStartDate(start);
                setEndDate(end);
                setDatePreset(start && end ? "CUSTOM" : "ALL");
              }}
              placeholder="Select Date Range"
              align="right"
            />
          </div>
        </div>

        {/* Active Date Filter Notice Banner */}
        {(startDate || endDate) && (
          <div className="pt-2 flex items-center justify-between text-xs bg-blue-50/70 dark:bg-blue-950/30 px-3 py-1.5 rounded-lg border border-blue-200/60 dark:border-blue-900/40 text-blue-800 dark:text-blue-300 font-semibold">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#6D8196]" />
              <span>
                Filtering articles posted between{" "}
                <span className="font-bold underline">{startDate || "Beginning"}</span> and{" "}
                <span className="font-bold underline">{endDate || "Today"}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-[11px] font-bold">
                {filteredArticles.length} matching
              </span>
            </div>
            <button
              onClick={clearDateRange}
              className="text-[11px] font-bold hover:underline text-blue-700 dark:text-blue-300 flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3 h-3" />
              Clear Date Filter
            </button>
          </div>
        )}
      </div>

      {/* Articles Table & List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs overflow-hidden">
        {filteredArticles.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#6D8196]/15 dark:bg-[#6D8196]/30 text-[#3D4F61] dark:text-slate-200 flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6 text-[#6D8196] dark:text-slate-200" />
            </div>
            <h3 className="text-sm font-bold text-[#4A4A4A] dark:text-white">No Articles Found</h3>
            <p className="text-xs text-[#737373] dark:text-slate-400 mt-1 font-medium max-w-sm mx-auto">
              {searchQuery
                ? `No articles match the query "${searchQuery}".`
                : statusFilter !== "ALL"
                ? `No ${statusFilter === "COMPLETED" ? "completed" : statusFilter.toLowerCase().replace("_", " ")} articles found for this site${startDate || endDate ? " in the selected date range" : ""}.`
                : "No articles have been assigned or created for this site yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#CBCBCB]/60 dark:border-slate-800 bg-[#FAF9F5] dark:bg-slate-850/60 text-[11px] font-bold uppercase tracking-wider text-[#737373] dark:text-slate-400">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Article Name / Product</th>
                  <th className="py-3 px-4">Article Link</th>
                  <th className="py-3 px-4">Writer</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Date of Posting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CBCBCB]/40 dark:divide-slate-800 text-xs">
                {filteredArticles.map((art, idx) => {
                  const statusConf = STATUS_CONFIG[art.status] || STATUS_CONFIG.PENDING;
                  const StatusIcon = statusConf.icon;
                  const postingDateFormatted = formatDateTime(art.dateOfPosting);

                  return (
                    <tr
                      key={art.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      {/* Index */}
                      <td className="py-3.5 px-4 text-center text-[#737373] dark:text-slate-400 font-semibold">
                        {idx + 1}
                      </td>

                      {/* Article Name / Product */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-[#4A4A4A] dark:text-white text-sm">
                            {art.articleName}
                          </span>
                          <div className="flex items-center gap-2 flex-wrap text-[11px]">
                            <span className="text-[#6D8196] dark:text-sky-400 font-medium flex items-center gap-1">
                              <Tag className="w-3 h-3" />
                              {art.productCategory}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">&bull;</span>
                            <span className="text-slate-400 dark:text-slate-500">
                              Product ID #{art.productId}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Article Link */}
                      <td className="py-3.5 px-4">
                        {art.articleLink ? (
                          <a
                            href={art.articleLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition group max-w-[260px]"
                            title={art.articleLink}
                          >
                            <span className="truncate">{art.articleLink.replace(/^https?:\/\//, "")}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 italic">
                            Not posted yet
                          </span>
                        )}
                      </td>

                      {/* Writer Name */}
                      <td className="py-3.5 px-4">
                        {art.writer ? (
                          <div className="flex items-center gap-2">
                            {art.writer.image ? (
                              <img
                                src={art.writer.image}
                                alt={art.writer.name}
                                className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-[#6D8196]/15 dark:bg-[#6D8196]/30 text-[#3D4F61] dark:text-slate-200 font-bold flex items-center justify-center text-xs">
                                {art.writer.name.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-[#4A4A4A] dark:text-slate-200 leading-none">
                                {art.writer.name}
                              </p>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 capitalize">
                                {art.writer.role.toLowerCase().replace("_", " ")}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic font-medium flex items-center gap-1">
                            <User className="w-3.5 h-3.5 opacity-50" />
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusConf.label}
                        </span>
                      </td>

                      {/* Date of Posting */}
                      <td className="py-3.5 px-4 text-right">
                        {postingDateFormatted ? (
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-[#4A4A4A] dark:text-slate-200 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-[#6D8196]" />
                              {postingDateFormatted}
                            </span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              Posted / Completed
                            </span>
                          </div>
                        ) : art.startedAt ? (
                          <div className="flex flex-col items-end">
                            <span className="text-slate-600 dark:text-slate-300 font-medium">
                              Started {formatDate(art.startedAt)}
                            </span>
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              In Writing
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 italic font-medium">
                            Pending Posting
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer Total Summary */}
        <div className="px-5 py-3.5 bg-[#FAF9F5] dark:bg-slate-850 border-t border-[#CBCBCB]/50 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-[#737373] dark:text-slate-400">
          <span>
            Showing {filteredArticles.length} of {articles.length} articles
          </span>
          <span className="text-[#6D8196] dark:text-sky-400">
            Total Articles on {site.name}: {articles.length}
          </span>
        </div>
      </div>
    </div>
  );
}
