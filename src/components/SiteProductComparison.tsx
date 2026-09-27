/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  GitCompare,
  Search,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  Download,
  ExternalLink,
  Layers,
  ArrowRight,
  Filter,
  Check,
  X,
  Sparkles,
  ChevronDown,
  Globe,
  SlidersHorizontal,
  Copy,
  Info,
  Building2,
  FileText,
  Link as LinkIcon,
  Tag,
  ArrowLeftRight
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useSession } from "next-auth/react";
import ConfirmDialog from "@/components/ConfirmDialog";

interface SiteInfo {
  id: number;
  name: string;
  url?: string | null;
  allowCountrySpecific?: boolean;
  categories?: { id: number; name: string }[];
  _count?: { products: number };
}

interface SiteProductInfo {
  id: number;
  name: string;
  slug?: string | null;
  country?: string | null;
  siteId: number;
  siteName: string;
  categoryId: number;
  categoryName?: string;
  productCategory?: string | null;
  affiliateName?: string | null;
  trendLevel?: string | null;
  trendLink?: string | null;
  previewLink?: string | null;
  remarks?: string | null;
  status: string;
  writerName?: string | null;
  articleLink?: string | null;
  linksCount: number;
  hasAcceptedLinks: boolean;
  hasBridgePage: boolean;
  addedAt: string;
  addedByName?: string;
}

interface ComparedProduct {
  key: string;
  name: string;
  slug?: string | null;
  country?: string | null;
  productCategory?: string | null;
  affiliateName?: string | null;
  trendLevel?: string | null;
  trendLink?: string | null;
  previewLink?: string | null;
  remarks?: string | null;
  categoryId?: number;
  categoryName?: string;
  sampleProductId: number;
  sites: Record<number, SiteProductInfo | null>;
  presentSiteIds: number[];
  missingSiteIds: number[];
  isSimilar: boolean;
  isDifferent: boolean;
}

interface CompareData {
  allSites: SiteInfo[];
  selectedSites: SiteInfo[];
  comparedProducts: ComparedProduct[];
  stats: {
    totalProducts: number;
    similarCount: number;
    differentCount: number;
    selectedSiteCounts: Record<number, { total: number; missing: number; siteName: string }>;
  };
}

export default function SiteProductComparison({
  currentUserRole = "LINKER",
}: {
  currentUserRole?: string;
}) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CompareData | null>(null);
  const [selectedSiteIds, setSelectedSiteIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "similar" | "different">("all");
  const [missingInSiteFilter, setMissingInSiteFilter] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"matrix" | "diff">("matrix");

  // State for single adding modal
  const [addingModalItem, setAddingModalItem] = useState<{
    targetSiteId: number;
    targetSiteName: string;
    product: ComparedProduct;
  } | null>(null);
  const [modalForm, setModalForm] = useState({
    name: "",
    slug: "",
    country: "",
    productCategory: "",
    affiliateName: "",
    trendLevel: "HIGH",
    trendLink: "",
    previewLink: "",
    remarks: "",
    categoryId: 0,
  });
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Quick-add loading indicator per `key-siteId`
  const [addingProgressKey, setAddingProgressKey] = useState<string | null>(null);

  // Batch sync modal state
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchTargetSiteId, setBatchTargetSiteId] = useState<number | null>(null);
  const [batchSelectedProductKeys, setBatchSelectedProductKeys] = useState<string[]>([]);
  const [submittingBatch, setSubmittingBatch] = useState(false);

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState("");
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  const openConfirm = (msg: string, action: () => void) => {
    setConfirmMsg(msg);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  // Fetch comparison data
  const fetchCompareData = useCallback(
    async (siteIdsOverride?: number[], showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        const idsToFetch = siteIdsOverride ?? selectedSiteIds;
        if (idsToFetch.length > 0) {
          queryParams.set("siteIds", idsToFetch.join(","));
        }
        if (search.trim()) {
          queryParams.set("search", search.trim());
        }

        const res = await fetch(`/api/products/compare?${queryParams.toString()}`);
        if (!res.ok) {
          throw new Error("Failed to load comparison data");
        }
        const json: CompareData = await res.json();
        setData(json);

        // Update selected site IDs from response if not initialized
        if (selectedSiteIds.length === 0 && json.selectedSites.length > 0) {
          setSelectedSiteIds(json.selectedSites.map((s) => s.id));
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to load comparison data");
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [selectedSiteIds, search]
  );

  // Initial load
  useEffect(() => {
    fetchCompareData(undefined, true);
  }, []);

  // When search or selected sites change, refresh with brief debounce
  const handleSiteSelectionChange = (newIds: number[]) => {
    if (newIds.length === 0) {
      toast.error("Please keep at least 1 site selected.");
      return;
    }
    setSelectedSiteIds(newIds);
    fetchCompareData(newIds, true);
  };

  const toggleSite = (siteId: number) => {
    let next: number[];
    if (selectedSiteIds.includes(siteId)) {
      if (selectedSiteIds.length <= 1) {
        toast.error("You must have at least one site selected for comparison.");
        return;
      }
      next = selectedSiteIds.filter((id) => id !== siteId);
    } else {
      next = [...selectedSiteIds, siteId];
    }
    handleSiteSelectionChange(next);
  };

  // Preset quick filters
  const handleSelectPreset = (preset: "all" | "ecom" | "nutra" | "first_two") => {
    if (!data?.allSites) return;
    let nextIds: number[] = [];
    if (preset === "all") {
      nextIds = data.allSites.map((s) => s.id);
    } else if (preset === "ecom") {
      nextIds = data.allSites
        .filter((s) => (s.categories || []).some((c) => c.name.toLowerCase().includes("ecom")))
        .map((s) => s.id);
      if (nextIds.length === 0) nextIds = data.allSites.slice(0, 4).map((s) => s.id);
    } else if (preset === "nutra") {
      nextIds = data.allSites
        .filter((s) => (s.categories || []).some((c) => c.name.toLowerCase().includes("nutra")))
        .map((s) => s.id);
      if (nextIds.length === 0) nextIds = data.allSites.slice(0, 3).map((s) => s.id);
    } else if (preset === "first_two") {
      nextIds = data.allSites.slice(0, 2).map((s) => s.id);
    }
    handleSiteSelectionChange(nextIds);
  };

  // Filtered products on client side based on filterMode & missingInSiteFilter
  const filteredProducts = useMemo(() => {
    if (!data?.comparedProducts) return [];
    return data.comparedProducts.filter((item) => {
      // Search filter is also handled on client for instantaneous response
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesSlug = item.slug ? item.slug.toLowerCase().includes(q) : false;
        const matchesCategory = item.productCategory ? item.productCategory.toLowerCase().includes(q) : false;
        const matchesAffiliate = item.affiliateName ? item.affiliateName.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesSlug && !matchesCategory && !matchesAffiliate) return false;
      }

      if (filterMode === "similar" && !item.isSimilar) return false;
      if (filterMode === "different" && !item.isDifferent) return false;

      if (missingInSiteFilter) {
        if (!item.missingSiteIds.includes(missingInSiteFilter)) return false;
      }

      return true;
    });
  }, [data?.comparedProducts, search, filterMode, missingInSiteFilter]);

  // Quick Add function: adds missing product to site instantly
  const handleQuickAdd = async (product: ComparedProduct, targetSiteId: number) => {
    const targetSite = data?.allSites.find((s) => s.id === targetSiteId);
    if (!targetSite) return;

    const opKey = `${product.key}-${targetSiteId}`;
    setAddingProgressKey(opKey);

    try {
      const res = await fetch("/api/products/compare/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetSiteId,
          sourceProductId: product.sampleProductId,
          name: product.name,
          slug: product.slug,
          country: product.country,
          productCategory: product.productCategory,
          affiliateName: product.affiliateName,
          trendLevel: product.trendLevel || "HIGH",
          trendLink: product.trendLink || "",
          previewLink: product.previewLink || "https://google.com",
          remarks: product.remarks || "",
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Failed to add product");
      }

      const createdProduct = resJson.created?.[0];
      toast.success(`"${product.name}" successfully added to ${targetSite.name}!`);

      // Optimistically update local state so the badge turns green immediately
      setData((prev) => {
        if (!prev) return prev;
        const updatedCompared = prev.comparedProducts.map((p) => {
          if (p.key !== product.key) return p;

          const updatedSites = {
            ...p.sites,
            [targetSiteId]: {
              id: createdProduct?.id || Date.now(),
              name: p.name,
              slug: p.slug,
              country: p.country,
              siteId: targetSiteId,
              siteName: targetSite.name,
              categoryId: createdProduct?.categoryId || 0,
              categoryName: createdProduct?.category?.name || "Ecom",
              productCategory: p.productCategory,
              affiliateName: p.affiliateName,
              trendLevel: p.trendLevel,
              trendLink: p.trendLink,
              previewLink: p.previewLink,
              remarks: p.remarks,
              status: "PENDING",
              writerName: null,
              articleLink: null,
              linksCount: 0,
              hasAcceptedLinks: false,
              hasBridgePage: false,
              addedAt: new Date().toISOString(),
              addedByName: session?.user?.name || "Linker",
            },
          };

          const newPresentSiteIds = [...p.presentSiteIds, targetSiteId];
          const newMissingSiteIds = p.missingSiteIds.filter((id) => id !== targetSiteId);

          return {
            ...p,
            sites: updatedSites,
            presentSiteIds: newPresentSiteIds,
            missingSiteIds: newMissingSiteIds,
            isSimilar: newMissingSiteIds.length === 0,
            isDifferent: newMissingSiteIds.length > 0,
          };
        });

        // Recompute stats
        const newSimilarCount = updatedCompared.filter((p) => p.isSimilar).length;
        const newDifferentCount = updatedCompared.filter((p) => p.isDifferent).length;

        const updatedSiteCounts = { ...prev.stats.selectedSiteCounts };
        if (updatedSiteCounts[targetSiteId]) {
          updatedSiteCounts[targetSiteId] = {
            ...updatedSiteCounts[targetSiteId],
            total: updatedSiteCounts[targetSiteId].total + 1,
            missing: Math.max(0, updatedSiteCounts[targetSiteId].missing - 1),
          };
        }

        return {
          ...prev,
          comparedProducts: updatedCompared,
          stats: {
            ...prev.stats,
            similarCount: newSimilarCount,
            differentCount: newDifferentCount,
            selectedSiteCounts: updatedSiteCounts,
          },
        };
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to add product to site");
    } finally {
      setAddingProgressKey(null);
    }
  };

  // Open Edit & Add Modal
  const openEditAndAdd = (product: ComparedProduct, targetSiteId: number) => {
    const targetSite = data?.allSites.find((s) => s.id === targetSiteId);
    if (!targetSite) return;

    // Pick first category of target site if available
    const initialCatId = targetSite.categories?.[0]?.id || product.categoryId || 0;

    setModalForm({
      name: product.name,
      slug: product.slug || "",
      country: product.country || "",
      productCategory: product.productCategory || "",
      affiliateName: product.affiliateName || "",
      trendLevel: product.trendLevel || "HIGH",
      trendLink: product.trendLink || "",
      previewLink: product.previewLink || "https://google.com",
      remarks: product.remarks || "",
      categoryId: initialCatId,
    });

    setAddingModalItem({
      targetSiteId,
      targetSiteName: targetSite.name,
      product,
    });
  };

  // Submit Edit & Add Modal
  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingModalItem) return;

    if (!modalForm.name.trim()) {
      toast.error("Product name is required.");
      return;
    }

    setSubmittingAdd(true);
    try {
      const res = await fetch("/api/products/compare/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetSiteId: addingModalItem.targetSiteId,
          sourceProductId: addingModalItem.product.sampleProductId,
          name: modalForm.name.trim(),
          slug: modalForm.slug.trim() || undefined,
          country: modalForm.country.trim() || undefined,
          productCategory: modalForm.productCategory.trim() || undefined,
          affiliateName: modalForm.affiliateName.trim() || undefined,
          trendLevel: modalForm.trendLevel,
          trendLink: modalForm.trendLink.trim() || undefined,
          previewLink: modalForm.previewLink.trim() || undefined,
          remarks: modalForm.remarks.trim() || undefined,
          categoryId: modalForm.categoryId || undefined,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Failed to add product");
      }

      toast.success(`"${modalForm.name}" added to ${addingModalItem.targetSiteName}!`);
      setAddingModalItem(null);
      fetchCompareData(undefined, false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add product to site");
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Open Batch Sync Modal
  const openBatchSync = (targetSiteId?: number) => {
    const siteId = targetSiteId || (data?.selectedSites?.[0]?.id ?? null);
    if (!siteId) return;

    setBatchTargetSiteId(siteId);

    // Collect all products missing on this target site
    const missingKeys = (data?.comparedProducts || [])
      .filter((p) => p.missingSiteIds.includes(siteId))
      .map((p) => p.key);

    setBatchSelectedProductKeys(missingKeys);
    setBatchModalOpen(true);
  };

  // Submit Batch Sync
  const handleBatchSyncSubmit = async () => {
    if (!batchTargetSiteId) return;
    const targetSite = data?.allSites.find((s) => s.id === batchTargetSiteId);
    if (!targetSite) return;

    if (batchSelectedProductKeys.length === 0) {
      toast.error("Please select at least one product to sync.");
      return;
    }

    const itemsToSync = (data?.comparedProducts || [])
      .filter((p) => batchSelectedProductKeys.includes(p.key))
      .map((p) => ({
        targetSiteId: batchTargetSiteId,
        sourceProductId: p.sampleProductId,
        name: p.name,
        slug: p.slug,
        country: p.country,
        productCategory: p.productCategory,
        affiliateName: p.affiliateName,
        trendLevel: p.trendLevel || "HIGH",
        trendLink: p.trendLink || "",
        previewLink: p.previewLink || "https://google.com",
        remarks: p.remarks || `Batch synced from compare tool`,
      }));

    setSubmittingBatch(true);
    try {
      const res = await fetch("/api/products/compare/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToSync }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Batch sync failed");
      }

      toast.success(`Successfully added ${resJson.count || itemsToSync.length} products to ${targetSite.name}!`);
      setBatchModalOpen(false);
      fetchCompareData(undefined, false);
    } catch (err: any) {
      toast.error(err.message || "Failed to batch sync products");
    } finally {
      setSubmittingBatch(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!data || !data.selectedSites) return;

    const headers = [
      "Product Name",
      "Category",
      "Affiliate Network",
      "Trend Level",
      "Status Overall",
      ...data.selectedSites.map((s) => `${s.name} (Status)`),
    ];

    const rows = filteredProducts.map((p) => {
      const siteStatuses = data.selectedSites.map((s) => {
        const siteProd = p.sites[s.id];
        if (!siteProd) return "MISSING";
        return `PRESENT (${siteProd.status || "PENDING"})`;
      });

      return [
        `"${p.name.replace(/"/g, '""')}"`,
        `"${(p.productCategory || p.categoryName || "").replace(/"/g, '""')}"`,
        `"${(p.affiliateName || "").replace(/"/g, '""')}"`,
        `"${p.trendLevel || "HIGH"}"`,
        `"${p.isSimilar ? "COMMON / ON ALL" : "DIFFERENT / MISSING"}"`,
        ...siteStatuses.map((s) => `"${s}"`),
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `product_comparison_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Comparison CSV exported successfully!");
  };

  const selectedSitesList = data?.selectedSites || [];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ─── HEADER BAR ────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
                Cross-Site Product Comparison
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Linker Sync Tool
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Compare products across multiple sites, analyze common and missing items, and sync missing products with one click.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchCompareData(undefined, true)}
            disabled={loading}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title="Refresh comparison"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-500" : ""}`} />
            Refresh
          </button>

          <button
            onClick={handleExportCSV}
            disabled={!data || filteredProducts.length === 0}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export CSV
          </button>

          {(currentUserRole === "LINKER" || currentUserRole === "ADMIN" || currentUserRole === "SUPER_ADMIN") && (
            <button
              onClick={() => openBatchSync()}
              disabled={!data || data.stats.differentCount === 0}
              className="px-3.5 py-2 bg-[#6D8196] hover:bg-[#5A6D81] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-40"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Batch Sync Missing
            </button>
          )}
        </div>
      </div>

      {/* ─── SITE SELECTION PANEL ────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Select Sites to Compare ({selectedSiteIds.length} of {data?.allSites.length || 0} selected)
            </span>
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-medium text-slate-400 mr-1">Quick Select:</span>
            <button
              onClick={() => handleSelectPreset("all")}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
            >
              All Sites
            </button>
            <button
              onClick={() => handleSelectPreset("first_two")}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
            >
              First 2 Sites
            </button>
            <button
              onClick={() => handleSelectPreset("ecom")}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
            >
              Ecom Sites
            </button>
            <button
              onClick={() => handleSelectPreset("nutra")}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
            >
              Nutra Sites
            </button>
          </div>
        </div>

        {/* Site Pills Grid */}
        <div className="flex flex-wrap gap-2 pt-1">
          {(data?.allSites || []).map((site) => {
            const isSelected = selectedSiteIds.includes(site.id);
            const siteStat = data?.stats.selectedSiteCounts?.[site.id];

            return (
              <button
                key={site.id}
                onClick={() => toggleSite(site.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 shadow-2xs"
                    : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded flex items-center justify-center transition-colors ${
                    isSelected ? "bg-indigo-600 text-white" : "border border-slate-300 dark:border-slate-600"
                  }`}
                >
                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
                <span className="font-bold">{site.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                  {siteStat ? `${siteStat.total} prods` : `${site._count?.products ?? 0} prods`}
                </span>
                {isSelected && siteStat && siteStat.missing > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold border border-rose-200 dark:border-rose-800">
                    -{siteStat.missing}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── SUMMARY METRICS ────────────────────────────────────────── */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Compared */}
          <div
            onClick={() => {
              setFilterMode("all");
              setMissingInSiteFilter(null);
            }}
            className={`bg-white dark:bg-slate-900 rounded-2xl p-4.5 border transition cursor-pointer shadow-xs ${
              filterMode === "all" && !missingInSiteFilter
                ? "border-indigo-500 ring-2 ring-indigo-500/20"
                : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Unique Products</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
              {data.stats.totalProducts}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Across {selectedSiteIds.length} compared sites</p>
          </div>

          {/* Card 2: Similar / Common on All Sites */}
          <div
            onClick={() => {
              setFilterMode("similar");
              setMissingInSiteFilter(null);
            }}
            className={`bg-white dark:bg-slate-900 rounded-2xl p-4.5 border transition cursor-pointer shadow-xs ${
              filterMode === "similar"
                ? "border-emerald-500 ring-2 ring-emerald-500/20"
                : "border-slate-200/80 dark:border-slate-800 hover:border-emerald-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Similar (On All Sites)
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {data.stats.similarCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Present in 100% of selected sites</p>
          </div>

          {/* Card 3: Different / Missing on 1+ Sites */}
          <div
            onClick={() => {
              setFilterMode("different");
              setMissingInSiteFilter(null);
            }}
            className={`bg-white dark:bg-slate-900 rounded-2xl p-4.5 border transition cursor-pointer shadow-xs ${
              filterMode === "different" && !missingInSiteFilter
                ? "border-amber-500 ring-2 ring-amber-500/20"
                : "border-slate-200/80 dark:border-slate-800 hover:border-amber-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Different (Missing on 1+)
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-500 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
              {data.stats.differentCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Can be synced to missing sites</p>
          </div>

          {/* Card 4: Selected Sites Coverage */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4.5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Site Coverage Gaps</span>
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="space-y-1.5 max-h-16 overflow-y-auto pr-1">
              {selectedSitesList.map((s) => {
                const stat = data.stats.selectedSiteCounts?.[s.id];
                return (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[100px]">{s.name}</span>
                    <span className="text-[11px] font-mono">
                      <span className="text-slate-500">{stat?.total ?? 0} present</span>
                      {stat && stat.missing > 0 ? (
                        <span className="text-rose-500 font-bold ml-1.5">({stat.missing} missing)</span>
                      ) : (
                        <span className="text-emerald-500 font-bold ml-1.5">(synced)</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── CONTROLS, SEARCH & FILTERS BAR ─────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search by product name, category, or affiliate..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 bg-slate-50 dark:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View mode toggle (Matrix vs Side-by-Side Diff) */}
          <div className="flex items-center gap-2">
            {selectedSiteIds.length === 2 && (
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setViewMode("matrix")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    viewMode === "matrix"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  Matrix View
                </button>
                <button
                  onClick={() => setViewMode("diff")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                    viewMode === "diff"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  Side-by-Side Diff
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => {
                setFilterMode("all");
                setMissingInSiteFilter(null);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                filterMode === "all" && !missingInSiteFilter
                  ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              All Products ({data?.comparedProducts.length ?? 0})
            </button>
            <button
              onClick={() => {
                setFilterMode("similar");
                setMissingInSiteFilter(null);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === "similar"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Similar / On All ({data?.stats.similarCount ?? 0})
            </button>
            <button
              onClick={() => {
                setFilterMode("different");
                setMissingInSiteFilter(null);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === "different" && !missingInSiteFilter
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Different / Missing ({data?.stats.differentCount ?? 0})
            </button>
          </div>

          {/* Missing in specific site filter dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400">Show only missing on:</span>
            <select
              value={missingInSiteFilter || ""}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value) : null;
                setMissingInSiteFilter(val);
                if (val) setFilterMode("different");
              }}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Any site</option>
              {selectedSitesList.map((s) => (
                <option key={s.id} value={s.id}>
                  Missing on {s.name} ({data?.stats.selectedSiteCounts?.[s.id]?.missing ?? 0})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── LOADING STATE ─────────────────────────────────────────── */}
      {loading && !data && (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Loading cross-site comparison...</p>
          <p className="text-xs text-slate-400 mt-1">Analyzing products and site coverage</p>
        </div>
      )}

      {/* ─── MAIN CONTENT: MATRIX OR DIFF VIEW ─────────────────────── */}
      {data && (
        <>
          {filteredProducts.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <Layers className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">No products match current filters</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Try clearing your search or switching the filter pills to see all compared items.
              </p>
              <button
                onClick={() => {
                  setSearch("");
                  setFilterMode("all");
                  setMissingInSiteFilter(null);
                }}
                className="mt-4 px-3.5 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : viewMode === "diff" && selectedSitesList.length === 2 ? (
            /* ─── SIDE-BY-SIDE DIFF VIEW (2 SITES) ─────────────────── */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Site A Only */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-rose-200/70 dark:border-rose-900/40 shadow-xs flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-rose-100 dark:border-rose-900/30 mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                      Only on {selectedSitesList[0].name}
                    </h3>
                    <p className="text-[11px] text-slate-400">Missing on {selectedSitesList[1].name}</p>
                  </div>
                  <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                    {filteredProducts.filter((p) => p.sites[selectedSitesList[0].id] && !p.sites[selectedSitesList[1].id]).length}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[600px] pr-1">
                  {filteredProducts
                    .filter((p) => p.sites[selectedSitesList[0].id] && !p.sites[selectedSitesList[1].id])
                    .map((p) => {
                      const prodA = p.sites[selectedSitesList[0].id]!;
                      const isAdding = addingProgressKey === `${p.key}-${selectedSitesList[1].id}`;

                      return (
                        <div
                          key={p.key}
                          className="p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-800 transition space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">{p.name}</h4>
                              <p className="text-[10px] text-slate-400">{p.productCategory || p.categoryName || "General"}</p>
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {prodA.status}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-slate-400">
                              Writer: {prodA.writerName || "Unassigned"}
                            </span>
                            <button
                              onClick={() => handleQuickAdd(p, selectedSitesList[1].id)}
                              disabled={isAdding}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 shadow-2xs transition cursor-pointer disabled:opacity-50"
                              title={`Add to ${selectedSitesList[1].name}`}
                            >
                              {isAdding ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Plus className="w-3 h-3" />
                              )}
                              + Add to {selectedSitesList[1].name}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Both Sites (Common / Similar) */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-emerald-200/70 dark:border-emerald-900/40 shadow-xs flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-100 dark:border-emerald-900/30 mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                      On Both Sites
                    </h3>
                    <p className="text-[11px] text-slate-400">Identical across both sites</p>
                  </div>
                  <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {filteredProducts.filter((p) => p.sites[selectedSitesList[0].id] && p.sites[selectedSitesList[1].id]).length}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[600px] pr-1">
                  {filteredProducts
                    .filter((p) => p.sites[selectedSitesList[0].id] && p.sites[selectedSitesList[1].id])
                    .map((p) => {
                      const prodA = p.sites[selectedSitesList[0].id]!;
                      const prodB = p.sites[selectedSitesList[1].id]!;

                      return (
                        <div
                          key={p.key}
                          className="p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">{p.name}</h4>
                              <p className="text-[10px] text-slate-400">{p.productCategory || p.categoryName || "General"}</p>
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                              Synced
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-slate-100 dark:border-slate-800">
                            <div>
                              <span className="font-bold text-slate-600 dark:text-slate-300">{selectedSitesList[0].name}:</span>{" "}
                              <span className="text-slate-500">{prodA.status}</span>
                            </div>
                            <div>
                              <span className="font-bold text-slate-600 dark:text-slate-300">{selectedSitesList[1].name}:</span>{" "}
                              <span className="text-slate-500">{prodB.status}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Site B Only */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-rose-200/70 dark:border-rose-900/40 shadow-xs flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-rose-100 dark:border-rose-900/30 mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                      Only on {selectedSitesList[1].name}
                    </h3>
                    <p className="text-[11px] text-slate-400">Missing on {selectedSitesList[0].name}</p>
                  </div>
                  <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                    {filteredProducts.filter((p) => !p.sites[selectedSitesList[0].id] && p.sites[selectedSitesList[1].id]).length}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[600px] pr-1">
                  {filteredProducts
                    .filter((p) => !p.sites[selectedSitesList[0].id] && p.sites[selectedSitesList[1].id])
                    .map((p) => {
                      const prodB = p.sites[selectedSitesList[1].id]!;
                      const isAdding = addingProgressKey === `${p.key}-${selectedSitesList[0].id}`;

                      return (
                        <div
                          key={p.key}
                          className="p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-800 transition space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">{p.name}</h4>
                              <p className="text-[10px] text-slate-400">{p.productCategory || p.categoryName || "General"}</p>
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {prodB.status}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-slate-400">
                              Writer: {prodB.writerName || "Unassigned"}
                            </span>
                            <button
                              onClick={() => handleQuickAdd(p, selectedSitesList[0].id)}
                              disabled={isAdding}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 shadow-2xs transition cursor-pointer disabled:opacity-50"
                              title={`Add to ${selectedSitesList[0].name}`}
                            >
                              {isAdding ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Plus className="w-3 h-3" />
                              )}
                              + Add to {selectedSitesList[0].name}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : (
            /* ─── MATRIX TABLE VIEW (DEFAULT) ────────────────────────── */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4 w-[280px]">Product Info</th>
                      <th className="py-3 px-4 w-[160px]">Category & Network</th>
                      <th className="py-3 px-4 w-[120px]">Comparison Status</th>
                      {selectedSitesList.map((site) => (
                        <th key={site.id} className="py-3 px-4 min-w-[170px] text-center border-l border-slate-200/60 dark:border-slate-800">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-extrabold text-slate-800 dark:text-slate-100">{site.name}</span>
                            <span className="text-[9px] font-medium text-slate-400 lowercase">
                              {data.stats.selectedSiteCounts?.[site.id]?.total ?? 0} products
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {filteredProducts.map((p) => {
                      return (
                        <tr
                          key={p.key}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          {/* Col 1: Product Info */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-start gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0 font-bold text-xs uppercase">
                                {p.name.slice(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate">{p.name}</h4>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                  {p.country && (
                                    <span className="font-semibold text-slate-500">[{p.country}]</span>
                                  )}
                                  {p.previewLink && (
                                    <a
                                      href={p.previewLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-indigo-500 hover:text-indigo-600 flex items-center gap-0.5"
                                    >
                                      Preview <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  )}
                                  {p.trendLink && (
                                    <a
                                      href={p.trendLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sky-500 hover:text-sky-600 flex items-center gap-0.5"
                                    >
                                      Trend <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Col 2: Category & Network */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {p.productCategory || p.categoryName || "General"}
                              </span>
                              {p.affiliateName && (
                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                                  {p.affiliateName}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Col 3: Status Overall */}
                          <td className="py-3.5 px-4">
                            {p.isSimilar ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-3 h-3" />
                                On All Sites
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <AlertTriangle className="w-3 h-3" />
                                Missing on {p.missingSiteIds.length} site{p.missingSiteIds.length > 1 ? "s" : ""}
                              </span>
                            )}
                          </td>

                          {/* Site Columns */}
                          {selectedSitesList.map((site) => {
                            const siteProd = p.sites[site.id];
                            const isAdding = addingProgressKey === `${p.key}-${site.id}`;

                            return (
                              <td
                                key={site.id}
                                className="py-3.5 px-4 text-center border-l border-slate-100 dark:border-slate-800 align-middle"
                              >
                                {siteProd ? (
                                  <div className="inline-flex flex-col items-center gap-1 max-w-[150px]">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                                      Present
                                    </span>
                                    <span className="text-[10px] font-semibold text-slate-500">
                                      Status: <strong className="text-slate-700 dark:text-slate-300">{siteProd.status}</strong>
                                    </span>
                                    {siteProd.writerName && (
                                      <span className="text-[9px] text-slate-400 truncate max-w-[130px]">
                                        Writer: {siteProd.writerName}
                                      </span>
                                    )}
                                    {siteProd.linksCount > 0 && (
                                      <span className="text-[9px] text-sky-600 dark:text-sky-400 font-medium">
                                        {siteProd.linksCount} link{siteProd.linksCount > 1 ? "s" : ""}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="inline-flex flex-col items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60">
                                      <X className="w-2.5 h-2.5" />
                                      Missing
                                    </span>

                                    {(currentUserRole === "LINKER" ||
                                      currentUserRole === "ADMIN" ||
                                      currentUserRole === "SUPER_ADMIN") && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => handleQuickAdd(p, site.id)}
                                          disabled={isAdding}
                                          className="px-2 py-1 text-[10px] font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 shadow-2xs transition cursor-pointer disabled:opacity-50"
                                          title={`Add "${p.name}" to ${site.name}`}
                                        >
                                          {isAdding ? (
                                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                          ) : (
                                            <Plus className="w-2.5 h-2.5" />
                                          )}
                                          + Add
                                        </button>

                                        <button
                                          onClick={() => openEditAndAdd(p, site.id)}
                                          disabled={isAdding}
                                          className="p-1 text-[10px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                                          title="Customize & Add"
                                        >
                                          <SlidersHorizontal className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer info */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span>
                  Showing <strong>{filteredProducts.length}</strong> of <strong>{data.comparedProducts.length}</strong> compared products
                </span>
                <span className="text-[11px] text-slate-400">
                  Tip: Click <strong>&quot;+ Add&quot;</strong> to instantly clone a product onto that site. Click the slider icon to customize details.
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── MODAL: EDIT & ADD TO SITE ─────────────────────────────── */}
      {addingModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    Add Product to {addingModalItem.targetSiteName}
                  </h3>
                  <p className="text-xs text-slate-400">Review details before adding to site</p>
                </div>
              </div>
              <button
                onClick={() => setAddingModalItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={modalForm.name}
                  onChange={(e) => setModalForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Target Category *</label>
                  <select
                    value={modalForm.categoryId}
                    onChange={(e) => setModalForm((f) => ({ ...f, categoryId: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold"
                  >
                    {data?.allSites
                      .find((s) => s.id === addingModalItem.targetSiteId)
                      ?.categories?.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Product Category</label>
                  <input
                    type="text"
                    value={modalForm.productCategory}
                    onChange={(e) => setModalForm((f) => ({ ...f, productCategory: e.target.value }))}
                    placeholder="e.g. Skincare, Supplements"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Affiliate Network</label>
                  <input
                    type="text"
                    value={modalForm.affiliateName}
                    onChange={(e) => setModalForm((f) => ({ ...f, affiliateName: e.target.value }))}
                    placeholder="e.g. ShareASale, Amazon"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Country (Optional)</label>
                  <input
                    type="text"
                    value={modalForm.country}
                    onChange={(e) => setModalForm((f) => ({ ...f, country: e.target.value }))}
                    placeholder="e.g. US, UK (leave empty for all)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Preview Link</label>
                <input
                  type="url"
                  value={modalForm.previewLink}
                  onChange={(e) => setModalForm((f) => ({ ...f, previewLink: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={modalForm.remarks}
                  onChange={(e) => setModalForm((f) => ({ ...f, remarks: e.target.value }))}
                  placeholder="Optional linker remarks..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setAddingModalItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {submittingAdd ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Add Product to {addingModalItem.targetSiteName}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: BATCH SYNC MISSING PRODUCTS ───────────────────── */}
      {batchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    Batch Sync Missing Products
                  </h3>
                  <p className="text-xs text-slate-400">Add multiple missing products to a selected site in one click</p>
                </div>
              </div>
              <button
                onClick={() => setBatchModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Target Site Selection */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Target Site to Add Products Onto *
                </label>
                <select
                  value={batchTargetSiteId || ""}
                  onChange={(e) => {
                    const sid = parseInt(e.target.value);
                    setBatchTargetSiteId(sid);
                    // auto select missing products on this site
                    const missingKeys = (data?.comparedProducts || [])
                      .filter((p) => p.missingSiteIds.includes(sid))
                      .map((p) => p.key);
                    setBatchSelectedProductKeys(missingKeys);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold text-xs"
                >
                  {selectedSitesList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({data?.stats.selectedSiteCounts?.[s.id]?.missing ?? 0} missing products)
                    </option>
                  ))}
                </select>
              </div>

              {/* Missing Products Checklist */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Select Products to Sync ({batchSelectedProductKeys.length} selected)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allKeys = (data?.comparedProducts || [])
                          .filter((p) => batchTargetSiteId && p.missingSiteIds.includes(batchTargetSiteId))
                          .map((p) => p.key);
                        setBatchSelectedProductKeys(allKeys);
                      }}
                      className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setBatchSelectedProductKeys([])}
                      className="text-slate-400 hover:text-slate-600 font-bold hover:underline"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-1">
                  {(data?.comparedProducts || [])
                    .filter((p) => batchTargetSiteId && p.missingSiteIds.includes(batchTargetSiteId))
                    .map((p) => {
                      const isChecked = batchSelectedProductKeys.includes(p.key);
                      return (
                        <label
                          key={p.key}
                          className="flex items-center gap-2.5 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setBatchSelectedProductKeys((keys) => [...keys, p.key]);
                              } else {
                                setBatchSelectedProductKeys((keys) => keys.filter((k) => k !== p.key));
                              }
                            }}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{p.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {p.productCategory || p.categoryName || "General"} • {p.affiliateName || "No Affiliate"}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setBatchModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBatchSyncSubmit}
                  disabled={submittingBatch || batchSelectedProductKeys.length === 0}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {submittingBatch ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Syncing {batchSelectedProductKeys.length} products...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Sync {batchSelectedProductKeys.length} Products
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Confirm Sync"
        message={confirmMsg}
        confirmLabel="Proceed"
        onConfirm={() => {
          if (confirmAction) confirmAction();
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
