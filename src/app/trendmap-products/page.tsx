"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Compass,
  Search,
  Plus,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  X,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpDown,
  Edit2,
  Check,
  Send,
  Sparkles,
  BarChart2,
  Globe,
  SlidersHorizontal,
  Code2,
  Copy,
  Clock,
  TrendingUp,
  AlertCircle,
  FileSpreadsheet,
  Download,
  User,
  Eye,
  MoreHorizontal,
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import { toast } from "react-hot-toast";
import LoadingScreen from "@/components/LoadingScreen";
import AddProductModal, { InitialProductData } from "@/components/AddProductModal";

interface TrendmapProductItem {
  id: number;
  name: string;
  productUrl: string | null;
  competitor: string | null;
  searchDemand: string | null;
  demandScore: number | null;
  demandLevel: "HIGH" | "MODERATE" | "LOW" | "NOT_ANALYZED" | string | null;
  category: string | null;
  market: string | null;
  modifiedDate: string | null;
  discoveredDate: string | null;
  researchedBy: string | null;
  notes: string | null;
  status: string;
  addedToCatalog: boolean;
  catalogProductId: number | null;
  addedBy?: { id: number; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
  // Duplicate opportunity & catalog match information
  duplicateCount?: number;
  hasDuplicates?: boolean;
  duplicateSources?: string[];
  duplicateResearchers?: string[];
  inCatalog?: boolean;
  catalogDetails?: {
    id: number;
    siteName: string;
    addedBy: string;
    addedAt: string;
  } | null;
}

interface TrendmapCounts {
  total: number;
  high: number;
  moderate: number;
  low: number;
  notAnalyzed: number;
  added: number;
  pending: number;
  duplicates?: number;
}

export default function TrendmapProductsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [products, setProducts] = useState<TrendmapProductItem[]>([]);
  const [counts, setCounts] = useState<TrendmapCounts>({
    total: 0,
    high: 0,
    moderate: 0,
    low: 0,
    notAnalyzed: 0,
    added: 0,
    pending: 0,
    duplicates: 0,
  });
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL"); // ALL, HIGH, MODERATE, LOW, NOT_ANALYZED
  const [statusFilter, setStatusFilter] = useState<string>("ALL"); // ALL, PENDING, ADDED, DUPLICATES
  const [competitorFilter, setCompetitorFilter] = useState<string>("ALL");
  const [sortOption, setSortOption] = useState<string>("latest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(25);

  // Selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Modals
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [initialProductData, setInitialProductData] = useState<InitialProductData | null>(null);
  const [previewItem, setPreviewItem] = useState<TrendmapProductItem | null>(null);
  const [duplicateWarningItem, setDuplicateWarningItem] = useState<TrendmapProductItem | null>(null);

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: "",
    productUrl: "",
    competitor: "",
    searchDemand: "",
    demandScore: "",
    demandLevel: "NOT_ANALYZED",
    category: "",
    market: "United (US)",
    researchedBy: "",
    notes: "",
  });
  const [submittingManual, setSubmittingManual] = useState(false);
  const [manualDuplicateCheck, setManualDuplicateCheck] = useState<{
    checking: boolean;
    hasTrendmapDuplicates?: boolean;
    trendmapDuplicates?: Array<{ id: number; competitor: string | null; researchedBy: string | null }>;
    existsInCatalog?: boolean;
    catalogMatches?: Array<{ siteName: string; addedBy: string }>;
    sourcesList?: string[];
  } | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TrendmapProductItem | null>(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const [isApiModalOpen, setIsApiModalOpen] = useState(false);

  const userRole = (session?.user?.role || "").toUpperCase();
  const canAccess =
    userRole === "SUPER_ADMIN" ||
    userRole === "ADMIN" ||
    userRole === "LINKER" ||
    userRole === "PRODUCT_RESEARCHER";

  // Fetch products
  const fetchProducts = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: search.trim(),
        demandLevel: priorityFilter,
        status: statusFilter,
        competitor: competitorFilter,
        sort: sortOption,
      });

      const res = await fetch(`/api/trendmap-products?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();

      setProducts(data.products || []);
      setCounts(data.counts || {
        total: 0,
        high: 0,
        moderate: 0,
        low: 0,
        notAnalyzed: 0,
        added: 0,
        pending: 0,
        duplicates: 0,
      });
      setCompetitors(data.competitors || []);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load Trendmap products");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, limit, search, priorityFilter, statusFilter, competitorFilter, sortOption]);

  // Real-time duplicate check for Manual Opportunity Add modal
  useEffect(() => {
    if (!isManualModalOpen) {
      setManualDuplicateCheck(null);
      return;
    }
    const trimmed = manualForm.name.trim();
    if (trimmed.length < 2) {
      setManualDuplicateCheck(null);
      return;
    }

    const timer = setTimeout(async () => {
      setManualDuplicateCheck((prev) => ({ ...(prev || { checking: true }), checking: true }));
      try {
        const res = await fetch(`/api/trendmap-products/check-duplicate?name=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          setManualDuplicateCheck({
            checking: false,
            hasTrendmapDuplicates: Boolean(data.hasTrendmapDuplicates),
            trendmapDuplicates: data.trendmapDuplicates || [],
            existsInCatalog: Boolean(data.existsInCatalog),
            catalogMatches: data.catalogMatches || [],
            sourcesList: data.sourcesList || [],
          });
        } else {
          setManualDuplicateCheck({ checking: false });
        }
      } catch (err) {
        console.error("Duplicate check failed:", err);
        setManualDuplicateCheck({ checking: false });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isManualModalOpen, manualForm.name]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchProducts();
    }
  }, [authStatus, fetchProducts]);

  // Handle Select All
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(products.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Convert Trendmap product into ArticleFlow Catalog Product
  const handleOpenAddToProducts = (item: TrendmapProductItem, force = false) => {
    // Duplicate Validation: If already added or exists in catalog, prompt duplicate warning modal first
    if (!force && (item.inCatalog || item.addedToCatalog)) {
      setDuplicateWarningItem(item);
      return;
    }

    const researcher = item.researchedBy || item.addedBy?.name || "Trendmap Researcher";
    setInitialProductData({
      name: item.name,
      category: item.category || "",
      source: "Competitor",
      trendLink: item.productUrl || "",
      previewLink: item.productUrl || "",
      trendLevel:
        item.demandLevel === "MODERATE"
          ? "MODERATE"
          : item.demandLevel === "LOW"
          ? "LOW"
          : "HIGH",
      remarks: `Imported from Trendmap opportunity (${item.competitor || "Competitor"}). Researched by: ${researcher}. Search Demand: ${
        item.searchDemand || (item.demandScore ? `${item.demandScore} / 100` : "Not analyzed")
      }${item.hasDuplicates ? `. Note: Discovered across ${item.duplicateCount} sources (${item.duplicateSources?.join(", ")})` : ""}`,
      defaultEntryMode: "single",
      trendmapProductId: item.id,
      researchedBy: researcher,
    });
    setDuplicateWarningItem(null);
    setIsAddProductModalOpen(true);
  };

  // Manual Add submit
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.name.trim()) {
      toast.error("Product Opportunity Name is required");
      return;
    }

    setSubmittingManual(true);
    try {
      const res = await fetch("/api/trendmap-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...manualForm,
          demandScore: manualForm.demandScore ? parseInt(manualForm.demandScore, 10) : null,
          discoveredDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create");
      }

      toast.success("Opportunity added manually!");
      setIsManualModalOpen(false);
      setManualForm({
        name: "",
        productUrl: "",
        competitor: "",
        searchDemand: "",
        demandScore: "",
        demandLevel: "NOT_ANALYZED",
        category: "",
        market: "United (US)",
        researchedBy: session?.user?.name || "",
        notes: "",
      });
      window.dispatchEvent(new CustomEvent("trendmap-updated"));
      fetchProducts(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSubmittingManual(false);
    }
  };

  // Edit item submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setSubmittingEdit(true);
    try {
      const res = await fetch(`/api/trendmap-products/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingItem),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update");
      }

      toast.success("Updated opportunity successfully!");
      setIsEditModalOpen(false);
      setEditingItem(null);
      window.dispatchEvent(new CustomEvent("trendmap-updated"));
      fetchProducts(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Batch mark added
  const handleBatchMarkAdded = async () => {
    if (selectedIds.length === 0) return;
    try {
      const res = await fetch("/api/trendmap-products/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-added", ids: selectedIds }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(`Marked ${selectedIds.length} as Added to Catalog`);
      setSelectedIds([]);
      window.dispatchEvent(new CustomEvent("trendmap-updated"));
      fetchProducts(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (products.length === 0) {
      toast.error("No products to export");
      return;
    }
    const headers = ["ID", "Name", "Product URL", "Competitor", "Researched By", "Demand Score", "Demand Level", "Market", "Status", "Discovered Date"];
    const rows = products.map((p) => [
      p.id,
      `"${(p.name || "").replace(/"/g, '""')}"`,
      `"${(p.productUrl || "").replace(/"/g, '""')}"`,
      `"${(p.competitor || "").replace(/"/g, '""')}"`,
      `"${(p.researchedBy || p.addedBy?.name || "").replace(/"/g, '""')}"`,
      p.demandScore ?? "",
      p.demandLevel ?? "",
      `"${(p.market || "").replace(/"/g, '""')}"`,
      p.addedToCatalog ? "Added to Catalog" : "Pending",
      `"${p.discoveredDate || ""}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `trendmap_products_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exported!");
  };

  if (authStatus === "loading") {
    return <LoadingScreen />;
  }

  if (authStatus === "unauthenticated" || (!canAccess && userRole)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
        <Compass className="w-16 h-16 text-zinc-400 mb-4 stroke-1 animate-pulse" />
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Access Restricted</h2>
        <p className="text-sm text-zinc-500 max-w-md mt-2">
          Trendmap Product Opportunities are accessible by Super Admins, Admins, Linkers, and Product Researchers.
        </p>
        <Link
          href="/"
          className="mt-6 px-4 py-2 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 rounded-xl text-sm font-semibold hover:opacity-90 transition"
        >
          Return to Overview
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-fadeIn">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-2xs shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white tracking-tight flex flex-wrap items-center gap-2 sm:gap-2.5">
                <span>Products from Trendmap</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {counts.total.toLocaleString()} Opportunities
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                Competitor products identified via Trendmap checklist. Evaluate demand, add manually, or push to Articleflow catalog.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            onClick={() => setIsApiModalOpen(true)}
            className="px-3 py-2 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer whitespace-nowrap"
            title="View API endpoint to send products from Trendmap directly"
          >
            <Code2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>API Docs</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => fetchProducts(true)}
            disabled={refreshing}
            className="hidden sm:flex p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0 items-center justify-center"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
          </button>

          <button
            onClick={() => setIsManualModalOpen(true)}
            className="col-span-2 sm:col-span-1 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Add Product Manually</span>
          </button>
        </div>
      </div>

      {/* ─── PRIORITY & STATUS METRIC CHIPS ─── */}
      <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 bg-zinc-100/70 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200/70 dark:border-zinc-800 overflow-x-auto no-scrollbar scroll-smooth">
        <button
          onClick={() => { setPriorityFilter("ALL"); setPage(1); }}
          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            priorityFilter === "ALL"
              ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-2xs"
              : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
          }`}
        >
          <span>All Priorities</span>
          <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${
            priorityFilter === "ALL"
              ? "bg-zinc-800 text-zinc-200 dark:bg-zinc-200 dark:text-zinc-800"
              : "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
          }`}>
            {counts.total.toLocaleString()}
          </span>
        </button>

        <button
          onClick={() => { setPriorityFilter("HIGH"); setPage(1); }}
          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            priorityFilter === "HIGH"
              ? "bg-emerald-600 text-white shadow-2xs"
              : "text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0" />
          <span>High Demand</span>
          <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${
            priorityFilter === "HIGH" ? "bg-emerald-700 text-white" : "bg-zinc-200/80 dark:bg-zinc-800"
          }`}>
            {counts.high}
          </span>
        </button>

        <button
          onClick={() => { setPriorityFilter("MODERATE"); setPage(1); }}
          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            priorityFilter === "MODERATE"
              ? "bg-amber-600 text-white shadow-2xs"
              : "text-zinc-600 hover:text-amber-600 dark:text-zinc-400 dark:hover:text-amber-400"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shrink-0" />
          <span>Moderate</span>
          <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${
            priorityFilter === "MODERATE" ? "bg-amber-700 text-white" : "bg-zinc-200/80 dark:bg-zinc-800"
          }`}>
            {counts.moderate}
          </span>
        </button>

        <button
          onClick={() => { setPriorityFilter("LOW"); setPage(1); }}
          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            priorityFilter === "LOW"
              ? "bg-blue-600 text-white shadow-2xs"
              : "text-zinc-600 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block shrink-0" />
          <span>Low</span>
          <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${
            priorityFilter === "LOW" ? "bg-blue-700 text-white" : "bg-zinc-200/80 dark:bg-zinc-800"
          }`}>
            {counts.low}
          </span>
        </button>

        <button
          onClick={() => { setPriorityFilter("NOT_ANALYZED"); setPage(1); }}
          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            priorityFilter === "NOT_ANALYZED"
              ? "bg-zinc-700 text-white dark:bg-zinc-300 dark:text-zinc-900 shadow-2xs"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          }`}
        >
          <span>Not Analyzed</span>
          <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${
            priorityFilter === "NOT_ANALYZED" ? "bg-zinc-800 text-white" : "bg-zinc-200/80 dark:bg-zinc-800"
          }`}>
            {counts.notAnalyzed.toLocaleString()}
          </span>
        </button>

        <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700 mx-1 shrink-0" />

        {/* Catalog Conversion Status Tabs */}
        <button
          onClick={() => { setStatusFilter("ALL"); setPage(1); }}
          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            statusFilter === "ALL"
              ? "text-zinc-900 dark:text-white underline decoration-2 underline-offset-4 font-extrabold"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
          }`}
        >
          All Catalog Status
        </button>

        <button
          onClick={() => { setStatusFilter("PENDING"); setPage(1); }}
          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap ${
            statusFilter === "PENDING"
              ? "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-2xs"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
          }`}
        >
          <span>Pending in Catalog</span>
          <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-200/80 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
            {counts.pending}
          </span>
        </button>

        <button
          onClick={() => { setStatusFilter("ADDED"); setPage(1); }}
          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap ${
            statusFilter === "ADDED"
              ? "bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-700 shadow-2xs"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
          }`}
        >
          <CheckCircle2 className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />
          <span>Added to Catalog</span>
          <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-teal-200/80 dark:bg-teal-800 text-teal-900 dark:text-teal-100">
            {counts.added}
          </span>
        </button>

        <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700 mx-1 shrink-0" />

        {/* Duplicates Tab */}
        <button
          onClick={() => {
            setStatusFilter(statusFilter === "DUPLICATES" ? "ALL" : "DUPLICATES");
            setPage(1);
          }}
          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            statusFilter === "DUPLICATES"
              ? "bg-amber-500 text-white shadow-2xs"
              : "text-zinc-500 hover:text-amber-700 dark:hover:text-amber-300"
          }`}
          title="Filter opportunities that appear multiple times or across multiple competitors"
        >
          <Copy className="w-3.5 h-3.5 shrink-0" />
          <span>Duplicates</span>
          {counts.duplicates !== undefined && (
            <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${
              statusFilter === "DUPLICATES"
                ? "bg-amber-700 text-white"
                : "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
            }`}>
              {counts.duplicates}
            </span>
          )}
        </button>
      </div>

      {/* ─── SEARCH & FILTER TOOLBAR ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xs">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search opportunity, competitor domain, URL..."
            className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setPage(1); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0">
          {/* Competitor filter */}
          <select
            value={competitorFilter}
            onChange={(e) => { setCompetitorFilter(e.target.value); setPage(1); }}
            className="w-full sm:w-auto px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 focus:outline-none cursor-pointer truncate"
          >
            <option value="ALL">All Competitors</option>
            {competitors.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortOption}
            onChange={(e) => { setSortOption(e.target.value); setPage(1); }}
            className="w-full sm:w-auto px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 focus:outline-none cursor-pointer truncate"
          >
            <option value="latest">Sort: Latest</option>
            <option value="oldest">Sort: Oldest</option>
            <option value="demand_desc">Demand: High-Low</option>
            <option value="demand_asc">Demand: Low-High</option>
            <option value="name_asc">Name: A-Z</option>
          </select>
        </div>
      </div>

      {/* ─── BATCH SELECTION BANNER ─── */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs animate-fadeIn">
          <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-bold">
            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>{selectedIds.length} item{selectedIds.length > 1 ? "s" : ""} selected</span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={handleBatchMarkAdded}
              className="px-3 py-1.5 rounded-lg font-bold bg-teal-600 hover:bg-teal-700 text-white transition flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark as Added</span>
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ─── DATA TABLE ─── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
            <p className="text-xs text-zinc-500 font-medium">Loading Trendmap opportunities...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto">
              <Compass className="w-7 h-7 stroke-1" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">No product opportunities found</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
                Send products from the Trendmap checklist via the API, or add them manually here.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setIsManualModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                + Add Product Manually
              </button>
              <button
                onClick={() => setIsApiModalOpen(true)}
                className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                View API Endpoint
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ─── MOBILE CARD VIEW (< md) ─── */}
            <div className="block md:hidden divide-y divide-zinc-200 dark:divide-zinc-800">
              {/* Select All Row on Mobile */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/80 flex items-center justify-between text-xs text-zinc-500">
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={products.length > 0 && selectedIds.length === products.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Select All ({products.length})</span>
                </label>
                <span className="text-[11px] text-zinc-400">
                  {selectedIds.length} selected
                </span>
              </div>

              {products.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                const isAdded = Boolean(item.addedToCatalog || item.inCatalog);

                return (
                  <div
                    key={item.id}
                    className={`p-4 space-y-3 transition ${
                      isSelected ? "bg-blue-50/50 dark:bg-blue-950/20" : "hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40"
                    }`}
                  >
                    {/* Top Row: Checkbox, Name, Category, Duplicate Pill, Catalog Status */}
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(item.id)}
                        className="mt-1 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewItem(item)}
                            className="font-bold text-zinc-950 dark:text-zinc-100 text-[13px] hover:text-blue-600 dark:hover:text-blue-400 transition text-left"
                          >
                            {item.name}
                          </button>
                          {item.category && (
                            <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                              {item.category}
                            </span>
                          )}
                          {item.hasDuplicates && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                              title={`Duplicate opportunity: found on ${item.duplicateCount} sources (${item.duplicateSources?.join(", ")})`}
                            >
                              <Copy className="w-2.5 h-2.5 text-amber-600" />
                              <span>{item.duplicateCount} Sources (Duplicate)</span>
                            </span>
                          )}
                        </div>

                        {item.productUrl && (
                          <a
                            href={item.productUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 font-mono truncate block mt-0.5"
                          >
                            {item.productUrl}
                          </a>
                        )}
                      </div>

                      {/* Status badge */}
                      <div className="shrink-0">
                        {isAdded ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
                            title={item.catalogDetails ? `In Catalog (Added by ${item.catalogDetails.addedBy})` : "Added to Catalog"}
                          >
                            <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                            <span>{item.catalogDetails ? "In Catalog" : "Added"}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Clock className="w-2.5 h-2.5 text-amber-600" />
                            <span>Pending</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle Info Row: Researched By & Demand */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
                      {/* Researched By */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[11px] text-zinc-400 shrink-0">By:</span>
                        {item.researchedBy || item.addedBy?.name ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 truncate">
                            <User className="w-3 h-3 text-blue-500 shrink-0" />
                            <span className="truncate">{item.researchedBy || item.addedBy?.name}</span>
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">—</span>
                        )}
                      </div>

                      {/* Search Demand */}
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-[11px] text-zinc-400 shrink-0">Demand:</span>
                        {item.demandScore !== null && item.demandScore !== undefined ? (
                          <span className="font-extrabold text-zinc-900 dark:text-zinc-100 text-xs">
                            {item.demandScore}/100
                            <span className={`ml-1 text-[9px] font-bold px-1 py-0.2 rounded ${
                              item.demandLevel === "HIGH"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : item.demandLevel === "MODERATE"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            }`}>
                              {item.demandLevel}
                            </span>
                          </span>
                        ) : item.searchDemand ? (
                          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{item.searchDemand}</span>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">N/A</span>
                        )}
                      </div>
                    </div>

                    {/* Competitor domain & metadata */}
                    {(item.competitor || item.market || item.modifiedDate) && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 pt-0.5">
                        {item.competitor && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                            <Globe className="w-3 h-3 text-zinc-400" />
                            <span>{item.competitor}</span>
                          </span>
                        )}
                        {item.market && (
                          <span className="text-zinc-400">Market: {item.market}</span>
                        )}
                        {item.modifiedDate && (
                          <span className="text-zinc-400">Modified: {item.modifiedDate}</span>
                        )}
                      </div>
                    )}

                    {/* Mobile Card Action Buttons (Directly clickable, no hover required!) */}
                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                      <button
                        type="button"
                        onClick={() => setPreviewItem(item)}
                        className="flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>Preview</span>
                      </button>

                      {isAdded ? (
                        <button
                          type="button"
                          onClick={() => setDuplicateWarningItem(item)}
                          className="flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700"
                        >
                          <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                          <span>In Catalog</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenAddToProducts(item)}
                          className="flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer bg-teal-600 hover:bg-teal-700 text-white"
                          title={item.hasDuplicates ? `Add product (will mark all ${item.duplicateCount} duplicate sources as Added)` : "Add product"}
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" />
                          <span>Add Product</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem(item);
                          setIsEditModalOpen(true);
                        }}
                        className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition cursor-pointer shrink-0"
                        title="Edit Opportunity"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {item.productUrl && (
                        <a
                          href={item.productUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition shrink-0"
                          title="Open link"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ─── DESKTOP DATA TABLE (>= md) ─── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={products.length > 0 && selectedIds.length === products.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3 font-bold min-w-[200px]">Product Opportunity</th>
                    <th className="py-3 px-3 font-bold w-[130px] whitespace-nowrap">Researched By</th>
                    <th className="py-3 px-3 font-bold w-[140px] whitespace-nowrap">Competitor</th>
                    <th className="py-3 px-3 font-bold w-[115px] whitespace-nowrap">Search Demand</th>
                    <th className="py-3 px-3 font-bold text-right w-[200px] whitespace-nowrap pr-4">Catalog Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {products.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    const isAdded = Boolean(item.addedToCatalog || item.inCatalog);

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition group ${
                          isSelected ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                        }`}
                      >
                        <td className="py-3 px-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(item.id)}
                            className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>

                        {/* Product Opportunity Details */}
                        <td className="py-3 px-3 min-w-[220px] max-w-sm">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setPreviewItem(item)}
                                className="font-bold text-zinc-950 dark:text-zinc-100 text-xs sm:text-[13px] hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer text-left hover:underline truncate max-w-xs"
                                title="Click to preview opportunity"
                              >
                                {item.name}
                              </button>
                              {item.category && (
                                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                  {item.category}
                                </span>
                              )}
                              {item.hasDuplicates && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                                  title={`Duplicate opportunity: found across ${item.duplicateCount} sources (${item.duplicateSources?.join(", ")})`}
                                >
                                  <Copy className="w-2.5 h-2.5 text-amber-600" />
                                  <span>{item.duplicateCount} Sources (Duplicate)</span>
                                </span>
                              )}
                            </div>

                            {item.productUrl && (
                              <a
                                href={item.productUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 font-mono truncate block max-w-xs"
                              >
                                {item.productUrl}
                              </a>
                            )}

                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-400 pt-0.5">
                              {item.modifiedDate && (
                                <span className="flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5 text-zinc-400" />
                                  <span>{item.modifiedDate}</span>
                                </span>
                              )}
                              {item.discoveredDate && (
                                <span>Disc: {item.discoveredDate}</span>
                              )}
                              {item.market && (
                                <span>{item.market}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Researched By User */}
                        <td className="py-3 px-3 whitespace-nowrap w-[130px]">
                          {item.researchedBy || item.addedBy?.name ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 truncate max-w-[120px]">
                              <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                                {(item.researchedBy || item.addedBy?.name || "U").charAt(0).toUpperCase()}
                              </div>
                              <span className="truncate">{item.researchedBy || item.addedBy?.name}</span>
                            </div>
                          ) : (
                            <span className="text-zinc-400 italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* Competitor */}
                        <td className="py-3 px-3 whitespace-nowrap w-[140px]">
                          {item.competitor ? (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700 truncate max-w-[130px]">
                              <Globe className="w-3 h-3 text-zinc-400 shrink-0" />
                              <span className="truncate">{item.competitor}</span>
                            </div>
                          ) : (
                            <span className="text-zinc-400 italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* Search Demand */}
                        <td className="py-3 px-3 whitespace-nowrap w-[115px]">
                          {item.demandScore !== null && item.demandScore !== undefined ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 h-3.5 bg-zinc-100 dark:bg-zinc-800 rounded px-0.5 flex items-center justify-center shrink-0">
                                <svg className="w-full h-2.5 text-blue-500" viewBox="0 0 40 10">
                                  <path
                                    d={`M0 8 Q 10 ${10 - (item.demandScore / 10)}, 20 6 T 40 ${10 - (item.demandScore / 12)}`}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              </div>
                              <span className="font-extrabold text-zinc-900 dark:text-zinc-100 text-xs">
                                {item.demandScore}/100
                              </span>
                              <span className={`text-[9px] font-bold px-1 py-0.2 rounded ${
                                item.demandLevel === "HIGH"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : item.demandLevel === "MODERATE"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              }`}>
                                {item.demandLevel}
                              </span>
                            </div>
                          ) : item.searchDemand ? (
                            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{item.searchDemand}</span>
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-500 italic text-[11px]">
                              Not analyzed
                            </span>
                          )}
                        </td>

                        {/* Catalog Status & Hover Actions Overlay */}
                        <td className="py-3 px-3 whitespace-nowrap text-right relative w-[200px] pr-4">
                          {/* Default Status Badge (fades out subtly on row hover to let actions take over) */}
                          <div className="flex items-center justify-end transition-opacity duration-150 group-hover:opacity-0">
                            {isAdded ? (
                              <div
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
                                title={item.catalogDetails ? `In Catalog: Added by ${item.catalogDetails.addedBy} on ${item.catalogDetails.siteName}` : "Added to Catalog"}
                              >
                                <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                                <span>{item.catalogDetails ? "In Catalog" : "Added"}</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <Clock className="w-2.5 h-2.5 text-amber-600" />
                                <span>Pending Catalog</span>
                              </div>
                            )}
                          </div>

                          {/* Action options overlay (appears right here overriding the row when hovered) */}
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-1.5 py-1 rounded-xl shadow-md border border-zinc-200 dark:border-zinc-700 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all duration-150 pointer-events-none group-hover:pointer-events-auto">
                            {/* Preview Opportunity */}
                            <button
                              type="button"
                              onClick={() => setPreviewItem(item)}
                              className="px-2 py-1 rounded-lg text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition flex items-center gap-1 cursor-pointer"
                              title="Preview Opportunity Details"
                            >
                              <Eye className="w-3 h-3 text-blue-500" />
                              <span>Preview</span>
                            </button>

                            {/* Add / In Catalog button */}
                            {isAdded ? (
                              <button
                                type="button"
                                onClick={() => setDuplicateWarningItem(item)}
                                className="px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 cursor-pointer shadow-2xs"
                                title="Already in Catalog! Click to view duplicate details or add another entry."
                              >
                                <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                                <span>In Catalog</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenAddToProducts(item)}
                                className="px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white shadow-2xs cursor-pointer"
                                title={item.hasDuplicates ? `Add product (will mark all ${item.duplicateCount} duplicate sources as Added)` : "Add this product directly to Articleflow catalog"}
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add</span>
                              </button>
                            )}

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItem(item);
                                setIsEditModalOpen(true);
                              }}
                              className="p-1 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition cursor-pointer"
                              title="Edit details"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>

                            {/* External link */}
                            {item.productUrl && (
                              <a
                                href={item.productUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                                title="Open original link"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ─── PAGINATION ─── */}
        {!loading && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-zinc-200 dark:border-zinc-800 text-xs">
            <span className="text-zinc-500">
              Showing page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── PRODUCT OPPORTUNITY PREVIEW MODAL ─── */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewItem(null);
          }}
        >
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-scaleIn flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-4 sm:px-6 py-4 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <Compass className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-zinc-950 dark:text-white truncate">Product Research Preview</h3>
                  <p className="text-[11px] text-zinc-400 truncate">Trendmap Opportunity & Research Attribution</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
              {/* Title & Badges */}
              <div className="space-y-2">
                <h2 className="text-base sm:text-lg font-extrabold text-zinc-950 dark:text-white">
                  {previewItem.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  {previewItem.category && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      {previewItem.category}
                    </span>
                  )}
                  {previewItem.market && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                      Market: {previewItem.market}
                    </span>
                  )}
                  {previewItem.addedToCatalog ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                      <Check className="w-3 h-3 stroke-[2.5]" /> Added to Products
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      <Clock className="w-3 h-3 text-amber-600" /> Pending Catalog
                    </span>
                  )}
                </div>
              </div>

              {/* ─── RESEARCHED BY & ADDED BY ATTRIBUTION CARDS ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Card 1: Researched By */}
                <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 space-y-2 shadow-2xs">
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider block">
                    Researched By
                  </span>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-xs shrink-0">
                      {(previewItem.researchedBy || previewItem.addedBy?.name || "R").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-zinc-950 dark:text-zinc-100 text-xs block truncate">
                        {previewItem.researchedBy || previewItem.addedBy?.name || "Unassigned Researcher"}
                      </span>
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium block">
                        Product Researcher
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Added By */}
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 space-y-2 shadow-2xs">
                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                    Added By
                  </span>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-zinc-700 dark:bg-zinc-600 text-white flex items-center justify-center text-xs font-black shadow-xs shrink-0">
                      {(previewItem.addedBy?.name || previewItem.addedBy?.email || previewItem.researchedBy || "U").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-zinc-950 dark:text-zinc-100 text-xs block truncate">
                        {previewItem.addedBy?.name || previewItem.addedBy?.email || previewItem.researchedBy || "System / API"}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-medium block truncate">
                        {previewItem.createdAt ? `Created ${new Date(previewItem.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "Recorded in Catalog"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Competitor & Product URL */}
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>Competitor Domain</span>
                  </div>
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400 truncate max-w-[180px] sm:max-w-none text-right">
                    {previewItem.competitor || "—"}
                  </span>
                </div>

                {previewItem.productUrl && (
                  <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-700/60 flex items-center justify-between gap-2">
                    <a
                      href={previewItem.productUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-mono text-blue-600 hover:text-blue-700 dark:text-blue-400 truncate flex items-center gap-1 flex-1 min-w-0"
                    >
                      <span className="truncate">{previewItem.productUrl}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(previewItem.productUrl || "");
                        toast.success("URL copied to clipboard");
                      }}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer shrink-0"
                      title="Copy URL"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Search Demand & Metrics */}
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Search Demand & Trends</span>
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    previewItem.demandLevel === "HIGH"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : previewItem.demandLevel === "MODERATE"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                  }`}>
                    {previewItem.demandLevel || "NOT_ANALYZED"}
                  </span>
                </div>

                {previewItem.demandScore !== null && previewItem.demandScore !== undefined ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Demand Score</span>
                      <span className="font-extrabold text-zinc-900 dark:text-zinc-100">{previewItem.demandScore} / 100</span>
                    </div>
                    <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${
                          previewItem.demandScore >= 70
                            ? "bg-emerald-500"
                            : previewItem.demandScore >= 40
                            ? "bg-amber-500"
                            : "bg-blue-500"
                        }`}
                        style={{ width: `${Math.min(100, previewItem.demandScore)}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500 italic">
                    {previewItem.searchDemand || "Search demand has not been scored yet"}
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-200/60 dark:border-zinc-700/40">
                  <span>Discovered: {previewItem.discoveredDate || "—"}</span>
                  <span>Modified: {previewItem.modifiedDate || "—"}</span>
                </div>
              </div>

              {/* Notes / Remarks */}
              {previewItem.notes && (
                <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/50 space-y-1">
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                    Instructions / Notes
                  </span>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                    {previewItem.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between border-t border-zinc-100 dark:border-zinc-800 px-4 sm:px-6 py-3.5 bg-zinc-50/80 dark:bg-zinc-900/80 gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const itemToEdit = previewItem;
                  setPreviewItem(null);
                  setEditingItem(itemToEdit);
                  setIsEditModalOpen(true);
                }}
                className="w-full sm:w-auto px-3.5 py-2 sm:py-1.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Opportunity</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="flex-1 sm:flex-initial px-3.5 py-2 sm:py-1.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer text-center"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const itemToAdd = previewItem;
                    setPreviewItem(null);
                    handleOpenAddToProducts(itemToAdd);
                  }}
                  className={`flex-1 sm:flex-initial px-4 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer ${
                    previewItem.addedToCatalog
                      ? "bg-zinc-800 hover:bg-zinc-900 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900"
                      : "bg-teal-600 hover:bg-teal-700 text-white"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{previewItem.addedToCatalog ? "Add Again" : "Add to Products"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── DUPLICATE PRODUCT WARNING MODAL ─── */}
      {duplicateWarningItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh] animate-scaleIn">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 p-4 sm:p-5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 flex items-center justify-center font-bold shrink-0 border border-amber-300 dark:border-amber-800">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                    <span>Duplicate Product Detected</span>
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Product already exists in the catalog or across competitor sources
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDuplicateWarningItem(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs space-y-1.5">
                <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm flex items-center gap-2">
                  <span>{duplicateWarningItem.name}</span>
                  {duplicateWarningItem.category && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {duplicateWarningItem.category}
                    </span>
                  )}
                </div>
                <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {duplicateWarningItem.inCatalog || duplicateWarningItem.addedToCatalog
                    ? "This product has already been added to your Articleflow Product Catalog."
                    : "This product was discovered across multiple competitor sources."}
                </p>
              </div>

              {/* Catalog presence details */}
              {(duplicateWarningItem.catalogDetails || duplicateWarningItem.addedToCatalog || duplicateWarningItem.inCatalog) && (
                <div className="p-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 text-xs space-y-1.5">
                  <div className="font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span>Catalog Status: Added & Active</span>
                  </div>
                  {duplicateWarningItem.catalogDetails && (
                    <div className="text-[11px] text-teal-800 dark:text-teal-300 space-y-0.5 pt-0.5">
                      <p>• Added By: <span className="font-semibold">{duplicateWarningItem.catalogDetails.addedBy}</span></p>
                      <p>• Associated Site: <span className="font-semibold">{duplicateWarningItem.catalogDetails.siteName}</span></p>
                    </div>
                  )}
                </div>
              )}

              {/* Duplicate Competitor Sources */}
              {duplicateWarningItem.hasDuplicates && duplicateWarningItem.duplicateSources && duplicateWarningItem.duplicateSources.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                    Found Across Competitor Sources ({duplicateWarningItem.duplicateSources.length}):
                  </label>
                  <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 space-y-1">
                    {duplicateWarningItem.duplicateSources.map((comp, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                        <Globe className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="font-mono text-[11px]">{comp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 p-4 sm:p-5 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
              <button
                type="button"
                onClick={() => setDuplicateWarningItem(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer text-center"
              >
                Close
              </button>

              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    const name = duplicateWarningItem.name;
                    setDuplicateWarningItem(null);
                    router.push(`/products?search=${encodeURIComponent(name)}`);
                  }}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                  <span>View in Catalog</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const item = duplicateWarningItem;
                    handleOpenAddToProducts(item, true);
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another Entry</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD PRODUCT MODAL (INTEGRATED) ─── */}
      <AddProductModal
        isOpen={isAddProductModalOpen}
        onClose={() => {
          setIsAddProductModalOpen(false);
          setInitialProductData(null);
        }}
        onSuccess={() => {
          setIsAddProductModalOpen(false);
          setInitialProductData(null);
          toast.success("Product successfully added to Articleflow catalog!");
          window.dispatchEvent(new CustomEvent("trendmap-updated"));
          fetchProducts(true);
        }}
        initialData={initialProductData}
      />

      {/* ─── MANUAL ADD OPPORTUNITY MODAL ─── */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh] animate-scaleIn">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 p-4 sm:p-5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-950 dark:text-white">Add Trendmap Opportunity</h3>
                  <p className="text-xs text-zinc-500">Record a product manually into the checklist</p>
                </div>
              </div>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Product Opportunity Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tru Supplements, Psilly Gummies"
                    value={manualForm.name}
                    onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  {manualDuplicateCheck && !manualDuplicateCheck.checking && (manualDuplicateCheck.hasTrendmapDuplicates || manualDuplicateCheck.existsInCatalog) && (
                    <div className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Duplicate Product Warning</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                        {manualDuplicateCheck.hasTrendmapDuplicates && (
                          <>
                            Already recorded across <strong>{manualDuplicateCheck.trendmapDuplicates?.length}</strong> source(s)
                            {manualDuplicateCheck.sourcesList && manualDuplicateCheck.sourcesList.length > 0 ? `: ${manualDuplicateCheck.sourcesList.join(", ")}` : ""}.{" "}
                          </>
                        )}
                        {manualDuplicateCheck.existsInCatalog && (
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400 block mt-0.5">
                            ✓ This product already exists in the Articleflow Catalog!
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Competitor URL / Product Link
                  </label>
                  <input
                    type="url"
                    placeholder="https://getsupplementreviews.com/..."
                    value={manualForm.productUrl}
                    onChange={(e) => setManualForm({ ...manualForm, productUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Competitor Domain
                    </label>
                    <input
                      type="text"
                      placeholder="getsupplementreviews.com"
                      value={manualForm.competitor}
                      onChange={(e) => setManualForm({ ...manualForm, competitor: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      placeholder="Supplements, Skincare"
                      value={manualForm.category}
                      onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Researched By (User)
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="e.g. John Doe, Sarah Writer"
                        value={manualForm.researchedBy}
                        onChange={(e) => setManualForm({ ...manualForm, researchedBy: e.target.value })}
                        className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Market
                    </label>
                    <input
                      type="text"
                      placeholder="United (US)"
                      value={manualForm.market}
                      onChange={(e) => setManualForm({ ...manualForm, market: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Search Demand Score (0-100)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="e.g. 26"
                      value={manualForm.demandScore}
                      onChange={(e) => setManualForm({ ...manualForm, demandScore: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Demand Level
                    </label>
                    <select
                      value={manualForm.demandLevel}
                      onChange={(e) => setManualForm({ ...manualForm, demandLevel: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                      <option value="HIGH">High Demand</option>
                      <option value="MODERATE">Moderate</option>
                      <option value="LOW">Low</option>
                      <option value="NOT_ANALYZED">Not Analyzed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Notes / Observations
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Optional research notes..."
                    value={manualForm.notes}
                    onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 p-4 sm:p-5 border-t border-zinc-100 dark:border-zinc-800 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-center cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingManual}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition disabled:opacity-50 text-center cursor-pointer"
                >
                  {submittingManual ? "Saving..." : "Save Opportunity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT MODAL ─── */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh] animate-scaleIn">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 p-4 sm:p-5 shrink-0">
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">Edit Opportunity</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Product Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Product URL
                  </label>
                  <input
                    type="text"
                    value={editingItem.productUrl || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, productUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Competitor
                    </label>
                    <input
                      type="text"
                      value={editingItem.competitor || ""}
                      onChange={(e) => setEditingItem({ ...editingItem, competitor: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Demand Level
                    </label>
                    <select
                      value={editingItem.demandLevel || "NOT_ANALYZED"}
                      onChange={(e) => setEditingItem({ ...editingItem, demandLevel: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 cursor-pointer"
                    >
                      <option value="HIGH">HIGH</option>
                      <option value="MODERATE">MODERATE</option>
                      <option value="LOW">LOW</option>
                      <option value="NOT_ANALYZED">NOT_ANALYZED</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Researched By (User)
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={editingItem.researchedBy || ""}
                      onChange={(e) => setEditingItem({ ...editingItem, researchedBy: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Catalog Status
                  </label>
                  <select
                    value={editingItem.addedToCatalog ? "true" : "false"}
                    onChange={(e) => setEditingItem({ ...editingItem, addedToCatalog: e.target.value === "true", status: e.target.value === "true" ? "ADDED" : "PENDING" })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 cursor-pointer"
                  >
                    <option value="false">Pending Catalog</option>
                    <option value="true">Added to Catalog</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 p-4 sm:p-5 border-t border-zinc-100 dark:border-zinc-800 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-center cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50 text-center cursor-pointer"
                >
                  {submittingEdit ? "Saving..." : "Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── API & INTEGRATION GUIDE MODAL ─── */}
      {isApiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh] animate-scaleIn">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 p-4 sm:p-5 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-950 dark:text-white">Trendmap Integration API</h3>
                  <p className="text-xs text-zinc-500">Send products directly from Trendmap to Articleflow</p>
                </div>
              </div>
              <button
                onClick={() => setIsApiModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 text-xs overflow-y-auto flex-1">
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                When clicking the paper airplane (<Send className="w-3.5 h-3.5 inline mx-0.5 text-blue-500" />) icon in Trendmap, your script, extension, or backend can send product opportunities directly to this endpoint:
              </p>

              <div>
                <span className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Endpoint URL (POST):</span>
                <div className="flex items-center gap-2 p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl font-mono text-[11px] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 select-all">
                  <span className="flex-1 truncate">
                    {typeof window !== "undefined" ? window.location.origin : ""}/api/trendmap-products
                  </span>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/api/trendmap-products`;
                      navigator.clipboard.writeText(url);
                      toast.success("URL copied to clipboard!");
                    }}
                    className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer shrink-0"
                    title="Copy URL"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <span className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">JSON Payload Format:</span>
                <div className="relative p-3 bg-zinc-950 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto border border-zinc-800">
                  <pre>
{`{
  "name": "Tru Supplements",
  "productUrl": "https://getsupplementreviews.com/tru-supplements-review/",
  "competitor": "getsupplementreviews.com",
  "searchDemand": "26 / 100",
  "demandScore": 26,
  "demandLevel": "LOW",
  "category": "Supplements",
  "market": "United (US)",
  "modifiedDate": "Jan 19, 2026",
  "discoveredDate": "Oct 6",
  "researchedBy": "John Doe"
}`}
                  </pre>
                  <button
                    onClick={() => {
                      const sample = JSON.stringify({
                        name: "Tru Supplements",
                        productUrl: "https://getsupplementreviews.com/tru-supplements-review/",
                        competitor: "getsupplementreviews.com",
                        searchDemand: "26 / 100",
                        demandScore: 26,
                        demandLevel: "LOW",
                        category: "Supplements",
                        market: "United (US)",
                        modifiedDate: "Jan 19, 2026",
                        discoveredDate: "Oct 6",
                        researchedBy: "John Doe",
                      }, null, 2);
                      navigator.clipboard.writeText(sample);
                      toast.success("JSON copied!");
                    }}
                    className="absolute top-2.5 right-2.5 p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded cursor-pointer"
                    title="Copy JSON"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-zinc-100 dark:border-zinc-800 flex justify-end shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50">
              <button
                onClick={() => setIsApiModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 rounded-xl text-xs font-bold hover:opacity-90 transition cursor-pointer text-center"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
