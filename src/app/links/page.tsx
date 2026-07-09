"use client";

import { useEffect, useState, Suspense } from "react";
import { Search, Plus, Download, MoreHorizontal, ExternalLink, AlertTriangle, Network, Edit, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import AddLinkModal from "@/components/AddLinkModal";
import EditLinkModal from "@/components/EditLinkModal";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

interface LinkLog {
  id: number;
  productId: number;
  affiliateName: string;
  affiliateLink: string;
  bridgePageLink?: string;
  status: string;
  addedAt: string;
  geos: { geo: string }[];
  addedBy: { name: string };
  product: { name: string; article?: { articleLink?: string | null } };
}

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-blue-50 text-blue-500",
  ACCEPTED: "bg-emerald-100 text-emerald-600",
  CANCELED: "bg-slate-100 text-slate-500",
  ISSUE: "bg-rose-100 text-rose-500",
  NEED_TO_CHECK: "bg-amber-100 text-amber-600",
  PRESELL_PAGE: "bg-purple-100 text-purple-600",
  REDIRECTED: "bg-yellow-100 text-yellow-600",
  ALERT: "bg-red-100 text-red-600",
};

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Requested",
  ACCEPTED: "Accepted",
  CANCELED: "Canceled",
  ISSUE: "Issue",
  NEED_TO_CHECK: "Need check",
  PRESELL_PAGE: "Presell Page",
  REDIRECTED: "Redirected",
  ALERT: "Alert",
};

function LinksPageContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const urlProductId = searchParams.get("productId");

  const [links, setLinks] = useState<LinkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<any>(null);
  const [currentUserRole, setCurrentUserRole] = useState("WRITER");
  const itemsPerPage = 10;

  const handleDeleteLink = async (linkId: number) => {
    if (confirm("Are you sure you want to delete this link log?")) {
      const uId = session?.user?.id || 2;
      try {
        const res = await fetch(`/api/links/${linkId}?callerId=${uId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed to delete link");
        setLinks((prev) => prev.filter((l) => l.id !== linkId));
        toast.success("Link deleted successfully!");
      } catch (err: any) {
        toast.error(err.message || "Failed to delete link");
      }
    }
  };

  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    const uId = session.user.id;
    const uRole = session.user.role || "WRITER";
    setCurrentUserRole(uRole);

    Promise.all([
      fetch(`/api/links?userId=${uId}`).then((r) => r.json()),
      fetch(`/api/dashboard?userId=${uId}`).then((r) => r.json()),
    ]).then(([linksData, dashboardData]) => {
      setLinks(Array.isArray(linksData) ? linksData : []);
      setStats(dashboardData);
    }).finally(() => setLoading(false));
  }, [session?.user?.id]);

  const [userFilter, setUserFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const uniqueAdders = Array.from(new Set(links.map((l) => l.addedBy?.name).filter(Boolean))) as string[];

  const filtered = links.filter((l) => {
    const matchSearch =
      l.product.name.toLowerCase().includes(search.toLowerCase()) ||
      l.affiliateName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || l.status === statusFilter;

    // Added By filter
    const matchUser = !userFilter || l.addedBy?.name === userFilter;

    // Date Range filter
    let matchDate = true;
    if (startDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      const d = new Date(l.addedAt);
      if (d < s) matchDate = false;
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      const d = new Date(l.addedAt);
      if (d > e) matchDate = false;
    }

    return matchSearch && matchStatus && matchUser && matchDate;
  });

  const missingBridgeCount = links.filter(l => !l.bridgePageLink).length;
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

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-[#f8fafc]" suppressHydrationWarning>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Link Logs</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">{links.length} link entries</p>
        </div>
        <div className="flex items-center gap-3">
          {(currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "LINKER") && (
            <button 
              onClick={() => setIsAddLinkOpen(true)}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-semibold hover:bg-indigo-600 shadow-sm transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Link
            </button>
          )}
          <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 shadow-sm transition flex items-center gap-2">
            <Download className="w-4 h-4 text-slate-500" />
            Export
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      {stats && (currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "TEAM_LEAD" || currentUserRole === "LINKER") && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 mb-2">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.superAdmin?.affiliateNetworks || 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Affiliate Networks</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32 relative">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full flex items-center gap-1">↓ 2</span>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.superAdmin?.deadLinks || 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Dead Links</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mb-2">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.superAdmin?.issueLinks || 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Issue Links</p>
            </div>
          </div>
        </div>
      )}

      {/* Alert Banner */}
      {missingBridgeCount > 0 && (
        <div className="mb-6 bg-amber-50/50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm font-medium text-amber-700">
            <strong className="font-bold">{missingBridgeCount} links have missing bridge pages.</strong> Bridge page is required before a link can be marked as <strong className="font-bold">Accepted</strong>.
          </p>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search link logs..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white placeholder-slate-400 font-medium text-slate-700"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[120px]"
        >
          <option value="">All Statuses</option>
          {Object.keys(STATUS_LABELS).map((k) => (
            <option key={k} value={k}>{STATUS_LABELS[k]}</option>
          ))}
        </select>

        {/* Added By Filter */}
        <select
          value={userFilter}
          onChange={(e) => { setUserFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[130px]"
        >
          <option value="">All Adders</option>
          {uniqueAdders.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>

        {/* Date Range Start */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 uppercase">From</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Date Range End */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 uppercase">To</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-slate-500 font-medium">No links found</p>
          </div>
        ) : (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Article Link</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bridge Page</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Affiliate</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Geo</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Added By</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                  {(currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "LINKER") && (
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center"></th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map((l) => {
                  const statusStyle = STATUS_STYLES[l.status] || STATUS_STYLES.REQUESTED;
                  const statusLabel = STATUS_LABELS[l.status] || l.status;
                  
                  return (
                    <tr key={l.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-3 py-3.5">
                        <span className="text-[13px] font-semibold text-slate-800">{l.product.name}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        {l.product.article?.articleLink ? (
                          <a href={l.product.article.articleLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-blue-500 hover:text-blue-600 transition">
                            <ExternalLink className="w-3.5 h-3.5" />
                            Article
                          </a>
                        ) : (
                          <span className="text-[12px] font-semibold text-slate-400">
                            --
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        {l.bridgePageLink ? (
                          <a href={l.bridgePageLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-blue-500 hover:text-blue-600 transition">
                            <ExternalLink className="w-3.5 h-3.5" />
                            Link
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-rose-500">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Missing
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[13px] font-medium text-slate-600">{l.affiliateName}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex gap-1 flex-wrap">
                          {l.geos && l.geos.length > 0 ? (
                            l.geos.map(g => (
                              <span key={g.geo} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold uppercase border border-slate-200">
                                {g.geo}
                              </span>
                            ))
                          ) : (
                            <span className="text-[12px] font-semibold text-slate-300">--</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${statusStyle}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[13px] font-medium text-slate-600">{l.addedBy.name}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[12px] font-medium text-slate-500">
                          {new Date(l.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                      {(currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "LINKER") && (
                        <td className="px-3 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setEditingLink(l)}
                              className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-400 hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 transition cursor-pointer"
                              title="Edit Link"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLink(l.id)}
                              className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition cursor-pointer"
                              title="Delete Link"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

      <AddLinkModal 
        isOpen={isAddLinkOpen} 
        onClose={() => setIsAddLinkOpen(false)} 
        onSuccess={() => window.location.reload()} 
        preselectedProductId={urlProductId ? parseInt(urlProductId) : null}
      />

      <EditLinkModal
        isOpen={!!editingLink}
        onClose={() => setEditingLink(null)}
        onSuccess={() => window.location.reload()}
        link={editingLink}
      />
    </div>
  );
}

export default function LinksPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading...</div>}>
      <LinksPageContent />
    </Suspense>
  );
}
