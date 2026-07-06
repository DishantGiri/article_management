"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DashboardData {
  products: { total: number };
  articles: { pending: number; inProgress: number; completed: number; total: number };
  links: { total: number; requested: number; accepted: number; issue: number };
  recentProducts: { id: number; name: string; site: { name: string }; category: { name: string }; addedBy: { name: string }; addedAt: string; article?: { status: string } }[];
  recentArticles: { id: number; product: { name: string }; writer?: { name: string }; status: string; updatedAt: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
};
const STATUS_DOT: Record<string, string> = {
  PENDING: "bg-slate-400",
  IN_PROGRESS: "bg-amber-400",
  COMPLETED: "bg-emerald-500",
};

function StatCard({ label, value, sub, color, icon }: { label: string; value: number; sub?: string; color: string; icon: React.ReactNode }) {
  return (
    <div className={`rounded-2xl p-5 ${color} flex items-start justify-between`}>
      <div>
        <p className="text-sm font-medium opacity-70">{label}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
      </div>
      <div className="opacity-80">{icon}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <div className="p-8 text-red-500">Failed to load dashboard data.</div>;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your article management workflow</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Products"
          value={data.products.total}
          sub="across all sites"
          color="bg-white text-gray-800 border border-gray-100 shadow-sm"
          icon={<svg className="w-10 h-10 text-violet-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
        />
        <StatCard
          label="In Progress"
          value={data.articles.inProgress}
          sub="articles being written"
          color="bg-amber-50 text-amber-900 border border-amber-100"
          icon={<svg className="w-10 h-10 text-amber-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
        />
        <StatCard
          label="Completed"
          value={data.articles.completed}
          sub="articles done"
          color="bg-emerald-50 text-emerald-900 border border-emerald-100"
          icon={<svg className="w-10 h-10 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Link Issues"
          value={data.links.issue}
          sub={`${data.links.total} total links`}
          color="bg-red-50 text-red-900 border border-red-100"
          icon={<svg className="w-10 h-10 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
        />
      </div>

      {/* Article Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Pending", val: data.articles.pending, status: "PENDING" },
          { label: "In Progress", val: data.articles.inProgress, status: "IN_PROGRESS" },
          { label: "Completed", val: data.articles.completed, status: "COMPLETED" },
        ].map((s) => (
          <Link key={s.status} href={`/articles?status=${s.status}`}
            className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:border-violet-200 transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">{s.label} Articles</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[s.status]}`}>{s.status.replace("_", " ")}</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{s.val}</p>
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${STATUS_DOT[s.status]}`}
                style={{ width: data.articles.total ? `${(s.val / data.articles.total) * 100}%` : "0%" }}
              />
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Products */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Recent Products</h2>
            <Link href="/products" className="text-xs text-violet-600 hover:text-violet-700 font-medium">View all →</Link>
          </div>
          {data.recentProducts.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No products yet. <Link href="/products/add" className="text-violet-600 hover:underline">Add one →</Link></div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.recentProducts.map((p) => (
                <div key={p.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs flex-shrink-0">
                    {p.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.site.name} · {p.category.name}</p>
                  </div>
                  {p.article && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${STATUS_COLORS[p.article.status]}`}>
                      {p.article.status.replace("_", " ")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Article Activity */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Article Activity</h2>
            <Link href="/articles" className="text-xs text-violet-600 hover:text-violet-700 font-medium">View all →</Link>
          </div>
          {data.recentArticles.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No article activity yet.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.recentArticles.map((a) => (
                <Link key={a.id} href={`/articles/${a.id}`}
                  className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors block">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[a.status]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{a.product.name}</p>
                    <p className="text-xs text-gray-400">{a.writer?.name || "Unassigned"}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${STATUS_COLORS[a.status]}`}>
                    {a.status.replace("_", " ")}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: "/products/add", label: "Add Product", desc: "Create a new product listing", bg: "from-violet-500 to-indigo-600" },
          { href: "/articles", label: "View Articles", desc: "Manage article workflow", bg: "from-amber-500 to-orange-600" },
          { href: "/links", label: "Manage Links", desc: "Add & track affiliate links", bg: "from-emerald-500 to-teal-600" },
        ].map((a) => (
          <Link key={a.href} href={a.href}
            className={`bg-gradient-to-br ${a.bg} rounded-xl p-5 text-white hover:shadow-lg hover:-translate-y-0.5 transition-all`}>
            <p className="font-semibold">{a.label}</p>
            <p className="text-sm opacity-75 mt-0.5">{a.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
