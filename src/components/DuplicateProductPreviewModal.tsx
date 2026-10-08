"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-hot-toast";
import {
  X,
  Globe,
  Check,
  AlertCircle,
  ExternalLink,
  Plus,
  Loader2,
  Package,
  User,
  Search,
  Sparkles,
  ShieldCheck,
  FileText,
  RefreshCw,
  Target,
  Compass,
  ArrowUpRight,
} from "lucide-react";

export interface SiteAvailabilityItem {
  siteId: number;
  siteName: string;
  siteUrl?: string | null;
  isAvailable: boolean;
  isResearchedTarget: boolean;
  product?: {
    id: number;
    name: string;
    slug?: string | null;
    country?: string | null;
    categoryId?: number | null;
    categoryName?: string | null;
    productCategory?: string | null;
    addedAt?: string | null;
    addedBy?: string | null;
    addedByRole?: string | null;
    researchedBy?: string | null;
    addedToSiteBy?: string | null;
    addedToSiteByRole?: string | null;
    article?: {
      id: number;
      status: string;
      writerName?: string | null;
    } | null;
    linkCount?: number;
  } | null;
}

export interface DuplicatePreviewData {
  productName: string;
  baseProductId?: number;
  researchedBy?: string | null;
  researchedByRole?: string | null;
  addedBy?: string | null;
  addedByRole?: string | null;
  addedToSiteBy?: string | null;
  targetSites?: string | null;
  totalSites: number;
  availableCount: number;
  missingCount: number;
  sites: SiteAvailabilityItem[];
}

interface DuplicateProductPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId?: number | null;
  productName: string;
  onProductAddedToSite?: (siteId: number, siteName: string) => void;
}

export default function DuplicateProductPreviewModal({
  isOpen,
  onClose,
  productId,
  productName,
  onProductAddedToSite,
}: DuplicateProductPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DuplicatePreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingSiteId, setAddingSiteId] = useState<number | null>(null);
  const [batchAdding, setBatchAdding] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "missing" | "available">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAvailability = useCallback(async () => {
    if (!productName && !productId) return;
    setLoading(true);
    setError(null);
    try {
      const url = productId
        ? `/api/products/${productId}/site-availability`
        : `/api/products/by-name/site-availability?name=${encodeURIComponent(productName.trim())}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load site availability");
      }
      const json: DuplicatePreviewData = await res.json();
      setData(json);
    } catch (e: any) {
      console.error("Duplicate preview load failed:", e);
      setError(e.message || "Failed to load product details");
    } finally {
      setLoading(false);
    }
  }, [productId, productName]);

  useEffect(() => {
    if (isOpen) {
      fetchAvailability();
      setFilterMode("all");
      setSearchQuery("");
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, fetchAvailability]);

  const handleAddToSite = async (siteId: number, siteName: string) => {
    setAddingSiteId(siteId);
    try {
      const effectiveId = productId || data?.baseProductId || "by-name";
      const res = await fetch(`/api/products/${effectiveId}/site-availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetSiteId: siteId,
          productName: productName.trim(),
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || `Failed to add product to ${siteName}`);
      }

      toast.success(`Successfully added "${data?.productName || productName}" to ${siteName}!`);
      await fetchAvailability();
      onProductAddedToSite?.(siteId, siteName);
    } catch (err: any) {
      toast.error(err.message || "Failed to add product to site");
    } finally {
      setAddingSiteId(null);
    }
  };

  const handleAddAllMissingSites = async () => {
    if (!data) return;
    const missingSiteIds = data.sites.filter((s) => !s.isAvailable).map((s) => s.siteId);
    if (missingSiteIds.length === 0) return;

    setBatchAdding(true);
    try {
      const effectiveId = productId || data.baseProductId || "by-name";
      const res = await fetch(`/api/products/${effectiveId}/site-availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetSiteIds: missingSiteIds,
          productName: productName.trim(),
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to add product to missing sites");
      }

      toast.success(
        `Successfully published "${data.productName}" to ${resData.createdCount || missingSiteIds.length} site(s)!`
      );
      await fetchAvailability();
      missingSiteIds.forEach((sId) => {
        const site = data.sites.find((s) => s.siteId === sId);
        onProductAddedToSite?.(sId, site?.siteName || "");
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to add to missing sites");
    } finally {
      setBatchAdding(false);
    }
  };

  // Parse comma or newline separated target sites into interactive tags
  const researchedTargetSitesList = useMemo(() => {
    if (!data?.targetSites) return [];
    return data.targetSites
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [data?.targetSites]);

  const filteredSites = useMemo(() => {
    if (!data?.sites) return [];
    return data.sites.filter((s) => {
      if (filterMode === "missing" && s.isAvailable) return false;
      if (filterMode === "available" && !s.isAvailable) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.siteName.toLowerCase().includes(q) ||
          (s.siteUrl || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data?.sites, filterMode, searchQuery]);

  if (!isOpen) return null;

  const coveragePercent =
    data && data.totalSites > 0
      ? Math.round((data.availableCount / data.totalSites) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div
        className="bg-white dark:bg-[#0c1427] border border-slate-200/90 dark:border-slate-800/90 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-5xl xl:max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-scaleUp transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-6 py-4 sm:py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-slate-50/70 dark:from-[#111c33] dark:via-[#0c1427] dark:to-[#111c33]">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-500/20 to-orange-500/20 dark:from-rose-500/30 dark:to-orange-500/30 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 shadow-inner">
              <Package className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                  {data?.productName || productName}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 shrink-0">
                  Existing in Catalog
                </span>
                {data?.baseProductId && (
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                    #{data.baseProductId}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Duplicate product verification · Cross-site availability breakdown & 1-click publishing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-3">
            <button
              type="button"
              onClick={() => fetchAvailability()}
              title="Refresh availability"
              className="w-9 h-9 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center justify-center transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {loading ? (
            <div className="py-24 text-center space-y-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Inspecting Product Records...
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cross-referencing researcher database, catalog history, and website availability
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          ) : data ? (
            <>
              {/* 1. Top Attribution & Coverage Cards Deck */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* Researcher Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 to-indigo-50/40 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-200/60 dark:border-blue-900/50 flex items-start gap-3.5 shadow-2xs">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/20">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 block">
                      Researched By
                    </span>
                    <h4 className="font-extrabold text-slate-900 dark:text-white text-base truncate mt-0.5">
                      {data.researchedBy || "Unassigned Researcher"}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {data.researchedByRole || "Product Researcher"}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        Trendmap / Research
                      </span>
                    </div>
                  </div>
                </div>

                {/* Submitter / Added By Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-teal-50/40 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200/60 dark:border-emerald-900/50 flex items-start gap-3.5 shadow-2xs">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                      Added To System By
                    </span>
                    <h4 className="font-extrabold text-slate-900 dark:text-white text-base truncate mt-0.5">
                      {data.addedBy || "Unknown User"}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {data.addedByRole || "Catalog Submitter"}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        Catalog Database
                      </span>
                    </div>
                  </div>
                </div>

                {/* Coverage & Status Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/70 to-indigo-50/40 dark:from-purple-950/30 dark:to-indigo-950/20 border border-purple-200/60 dark:border-purple-900/50 flex items-start gap-3.5 shadow-2xs">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/20">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">
                      Website Coverage
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <h4 className="font-black text-slate-900 dark:text-white text-base">
                        {data.availableCount} / {data.totalSites} Sites
                      </h4>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        ({coveragePercent}%)
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                      {data.missingCount === 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          ✓ Available on all target websites
                        </span>
                      ) : (
                        <span>{data.missingCount} site(s) waiting for addition</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Researched Target Sites Pill Deck */}
              {researchedTargetSitesList.length > 0 && (
                <div className="p-4 bg-slate-50/90 dark:bg-[#11192b] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Researched Target Sites ({researchedTargetSitesList.length})
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Recommended by product researcher
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {researchedTargetSitesList.map((targetSiteName, idx) => {
                      const matchedSite = data.sites.find(
                        (s) =>
                          s.siteName.toLowerCase() === targetSiteName.toLowerCase()
                      );
                      const isAvail = matchedSite?.isAvailable;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSearchQuery(targetSiteName)}
                          className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border shadow-2xs ${
                            isAvail
                              ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                              : "bg-white dark:bg-[#152037] text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 hover:border-blue-400"
                          }`}
                        >
                          <span className="text-amber-500">★</span>
                          <span>{targetSiteName}</span>
                          {isAvail ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Available on this site" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Missing on this site" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Availability Overview & Batch Action Bar */}
              <div className="p-4 sm:p-5 bg-white dark:bg-[#101a2f] rounded-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-2xs space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Website Availability Overview
                    </h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        {data.availableCount} Available
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-semibold text-rose-500 dark:text-rose-400">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        {data.missingCount} Missing
                      </span>
                      <span>•</span>
                      <span>{data.totalSites} Total Websites</span>
                    </div>
                  </div>

                  {data.missingCount > 0 && (
                    <button
                      type="button"
                      disabled={batchAdding}
                      onClick={handleAddAllMissingSites}
                      className="px-4 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {batchAdding ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Publishing to All Missing Sites...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>Add to All Missing Sites ({data.missingCount})</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Two-Tone Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full bg-slate-100 dark:bg-slate-800/80 h-2.5 rounded-full overflow-hidden flex shadow-inner">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500"
                      style={{ width: `${coveragePercent}%` }}
                      title={`${coveragePercent}% Available`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-0.5">
                    <span>{coveragePercent}% Published</span>
                    <span>{100 - coveragePercent}% Missing</span>
                  </div>
                </div>
              </div>

              {/* 4. Filter Tabs & Search Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                <div className="inline-flex p-1 bg-slate-100 dark:bg-[#131d31] rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                      filterMode === "all"
                        ? "bg-white dark:bg-[#0b1120] text-slate-900 dark:text-white shadow-xs font-bold"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    <span>All Websites</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/70 dark:bg-slate-800">
                      {data.totalSites}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("missing")}
                    className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                      filterMode === "missing"
                        ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60 shadow-xs font-bold"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    <span>Missing</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                      {data.missingCount}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("available")}
                    className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                      filterMode === "available"
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 shadow-xs font-bold"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    <span>Available</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                      {data.availableCount}
                    </span>
                  </button>
                </div>

                <div className="relative flex-1 sm:max-w-xs">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter websites..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#162238] transition"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* 5. 2-Column Responsive Grid of Website Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[48vh] overflow-y-auto pr-1">
                {filteredSites.length === 0 ? (
                  <div className="lg:col-span-2 text-center py-12 rounded-2xl bg-slate-50 dark:bg-[#101a2f] border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                    <Globe className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No websites match your current filter.
                    </p>
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                      >
                        Clear search query
                      </button>
                    )}
                  </div>
                ) : (
                  filteredSites.map((site) => {
                    const isAddingThis = addingSiteId === site.siteId;

                    return (
                      <div
                        key={site.siteId}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                          site.isAvailable
                            ? "bg-slate-50/70 dark:bg-[#0b1325] border-slate-200/90 dark:border-slate-800/90 hover:border-emerald-300 dark:hover:border-emerald-800"
                            : "bg-white dark:bg-[#111c2e] border-slate-200/90 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 shadow-2xs"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          {/* Site Info & Tags */}
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                                {site.siteName}
                              </span>
                              {site.isResearchedTarget && !site.isAvailable && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                                  <span>★</span> Researched Target
                                </span>
                              )}
                            </div>

                            {site.siteUrl && (
                              <a
                                href={site.siteUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-slate-400 hover:text-blue-500 flex items-center gap-1 truncate max-w-[280px]"
                              >
                                <span>{site.siteUrl.replace(/^https?:\/\//i, "")}</span>
                                <ArrowUpRight className="w-3 h-3 shrink-0" />
                              </a>
                            )}
                          </div>

                          {/* Quick Badge */}
                          <div className="shrink-0">
                            {site.isAvailable ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Active</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                                Missing
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bottom Row / Status / Actions */}
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between gap-2 flex-wrap">
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 min-w-0">
                            {site.isAvailable ? (
                              <div className="space-y-0.5">
                                {site.product?.article ? (
                                  <span className="flex items-center gap-1 truncate">
                                    <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>
                                      Article: <strong>{site.product.article.status}</strong>
                                      {site.product.article.writerName && ` (${site.product.article.writerName})`}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">Ready for Article</span>
                                )}
                                {site.product?.addedBy && (
                                  <span className="block text-[10px] text-slate-400 truncate">
                                    Added by {site.product.addedBy}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">
                                Not published on this site yet
                              </span>
                            )}
                          </div>

                          <div className="shrink-0">
                            {site.isAvailable ? (
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 px-2 py-1">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                <span>Published</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={isAddingThis || batchAdding}
                                onClick={() => handleAddToSite(site.siteId, site.siteName)}
                                className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                {isAddingThis ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Publishing...</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                    <span>Add to this site</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#11192b] flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Adding to missing websites automatically links categories and prepares articles for writing.</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
