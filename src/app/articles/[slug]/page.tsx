/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  LayoutGrid,
  Globe,
  ExternalLink,
  Copy,
  Clock,
  CheckCircle2,
  Flag,
  Lock,
  Shield,
  User,
  Calendar,
  ArrowLeft,
  AlertTriangle,
  Flame,
  Check,
  X,
  TrendingUp,
  Tag,
  Link as LinkIcon,
  MessageSquare,
  History as HistoryIcon,
  PenTool,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import LoadingScreen from "@/components/LoadingScreen";
import FormattedRemarks, { formatRemarkDate } from "@/components/FormattedRemarks";

interface Article {
  id: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "APPROVED" | "REDO";
  articleLink?: string;
  startedAt?: string;
  completedAt?: string;
  writingTimeMin?: number;
  updateTimeMin?: number;
  productCreatedAt?: string;
  updatedAt: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  specialApprovalRequested?: boolean;
  specialApprovalRequestReason?: string;
  product: {
    id: number;
    name: string;
    trendLink?: string;
    previewLink?: string;
    remarks?: string;
    productCategory?: string;
    trendLevel?: string;
    site: { id: number; name: string };
    category: { id: number; name: string };
    addedBy: { name: string };
    addedAt: string;
    linkLogs: {
      id: number;
      affiliateName: string;
      affiliateLink: string;
      bridgePageLink?: string;
      buyLink?: string;
      status: string;
      linkerRemarks?: string;
      geos: { geo: string }[];
      addedBy: { name: string };
      addedAt: string;
    }[];
  };
  writer?: { id: number; name: string; email?: string; image?: string };
  reviews: {
    id: number;
    suggestion?: string;
    approved: boolean;
    reviewedBy: { id: number; name: string };
    reviewedAt: string;
  }[];
  specialApproval?: { reason: string; approvedBy: { name: string }; approvedAt: string };
  history: {
    id: number;
    notes: string;
    oldStatus?: string;
    newStatus?: string;
    updatedAt: string;
    updatedBy: { id: number; name: string };
  }[];
}

const ensureExternalUrl = (url: string | null | undefined) => {
  if (!url) return "";
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const getInitials = (name?: string) => {
  if (!name) return "??";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
};

export default function ArticleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const id = parseInt(resolvedParams.slug.split("-")[0]);
  const router = useRouter();

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [remark, setRemark] = useState("");
  const [redoPriority, setRedoPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [editLinkMode, setEditLinkMode] = useState(false);
  const [newLinkValue, setNewLinkValue] = useState("");
  const [updateReason, setUpdateReason] = useState("");
  const [updatingLink, setUpdatingLink] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [submittingFlag, setSubmittingFlag] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user?.id) return;
    const uId = session.user.id;
    setCurrentUserId(uId);
    const uRole = session.user.role || "WRITER";
    setCurrentUserRole(uRole);

    if (uRole === "WRITER" || uRole === "LINKER") {
      router.push("/");
      return;
    }

      fetch(`/api/articles/${id}?userId=${uId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) {
            setError(data.error);
            setArticle(null);
          } else {
            setArticle(data);
            if (data.priority) {
              setRedoPriority(data.priority);
            }
          }
        })
        .catch(() => setError("Failed to fetch article details"))
        .finally(() => setLoading(false));
    }, [id, router, session?.user?.id]);

  useEffect(() => {
    if (article?.articleLink) {
      setNewLinkValue(article.articleLink);
    }
  }, [article?.articleLink]);

  useEffect(() => {
    if (article?.priority) {
      setRedoPriority(article.priority);
    }
  }, [article?.priority]);

  const handleSetRedoPriority = async (newPriority: "LOW" | "MEDIUM" | "HIGH") => {
    setRedoPriority(newPriority);
    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority, callerId: currentUserId }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update priority");
      }
      setArticle((prev) => (prev ? { ...prev, priority: newPriority } : prev));
      toast.success(`Priority updated to ${newPriority === "HIGH" ? "High" : newPriority === "MEDIUM" ? "Medium" : "Low"}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update priority");
    }
  };

  const handleReviewSubmit = async (approved: boolean) => {
    if (!article) return;

    // Workflow validation rule: one text one time
    if (article.status === "PENDING") {
      toast.error("Cannot review an article that has not been started yet.");
      return;
    }
    if (article.status === "IN_PROGRESS") {
      toast.error("Cannot review while the writer is actively drafting. Please wait for completion.");
      return;
    }
    if (article.status === "REDO") {
      toast.error("A revision has already been requested. Please wait for the writer to fix the article and resubmit.");
      return;
    }

    if (!remark.trim() && !approved) {
      setError("Please provide feedback remarks when requesting a redo.");
      toast.error("Feedback remarks are required when requesting a redo.");
      return;
    }

    setSubmittingReview(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: article.id,
          reviewedById: currentUserId,
          suggestion: remark.trim(),
          approved,
          priority: redoPriority,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit review");

      const successMsg = approved
        ? "Article approved successfully!"
        : "Redo request submitted! The writer has been notified to fix the article.";
      setSuccess(successMsg);
      toast.success(successMsg);
      setRemark("");

      // Refresh article data
      const refreshRes = await fetch(`/api/articles/${id}?userId=${currentUserId}`);
      const freshData = await refreshRes.json();
      if (!refreshRes.ok) throw new Error(freshData.error);
      setArticle(freshData);
      if (freshData.priority) {
        setRedoPriority(freshData.priority);
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit review");
      toast.error(err.message || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleFlagForUpdate = async () => {
    if (!article || !flagReason.trim() || !currentUserId) return;
    setSubmittingFlag(true);
    try {
      const targetWriterId = article.writer?.id || currentUserId;
      const res = await fetch(`/api/articles/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flagForUpdate: true,
          writerId: targetWriterId,
          status: "IN_PROGRESS",
          suggestion: flagReason.trim(),
          callerId: currentUserId,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Flag raised! Article unlocked and assigned for update.");
      setShowFlagModal(false);
      setFlagReason("");
      const ref = await fetch(`/api/articles/${id}?userId=${currentUserId}`);
      const data = await ref.json();
      if (!data.error) setArticle(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to flag article for update");
    } finally {
      setSubmittingFlag(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F5]">
        <LoadingScreen
          message="Loading article workspace..."
          subtext="Fetching editorial metadata, tracking details & review history"
          size="md"
        />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="p-8 max-w-xl mx-auto my-20 text-center bg-white rounded-2xl border border-rose-200 shadow-sm">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900">Article Access Denied or Not Found</h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          This article record could not be found or you do not have permission to view it.
        </p>
        <button
          onClick={() => router.push("/articles")}
          className="px-4 py-2 bg-[#6D8196] text-white rounded-xl text-xs font-bold hover:bg-[#5A6D81] transition cursor-pointer"
        >
          Return to Articles
        </button>
      </div>
    );
  }

  const { product } = article;
  const isManager =
    currentUserRole === "TEAM_LEAD" ||
    currentUserRole === "ADMIN" ||
    currentUserRole === "SUPER_ADMIN";

  // Latest review (for showing last feedback)
  const latestReview = article.reviews && article.reviews.length > 0 ? article.reviews[0] : null;

  // Extract writer remarks from history
  const writerRemarkHistoryItem = article.history?.find((h) => h.notes?.includes("Writer remarks:"));
  const writerRemarks = writerRemarkHistoryItem?.notes?.split("Writer remarks:")?.[1]?.trim() || "";
  const writerRemarksDate = writerRemarkHistoryItem?.updatedAt || article.updatedAt;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto min-h-screen bg-[#FAF9F5] dark:bg-slate-950 text-[#4A4A4A] dark:text-slate-100 space-y-6">
      {/* ─── TOP ACTION BAR ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-[#CBCBCB] dark:border-slate-800 hover:border-[#6D8196] dark:hover:border-[#6D8196] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <Link href="/articles" className="hover:text-slate-700 dark:hover:text-slate-200 transition">Articles</Link>
            <span>/</span>
            <span className="text-slate-700 dark:text-slate-100 font-bold truncate max-w-[200px] sm:max-w-none">{product.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <span
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs border ${article.status === "IN_PROGRESS"
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : article.status === "REDO"
                  ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                  : article.status === "APPROVED"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : article.status === "COMPLETED"
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${article.status === "IN_PROGRESS"
                  ? "bg-blue-500 animate-pulse"
                  : article.status === "REDO"
                    ? "bg-rose-500 animate-ping"
                    : article.status === "APPROVED"
                      ? "bg-emerald-500"
                      : article.status === "COMPLETED"
                        ? "bg-indigo-500"
                        : "bg-amber-500"
                }`}
            />
            {article.status === "IN_PROGRESS"
              ? "In Progress"
              : article.status === "REDO"
                ? "Needs Changes / Redo"
                : article.status === "COMPLETED"
                  ? "Completed (Awaiting Review)"
                  : article.status === "APPROVED"
                    ? "Approved"
                    : "Pending Writer"}
          </span>
        </div>
      </div>

      {/* Error / Success Alerts */}
      {error && (
        <div className="px-4 py-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* ─── HERO CARD: ARTICLE, WRITER & PRODUCT OVERVIEW ─────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#CBCBCB]/60 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#6D8196] dark:text-sky-400" />
                {product.site.name}
              </span>
              <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1.5">
                <LayoutGrid className="w-3.5 h-3.5 text-[#6D8196] dark:text-sky-400" />
                {product.category.name}
              </span>
              {product.productCategory && (
                <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-bold">
                  {product.productCategory}
                </span>
              )}
              {product.trendLevel && (
                <span className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 rounded-lg text-[11px] font-bold flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" />
                  {product.trendLevel} Trend
                </span>
              )}
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {product.name}
              </h1>
              <p className="text-xs text-slate-400 font-medium mt-1 flex items-center gap-2">
                <span>Added by {product.addedBy.name}</span>
                <span>·</span>
                <span>{new Date(product.addedAt).toLocaleDateString()}</span>
              </p>
            </div>
          </div>

          {/* Assigned Writer Profile Box */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 min-w-[260px] flex items-center gap-3.5 shadow-2xs">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-extrabold text-sm flex-shrink-0 shadow-2xs">
              {getInitials(article.writer?.name)}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Assigned Author
              </span>
              <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                {article.writer?.name || "Unassigned"}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-medium">
                {article.writer?.email || "Pending writer claim"}
              </p>
            </div>
          </div>
        </div>

        {/* ─── DIRECT LINKS SECTION (Prominent document & product links) ─── */}
        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-[#6D8196]" />
              Submission & Resource Links
            </span>

            {/* Edit document link toggle */}
            {isManager && (
              article.writer?.id ? (
                <button
                  onClick={() => {
                    setNewLinkValue(article.articleLink || "");
                    setEditLinkMode(!editLinkMode);
                  }}
                  className="text-[11px] font-bold text-[#6D8196] hover:underline cursor-pointer"
                >
                  {editLinkMode ? "Cancel Editing" : "Edit Document URL"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Document link cannot be edited for articles that have not been assigned to a writer."
                  className="text-[11px] font-semibold text-slate-400 cursor-not-allowed opacity-60"
                >
                  Edit Document URL
                </button>
              )
            )}
          </div>

          {/* Edit Document Link Inline Form */}
          {editLinkMode && article.writer?.id && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
              <label className="block text-[11px] font-bold text-slate-600">
                Override Document Link URL
              </label>
              <input
                type="url"
                value={newLinkValue}
                onChange={(e) => setNewLinkValue(e.target.value)}
                placeholder="https://docs.google.com/..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6D8196] transition"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditLinkMode(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  disabled={updatingLink || !newLinkValue.trim()}
                  onClick={async () => {
                    if (!article.writer?.id) {
                      toast.error("Cannot edit document link for an article that has not been assigned to a writer.");
                      return;
                    }
                    setUpdatingLink(true);
                    try {
                      const res = await fetch(`/api/articles/${article.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          articleLink: newLinkValue,
                          callerId: currentUserId,
                        }),
                      });
                      if (!res.ok) {
                        const errData = await res.json().catch(() => ({}));
                        throw new Error(errData.error || "Failed to update article document link");
                      }
                      toast.success("Document link updated!");
                      setEditLinkMode(false);
                      setArticle((prev) => (prev ? { ...prev, articleLink: newLinkValue } : prev));
                    } catch (e: any) {
                      toast.error(e.message || "Failed to update link");
                    } finally {
                      setUpdatingLink(false);
                    }
                  }}
                  className="px-4 py-1.5 rounded-lg bg-[#6D8196] text-white text-xs font-bold hover:bg-[#5A6D81] transition disabled:opacity-50 cursor-pointer"
                >
                  {updatingLink ? "Saving..." : "Save Link"}
                </button>
              </div>
            </div>
          )}

          {/* Links Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Article Document Link Card */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Article Document
              </span>
              {article.articleLink ? (
                <div className="flex items-center gap-2">
                  <a
                    href={ensureExternalUrl(article.articleLink)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 truncate"
                  >
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">Open Article Document</span>
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(article.articleLink || "");
                      toast.success("Article link copied!");
                    }}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                    title="Copy Document Link"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic font-medium py-1">
                  No document link submitted yet.
                </span>
              )}
            </div>

            {/* Trend Link Card */}
            {product.trendLink && (
              <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Trend Source
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={ensureExternalUrl(product.trendLink)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 truncate"
                  >
                    <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
                    <span className="truncate">View Trend Link</span>
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(product.trendLink || "");
                      toast.success("Trend link copied!");
                    }}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                    title="Copy Trend Link"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Preview Link Card */}
            {product.previewLink && (
              <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Product Preview
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={ensureExternalUrl(product.previewLink)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 truncate"
                  >
                    <Globe className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
                    <span className="truncate">Open Preview Link</span>
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(product.previewLink || "");
                      toast.success("Preview link copied!");
                    }}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                    title="Copy Preview Link"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── MAIN WORKSPACE GRID: REVIEW PANEL + TRACKING ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: EDITORIAL REVIEW CENTER (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* ─── REVIEW ACTION COMMAND CENTER ─── */}
          {isManager && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#CBCBCB]/60 dark:border-slate-800 p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#6D8196] dark:text-sky-400" />
                    Editorial Review & Quality Check
                  </h2>
                  <p className="text-xs text-slate-400 dark:text-slate-400 font-medium mt-0.5">
                    Verify compliance, document link, and accuracy before approval
                  </p>
                </div>

                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg">
                  {article.status}
                </span>
              </div>

              {/* STATE 1: READY FOR REVIEW (COMPLETED) */}
              {article.status === "COMPLETED" && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 rounded-xl flex items-center gap-2.5 text-xs text-indigo-900 dark:text-indigo-200 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                    <span>
                      Article has been submitted by <strong className="text-slate-900 dark:text-white">{article.writer?.name || "the writer"}</strong> and is awaiting your verdict.
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                      Review Remarks / Change Instructions (Required for Redo)
                    </label>
                    <textarea
                      rows={4}
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      placeholder="Explain what revisions the writer must address, or write an approval note..."
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#6D8196] bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 transition resize-none font-medium"
                    />
                  </div>

                  {/* Priority selector */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Set Priority for Writer Revisions
                    </label>
                    <div className="flex gap-2">
                      {(["LOW", "MEDIUM", "HIGH"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handleSetRedoPriority(p)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${redoPriority === p
                              ? p === "HIGH"
                                ? "bg-rose-500 text-white border-rose-600 shadow-2xs font-extrabold"
                                : p === "MEDIUM"
                                  ? "bg-amber-500 text-white border-amber-600 shadow-2xs font-extrabold"
                                  : "bg-[#6D8196] text-white border-[#5A6D81] shadow-2xs font-extrabold"
                              : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750"
                            }`}
                        >
                          {p === "HIGH" ? "🔴 High" : p === "MEDIUM" ? "🟡 Medium" : "⚪ Low"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => handleReviewSubmit(false)}
                      disabled={submittingReview}
                      className="py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 hover:border-rose-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Request Redo
                    </button>
                    <button
                      onClick={() => handleReviewSubmit(true)}
                      disabled={submittingReview}
                      className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      Approve Article
                    </button>
                  </div>
                </div>
              )}

              {/* STATE 2: REDO IN PROGRESS - LOCKED UNTIL WRITER RESUBMITS */}
              {article.status === "REDO" && (
                <div className="space-y-4">
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                      <span>Revision Requested - Waiting for Writer Resubmission</span>
                    </div>
                    <p className="text-xs text-rose-900 dark:text-rose-200 leading-relaxed font-medium">
                      You have sent revision instructions to <strong className="text-rose-950 dark:text-rose-100">{article.writer?.name || "the assigned writer"}</strong>.
                      Per workflow rules, the writer must fix the problem in the article and resubmit before another review command can be issued.
                    </p>
                    {latestReview?.suggestion && (
                      <div className="p-3 bg-white/80 dark:bg-slate-900/90 rounded-xl border border-rose-200 dark:border-rose-800/60 text-xs text-rose-950 dark:text-rose-100 font-medium">
                        <span className="font-bold block mb-0.5 text-rose-800 dark:text-rose-300">Latest Feedback Sent to Writer:</span>
                        &quot;{latestReview.suggestion}&quot;
                      </div>
                    )}

                    {/* Set Priority for Writer Revisions (Live control during active REDO) */}
                    <div className="pt-2.5 border-t border-rose-200/80 dark:border-rose-800/60">
                      <label className="block text-[10px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider mb-2">
                        Set Priority for Writer Revisions
                      </label>
                      <div className="flex gap-2">
                        {(["LOW", "MEDIUM", "HIGH"] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => handleSetRedoPriority(p)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${redoPriority === p
                                ? p === "HIGH"
                                  ? "bg-rose-500 text-white border-rose-600 shadow-2xs font-extrabold"
                                  : p === "MEDIUM"
                                    ? "bg-amber-500 text-white border-amber-600 shadow-2xs font-extrabold"
                                    : "bg-[#6D8196] text-white border-[#5A6D81] shadow-2xs font-extrabold"
                                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                              }`}
                          >
                            {p === "HIGH" ? "🔴 High" : p === "MEDIUM" ? "🟡 Medium" : "⚪ Low"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center justify-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Review commands locked. Unlocks automatically when writer submits their revised draft.</span>
                  </div>
                </div>
              )}

              {/* STATE 3: PENDING WRITER */}
              {article.status === "PENDING" && (
                <div className="p-4 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Article Pending Assignment</span>
                  </div>
                  <p className="text-xs text-amber-900 dark:text-amber-100 font-medium leading-relaxed">
                    This article has not been claimed or written yet. Review controls will become available once an eligible writer claims the assignment and submits their completed article document.
                  </p>
                </div>
              )}

              {/* STATE 4: IN PROGRESS */}
              {article.status === "IN_PROGRESS" && (
                <div className="p-4 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold text-xs">
                    <PenTool className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Drafting in Progress</span>
                  </div>
                  <p className="text-xs text-blue-900 dark:text-blue-100 font-medium leading-relaxed">
                    Writer <strong className="text-slate-900 dark:text-white">{article.writer?.name || "Assigned Writer"}</strong> is actively working on this article. {isManager ? "The live stopwatch is running. Review controls will unlock as soon as the article is submitted." : "Review controls will unlock as soon as the article is submitted."}
                  </p>
                </div>
              )}

              {/* STATE 5: APPROVED */}
              {article.status === "APPROVED" && (
                <div className="space-y-4">
                  {article.specialApprovalRequested ? (
                    <div className="p-5 bg-amber-50/90 dark:bg-slate-850 border border-amber-200 dark:border-amber-800/60 rounded-2xl space-y-3.5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-bold text-xs">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                          <span>Writer Requested Permission to Edit Approved Article</span>
                        </div>
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60">
                          Pending Decision
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                        Writer <strong className="text-slate-900 dark:text-white">{article.writer?.name || "Assigned Writer"}</strong> is requesting permission from the Team Lead to reopen and make modifications to this finalized article.
                      </p>

                      <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-amber-200/80 dark:border-amber-800/60 text-xs font-medium space-y-1">
                        <span className="font-bold block text-amber-800 dark:text-amber-400 text-[10px] uppercase tracking-wider">Writer&apos;s Explanation / Reason:</span>
                        <p className="italic text-slate-800 dark:text-slate-100 font-semibold">&quot;{article.specialApprovalRequestReason || "No specific reason provided"}&quot;</p>
                      </div>

                      {isManager && (
                        <div className="flex flex-wrap gap-2.5 pt-1">
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch("/api/approvals", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    articleId: article.id,
                                    reason: article.specialApprovalRequestReason || "Approved edit request",
                                    action: "APPROVE",
                                  }),
                                });
                                if (!res.ok) throw new Error("Failed to approve update request");
                                toast.success("Article unlocked! Reopened for writer to edit.");
                                const refreshRes = await fetch(`/api/articles/${article.id}?userId=${currentUserId}`);
                                const freshData = await refreshRes.json();
                                setArticle(freshData);
                              } catch (e: any) {
                                toast.error(e.message || "Failed to approve update");
                              }
                            }}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            Approve & Unlock Article for Writer
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch("/api/approvals", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    articleId: article.id,
                                    reason: "Declined by Team Lead",
                                    action: "REJECT",
                                  }),
                                });
                                if (!res.ok) throw new Error("Failed to decline request");
                                toast.success("Update request declined.");
                                const refreshRes = await fetch(`/api/articles/${article.id}?userId=${currentUserId}`);
                                const freshData = await refreshRes.json();
                                setArticle(freshData);
                              } catch (e: any) {
                                toast.error(e.message || "Failed to decline update");
                              }
                            }}
                            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            Decline Request
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>Article Approved & Finalized</span>
                        </div>
                        {isManager && (
                          <button
                            onClick={() => {
                              setShowFlagModal(true);
                              setFlagReason("");
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                            title="Raise a flag to the writer that this approved article requires revisions"
                          >
                            <Flag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Flag for Update</span>
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-emerald-900 dark:text-emerald-100 font-medium leading-relaxed">
                        This article has passed all editorial checks and has been approved. If revisions are required later, you can raise a flag to reopen it for the writer.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── AFFILIATE & TRACKING LINKS SECTION ─── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#CBCBCB]/60 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-[#6D8196] dark:text-sky-400" />
              Tracked Links & GEO Networks ({product.linkLogs?.length || 0})
            </h3>

            {/* Dedicated Product Preview Link if present */}
            {product.previewLink && (
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  <span className="text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300 uppercase flex-shrink-0">Preview Link:</span>
                  <a
                    href={ensureExternalUrl(product.previewLink)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-sky-400 hover:underline truncate font-mono text-[11px]"
                  >
                    {product.previewLink}
                  </a>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(product.previewLink || "");
                      toast.success("Preview link copied!");
                    }}
                    className="p-1 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 cursor-pointer"
                    title="Copy Preview Link"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href={ensureExternalUrl(product.previewLink)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300"
                    title="Open Preview Link"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            {product.linkLogs?.length > 0 ? (
              <div className="space-y-3">
                {product.linkLogs.map((log: any) => (
                  <div key={log.id} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{log.affiliateName}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-transparent dark:border-blue-800/60">
                        {log.status}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      {log.bridgePageLink && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase flex-shrink-0">Bridge:</span>
                          <a
                            href={ensureExternalUrl(log.bridgePageLink)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 dark:text-sky-400 hover:underline truncate flex-1 font-mono text-[11px]"
                          >
                            {log.bridgePageLink}
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(log.bridgePageLink);
                              toast.success("Bridge link copied!");
                            }}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-pointer"
                            title="Copy Bridge Link"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {log.buyLink && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase flex-shrink-0">Buy Now Link:</span>
                          <a
                            href={ensureExternalUrl(log.buyLink)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 dark:text-emerald-300 hover:underline truncate flex-1 font-mono text-[11px]"
                          >
                            {log.buyLink}
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(log.buyLink);
                              toast.success("Buy now link copied!");
                            }}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-pointer"
                            title="Copy Buy Now Link"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {log.affiliateLink && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase flex-shrink-0">Affiliate Link:</span>
                          <a
                            href={ensureExternalUrl(log.affiliateLink)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 dark:text-sky-400 hover:underline truncate flex-1 font-mono text-[11px]"
                          >
                            {log.affiliateLink}
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(log.affiliateLink);
                              toast.success("Affiliate link copied!");
                            }}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-pointer"
                            title="Copy Affiliate Link"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {log.geos?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {log.geos.map((g: any) => {
                          const geoLink = g.affiliateLink || log.affiliateLink;
                          return (
                            <span
                              key={g.geo}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-bold text-slate-600 dark:text-slate-200 shadow-2xs"
                            >
                              <span>{g.geo}</span>
                              {geoLink && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(geoLink);
                                    toast.success(`${g.geo} affiliate link copied!`);
                                  }}
                                  className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-sky-400 transition cursor-pointer"
                                  title={`Copy ${g.geo} link`}
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">No affiliate links configured for this product yet.</p>
            )}
          </div>

          {/* ─── REMARKS & SPECIAL APPROVAL SECTION ─── */}
          {(product.remarks || writerRemarks || article.specialApprovalRequested || article.specialApproval) && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#CBCBCB]/60 dark:border-slate-800 p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#6D8196] dark:text-sky-400" />
                  Notes & Special Approvals
                </h3>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                  Audit Notes & Instructions
                </span>
              </div>

              {/* Special Approval Granted */}
              {article.specialApproval && (
                <div className="p-4 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                      <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Special Exemption Granted</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold border border-emerald-300 dark:border-emerald-800">
                      Approved by {article.specialApproval.approvedBy.name}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                    <p className="text-xs text-emerald-900 dark:text-emerald-100 italic font-medium">
                      &quot;{article.specialApproval.reason}&quot;
                    </p>
                  </div>
                </div>
              )}

              {/* Special Approval Pending */}
              {article.specialApprovalRequested && !article.specialApproval && (
                <div className="p-4 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                      <Flag className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Special Approval Requested (No-Link Exemption)</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold border border-amber-300 dark:border-amber-800">
                      Awaiting Team Lead
                    </span>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-amber-100 dark:border-amber-900/40">
                    <p className="text-xs text-amber-900 dark:text-amber-100 italic font-medium">
                      Reason: &quot;{article.specialApprovalRequestReason || "No explanation provided."}&quot;
                    </p>
                  </div>
                </div>
              )}

              {/* Writer Remarks */}
              {writerRemarks && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                      <User className="w-3.5 h-3.5 text-indigo-500" />
                      Writer Submission Note ({article.writer?.name || "Writer"})
                    </span>
                    {writerRemarksDate && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formatRemarkDate(writerRemarksDate)}
                      </span>
                    )}
                  </div>
                  <FormattedRemarks
                    remarks={writerRemarks}
                    date={writerRemarksDate}
                    defaultBadgeTitle="Writer Remark"
                    textClass="text-xs font-semibold"
                  />
                </div>
              )}

              {/* Linker / Product Remarks */}
              {product.remarks && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                      <Tag className="w-3.5 h-3.5 text-[#6D8196] dark:text-sky-400" />
                      Linker & Product Instructions
                    </span>
                    {product.addedAt && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formatRemarkDate(product.addedAt)}
                      </span>
                    )}
                  </div>
                  <FormattedRemarks
                    remarks={product.remarks}
                    date={product.addedAt}
                    defaultBadgeTitle="Linker Instruction"
                    textClass="text-xs font-semibold"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: TIMELINE & AUDIT TRAIL (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Timing Metrics Card - Hidden from writers */}
          {isManager && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#CBCBCB]/60 dark:border-slate-800 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#6D8196] dark:text-sky-400" />
                Production & Velocity Metrics
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Started At</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {article.startedAt ? new Date(article.startedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "-"}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Completed At</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {article.completedAt ? new Date(article.completedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "-"}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Writing Time</p>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {article.writingTimeMin !== undefined && article.writingTimeMin !== null
                      ? article.writingTimeMin >= 60
                        ? `${Math.floor(article.writingTimeMin / 60)}h ${article.writingTimeMin % 60}m`
                        : `${article.writingTimeMin}m`
                      : "-"}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Revision Time</p>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {article.updateTimeMin !== undefined && article.updateTimeMin !== null
                      ? article.updateTimeMin >= 60
                        ? `${Math.floor(article.updateTimeMin / 60)}h ${article.updateTimeMin % 60}m`
                        : `${article.updateTimeMin}m`
                      : "-"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Past Reviews Log */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#CBCBCB]/60 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#6D8196] dark:text-sky-400" />
              Editorial Reviews History ({article.reviews?.length || 0})
            </h3>

            {article.reviews && article.reviews.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {article.reviews.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-750 rounded-xl space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-750 text-slate-700 dark:text-slate-200 flex items-center justify-center text-[10px] font-bold">
                          {r.reviewedBy.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {r.reviewedBy.name}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          r.approved
                            ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                            : "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                        }`}
                      >
                        {r.approved ? "APPROVED" : "NEEDS CHANGES"}
                      </span>
                    </div>
                    {r.suggestion && (
                      <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-750 text-xs text-slate-800 dark:text-slate-100 italic font-medium leading-relaxed">
                        &quot;{r.suggestion}&quot;
                      </div>
                    )}
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block text-right">
                      {new Date(r.reviewedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">No previous reviews recorded yet.</p>
            )}
          </div>

          {/* Update History Audit Trail */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#CBCBCB]/60 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <HistoryIcon className="w-4 h-4 text-[#6D8196] dark:text-sky-400" />
              Activity & Audit Trail ({article.history?.length || 0})
            </h3>

            {article.history && article.history.length > 0 ? (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {article.history.map((h) => {
                  const hasRemarks = h.notes?.includes("Writer remarks:");
                  const parts = hasRemarks ? h.notes.split("Writer remarks:") : [h.notes, ""];

                  return (
                    <div key={h.id} className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-700 py-0.5 text-left">
                      <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-400 border border-white dark:border-slate-900" />
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{h.updatedBy.name}</p>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {new Date(h.updatedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-normal">{parts[0]}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No activity logs recorded yet.</p>
            )}
          </div>
        </div>
      </div>

      {showFlagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Flag className="w-4 h-4 text-amber-600" />
                  Flag Approved Article for Update
                </h3>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Reopen this approved article and send update instructions to the writer
                </p>
              </div>
              <button
                onClick={() => setShowFlagModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Writer</span>
                <p className="font-bold text-slate-800">{article.writer?.name || "Unassigned"}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Update Instructions <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  placeholder="Specify what needs to be updated by the writer (e.g. dead link, pricing update)..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition resize-none font-medium placeholder-slate-400"
                />
              </div>

              <div className="flex gap-2.5 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowFlagModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFlagForUpdate}
                  disabled={submittingFlag || !flagReason.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {submittingFlag ? "Raising Flag..." : "Raise Flag & Unlock"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
