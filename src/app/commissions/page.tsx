"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ReceiptText,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Coins,
  Globe,
  PenTool,
  Link2,
  Pill,
  ShoppingBag,
  Plus,
  RefreshCw,
  X,
  Calendar,
  AlertCircle,
  Trash2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Check,
  Layers,
  ArrowRight,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { toast } from "react-hot-toast";
import LoadingScreen from "@/components/LoadingScreen";

interface CommissionSale {
  id: number;
  productId: number;
  siteId: number;
  saleType: "FIRST_SALE" | "RESALE";
  saleDate: string;
  writerId: number | null;
  writerName: string | null;
  linkerId: number | null;
  linkerName: string | null;
  paymentStatus: "PENDING" | "PAID";
  paidAt: string | null;
  amount: number;
  linkerAmount: number;
  writerAmount: number;
  tlAmount: number;
  seoAmount: number;
  bonusAmount: number;
  partyAmount: number;
  notes: string | null;
}

interface ProductCommissionRow {
  id: number;
  name: string;
  siteId: number;
  siteName: string;
  siteUrl: string | null;
  categoryName: string;
  categoryKey: "NUTRA" | "ECOM";
  linkerId: number | null;
  linkerName: string;
  writerId: number | null;
  writerName: string;
  articleStatus: string;
  articleLink: string | null;
  firstSalesCount: number;
  resalesCount: number;
  totalSalesCount: number;
  totalCommissionAmount: number;
  paidCommissionAmount: number;
  pendingCommissionAmount: number;
  overallPaymentStatus: "PAID" | "PENDING" | "NO_SALES";
  latestDate: string;
  sales: CommissionSale[];
  rates: {
    firstSaleTotal: number;
    resaleTotal: number;
    firstSaleBreakdown: any;
    resaleBreakdown: any;
  };
}

interface SiteTab {
  id: number;
  name: string;
  url: string | null;
  _count: {
    products: number;
    commissionSales: number;
  };
}

export default function CommissionsPage() {
  const { data: session, status } = useSession();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [sites, setSites] = useState<SiteTab[]>([]);
  const [products, setProducts] = useState<ProductCommissionRow[]>([]);
  const [metrics, setMetrics] = useState({
    totalProducts: 0,
    totalCommissions: 0,
    totalPaid: 0,
    totalPending: 0,
    totalFirstSales: 0,
    totalResales: 0,
  });

  // Active Site Tab: "ALL" or siteId number as string
  const [activeSiteTab, setActiveSiteTab] = useState<string>("ALL");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Modal States
  const [selectedProductForSale, setSelectedProductForSale] =
    useState<ProductCommissionRow | null>(null);
  const [modalSaleType, setModalSaleType] = useState<"FIRST_SALE" | "RESALE">("FIRST_SALE");
  const [modalSaleDate, setModalSaleDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [modalPaymentStatus, setModalPaymentStatus] = useState<"PENDING" | "PAID">("PENDING");
  const [modalNotes, setModalNotes] = useState<string>("");
  const [submittingSale, setSubmittingSale] = useState(false);

  // History Modal State
  const [historyProduct, setHistoryProduct] = useState<ProductCommissionRow | null>(null);
  const [updatingSaleId, setUpdatingSaleId] = useState<number | null>(null);

  // Fetch Commission Data
  const fetchData = async (siteId = activeSiteTab, isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const params = new URLSearchParams();
      if (siteId && siteId !== "ALL") {
        params.append("siteId", siteId);
      }
      if (search) params.append("search", search);
      if (statusFilter !== "ALL") params.append("paymentStatus", statusFilter);
      if (categoryFilter !== "ALL") params.append("category", categoryFilter);

      const res = await fetch(`/api/commissions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load commissions data");

      const data = await res.json();
      setSites(data.sites || []);
      setProducts(data.products || []);
      if (data.metrics) setMetrics(data.metrics);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load commissions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (status !== "loading") {
      fetchData(activeSiteTab);
    }
  }, [activeSiteTab, status]);

  // Open Add Sale Modal
  const handleOpenAddSale = (
    product: ProductCommissionRow,
    defaultType: "FIRST_SALE" | "RESALE" = "FIRST_SALE"
  ) => {
    setSelectedProductForSale(product);
    setModalSaleType(defaultType);
    setModalSaleDate(new Date().toISOString().split("T")[0]);
    setModalPaymentStatus("PENDING");
    setModalNotes("");
  };

  // Submit Add Sale
  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForSale) return;

    setSubmittingSale(true);
    try {
      const res = await fetch("/api/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductForSale.id,
          saleType: modalSaleType,
          saleDate: modalSaleDate,
          paymentStatus: modalPaymentStatus,
          notes: modalNotes,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to record sale");
      }

      toast.success(
        `${modalSaleType === "FIRST_SALE" ? "1st Sale" : "Resale"} logged for ${selectedProductForSale.name}!`
      );
      setSelectedProductForSale(null);
      fetchData(activeSiteTab, true);
    } catch (err: any) {
      toast.error(err.message || "Error saving sale");
    } finally {
      setSubmittingSale(false);
    }
  };

  // Toggle Sale Payment Status in History Modal
  const handleTogglePaymentStatus = async (sale: CommissionSale) => {
    setUpdatingSaleId(sale.id);
    const nextStatus: "PENDING" | "PAID" =
      sale.paymentStatus === "PAID" ? "PENDING" : "PAID";
    try {
      const res = await fetch(`/api/commissions/${sale.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: nextStatus }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      toast.success(`Marked as ${nextStatus}`);

      // Update local state in history modal and main list
      if (historyProduct) {
        const updatedSales = historyProduct.sales.map((s) =>
          s.id === sale.id ? { ...s, paymentStatus: nextStatus } : s
        );
        setHistoryProduct({ ...historyProduct, sales: updatedSales });
      }
      fetchData(activeSiteTab, true);
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    } finally {
      setUpdatingSaleId(null);
    }
  };

  // Delete Sale
  const handleDeleteSale = async (saleId: number) => {
    if (!confirm("Are you sure you want to delete this sale record?")) return;

    try {
      const res = await fetch(`/api/commissions/${saleId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete sale");

      toast.success("Sale record deleted");

      if (historyProduct) {
        const updatedSales = historyProduct.sales.filter((s) => s.id !== saleId);
        setHistoryProduct({ ...historyProduct, sales: updatedSales });
      }
      fetchData(activeSiteTab, true);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  // Filtered products list based on client search & filters
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (search) {
        const query = search.toLowerCase();
        const matchName = p.name.toLowerCase().includes(query);
        const matchWriter = p.writerName.toLowerCase().includes(query);
        const matchLinker = p.linkerName.toLowerCase().includes(query);
        const matchSite = p.siteName.toLowerCase().includes(query);
        if (!matchName && !matchWriter && !matchLinker && !matchSite) return false;
      }
      if (statusFilter !== "ALL" && p.overallPaymentStatus !== statusFilter) return false;
      if (categoryFilter !== "ALL" && p.categoryKey !== categoryFilter) return false;
      return true;
    });
  }, [products, search, statusFilter, categoryFilter]);

  if (loading && status !== "loading") {
    return (
      <div className="p-6 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] dark:bg-slate-950">
        <LoadingScreen
          message="Loading commissions dashboard..."
          subtext="Retrieving sites, products, writer & linker allocations"
          size="lg"
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] dark:bg-slate-950 text-[#4A4A4A] dark:text-slate-100 space-y-6">
      {/* ─── TOP HEADER BANNER ────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-emerald-100/40 dark:from-emerald-950/20 via-sky-100/20 dark:via-sky-950/10 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#6D8196] via-[#5A6D81] to-[#3D4F61] text-white flex items-center justify-center font-bold shadow-md shrink-0">
              <ReceiptText className="w-8 h-8 drop-shadow-sm" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#4A4A4A] dark:text-white">
                  Commissions Dashboard
                </h1>
                <span className="text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Live Tracking
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#737373] dark:text-slate-400 mt-1 font-medium max-w-2xl leading-relaxed">
                Track product sales, 1st sale and resale commissions, auto-linked writers, and linkers across all sites.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 self-stretch sm:self-auto flex-wrap">
            {/* View Switcher: Products View vs Users View */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-bold shrink-0">
              <span className="px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 text-[#4A4A4A] dark:text-white shadow-2xs font-extrabold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#6D8196]" />
                <span>By Products</span>
              </span>
              <Link
                href="/user-commissions"
                className="px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5" />
                <span>By Users</span>
              </Link>
            </div>

            <button
              onClick={() => fetchData(activeSiteTab, true)}
              disabled={refreshing}
              className="px-3.5 py-2.5 rounded-xl border border-[#CBCBCB]/80 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-[#4A4A4A] dark:text-slate-200 transition flex items-center gap-2 shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            {session?.user?.role === "SUPER_ADMIN" && (
              <Link
                href="/commission-settings"
                className="px-4 py-2.5 rounded-xl border border-purple-200 dark:border-purple-800/70 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-xs font-bold text-purple-700 dark:text-purple-300 transition flex items-center gap-2 shadow-2xs cursor-pointer"
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Commission Settings</span>
              </Link>
            )}
          </div>
        </div>

        {/* ─── NAVBAR-STYLE SITE TABS ─────────────────────────────────── */}
        <div className="mt-6 pt-5 border-t border-[#CBCBCB]/40 dark:border-slate-800">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] uppercase font-bold tracking-wider text-[#737373] dark:text-slate-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#6D8196]" />
              <span>Select Site to Filter Products:</span>
            </span>
            <span className="text-xs text-[#737373] dark:text-slate-400 font-bold">
              {sites.length} Active Sites
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
            {/* "All Sites" Tab */}
            <button
              onClick={() => setActiveSiteTab("ALL")}
              className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeSiteTab === "ALL"
                  ? "bg-[#6D8196] text-white shadow-xs"
                  : "bg-[#FAF9F5] dark:bg-slate-800/80 text-[#737373] dark:text-slate-300 hover:text-[#4A4A4A] dark:hover:text-white border border-[#CBCBCB]/60 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Sites</span>
              <span
                className={`text-[10px] px-2 py-0.2 rounded-full font-extrabold ${
                  activeSiteTab === "ALL"
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                {metrics.totalProducts}
              </span>
            </button>

            {/* Individual Site Tabs */}
            {sites.map((site) => {
              const isActive = activeSiteTab === String(site.id);
              return (
                <button
                  key={site.id}
                  onClick={() => setActiveSiteTab(String(site.id))}
                  className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    isActive
                      ? "bg-[#6D8196] text-white shadow-xs"
                      : "bg-[#FAF9F5] dark:bg-slate-800/80 text-[#737373] dark:text-slate-300 hover:text-[#4A4A4A] dark:hover:text-white border border-[#CBCBCB]/60 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>{site.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {site._count?.products || 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── SUMMARY METRICS STRIP ────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] uppercase font-bold text-[#737373] dark:text-slate-400">
            Total Commissions
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-black text-[#6D8196] dark:text-sky-400">
              Rs. {metrics.totalCommissions.toFixed(2)}
            </span>
            <Coins className="w-4 h-4 text-[#6D8196] opacity-60" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
            Paid Commissions
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
              Rs. {metrics.totalPaid.toFixed(2)}
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500 opacity-70" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] uppercase font-bold text-amber-600 dark:text-amber-400">
            Pending Commissions
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400">
              Rs. {metrics.totalPending.toFixed(2)}
            </span>
            <Clock className="w-4 h-4 text-amber-500 opacity-70" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] uppercase font-bold text-blue-600 dark:text-blue-400">
            1st Sales Logged
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-black text-blue-600 dark:text-blue-400">
              {metrics.totalFirstSales}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              1st
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <span className="text-[11px] uppercase font-bold text-purple-600 dark:text-purple-400">
            Resales Logged
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-black text-purple-600 dark:text-purple-400">
              {metrics.totalResales}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
              Re
            </span>
          </div>
        </div>
      </div>

      {/* ─── SEARCH & FILTER CONTROLS ─────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search product, writer, linker..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-[#FAF9F5] dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-[#4A4A4A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6D8196]/40"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto flex-wrap">
          {/* Payment Status Filter */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-bold">
            {["ALL", "PAID", "PENDING"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-lg transition cursor-pointer text-[11px] ${
                  statusFilter === status
                    ? "bg-white dark:bg-slate-700 text-[#4A4A4A] dark:text-white shadow-2xs font-extrabold"
                    : "text-slate-500 dark:text-slate-400 hover:text-[#4A4A4A]"
                }`}
              >
                {status === "ALL" ? "All Status" : status}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-bold">
            {["ALL", "NUTRA", "ECOM"].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-lg transition cursor-pointer text-[11px] ${
                  categoryFilter === cat
                    ? "bg-white dark:bg-slate-700 text-[#4A4A4A] dark:text-white shadow-2xs font-extrabold"
                    : "text-slate-500 dark:text-slate-400 hover:text-[#4A4A4A]"
                }`}
              >
                {cat === "ALL" ? "All Types" : cat}
              </button>
            ))}
          </div>

          {(search || statusFilter !== "ALL" || categoryFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setCategoryFilter("ALL");
              }}
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ─── MAIN PRODUCTS COMMISSIONS TABLE ──────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9F5] dark:bg-slate-850/80 border-b border-[#CBCBCB]/50 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-[#737373] dark:text-slate-400">
              <tr>
                <th className="py-3.5 px-4">Product & Site</th>
                <th className="py-3.5 px-3">Linker</th>
                <th className="py-3.5 px-3">Writer</th>
                <th className="py-3.5 px-3 text-center">1st Sale</th>
                <th className="py-3.5 px-3 text-center">Resale</th>
                <th className="py-3.5 px-3 text-center">Payment Status</th>
                <th className="py-3.5 px-3">Date</th>
                <th className="py-3.5 px-4 text-right">Commission (Rs.)</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <p className="text-sm font-semibold">No products found for the selected criteria</p>
                    <p className="text-xs mt-1">Try changing the site tab or clearing active filters</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => {
                  const hasSales = prod.totalSalesCount > 0;
                  const isNutra = prod.categoryKey === "NUTRA";

                  return (
                    <tr
                      key={prod.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition group"
                    >
                      {/* Product Name & Site */}
                      <td className="py-3.5 px-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-slate-900 dark:text-white truncate max-w-[220px]">
                              {prod.name}
                            </span>
                            {prod.articleLink && (
                              <a
                                href={prod.articleLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-400 hover:text-sky-500"
                                title="View Article Link"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {prod.siteName}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                                isNutra
                                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40"
                                  : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40"
                              }`}
                            >
                              {isNutra ? (
                                <Pill className="w-2.5 h-2.5 text-emerald-500" />
                              ) : (
                                <ShoppingBag className="w-2.5 h-2.5 text-blue-500" />
                              )}
                              <span>{prod.categoryName}</span>
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Linker Name */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                            <Link2 className="w-3 h-3" />
                          </div>
                          <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs">
                            {prod.linkerName}
                          </span>
                        </div>
                      </td>

                      {/* Writer Name */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                            <PenTool className="w-3 h-3" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs block">
                              {prod.writerName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {prod.articleStatus}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 1st Sale Count & Quick Add */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                              prod.firstSalesCount > 0
                                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                            }`}
                          >
                            {prod.firstSalesCount}
                          </span>
                          <button
                            onClick={() => handleOpenAddSale(prod, "FIRST_SALE")}
                            className="p-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-400 hover:text-emerald-600 transition cursor-pointer"
                            title="Log 1st Sale"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Resale Count & Quick Add */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                              prod.resalesCount > 0
                                ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                            }`}
                          >
                            {prod.resalesCount}
                          </span>
                          <button
                            onClick={() => handleOpenAddSale(prod, "RESALE")}
                            className="p-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 text-slate-400 hover:text-blue-600 transition cursor-pointer"
                            title="Log Resale"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Payment Status */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {prod.overallPaymentStatus === "PAID" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                            <Check className="w-3 h-3" />
                            <span>Paid</span>
                          </span>
                        ) : prod.overallPaymentStatus === "PENDING" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                            <Clock className="w-3 h-3" />
                            <span>Pending</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400">
                            No Sales
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px]">
                        {new Date(prod.latestDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      {/* Commission Amount */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="font-black text-sm text-[#4A4A4A] dark:text-white">
                          Rs. {prod.totalCommissionAmount.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {hasSales ? (
                            <span>{prod.totalSalesCount} total sales</span>
                          ) : (
                            <span>
                              1st: Rs.{prod.rates.firstSaleTotal} | Re: Rs.{prod.rates.resaleTotal}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenAddSale(prod)}
                            className="px-2.5 py-1 rounded-xl bg-[#6D8196] hover:bg-[#5A6D81] text-white text-[11px] font-bold shadow-2xs transition flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Sale</span>
                          </button>

                          {hasSales && (
                            <button
                              onClick={() => setHistoryProduct(prod)}
                              className="px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 text-[11px] font-bold transition shadow-2xs cursor-pointer"
                              title="View Sales History"
                            >
                              History ({prod.totalSalesCount})
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL: RECORD 1ST SALE / RESALE ─────────────────────────── */}
      {selectedProductForSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-black text-[#4A4A4A] dark:text-white">
                  Record Commission Sale
                </h3>
                <p className="text-xs text-[#737373] dark:text-slate-400 mt-0.5">
                  {selectedProductForSale.name} ({selectedProductForSale.siteName})
                </p>
              </div>
              <button
                onClick={() => setSelectedProductForSale(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitSale} className="space-y-4 text-xs">
              {/* Sale Type Selector: 1st Sale vs Resale */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Select Sale Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalSaleType("FIRST_SALE")}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                      modalSaleType === "FIRST_SALE"
                        ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-2xs"
                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>1st Sale</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalSaleType("RESALE")}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                      modalSaleType === "RESALE"
                        ? "bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300 shadow-2xs"
                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Resale</span>
                  </button>
                </div>
              </div>

              {/* Rate Preview from CommissionSetting */}
              <div className="p-3 rounded-xl bg-[#FAF9F5] dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Auto-Resolved Rate ({selectedProductForSale.categoryKey}):
                  </span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    Rs.{" "}
                    {modalSaleType === "FIRST_SALE"
                      ? selectedProductForSale.rates.firstSaleTotal.toFixed(2)
                      : selectedProductForSale.rates.resaleTotal.toFixed(2)}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800">
                  <span>Writer: {selectedProductForSale.writerName}</span>
                  <span>Linker: {selectedProductForSale.linkerName}</span>
                </div>
              </div>

              {/* Date of Sale */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Sale Date
                </label>
                <input
                  type="date"
                  value={modalSaleDate}
                  onChange={(e) => setModalSaleDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6D8196]/40"
                  required
                />
              </div>

              {/* Payment Status */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Payment Status
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalPaymentStatus("PENDING")}
                    className={`flex-1 py-1.5 px-3 rounded-xl font-bold border transition cursor-pointer ${
                      modalPaymentStatus === "PENDING"
                        ? "bg-amber-50 dark:bg-amber-950/60 border-amber-400 text-amber-700 dark:text-amber-300 shadow-2xs"
                        : "border-slate-200 dark:border-slate-800 text-slate-500"
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalPaymentStatus("PAID")}
                    className={`flex-1 py-1.5 px-3 rounded-xl font-bold border transition cursor-pointer ${
                      modalPaymentStatus === "PAID"
                        ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-700 dark:text-emerald-300 shadow-2xs"
                        : "border-slate-200 dark:border-slate-800 text-slate-500"
                    }`}
                  >
                    Paid
                  </button>
                </div>
              </div>

              {/* Remarks / Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Remarks / Order Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Order #12345 or affiliate tracking ID"
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6D8196]/40"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedProductForSale(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSale}
                  className="px-5 py-2 rounded-xl bg-[#6D8196] hover:bg-[#5A6D81] text-white font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {submittingSale ? "Recording..." : "Confirm & Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: SALES HISTORY ────────────────────────────────────── */}
      {historyProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-black text-[#4A4A4A] dark:text-white">
                  Sales History: {historyProduct.name}
                </h3>
                <p className="text-xs text-[#737373] dark:text-slate-400 mt-0.5">
                  {historyProduct.siteName} • {historyProduct.categoryName} • Total Commissions: Rs. {historyProduct.totalCommissionAmount.toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => setHistoryProduct(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {historyProduct.sales.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No sales logged yet for this product.
                </div>
              ) : (
                historyProduct.sales.map((sale) => (
                  <div
                    key={sale.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          sale.saleType === "FIRST_SALE"
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                            : "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                        }`}
                      >
                        {sale.saleType === "FIRST_SALE" ? "1st Sale" : "Resale"}
                      </span>
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          Rs. {sale.amount.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(sale.saleDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          {sale.notes && ` • ${sale.notes}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTogglePaymentStatus(sale)}
                        disabled={updatingSaleId === sale.id}
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold border transition cursor-pointer ${
                          sale.paymentStatus === "PAID"
                            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-700 dark:text-emerald-300 hover:bg-amber-50 hover:text-amber-700"
                            : "bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-700 dark:text-amber-300 hover:bg-emerald-50 hover:text-emerald-700"
                        }`}
                        title="Click to toggle Paid/Pending"
                      >
                        {sale.paymentStatus === "PAID" ? "✓ Paid" : "⏳ Pending"}
                      </button>

                      <button
                        onClick={() => handleDeleteSale(sale.id)}
                        className="p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                        title="Delete Sale Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setHistoryProduct(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
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
