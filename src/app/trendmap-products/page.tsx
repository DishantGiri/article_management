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
}

interface TrendmapCounts {
  total: number;
  high: number;
  moderate: number;
  low: number;
  notAnalyzed: number;
  added: number;
  pending: number;
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
  });
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL"); // ALL, HIGH, MODERATE, LOW, NOT_ANALYZED
  const [statusFilter, setStatusFilter] = useState<string>("ALL"); // ALL, PENDING, ADDED
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
  const handleOpenAddToProducts = (item: TrendmapProductItem) => {
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
      remarks: `Imported from Trendmap opportunity (${item.competitor || "Competitor"}). Researched by: ${
        item.researchedBy || item.addedBy?.name || "Trendmap Researcher"
      }. Search Demand: ${
        item.searchDemand || (item.demandScore ? `${item.demandScore} / 100` : "Not analyzed")
      }`,
      defaultEntryMode: "single",
      trendmapProductId: item.id,
    });
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
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-2xs">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white tracking-tight flex items-center gap-2.5">
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
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            onClick={() => setIsApiModalOpen(true)}
            className="px-3 py-2 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="View API endpoint to send products from Trendmap directly"
          >
            <Code2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Send from Trendmap API</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => fetchProducts(true)}
            disabled={refreshing}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
          </button>

          <button
            onClick={() => setIsManualModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product Manually</span>
          </button>
        </div>
      </div>

      {/* ─── PRIORITY & STATUS METRIC CHIPS (MATCHING SCREENSHOT) ─── */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-zinc-100/70 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200/70 dark:border-zinc-800">
        <button
          onClick={() => { setPriorityFilter("ALL"); setPage(1); }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
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
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            priorityFilter === "HIGH"
              ? "bg-emerald-600 text-white shadow-2xs"
              : "text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span>High Demand</span>
          <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${
            priorityFilter === "HIGH" ? "bg-emerald-700 text-white" : "bg-zinc-200/80 dark:bg-zinc-800"
          }`}>
            {counts.high}
          </span>
        </button>

        <button
          onClick={() => { setPriorityFilter("MODERATE"); setPage(1); }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            priorityFilter === "MODERATE"
              ? "bg-amber-600 text-white shadow-2xs"
              : "text-zinc-600 hover:text-amber-600 dark:text-zinc-400 dark:hover:text-amber-400"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
          <span>Moderate</span>
          <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${
            priorityFilter === "MODERATE" ? "bg-amber-700 text-white" : "bg-zinc-200/80 dark:bg-zinc-800"
          }`}>
            {counts.moderate}
          </span>
        </button>

        <button
          onClick={() => { setPriorityFilter("LOW"); setPage(1); }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            priorityFilter === "LOW"
              ? "bg-blue-600 text-white shadow-2xs"
              : "text-zinc-600 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          <span>Low</span>
          <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${
            priorityFilter === "LOW" ? "bg-blue-700 text-white" : "bg-zinc-200/80 dark:bg-zinc-800"
          }`}>
            {counts.low}
          </span>
        </button>

        <button
          onClick={() => { setPriorityFilter("NOT_ANALYZED"); setPage(1); }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
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

        <div className="hidden sm:block h-4 w-px bg-zinc-300 dark:bg-zinc-700 mx-1" />

        {/* Catalog Conversion Status Tabs */}
        <button
          onClick={() => { setStatusFilter("ALL"); setPage(1); }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            statusFilter === "ALL"
              ? "text-zinc-900 dark:text-white underline decoration-2 underline-offset-4 font-extrabold"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
          }`}
        >
          All Catalog Status
        </button>

        <button
          onClick={() => { setStatusFilter("PENDING"); setPage(1); }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
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
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
            statusFilter === "ADDED"
              ? "bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-700 shadow-2xs"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
          }`}
        >
          <CheckCircle2 className="w-3 h-3 text-teal-600 dark:text-teal-400" />
          <span>Added to Catalog</span>
          <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-teal-200/80 dark:bg-teal-800 text-teal-900 dark:text-teal-100">
            {counts.added}
          </span>
        </button>
      </div>

      {/* ─── SEARCH & FILTER TOOLBAR ─── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search product opportunity, competitor domain, URL..."
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Competitor filter */}
          <select
            value={competitorFilter}
            onChange={(e) => { setCompetitorFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 focus:outline-none cursor-pointer"
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
            className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 focus:outline-none cursor-pointer"
          >
            <option value="latest">Sort: Date (Latest)</option>
            <option value="oldest">Sort: Date (Oldest)</option>
            <option value="demand_desc">Sort: Search Demand (High-Low)</option>
            <option value="demand_asc">Sort: Search Demand (Low-High)</option>
            <option value="name_asc">Sort: Product Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* ─── BATCH SELECTION BANNER ─── */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs animate-fadeIn">
          <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-bold">
            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>{selectedIds.length} item{selectedIds.length > 1 ? "s" : ""} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchMarkAdded}
              className="px-3 py-1.5 rounded-lg font-bold bg-teal-600 hover:bg-teal-700 text-white transition flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark as Added</span>
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={products.length > 0 && selectedIds.length === products.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4 font-bold">Product Opportunity</th>
                  <th className="py-3 px-4 font-bold">Researched By</th>
                  <th className="py-3 px-4 font-bold">Competitor</th>
                  <th className="py-3 px-4 font-bold">Search Demand</th>
                  <th className="py-3 px-4 font-bold">Catalog Status</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {products.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  const isAdded = item.addedToCatalog;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition group ${
                        isSelected ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(item.id)}
                          className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Product Opportunity Details */}
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-950 dark:text-zinc-100 text-[13px] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                              {item.name}
                            </span>
                            {item.category && (
                              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                {item.category}
                              </span>
                            )}
                          </div>

                          {item.productUrl && (
                            <a
                              href={item.productUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 font-mono truncate block max-w-sm sm:max-w-md"
                            >
                              {item.productUrl}
                            </a>
                          )}

                          <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-400 pt-0.5">
                            {item.modifiedDate && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-zinc-400" />
                                <span>Modified: {item.modifiedDate}</span>
                              </span>
                            )}
                            {item.discoveredDate && (
                              <span>Discovered: {item.discoveredDate}</span>
                            )}
                            {item.market && (
                              <span className="text-zinc-500 dark:text-zinc-400">
                                Market: {item.market}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Researched By User */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {item.researchedBy || item.addedBy?.name ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 shadow-2xs">
                            <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold">
                              {(item.researchedBy || item.addedBy?.name || "U").charAt(0).toUpperCase()}
                            </div>
                            <span>{item.researchedBy || item.addedBy?.name}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* Competitor */}
                      <td className="py-3.5 px-4">
                        {item.competitor ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700">
                            <Globe className="w-3 h-3 text-zinc-400" />
                            <span>{item.competitor}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic">—</span>
                        )}
                      </td>

                      {/* Search Demand */}
                      <td className="py-3.5 px-4">
                        {item.demandScore !== null && item.demandScore !== undefined ? (
                          <div className="flex items-center gap-2">
                            {/* Demand visual sparkline mini curve */}
                            <div className="w-16 h-4 bg-zinc-100 dark:bg-zinc-800 rounded px-1 flex items-center justify-center">
                              <svg className="w-full h-3 text-blue-500" viewBox="0 0 40 10">
                                <path
                                  d={`M0 8 Q 10 ${10 - (item.demandScore / 10)}, 20 6 T 40 ${10 - (item.demandScore / 12)}`}
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </div>
                            <span className="font-extrabold text-zinc-900 dark:text-zinc-100">
                              {item.demandScore} / 100
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
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
                          <div className="flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-300">
                            <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                            <span>{item.searchDemand}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500 italic">
                            Not analyzed
                          </span>
                        )}
                      </td>

                      {/* Catalog Status */}
                      <td className="py-3.5 px-4">
                        {isAdded ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                            <Check className="w-3 h-3 stroke-[2.5]" />
                            <span>Added to Products</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending Catalog</span>
                          </div>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* "+ Add Product" button */}
                          <button
                            onClick={() => handleOpenAddToProducts(item)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer ${
                              isAdded
                                ? "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                                : "bg-teal-600 hover:bg-teal-700 text-white"
                            }`}
                            title={isAdded ? "Add another product entry in catalog" : "Add this product directly to Articleflow catalog"}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isAdded ? "Add Again" : "Add Product"}</span>
                          </button>

                          {/* External link */}
                          {item.productUrl && (
                            <a
                              href={item.productUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                              title="Open original link"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {/* Edit */}
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setIsEditModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition cursor-pointer"
                            title="Edit details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── PAGINATION ─── */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-zinc-200 dark:border-zinc-800 text-xs">
            <span className="text-zinc-500">
              Showing page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-950 dark:text-white">Add Trendmap Opportunity</h3>
                  <p className="text-xs text-zinc-500">Record a product manually into the checklist</p>
                </div>
              </div>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3.5">
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

              <div className="grid grid-cols-2 gap-3">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Researched By (User)
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
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

              <div className="grid grid-cols-2 gap-3">
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

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingManual}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">Edit Opportunity</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Competitor
                  </label>
                  <input
                    type="text"
                    value={editingItem.competitor || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, competitor: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Demand Level
                  </label>
                  <select
                    value={editingItem.demandLevel || "NOT_ANALYZED"}
                    onChange={(e) => setEditingItem({ ...editingItem, demandLevel: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
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
                  <User className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
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
                  className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                >
                  <option value="false">Pending Catalog</option>
                  <option value="true">Added to Catalog</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-950 dark:text-white">Trendmap Integration API</h3>
                  <p className="text-xs text-zinc-500">Send products directly from Trendmap to Articleflow</p>
                </div>
              </div>
              <button
                onClick={() => setIsApiModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
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
                    className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
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
                    className="absolute top-2.5 right-2.5 p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded"
                    title="Copy JSON"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setIsApiModalOpen(false)}
                className="px-4 py-2 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 rounded-xl text-xs font-bold hover:opacity-90"
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
