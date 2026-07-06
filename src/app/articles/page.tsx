"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Article {
  id: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  articleLink?: string;
  startedAt?: string;
  completedAt?: string;
  writingTimeMin?: number;
  updatedAt: string;
  product: { id: number; name: string; site: { name: string }; category: { name: string } };
  writer?: { id: number; name: string };
  reviews: { suggestion?: string; approved: boolean; reviewedBy: { name: string }; reviewedAt: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600 border border-slate-200",
  IN_PROGRESS: "bg-amber-100 text-amber-700 border border-amber-200",
  COMPLETED: "bg-emerald-100 text-emerald-700 border border-emerald-200",
};

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/articles?${params}`)
      .then((r) => r.json())
      .then(setArticles)
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = articles.filter((a) =>
    a.product.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.writer?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Articles</h1>
          <p className="text-gray-500 mt-1">Track writing progress across all products</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search product or writer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white flex-1 min-w-48"
        />
        {["", "PENDING", "IN_PROGRESS", "COMPLETED"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              statusFilter === s
                ? "bg-violet-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-violet-300"
            }`}
          >
            {s === "" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          No articles found.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <Link key={a.id} href={`/articles/${a.id}`}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:border-violet-200 transition-all block">
              {/* Status indicator */}
              <div className={`w-2 h-12 rounded-full flex-shrink-0 ${
                a.status === "PENDING" ? "bg-slate-300" : a.status === "IN_PROGRESS" ? "bg-amber-400" : "bg-emerald-500"
              }`} />

              {/* Product info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 truncate">{a.product.name}</p>
                <p className="text-xs text-gray-400">{a.product.site.name} · {a.product.category.name}</p>
              </div>

              {/* Writer */}
              <div className="text-right min-w-0 flex-shrink-0">
                {a.writer ? (
                  <>
                    <p className="text-sm text-gray-600 font-medium">{a.writer.name}</p>
                    <p className="text-xs text-gray-400">Writer</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-300 italic">Unassigned</p>
                )}
              </div>

              {/* Writing time */}
              {a.writingTimeMin && (
                <div className="text-center flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-700">{a.writingTimeMin}m</p>
                  <p className="text-xs text-gray-400">Time taken</p>
                </div>
              )}

              {/* Review indicator */}
              {a.reviews.length > 0 && (
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  a.reviews[0].approved ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                }`}>
                  {a.reviews[0].approved ? "✓" : "!"}
                </div>
              )}

              {/* Status badge */}
              <span className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${STATUS_COLORS[a.status]}`}>
                {a.status.replace("_", " ")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
