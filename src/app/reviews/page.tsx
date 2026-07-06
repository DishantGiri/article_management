"use client";

import { useEffect, useState } from "react";

interface Article {
  id: number;
  status: string;
  articleLink?: string;
  writingTimeMin?: number;
  product: { name: string; site: { name: string } };
  writer?: { name: string };
  reviews: { id: number; approved: boolean; suggestion?: string; reviewedBy: { name: string }; reviewedAt: string }[];
  specialApproval?: { reason: string };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
};

export default function ReviewsPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(4);
  const [reviewForms, setReviewForms] = useState<Record<number, { suggestion: string; approved: boolean }>>({});
  const [approvalForms, setApprovalForms] = useState<Record<number, { reason: string }>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("mockUserId");
    setCurrentUserId(parseInt(stored || "4"));
    fetch("/api/articles")
      .then((r) => r.json())
      .then(setArticles)
      .finally(() => setLoading(false));
  }, []);

  const submitReview = async (articleId: number) => {
    const form = reviewForms[articleId];
    if (!form) return;
    setSaving(articleId);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, reviewedById: currentUserId, ...form }),
      });
      if (res.ok) {
        setSuccessMsg("Review submitted!");
        setTimeout(() => setSuccessMsg(""), 3000);
        // Refresh articles
        fetch("/api/articles").then((r) => r.json()).then(setArticles);
        setReviewForms((prev) => { const n = { ...prev }; delete n[articleId]; return n; });
      }
    } finally {
      setSaving(null);
    }
  };

  const grantApproval = async (articleId: number) => {
    const form = approvalForms[articleId];
    if (!form?.reason.trim()) return;
    setSaving(articleId * 1000);
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, approvedById: currentUserId, reason: form.reason }),
      });
      if (res.ok) {
        setSuccessMsg("Special approval granted!");
        setTimeout(() => setSuccessMsg(""), 3000);
        fetch("/api/articles").then((r) => r.json()).then(setArticles);
        setApprovalForms((prev) => { const n = { ...prev }; delete n[articleId]; return n; });
      }
    } finally {
      setSaving(null);
    }
  };

  const inProgressArticles = articles.filter((a) => a.status === "IN_PROGRESS");
  const completedArticles = articles.filter((a) => a.status === "COMPLETED" && a.reviews.length === 0);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Team Lead Reviews</h1>
        <p className="text-gray-500 mt-1">Review articles, approve completions, and send feedback</p>
      </div>

      {successMsg && (
        <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">{successMsg}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* In Progress — Need Review */}
          <div>
            <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              In Progress ({inProgressArticles.length})
            </h2>
            <div className="space-y-3">
              {inProgressArticles.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-400">No articles in progress.</div>
              ) : inProgressArticles.map((a) => (
                <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-800">{a.product.name}</p>
                      <p className="text-xs text-gray-400">{a.product.site.name} · Writer: {a.writer?.name || "Unassigned"}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[a.status]}`}>{a.status.replace("_", " ")}</span>
                  </div>

                  {/* Review Form */}
                  <div className="space-y-3 border-t border-gray-100 pt-3">
                    <textarea
                      rows={2}
                      placeholder="Add suggestion or feedback for the writer…"
                      value={reviewForms[a.id]?.suggestion || ""}
                      onChange={(e) => setReviewForms((prev) => ({ ...prev, [a.id]: { ...prev[a.id], suggestion: e.target.value, approved: prev[a.id]?.approved ?? false } }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                    />
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={reviewForms[a.id]?.approved ?? false}
                          onChange={(e) => setReviewForms((prev) => ({ ...prev, [a.id]: { ...prev[a.id], approved: e.target.checked, suggestion: prev[a.id]?.suggestion || "" } }))}
                          className="w-4 h-4 rounded text-violet-600 accent-violet-600"
                        />
                        Mark as Approved
                      </label>
                      <button
                        onClick={() => submitReview(a.id)}
                        disabled={saving === a.id}
                        className="ml-auto px-4 py-1.5 bg-violet-600 text-white rounded-xl text-xs font-semibold hover:bg-violet-700 disabled:opacity-50 transition"
                      >
                        {saving === a.id ? "Submitting…" : "Submit Review"}
                      </button>
                    </div>

                    {/* Special Approval */}
                    {!a.specialApproval && (
                      <div className="border-t border-gray-100 pt-3">
                        <p className="text-xs font-semibold text-amber-700 mb-2">Grant Special Approval (complete without article link)</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Reason for special approval…"
                            value={approvalForms[a.id]?.reason || ""}
                            onChange={(e) => setApprovalForms((prev) => ({ ...prev, [a.id]: { reason: e.target.value } }))}
                            className="flex-1 px-3 py-1.5 rounded-xl border border-amber-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50"
                          />
                          <button
                            onClick={() => grantApproval(a.id)}
                            disabled={saving === a.id * 1000}
                            className="px-3 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 disabled:opacity-50 transition"
                          >
                            Grant
                          </button>
                        </div>
                      </div>
                    )}
                    {a.specialApproval && (
                      <div className="bg-amber-50 rounded-xl px-3 py-2 text-xs text-amber-700">
                        ✓ Special approval granted: {a.specialApproval.reason}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Completed — Awaiting Review */}
          <div>
            <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Completed — Awaiting Review ({completedArticles.length})
            </h2>
            <div className="space-y-3">
              {completedArticles.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-400">No completed articles awaiting review.</div>
              ) : completedArticles.map((a) => (
                <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-800">{a.product.name}</p>
                      <p className="text-xs text-gray-400">{a.product.site.name} · {a.writer?.name || "Unknown"}</p>
                    </div>
                    <div className="text-right">
                      {a.writingTimeMin && <p className="text-xs text-gray-500">{a.writingTimeMin}m</p>}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[a.status]}`}>{a.status.replace("_", " ")}</span>
                    </div>
                  </div>
                  {a.articleLink && (
                    <a href={a.articleLink} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 hover:underline block mb-3 truncate">{a.articleLink}</a>
                  )}
                  <div className="space-y-3 border-t border-gray-100 pt-3">
                    <textarea
                      rows={2}
                      placeholder="Add feedback…"
                      value={reviewForms[a.id]?.suggestion || ""}
                      onChange={(e) => setReviewForms((prev) => ({ ...prev, [a.id]: { ...prev[a.id], suggestion: e.target.value, approved: prev[a.id]?.approved ?? false } }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                    />
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input type="checkbox"
                          checked={reviewForms[a.id]?.approved ?? false}
                          onChange={(e) => setReviewForms((prev) => ({ ...prev, [a.id]: { ...prev[a.id], approved: e.target.checked, suggestion: prev[a.id]?.suggestion || "" } }))}
                          className="w-4 h-4 accent-violet-600" />
                        Approve
                      </label>
                      <button onClick={() => submitReview(a.id)} disabled={saving === a.id}
                        className="ml-auto px-4 py-1.5 bg-violet-600 text-white rounded-xl text-xs font-semibold hover:bg-violet-700 disabled:opacity-50 transition">
                        {saving === a.id ? "Submitting…" : "Submit Review"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
