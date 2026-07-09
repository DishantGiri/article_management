"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Download, MoreHorizontal, CheckCircle2, PlayCircle, FileText, Activity } from "lucide-react";
import { useSession } from "next-auth/react";

interface Article {
  id: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED" | "REVIEW";
  updatedAt: string;
  articleLink?: string;
  product: { id: number; name: string; site: { name: string }; category: { name: string } };
  writer?: { id: number; name: string };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  REVIEW: "bg-cyan-100 text-cyan-700",
};

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [statusFilter, setStatusFilter] = useState("");
  const [writerFilter, setWriterFilter] = useState("");
  const [siteFilter, setSiteFilter] = useState("");

  const [currentUserRole, setCurrentUserRole] = useState("WRITER");
  const [stats, setStats] = useState<any>(null);
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user?.id) return;
    const stored = session.user.id;
    const uRole = session.user.role || "WRITER";
    setCurrentUserRole(uRole);

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

  const ensureExternalUrl = (url: string | null | undefined) => {
    if (!url) return "";
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-[#f8fafc]" suppressHydrationWarning>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Articles</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">All article submissions and their statuses</p>
        </div>
        <div>
          <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 shadow-sm transition flex items-center gap-2">
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
          <option value="REJECTED">Rejected</option>
          <option value="REVIEW">Review</option>
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
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[25%]">Product</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[20%]">Site</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[20%]">Writer</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[15%]">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[15%]">Date</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center w-[5%]">Link</th>
                  {(currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "TEAM_LEAD") && (
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left w-[10%]">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map((a: any) => {
                  const status = a.status || "PENDING";
                  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.PENDING;
                  
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
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${statusColor}`}>
                          {status === "IN_PROGRESS" ? "In Progress" : status.charAt(0) + status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-[12px] font-medium text-slate-500">
                          {new Date(a.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
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
                            href={`/articles/${a.id}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Review
                          </Link>
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
    </div>
  );
}
