/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, Suspense } from "react";
import { Search, Plus, Download, Tag, Globe, MoreHorizontal, ExternalLink, AlertTriangle, Network, Edit, Trash2, Clock, Info, X, ChevronDown } from "lucide-react";
import { toast } from "react-hot-toast";
import AddLinkModal from "@/components/AddLinkModal";
import FormattedRemarks from "@/components/FormattedRemarks";
import EditLinkModal from "@/components/EditLinkModal";
import AffiliateManageModal from "@/components/AffiliateManageModal";
import GeoManageModal from "@/components/GeoManageModal";
import LinkHistoryModal from "@/components/LinkHistoryModal";
import DateRangePicker from "@/components/DateRangePicker";
import CustomSelect from "@/components/CustomSelect";
import PendingLinkLogsSection from "@/components/PendingLinkLogsSection";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface LinkLog {
  id: number;
  productId: number;
  affiliateName: string;
  affiliateLink: string;
  bridgePageLink?: string;
  buyLink?: string;
  linkerRemarks?: string | null;
  status: string;
  addedAt: string;
  geos: { geo: string }[];
  addedBy: { name: string };
  updatedBy?: { name: string } | null;
  product: { name: string; site?: { name: string }; article?: { articleLink?: string | null } };
}

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-blue-50 text-blue-700 border border-blue-200/60",
  ACCEPTED: "bg-[#6D8196]/15 text-[#3D4F61] border border-[#6D8196]/30",
  CANCELED: "bg-slate-100 text-slate-600 border border-slate-200",
  ISSUE: "bg-rose-50 text-rose-700 border border-rose-200/60",
  NEED_TO_CHECK: "bg-amber-50 text-amber-700 border border-amber-200/60",
  PRESELL_PAGE: "bg-[#6D8196]/15 text-[#3D4F61] border border-[#6D8196]/30",
  REDIRECTED: "bg-yellow-50 text-yellow-800 border border-yellow-200/60",
  ALERT: "bg-red-50 text-red-700 border border-red-200/60",
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
  const router = useRouter();
  const urlProductId = searchParams.get("productId");
  const urlSearch = searchParams.get("search");

  const [links, setLinks] = useState<LinkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(urlSearch || "");
  const [statusFilter, setStatusFilter] = useState("");
  const [showOnlyDeadLinks, setShowOnlyDeadLinks] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false);
  const [isAffiliateModalOpen, setIsAffiliateModalOpen] = useState(false);
  const [isGeoModalOpen, setIsGeoModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<any>(null);
  const [historyLinkLog, setHistoryLinkLog] = useState<any>(null);
  const [viewingRemarks, setViewingRemarks] = useState<string | null>(null);
  const [unlinkedProducts, setUnlinkedProducts] = useState<any[]>([]);
  const [preselectedProductId, setPreselectedProductId] = useState<number | null>(urlProductId ? parseInt(urlProductId) : null);
  const [currentUserRole, setCurrentUserRole] = useState("");
  const itemsPerPage = 10;

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState("");

  const openConfirm = (message: string, action: () => void) => {
    setConfirmMsg(message);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  useEffect(() => {
    if (urlProductId) {
      setPreselectedProductId(parseInt(urlProductId));
      setIsAddLinkOpen(true);
    }
  }, [urlProductId]);

  const handleExportCSV = () => {
    const headers = ["ID", "Product", "Site", "Article Link", "Bridge Page", "Affiliate Name", "Affiliate Link", "Geos", "Status", "Added By", "Date", "Remarks"];
    const rows = filtered.map((l) => [
      l.id.toString(),
      l.product.name,
      l.product.site?.name || "",
      l.product.article?.articleLink || "",
      l.bridgePageLink || "",
      l.affiliateName,
      l.affiliateLink,
      (l.geos || []).map(g => g.geo).join("; "),
      l.status,
      l.addedBy?.name || "",
      new Date(l.addedAt).toLocaleDateString(),
      l.linkerRemarks || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${(val || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `links_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exported successfully!");
  };

  const handleDeleteLink = async (linkId: number) => {
    openConfirm(
      "Are you sure you want to delete this link log? This action cannot be undone.",
      async () => {
        const uId = session?.user?.id || 2;
        try {
          const res = await fetch(`/api/links/${linkId}?callerId=${uId}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error((await res.json()).error || "Failed to delete link");
          toast.success("Link deleted successfully!");
          refreshLinksData(false);
        } catch (err: any) {
          toast.error(err.message || "Failed to delete link");
        }
      }
    );
  };

  const [stats, setStats] = useState<any>(null);

  const refreshLinksData = (showLoading = false) => {
    if (!session?.user?.id) return;
    const uId = session.user.id;
    const uRole = session.user.role || "WRITER";
    setCurrentUserRole(uRole);

    if (showLoading) setLoading(true);

    Promise.all([
      fetch(`/api/links?userId=${uId}`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/dashboard?userId=${uId}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/products?userId=${uId}`).then((r) => (r.ok ? r.json() : [])),
    ]).then(([linksData, dashboardData, productsData]) => {
      const arr = Array.isArray(linksData) ? linksData : [];
      setLinks(arr);
      setStats(dashboardData);

      const prods = Array.isArray(productsData) ? productsData : [];
      const unlinked = prods.filter((p: any) => !p.linkLogs || p.linkLogs.length === 0);
      setUnlinkedProducts(unlinked);

      const editIdParam = searchParams.get("editLinkId");
      if (editIdParam) {
        const matched = arr.find((l: any) => l.id === parseInt(editIdParam));
        if (matched) {
          setEditingLink(matched);
        }
      }
    }).finally(() => {
      if (showLoading) setLoading(false);
    });
  };

  useEffect(() => {
    refreshLinksData(true);
  }, [session?.user?.id, searchParams]);

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

    const matchDeadOnly = !showOnlyDeadLinks || (
      l.status === "ISSUE" &&
      l.linkerRemarks &&
      /dead|down|404|broken/i.test(l.linkerRemarks)
    );

    return matchSearch && matchStatus && matchUser && matchDate && matchDeadOnly;
  });

  const missingBridgeCount = links.filter(l => !l.bridgePageLink).length;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pageSize = 5;
    const currentBlock = Math.floor((currentPage - 1) / pageSize);
    const startPage = currentBlock * pageSize + 1;
    const endPage = Math.min(totalPages, startPage + pageSize - 1);

    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
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

          {startPage > 1 && (
            <button
              onClick={() => setCurrentPage(startPage - 1)}
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

          {endPage < totalPages && (
            <button
              onClick={() => setCurrentPage(endPage + 1)}
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] text-[#4A4A4A]" suppressHydrationWarning>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#4A4A4A] tracking-tight">Link Logs</h1>
          <p className="text-[#737373] text-sm mt-0.5 font-medium">{links.length} link entries</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {(currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "LINKER") && (
            <>
              <button
                onClick={() => setIsGeoModalOpen(true)}
                className="px-4 py-2 bg-white border border-slate-200 text-[#4A4A4A] rounded-lg text-sm font-semibold hover:bg-[#FAF9F5] shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                <Globe className="w-4 h-4 text-[#6D8196]" />
                GEOs
              </button>
              <button
                onClick={() => setIsAffiliateModalOpen(true)}
                className="px-4 py-2 bg-white border border-slate-200 text-[#4A4A4A] rounded-lg text-sm font-semibold hover:bg-[#FAF9F5] shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                <Tag className="w-4 h-4 text-[#6D8196]" />
                Affiliates
              </button>
              <button 
                onClick={() => setIsAddLinkOpen(true)}
                className="px-4 py-2 bg-[#6D8196] hover:bg-[#5A6D81] text-white rounded-lg text-sm font-semibold shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Link
              </button>
            </>
          )}
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 shadow-sm transition flex items-center gap-2 cursor-pointer">
            <Download className="w-4 h-4 text-slate-500" />
            Export
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      {stats && (currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "TEAM_LEAD" || currentUserRole === "LINKER") && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div 
            onClick={() => {
              setStatusFilter("");
              setShowOnlyDeadLinks(false);
              setCurrentPage(1);
            }}
            className={`bg-white rounded-xl p-5 shadow-sm flex flex-col justify-between h-32 cursor-pointer transition-all border ${
              !statusFilter && !showOnlyDeadLinks 
                ? "border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/5" 
                : "border-slate-200/60 hover:border-indigo-300"
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 mb-2">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.linkStats?.affiliateNetworks || 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Affiliate Networks</p>
            </div>
          </div>

          <div 
            onClick={() => {
              setStatusFilter("");
              setShowOnlyDeadLinks(true);
              setCurrentPage(1);
            }}
            className={`bg-white rounded-xl p-5 shadow-sm flex flex-col justify-between h-32 relative cursor-pointer transition-all border ${
              showOnlyDeadLinks 
                ? "border-rose-500 ring-1 ring-rose-500 bg-rose-50/5" 
                : "border-slate-200/60 hover:border-rose-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full flex items-center gap-1">↓ 2</span>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.linkStats?.deadLinks || 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Dead Links</p>
            </div>
          </div>

          <div 
            onClick={() => {
              setStatusFilter("ISSUE");
              setShowOnlyDeadLinks(false);
              setCurrentPage(1);
            }}
            className={`bg-white rounded-xl p-5 shadow-sm flex flex-col justify-between h-32 cursor-pointer transition-all border ${
              statusFilter === "ISSUE" && !showOnlyDeadLinks 
                ? "border-amber-500 ring-1 ring-amber-500 bg-amber-50/5" 
                : "border-slate-200/60 hover:border-amber-300"
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mb-2">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.linkStats?.issueLinks || 0}</p>
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

      {/* Unlinked Products Section */}
      <PendingLinkLogsSection
        products={unlinkedProducts}
        onAddLink={(productId) => {
          setPreselectedProductId(productId);
          setIsAddLinkOpen(true);
        }}
      />

      {/* Tabs Selector for Links */}
      <div className="flex border-b border-[#CBCBCB]/60 mb-6 gap-2">
        <button
          onClick={() => { setStatusFilter(""); setShowOnlyDeadLinks(false); setCurrentPage(1); }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            !statusFilter && !showOnlyDeadLinks
              ? "border-[#6D8196] text-[#6D8196] font-bold"
              : "border-transparent text-slate-500 hover:text-[#4A4A4A]"
          }`}
        >
          All Links
        </button>
        <button
          onClick={() => { setStatusFilter("ISSUE"); setShowOnlyDeadLinks(false); setCurrentPage(1); }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
            statusFilter === "ISSUE"
              ? "border-rose-500 text-rose-600 font-bold"
              : "border-transparent text-slate-500 hover:text-[#4A4A4A]"
          }`}
        >
          <span>Flagged Links</span>
          {links.filter(l => l.status === "ISSUE").length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-700 rounded-full">
              {links.filter(l => l.status === "ISSUE").length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setStatusFilter("REQUESTED"); setShowOnlyDeadLinks(false); setCurrentPage(1); }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            statusFilter === "REQUESTED"
              ? "border-[#6D8196] text-[#6D8196] font-bold"
              : "border-transparent text-slate-500 hover:text-[#4A4A4A]"
          }`}
        >
          Pending Requests
        </button>
        <button
          onClick={() => { setStatusFilter("ACCEPTED"); setShowOnlyDeadLinks(false); setCurrentPage(1); }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            statusFilter === "ACCEPTED"
              ? "border-[#6D8196] text-[#6D8196] font-bold"
              : "border-transparent text-slate-500 hover:text-[#4A4A4A]"
          }`}
        >
          Accepted Links
        </button>
      </div>

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
            onChange={(e) => { setSearch(e.target.value); setShowOnlyDeadLinks(false); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white placeholder-slate-400 font-medium text-slate-700"
          />
        </div>

        {/* Status Filter */}
        <CustomSelect
          value={statusFilter}
          onChange={(val) => { setStatusFilter(val); setShowOnlyDeadLinks(false); setCurrentPage(1); }}
          options={Object.keys(STATUS_LABELS).map((k) => ({ value: k, label: STATUS_LABELS[k] }))}
          placeholder="All Statuses"
        />

        {/* Added By Filter */}
        <CustomSelect
          value={userFilter}
          onChange={(val) => { setUserFilter(val); setCurrentPage(1); }}
          options={uniqueAdders.map((u) => ({ value: u, label: u }))}
          placeholder="All Adders"
        />

        {/* Date Range Picker */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 uppercase">Date Range</span>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
              setCurrentPage(1);
            }}
            placeholder="Select date range"
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
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Site</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Article Link</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bridge Page</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Affiliate</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Geo</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Added By</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Modified By</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Remarks</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center w-[12%]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map((l) => {
                  const statusStyle = STATUS_STYLES[l.status] || STATUS_STYLES.REQUESTED;
                  const statusLabel = STATUS_LABELS[l.status] || l.status;
                  
                  return (
                    <tr key={l.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-3 py-3.5 max-w-[240px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-semibold text-slate-800 break-words block">{l.product.name}</span>
                          {l.status === "ISSUE" && (
                            <span className="inline-flex items-center text-rose-500 hover:text-rose-700 cursor-pointer" title="Flagged Link Issue">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Fix 2: Site Name column */}
                      <td className="px-3 py-3.5">
                        <span className="text-[11px] font-bold text-[#3D4F61] bg-[#6D8196]/15 border border-[#6D8196]/30 px-2 py-0.5 rounded-full">
                          {l.product.site?.name || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        {l.product.article?.articleLink ? (
                          <a href={l.product.article.articleLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#6D8196] hover:text-[#4A4A4A] transition">
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
                          <a href={l.bridgePageLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#6D8196] hover:text-[#4A4A4A] transition">
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
                              <span key={g.geo} className="px-1.5 py-0.5 rounded bg-[#FAF9F5] text-[#4A4A4A] text-[10px] font-bold uppercase border border-[#CBCBCB]">
                                {g.geo}
                              </span>
                            ))
                          ) : (
                            <span className="text-[12px] font-semibold text-slate-300">--</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusStyle}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[13px] font-medium text-slate-600">{l.addedBy?.name || "—"}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        {l.updatedBy?.name ? (
                          <span className="text-[11px] font-semibold text-[#3D4F61] bg-[#6D8196]/10 px-2 py-0.5 rounded-md border border-[#6D8196]/20">
                            {l.updatedBy.name}
                          </span>
                        ) : (
                          <span className="text-[12px] text-slate-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[12px] font-medium text-slate-500">
                          {new Date(l.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                      {/* Fix 4: Remarks column */}
                      <td className="px-3 py-3.5 text-center">
                        {l.linkerRemarks ? (
                          <button
                            onClick={() => setViewingRemarks(l.linkerRemarks || "")}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#CBCBCB] bg-white text-[#4A4A4A] hover:text-[#6D8196] hover:border-[#6D8196] hover:bg-[#FAF9F5] transition-all text-[10px] font-bold cursor-pointer shadow-2xs"
                            title="View Remarks Details"
                          >
                            <Info className="w-3.5 h-3.5" />
                            View
                          </button>
                        ) : (
                          <span className="text-[12px] font-semibold text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setHistoryLinkLog(l)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#CBCBCB] bg-white text-[#4A4A4A] hover:text-[#6D8196] hover:border-[#6D8196] hover:bg-[#FAF9F5] transition-all text-[10px] font-bold cursor-pointer shadow-2xs"
                            title="View History Details"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            Details
                          </button>
                          {(currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "LINKER") && (
                            <>
                              <button
                                onClick={() => setEditingLink(l)}
                                className="p-1.5 rounded-md border border-[#CBCBCB] bg-white text-slate-500 hover:text-[#6D8196] hover:border-[#6D8196] hover:bg-[#FAF9F5] transition cursor-pointer shadow-2xs"
                                title="Edit Link"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteLink(l.id)}
                                className="p-1.5 rounded-md border border-[#CBCBCB] bg-white text-slate-500 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition cursor-pointer shadow-2xs"
                                title="Delete Link"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {renderPagination()}
          </div>
        )}
      </div>

      <GeoManageModal
        isOpen={isGeoModalOpen}
        onClose={() => setIsGeoModalOpen(false)}
      />

      <AffiliateManageModal
        isOpen={isAffiliateModalOpen}
        onClose={() => setIsAffiliateModalOpen(false)}
      />

      <AddLinkModal 
        isOpen={isAddLinkOpen} 
        onClose={() => {
          setIsAddLinkOpen(false);
          setPreselectedProductId(null);
          if (urlProductId) {
            router.replace("/links");
          }
        }} 
        onSuccess={() => {
          setIsAddLinkOpen(false);
          setPreselectedProductId(null);
          if (urlProductId) {
            router.replace("/links");
          }
          refreshLinksData(false);
        }} 
        preselectedProductId={preselectedProductId}
      />

      <EditLinkModal
        isOpen={!!editingLink}
        onClose={() => {
          setEditingLink(null);
          if (searchParams.get("editLinkId")) {
            router.replace("/links");
          }
        }}
        onSuccess={() => {
          setEditingLink(null);
          if (searchParams.get("editLinkId")) {
            router.replace("/links");
          }
          refreshLinksData(false);
        }}
        link={editingLink}
      />

      <LinkHistoryModal
        isOpen={!!historyLinkLog}
        onClose={() => setHistoryLinkLog(null)}
        linkLog={historyLinkLog}
      />

      {/* Remarks Popup Modal */}
      {viewingRemarks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800">Linker Remarks</h3>
              <button
                onClick={() => setViewingRemarks(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <FormattedRemarks remarks={viewingRemarks} textClass="text-xs font-semibold" />
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setViewingRemarks(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 shadow-sm transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete Link Log"
        message={confirmMsg}
        confirmLabel="Delete Link"
        variant="danger"
        onConfirm={() => {
          setConfirmOpen(false);
          confirmAction?.();
        }}
        onCancel={() => setConfirmOpen(false)}
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
