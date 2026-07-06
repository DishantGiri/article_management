"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";

interface Article {
  id: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  articleLink?: string;
  startedAt?: string;
  completedAt?: string;
  writingTimeMin?: number;
  productCreatedAt?: string;
  updatedAt: string;
  product: {
    id: number; name: string; trendLink?: string; previewLink?: string; remarks?: string;
    site: { name: string }; category: { name: string }; addedBy: { name: string };
    linkLogs: { id: number; affiliateName: string; affiliateLink: string; bridgePageLink?: string; buyLink?: string; status: string; geos: { geo: string }[]; addedBy: { name: string }; addedAt: string }[];
  };
  writer?: { id: number; name: string };
  reviews: { id: number; suggestion?: string; approved: boolean; reviewedBy: { id: number; name: string }; reviewedAt: string }[];
  specialApproval?: { reason: string; approvedBy: { name: string }; approvedAt: string };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "text-slate-600 bg-slate-100",
  IN_PROGRESS: "text-amber-700 bg-amber-100",
  COMPLETED: "text-emerald-700 bg-emerald-100",
};

const LINK_STATUS_COLORS: Record<string, string> = {
  REQUESTED: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  CANCELED: "bg-red-100 text-red-700",
  ISSUE: "bg-orange-100 text-orange-700",
  NEED_TO_CHECK: "bg-amber-100 text-amber-700",
  PRESELL_PAGE: "bg-purple-100 text-purple-700",
  REDIRECTED: "bg-cyan-100 text-cyan-700",
};

export default function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(2);
  const [articleLink, setArticleLink] = useState("");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showApprovalRequest, setShowApprovalRequest] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("mockUserId");
    setCurrentUserId(parseInt(stored || "2"));
    fetch(`/api/articles/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setArticle(data);
        setArticleLink(data.articleLink || "");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (newStatus: string) => {
    setUpdating(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          writerId: currentUserId,
          articleLink: articleLink || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setArticle((prev) => prev ? { ...prev, ...data } : prev);
      setSuccess(`Status updated to ${newStatus.replace("_", " ")}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!article) return <div className="p-8 text-red-500">Article not found.</div>;

  const { product } = article;

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
          <p className="text-gray-500 mt-1">{product.site.name} · {product.category.name}</p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${STATUS_COLORS[article.status]}`}>
          {article.status.replace("_", " ")}
        </span>
      </div>

      {/* Error / Success */}
      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}
      {success && <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Product Details */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Product Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-gray-400 text-xs mb-1">Added By</p><p className="font-medium text-gray-700">{product.addedBy.name}</p></div>
              <div><p className="text-gray-400 text-xs mb-1">Writer</p><p className="font-medium text-gray-700">{article.writer?.name || <span className="text-gray-300 italic">Unassigned</span>}</p></div>
              {product.trendLink && <div className="col-span-2"><p className="text-gray-400 text-xs mb-1">Trend Link</p><a href={product.trendLink} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline truncate block">{product.trendLink}</a></div>}
              {product.previewLink && <div className="col-span-2"><p className="text-gray-400 text-xs mb-1">Preview Link</p><a href={product.previewLink} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline truncate block">{product.previewLink}</a></div>}
              {product.remarks && <div className="col-span-2"><p className="text-gray-400 text-xs mb-1">Remarks</p><p className="text-gray-600">{product.remarks}</p></div>}
            </div>
          </div>

          {/* Writing Workflow */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Article Workflow</h2>

            {/* Timeline */}
            <div className="flex items-center gap-0 mb-5">
              {["PENDING", "IN_PROGRESS", "COMPLETED"].map((s, i) => {
                const done = ["PENDING", "IN_PROGRESS", "COMPLETED"].indexOf(article.status) >= i;
                return (
                  <div key={s} className="flex items-center flex-1 last:flex-none">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${done ? (s === "COMPLETED" ? "bg-emerald-500 text-white" : "bg-violet-600 text-white") : "bg-gray-100 text-gray-400"}`}>
                      {done && s === "COMPLETED" ? "✓" : i + 1}
                    </div>
                    <div className="ml-1.5 flex-shrink-0">
                      <p className={`text-xs font-medium ${done ? "text-gray-700" : "text-gray-400"}`}>{s.replace("_", " ")}</p>
                    </div>
                    {i < 2 && <div className={`h-0.5 flex-1 mx-3 rounded ${done && article.status !== s ? "bg-violet-400" : "bg-gray-200"}`} />}
                  </div>
                );
              })}
            </div>

            {/* Stats */}
            {article.startedAt && (
              <div className="grid grid-cols-3 gap-3 mb-5 text-center">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Started</p>
                  <p className="text-sm font-semibold text-gray-700">{new Date(article.startedAt).toLocaleDateString()}</p>
                </div>
                {article.completedAt && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">Completed</p>
                    <p className="text-sm font-semibold text-gray-700">{new Date(article.completedAt).toLocaleDateString()}</p>
                  </div>
                )}
                {article.writingTimeMin && (
                  <div className="bg-violet-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">Time Taken</p>
                    <p className="text-sm font-semibold text-violet-700">
                      {article.writingTimeMin >= 60 ? `${Math.floor(article.writingTimeMin / 60)}h ${article.writingTimeMin % 60}m` : `${article.writingTimeMin}m`}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Article Link Input */}
            {article.status !== "COMPLETED" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Article Link</label>
                <input
                  type="url"
                  value={articleLink}
                  onChange={(e) => setArticleLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
            )}

            {article.articleLink && article.status === "COMPLETED" && (
              <div className="mb-4 p-3 bg-emerald-50 rounded-xl">
                <p className="text-xs text-emerald-600 font-medium mb-1">Article Link</p>
                <a href={article.articleLink} target="_blank" rel="noopener noreferrer" className="text-emerald-700 text-sm hover:underline break-all">{article.articleLink}</a>
              </div>
            )}

            {/* Special Approval */}
            {article.specialApproval && (
              <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-xs text-amber-600 font-medium mb-1">Special Approval Granted</p>
                <p className="text-sm text-amber-700">By: {article.specialApproval.approvedBy.name}</p>
                <p className="text-sm text-amber-700">Reason: {article.specialApproval.reason}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 flex-wrap">
              {article.status === "PENDING" && (
                <button
                  id="btn-start-article"
                  disabled={updating}
                  onClick={() => updateStatus("IN_PROGRESS")}
                  className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition"
                >
                  {updating ? "Starting…" : "Start Writing"}
                </button>
              )}
              {article.status === "IN_PROGRESS" && (
                <>
                  <button
                    id="btn-complete-article"
                    disabled={updating}
                    onClick={() => updateStatus("COMPLETED")}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50 transition"
                  >
                    {updating ? "Saving…" : "Mark Completed"}
                  </button>
                  <button
                    onClick={() => setShowApprovalRequest(true)}
                    className="px-4 py-2 border border-amber-300 text-amber-700 rounded-xl text-sm font-semibold hover:bg-amber-50 transition"
                  >
                    Request Special Approval
                  </button>
                </>
              )}
            </div>

            {/* Approval Request Form */}
            {showApprovalRequest && (
              <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-sm font-semibold text-amber-800 mb-2">Request Completion Without Article Link</p>
                <p className="text-xs text-amber-600 mb-3">A Team Lead must approve this. Contact your Team Lead with article ID: <strong>#{article.id}</strong></p>
                <button onClick={() => setShowApprovalRequest(false)} className="text-xs text-amber-700 hover:underline">Cancel</button>
              </div>
            )}
          </div>

          {/* Team Lead Reviews */}
          {article.reviews.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Team Lead Reviews</h2>
              <div className="space-y-3">
                {article.reviews.map((r) => (
                  <div key={r.id} className={`p-4 rounded-xl ${r.approved ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-700">{r.reviewedBy.name}</p>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.approved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {r.approved ? "✓ Approved" : "Needs Changes"}
                        </span>
                        <span className="text-xs text-gray-400">{new Date(r.reviewedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {r.suggestion && <p className="text-sm text-gray-600">{r.suggestion}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Side Column — Links */}
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Affiliate Links</h2>
              <a href={`/links?productId=${product.id}`}
                className="text-xs text-violet-600 hover:text-violet-700 font-medium">Manage →</a>
            </div>
            {product.linkLogs.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No links added yet.</p>
            ) : (
              <div className="space-y-3">
                {product.linkLogs.map((l) => (
                  <div key={l.id} className="p-3 bg-slate-50 rounded-xl text-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="font-medium text-gray-700 truncate">{l.affiliateName}</p>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${LINK_STATUS_COLORS[l.status] || "bg-gray-100 text-gray-600"}`}>
                        {l.status.replace("_", " ")}
                      </span>
                    </div>
                    {l.geos.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {l.geos.map((g) => (
                          <span key={g.geo} className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] text-gray-600">{g.geo}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
