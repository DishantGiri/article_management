"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ReceiptText,
  Search,
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
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Check,
  Layers,
  ArrowRight,
  SlidersHorizontal,
  Users,
  Award,
  TrendingUp,
  Gift,
  PartyPopper,
  Sparkles,
  Eye,
  ArrowUpDown,
  Filter,
  Package,
} from "lucide-react";
import { toast } from "react-hot-toast";
import LoadingScreen from "@/components/LoadingScreen";
import { fuzzyMatchAny } from "@/lib/fuzzy";

// Flat Commission Sale for the Commission List view
export interface CommissionSaleItem {
  id: number;
  productId: number;
  productName: string;
  siteId: number;
  siteName: string;
  siteUrl: string | null;
  categoryName: string;
  categoryKey: "NUTRA" | "ECOM";
  articleLink: string | null;
  articleStatus: string;
  saleType: "FIRST_SALE" | "RESALE";
  saleDate: string;
  writerId: number | null;
  writerName: string;
  writerAmount: number;
  linkerId: number | null;
  linkerName: string;
  linkerAmount: number;
  teamLeadId: number | null;
  teamLeadName: string | null;
  tlAmount: number;
  seoAmount: number;
  bonusAmount: number;
  partyAmount: number;
  amount: number;
  paymentStatus: "PENDING" | "PAID";
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
}

// Grouped Product Row for "By Products" view
export interface ProductCommissionRow {
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
  sales: any[];
  rates: {
    firstSaleTotal: number;
    resaleTotal: number;
    firstSaleBreakdown: any;
    resaleBreakdown: any;
  };
}

export interface SiteTab {
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
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // View Mode: "LIST" (Commission List) or "PRODUCTS" (Grouped by Products)
  const initialTab = searchParams.get("tab") === "products" ? "PRODUCTS" : "LIST";
  const [activeViewTab, setActiveViewTab] = useState<"LIST" | "PRODUCTS">(initialTab);

  const [sites, setSites] = useState<SiteTab[]>([]);
  const [products, setProducts] = useState<ProductCommissionRow[]>([]);
  const [sales, setSales] = useState<CommissionSaleItem[]>([]);

  // 5 Core Metric Pools + Turnover Stats
  const [metrics, setMetrics] = useState({
    totalProducts: 0,
    totalSales: 0,
    totalCommissions: 0,
    totalPaid: 0,
    totalPending: 0,
    totalFirstSales: 0,
    totalFirstSalesAmount: 0,
    totalResales: 0,
    totalResalesAmount: 0,
    totalBonusPool: 0,
    totalSeoPool: 0,
    totalPartyFunds: 0,
    totalLinkerAmount: 0,
    totalWriterAmount: 0,
    totalTlAmount: 0,
  });

  // Active Site Tab: "ALL" or siteId string
  const [activeSiteTab, setActiveSiteTab] = useState<string>("ALL");

  // Filters
  const [search, setSearch] = useState("");
  const [saleTypeFilter, setSaleTypeFilter] = useState<string>("ALL"); // "ALL" | "FIRST_SALE" | "RESALE"
  const [statusFilter, setStatusFilter] = useState<string>("ALL");     // "ALL" | "PAID" | "PENDING"
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL"); // "ALL" | "NUTRA" | "ECOM"
  const [sortBy, setSortBy] = useState<string>("dateDesc");

  // Modal: Record Sale (Works for both specific product or any product selector)
  const [isRecordSaleModalOpen, setIsRecordSaleModalOpen] = useState(false);
  const [selectedProductForSale, setSelectedProductForSale] = useState<ProductCommissionRow | null>(null);
  const [modalProductId, setModalProductId] = useState<string>("");
  const [modalSaleType, setModalSaleType] = useState<"FIRST_SALE" | "RESALE">("FIRST_SALE");
  const [modalSaleDate, setModalSaleDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [modalPaymentStatus, setModalPaymentStatus] = useState<"PENDING" | "PAID">("PENDING");
  const [modalNotes, setModalNotes] = useState<string>("");
  const [submittingSale, setSubmittingSale] = useState(false);

  // Modal: Single Sale Details Breakdown
  const [detailsSale, setDetailsSale] = useState<CommissionSaleItem | null>(null);

  // Modal: Product History Modal (for "By Products" view)
  const [historyProduct, setHistoryProduct] = useState<ProductCommissionRow | null>(null);
  const [updatingSaleId, setUpdatingSaleId] = useState<number | null>(null);

  // Fetch Commission Data
  const fetchData = async (siteId = activeSiteTab, isBackground = false) => {
    if (session?.user?.role !== "SUPER_ADMIN") {
      setLoading(false);
      return;
    }

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
      setSales(data.sales || []);
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
      if (session?.user?.role === "SUPER_ADMIN") {
        fetchData(activeSiteTab);
      } else {
        setLoading(false);
      }
    }
  }, [activeSiteTab, status, session]);

  // Open Record Sale Modal
  const handleOpenAddSale = (
    product?: ProductCommissionRow | null,
    defaultType: "FIRST_SALE" | "RESALE" = "FIRST_SALE"
  ) => {
    if (product) {
      setSelectedProductForSale(product);
      setModalProductId(String(product.id));
    } else {
      setSelectedProductForSale(products[0] || null);
      setModalProductId(products[0] ? String(products[0].id) : "");
    }
    setModalSaleType(defaultType);
    setModalSaleDate(new Date().toISOString().split("T")[0]);
    setModalPaymentStatus("PENDING");
    setModalNotes("");
    setIsRecordSaleModalOpen(true);
  };

  // Submit Sale Recording
  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const prodId = selectedProductForSale?.id || parseInt(modalProductId);
    if (!prodId) {
      toast.error("Please select a product");
      return;
    }

    setSubmittingSale(true);
    try {
      const res = await fetch("/api/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: prodId,
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
        `${modalSaleType === "FIRST_SALE" ? "1st Sale" : "Resale"} logged successfully!`
      );
      setIsRecordSaleModalOpen(false);
      setSelectedProductForSale(null);
      fetchData(activeSiteTab, true);
    } catch (err: any) {
      toast.error(err.message || "Error saving sale");
    } finally {
      setSubmittingSale(false);
    }
  };

  // Toggle Single Sale Payment Status
  const handleTogglePaymentStatus = async (saleId: number, currentStatus: string) => {
    setUpdatingSaleId(saleId);
    const nextStatus: "PENDING" | "PAID" = currentStatus === "PAID" ? "PENDING" : "PAID";

    try {
      const res = await fetch(`/api/commissions/${saleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: nextStatus }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      toast.success(`Sale #${saleId} marked as ${nextStatus}!`);

      // Update in sales state
      setSales((prev) =>
        prev.map((s) => (s.id === saleId ? { ...s, paymentStatus: nextStatus } : s))
      );

      // Update in details modal if active
      if (detailsSale && detailsSale.id === saleId) {
        setDetailsSale({ ...detailsSale, paymentStatus: nextStatus });
      }

      // Update in history modal if active
      if (historyProduct) {
        const updatedSales = historyProduct.sales.map((s) =>
          s.id === saleId ? { ...s, paymentStatus: nextStatus } : s
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


  // Filter & Sort for the Commission List view
  const filteredSales = useMemo(() => {
    let result = [...sales];

    if (search.trim()) {
      result = result.filter((s) =>
        fuzzyMatchAny(
          [
            s.productName,
            s.siteName,
            s.writerName,
            s.linkerName,
            s.teamLeadName,
            s.categoryName,
            s.notes,
          ],
          search
        )
      );
    }

    if (saleTypeFilter !== "ALL") {
      result = result.filter((s) => s.saleType === saleTypeFilter);
    }

    if (statusFilter !== "ALL") {
      result = result.filter((s) => s.paymentStatus === statusFilter);
    }

    if (categoryFilter !== "ALL") {
      result = result.filter((s) => s.categoryKey === categoryFilter);
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case "dateDesc":
          return new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime();
        case "dateAsc":
          return new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime();
        case "amountDesc":
          return b.amount - a.amount;
        case "bonusDesc":
          return b.bonusAmount - a.bonusAmount;
        case "seoDesc":
          return b.seoAmount - a.seoAmount;
        case "partyDesc":
          return b.partyAmount - a.partyAmount;
        default:
          return new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime();
      }
    });

    return result;
  }, [sales, search, saleTypeFilter, statusFilter, categoryFilter, sortBy]);

  // Filtered Products for the "By Products" view
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (search.trim()) {
        const match = fuzzyMatchAny(
          [p.name, p.siteName, p.writerName, p.linkerName, p.categoryName],
          search
        );
        if (!match) return false;
      }
      if (statusFilter !== "ALL" && p.overallPaymentStatus !== statusFilter) return false;
      if (categoryFilter !== "ALL" && p.categoryKey !== categoryFilter) return false;
      return true;
    });
  }, [products, search, statusFilter, categoryFilter]);

  if (status === "loading" || (loading && session?.user?.role === "SUPER_ADMIN")) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] dark:bg-slate-950">
        <LoadingScreen
          message={status === "loading" ? "Authenticating..." : "Loading commissions dashboard..."}
          subtext={
            status === "loading"
              ? "Checking permissions..."
              : "Retrieving 1st sales, resales, bonus pool, SEO pool, and party funds"
          }
          size="lg"
        />
      </div>
    );
  }

  // Super Admin Role Verification
  if (!session || session.user?.role !== "SUPER_ADMIN") {
    return (
      <div className="p-6 sm:p-12 max-w-2xl mx-auto min-h-screen flex flex-col items-center justify-center text-center bg-[#FAF9F5] dark:bg-slate-950 text-[#4A4A4A] dark:text-slate-100">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-5 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#4A4A4A] dark:text-white">
          Super Admin Access Required
        </h1>
        <p className="text-sm text-[#737373] dark:text-slate-400 mt-2 max-w-md font-medium leading-relaxed">
          The main commissions dashboard and fund pool reports are strictly restricted to Super Administrators. Please sign in with an authorized account or visit your individual User Commissions page.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Link
            href="/user-commissions"
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-xs"
          >
            Go to User Commissions
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold transition shadow-xs"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] dark:bg-slate-950 text-[#4A4A4A] dark:text-slate-100 space-y-6">
      {/* ─── TOP HEADER BANNER ────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-amber-100/30 dark:from-amber-950/20 via-sky-100/20 dark:via-sky-950/10 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#6D8196] via-[#5A6D81] to-[#3D4F61] text-white flex items-center justify-center font-bold shadow-md shrink-0">
              <ReceiptText className="w-8 h-8 drop-shadow-sm" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#4A4A4A] dark:text-white">
                  Commission List & Funds
                </h1>
                <span className="text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Live Pool Tracking
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#737373] dark:text-slate-400 mt-1 font-medium max-w-2xl leading-relaxed">
                Complete overview of 1st sales, resales, team performance bonus pool, SEO growth pool, and office party funds.
              </p>
            </div>
          </div>

          {/* Action Buttons & View Switcher */}
          <div className="flex items-center gap-2.5 self-stretch sm:self-auto flex-wrap">
            {/* View Switcher Tabs */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-bold shrink-0">
              <button
                onClick={() => setActiveViewTab("LIST")}
                className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  activeViewTab === "LIST"
                    ? "bg-white dark:bg-slate-700 text-[#4A4A4A] dark:text-white shadow-2xs font-extrabold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <ReceiptText className="w-3.5 h-3.5 text-[#6D8196]" />
                <span>Commission List</span>
              </button>

              <button
                onClick={() => setActiveViewTab("PRODUCTS")}
                className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  activeViewTab === "PRODUCTS"
                    ? "bg-white dark:bg-slate-700 text-[#4A4A4A] dark:text-white shadow-2xs font-extrabold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>By Products</span>
              </button>

              <Link
                href="/user-commissions"
                className="px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5" />
                <span>By Users</span>
              </Link>
            </div>

            {/* Record Sale Action */}
            <button
              onClick={() => handleOpenAddSale(null)}
              className="px-4 py-2 rounded-xl bg-[#6D8196] hover:bg-[#5A6D81] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record Sale</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => fetchData(activeSiteTab, true)}
              disabled={refreshing}
              className="px-3.5 py-2 rounded-xl border border-[#CBCBCB]/80 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-[#4A4A4A] dark:text-slate-200 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {session?.user?.role === "SUPER_ADMIN" && (
              <Link
                href="/commission-settings"
                className="px-3.5 py-2 rounded-xl border border-purple-200 dark:border-purple-800/70 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-xs font-bold text-purple-700 dark:text-purple-300 transition flex items-center gap-1.5 shadow-2xs"
              >
                <Coins className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
            )}
          </div>
        </div>

        {/* ─── NAVBAR-STYLE SITE TABS ─────────────────────────────────── */}
        <div className="mt-6 pt-5 border-t border-[#CBCBCB]/40 dark:border-slate-800">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] uppercase font-bold tracking-wider text-[#737373] dark:text-slate-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#6D8196]" />
              <span>Filter by Site:</span>
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
                {metrics.totalSales}
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
                    {site._count?.commissionSales || 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── 5 SPECIALIZED METRIC CARDS (1st Sale, Resales, Bonus, SEO, Party) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* CARD 1: Total 1st Sales */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200/70 dark:border-blue-900/60 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-blue-400 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider">
              Total 1st Sales
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-blue-700 dark:text-blue-300 tracking-tight">
              {metrics.totalFirstSales} <span className="text-xs font-semibold text-slate-400">sales</span>
            </div>
            <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-blue-100 dark:border-blue-950">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Total Revenue</span>
              <span className="text-xs font-black text-blue-700 dark:text-blue-300">
                Rs. {metrics.totalFirstSalesAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 2: Total Resales */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-purple-200/70 dark:border-purple-900/60 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-purple-400 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-purple-600 dark:text-purple-400 tracking-wider">
              Total Resales
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-purple-700 dark:text-purple-300 tracking-tight">
              {metrics.totalResales} <span className="text-xs font-semibold text-slate-400">sales</span>
            </div>
            <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-purple-100 dark:border-purple-950">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Total Revenue</span>
              <span className="text-xs font-black text-purple-700 dark:text-purple-300">
                Rs. {metrics.totalResalesAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 3: Bonus Pool */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-amber-900/60 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-amber-400 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">
              Bonus Pool
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Gift className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-300 tracking-tight">
              Rs. {metrics.totalBonusPool.toFixed(2)}
            </div>
            <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-amber-100 dark:border-amber-950">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Allocation</span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
                Team Performance
              </span>
            </div>
          </div>
        </div>

        {/* CARD 4: SEO Pool */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-teal-200/70 dark:border-teal-900/60 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-teal-400 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-teal-600 dark:text-teal-400 tracking-wider">
              SEO Pool
            </span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-teal-700 dark:text-teal-300 tracking-tight">
              Rs. {metrics.totalSeoPool.toFixed(2)}
            </div>
            <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-teal-100 dark:border-teal-950">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Allocation</span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200">
                Site Rankings
              </span>
            </div>
          </div>
        </div>

        {/* CARD 5: Party Funds */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200/70 dark:border-rose-900/60 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-rose-400 transition sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider">
              Party Funds
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <PartyPopper className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-rose-700 dark:text-rose-300 tracking-tight">
              Rs. {metrics.totalPartyFunds.toFixed(2)}
            </div>
            <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-rose-100 dark:border-rose-950">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Allocation</span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200">
                Celebration Pool
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECONDARY OVERVIEW BAR: Turnover & Settled vs Pending ─── */}
      <div className="bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Total Commissions:</span>
            <span className="text-sm font-black text-slate-800 dark:text-white">
              Rs. {metrics.totalCommissions.toFixed(2)}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase text-[10px]">Paid:</span>
            <span className="font-extrabold text-emerald-700 dark:text-emerald-300">
              Rs. {metrics.totalPaid.toFixed(2)}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <div className="flex items-center gap-1.5">
            <span className="text-amber-600 dark:text-amber-400 font-bold uppercase text-[10px]">Pending:</span>
            <span className="font-extrabold text-amber-700 dark:text-amber-300">
              Rs. {metrics.totalPending.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Team Beneficiary Shares summary */}
        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          <span>Writer Share: <strong className="text-slate-700 dark:text-slate-200">Rs. {metrics.totalWriterAmount.toFixed(2)}</strong></span>
          <span>•</span>
          <span>Linker Share: <strong className="text-slate-700 dark:text-slate-200">Rs. {metrics.totalLinkerAmount.toFixed(2)}</strong></span>
          <span>•</span>
          <span>TL Share: <strong className="text-slate-700 dark:text-slate-200">Rs. {metrics.totalTlAmount.toFixed(2)}</strong></span>
        </div>
      </div>

      {/* ─── SEARCH & FILTER TOOLBAR ─────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              activeViewTab === "LIST"
                ? "Search product, writer, linker, notes..."
                : "Search product catalog..."
            }
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
          {/* Sale Type Filter (for Commission List view) */}
          {activeViewTab === "LIST" && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-bold">
              {[
                { key: "ALL", label: "All Sales" },
                { key: "FIRST_SALE", label: "1st Sales" },
                { key: "RESALE", label: "Resales" },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSaleTypeFilter(t.key)}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer text-[11px] ${
                    saleTypeFilter === t.key
                      ? "bg-white dark:bg-slate-700 text-[#4A4A4A] dark:text-white shadow-2xs font-extrabold"
                      : "text-slate-500 dark:text-slate-400 hover:text-[#4A4A4A]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

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

          {/* Sort By (for Commission List view) */}
          {activeViewTab === "LIST" && (
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl text-xs bg-[#FAF9F5] dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="dateDesc">Date: Newest First</option>
              <option value="dateAsc">Date: Oldest First</option>
              <option value="amountDesc">Amount: Highest First</option>
              <option value="bonusDesc">Bonus Pool: Highest</option>
              <option value="seoDesc">SEO Pool: Highest</option>
              <option value="partyDesc">Party Fund: Highest</option>
            </select>
          )}

          {(search ||
            statusFilter !== "ALL" ||
            categoryFilter !== "ALL" ||
            saleTypeFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setCategoryFilter("ALL");
                setSaleTypeFilter("ALL");
              }}
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ─── MAIN VIEW 1: COMMISSION LIST TABLE (Default) ───────────── */}
      {activeViewTab === "LIST" ? (
        <div className="bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#4A4A4A] dark:text-white">
                All Recorded Commission Sales ({filteredSales.length})
              </span>
              <span className="text-xs text-slate-400">
                • Showing 1st sales, resales & pool breakdowns
              </span>
            </div>
            <button
              onClick={() => handleOpenAddSale(null)}
              className="px-3 py-1.5 rounded-xl bg-[#6D8196] hover:bg-[#5A6D81] text-white text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Sale</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F5] dark:bg-slate-850/80 border-b border-[#CBCBCB]/50 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-[#737373] dark:text-slate-400">
                <tr>
                  <th className="py-3.5 px-4"># / Date</th>
                  <th className="py-3.5 px-3">Product & Site</th>
                  <th className="py-3.5 px-3 text-center">Sale Type</th>
                  <th className="py-3.5 px-3">Beneficiaries (Team)</th>
                  <th className="py-3.5 px-3 text-center">Bonus Pool</th>
                  <th className="py-3.5 px-3 text-center">SEO Pool</th>
                  <th className="py-3.5 px-3 text-center">Party Fund</th>
                  <th className="py-3.5 px-4 text-right">Total Commission</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <p className="text-sm font-semibold">No commission sales found</p>
                      <p className="text-xs mt-1">
                        Try clearing active filters or click &quot;Record Sale&quot; to log a new commission
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => {
                    const is1st = sale.saleType === "FIRST_SALE";
                    const isNutra = sale.categoryKey === "NUTRA";

                    return (
                      <tr
                        key={sale.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition group"
                      >
                        {/* Sale ID & Date */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-extrabold text-slate-800 dark:text-slate-100">
                            #{sale.id}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>
                              {new Date(sale.saleDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </td>

                        {/* Product & Site */}
                        <td className="py-3.5 px-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-slate-900 dark:text-white truncate max-w-[200px]">
                                {sale.productName}
                              </span>
                              {sale.articleLink && (
                                <a
                                  href={sale.articleLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-slate-400 hover:text-sky-500"
                                  title="View Article Link"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {sale.siteName}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                  isNutra
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40"
                                    : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40"
                                }`}
                              >
                                {sale.categoryName}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Sale Type */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          {is1st ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 shadow-2xs">
                              <Award className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                              <span>1st Sale</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 shadow-2xs">
                              <RefreshCw className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                              <span>Resale</span>
                            </span>
                          )}
                        </td>

                        {/* Beneficiaries Breakdown */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="space-y-0.5 text-[10px]">
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400 font-bold w-10">Writer:</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {sale.writerName}
                              </span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 ml-auto">
                                Rs. {sale.writerAmount.toFixed(0)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400 font-bold w-10">Linker:</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {sale.linkerName}
                              </span>
                              <span className="font-bold text-sky-600 dark:text-sky-400 ml-auto">
                                Rs. {sale.linkerAmount.toFixed(0)}
                              </span>
                            </div>
                            {sale.teamLeadName && (
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400 font-bold w-10">TL:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                  {sale.teamLeadName}
                                </span>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400 ml-auto">
                                  Rs. {sale.tlAmount.toFixed(0)}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Bonus Pool */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 shadow-2xs">
                            <Gift className="w-3 h-3 text-amber-500" />
                            <span>Rs. {sale.bonusAmount.toFixed(0)}</span>
                          </span>
                        </td>

                        {/* SEO Pool */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/40 shadow-2xs">
                            <TrendingUp className="w-3 h-3 text-teal-500" />
                            <span>Rs. {sale.seoAmount.toFixed(0)}</span>
                          </span>
                        </td>

                        {/* Party Fund */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 shadow-2xs">
                            <PartyPopper className="w-3 h-3 text-rose-500" />
                            <span>Rs. {sale.partyAmount.toFixed(0)}</span>
                          </span>
                        </td>

                        {/* Total Commission */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="font-black text-sm text-[#4A4A4A] dark:text-white">
                            Rs. {sale.amount.toFixed(2)}
                          </div>
                          {sale.notes && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[140px] ml-auto">
                              {sale.notes}
                            </div>
                          )}
                        </td>

                        {/* Payment Status (Clickable Toggle) */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleTogglePaymentStatus(sale.id, sale.paymentStatus)}
                            disabled={updatingSaleId === sale.id}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold border transition cursor-pointer shadow-2xs ${
                              sale.paymentStatus === "PAID"
                                ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 text-emerald-700 dark:text-emerald-300 hover:bg-amber-50 hover:text-amber-700"
                                : "bg-amber-50 dark:bg-amber-950/60 border-amber-300 text-amber-700 dark:text-amber-300 hover:bg-emerald-50 hover:text-emerald-700"
                            }`}
                            title="Click to toggle Paid / Pending"
                          >
                            {sale.paymentStatus === "PAID" ? "✓ Paid" : "⏳ Pending"}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => setDetailsSale(sale)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#6D8196] hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="View Full Breakdown"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ─── MAIN VIEW 2: BY PRODUCTS VIEW ─────────────────────────── */
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
      )}

      {/* ─── MODAL: RECORD COMMISSION SALE ───────────────────────────── */}
      {isRecordSaleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-black text-[#4A4A4A] dark:text-white">
                  Record Commission Sale
                </h3>
                <p className="text-xs text-[#737373] dark:text-slate-400 mt-0.5">
                  Allocate Writer, Linker, TL, Bonus Pool, SEO Pool & Party Fund
                </p>
              </div>
              <button
                onClick={() => setIsRecordSaleModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitSale} className="space-y-4 text-xs">
              {/* Product Selector (if not pre-selected) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Select Product
                </label>
                <select
                  value={modalProductId}
                  onChange={(e) => {
                    setModalProductId(e.target.value);
                    const found = products.find((p) => p.id === parseInt(e.target.value));
                    setSelectedProductForSale(found || null);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-[#6D8196]/40 cursor-pointer"
                  required
                >
                  <option value="">Select a product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.siteName} • {p.categoryName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Sale Type Selector: 1st Sale vs Resale */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Sale Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalSaleType("FIRST_SALE")}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                      modalSaleType === "FIRST_SALE"
                        ? "bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300 shadow-2xs"
                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>1st Sale</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalSaleType("RESALE")}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                      modalSaleType === "RESALE"
                        ? "bg-purple-50 dark:bg-purple-950/60 border-purple-500 text-purple-700 dark:text-purple-300 shadow-2xs"
                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    <span>Resale</span>
                  </button>
                </div>
              </div>

              {/* Rate & Pool Preview */}
              {selectedProductForSale && (
                <div className="p-3 rounded-xl bg-[#FAF9F5] dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">
                      Total Commission ({selectedProductForSale.categoryKey}):
                    </span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      Rs.{" "}
                      {modalSaleType === "FIRST_SALE"
                        ? selectedProductForSale.rates.firstSaleTotal.toFixed(2)
                        : selectedProductForSale.rates.resaleTotal.toFixed(2)}
                    </span>
                  </div>

                  {/* Fund Distribution Breakdown */}
                  {(() => {
                    const brk =
                      modalSaleType === "FIRST_SALE"
                        ? selectedProductForSale.rates.firstSaleBreakdown
                        : selectedProductForSale.rates.resaleBreakdown;
                    if (!brk) return null;
                    return (
                      <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[10px]">
                        <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
                          <span className="text-slate-400 block font-semibold">Bonus Pool</span>
                          <span className="font-extrabold text-amber-600 dark:text-amber-400">
                            Rs. {brk.bonusPool}
                          </span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
                          <span className="text-slate-400 block font-semibold">SEO Pool</span>
                          <span className="font-extrabold text-teal-600 dark:text-teal-400">
                            Rs. {brk.seo}
                          </span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
                          <span className="text-slate-400 block font-semibold">Party Fund</span>
                          <span className="font-extrabold text-rose-600 dark:text-rose-400">
                            Rs. {brk.partyFund}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

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
                  onClick={() => setIsRecordSaleModalOpen(false)}
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

      {/* ─── MODAL: FULL SALE BREAKDOWN & DETAILS ───────────────────── */}
      {detailsSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-[#4A4A4A] dark:text-white">
                    Sale #{detailsSale.id} Details
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      detailsSale.saleType === "FIRST_SALE"
                        ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                        : "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
                    }`}
                  >
                    {detailsSale.saleType === "FIRST_SALE" ? "1st Sale" : "Resale"}
                  </span>
                </div>
                <p className="text-xs text-[#737373] dark:text-slate-400 mt-0.5">
                  {detailsSale.productName} ({detailsSale.siteName} • {detailsSale.categoryName})
                </p>
              </div>
              <button
                onClick={() => setDetailsSale(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Total Amount Banner */}
            <div className="p-4 rounded-2xl bg-[#FAF9F5] dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase">
                  Total Commission
                </span>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  Rs. {detailsSale.amount.toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-slate-400 uppercase block">
                  Status
                </span>
                <button
                  onClick={() =>
                    handleTogglePaymentStatus(detailsSale.id, detailsSale.paymentStatus)
                  }
                  className={`mt-1 px-3 py-1 rounded-xl text-xs font-black border transition cursor-pointer ${
                    detailsSale.paymentStatus === "PAID"
                      ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-50 dark:bg-amber-950/60 border-amber-300 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {detailsSale.paymentStatus === "PAID" ? "✓ Paid" : "⏳ Pending"}
                </button>
              </div>
            </div>

            {/* Beneficiaries breakdown */}
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Team Member Allocations
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    Writer: {detailsSale.writerName}
                  </span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    Rs. {detailsSale.writerAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    Linker: {detailsSale.linkerName}
                  </span>
                  <span className="font-extrabold text-sky-600 dark:text-sky-400">
                    Rs. {detailsSale.linkerAmount.toFixed(2)}
                  </span>
                </div>
                {detailsSale.teamLeadName && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      Team Lead: {detailsSale.teamLeadName}
                    </span>
                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                      Rs. {detailsSale.tlAmount.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Company Pools breakdown */}
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Company & Fund Allocations
              </h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-center">
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 block uppercase">
                    Bonus Pool
                  </span>
                  <span className="text-base font-black text-amber-800 dark:text-amber-300 mt-0.5 block">
                    Rs. {detailsSale.bonusAmount.toFixed(2)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/40 text-center">
                  <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 block uppercase">
                    SEO Pool
                  </span>
                  <span className="text-base font-black text-teal-800 dark:text-teal-300 mt-0.5 block">
                    Rs. {detailsSale.seoAmount.toFixed(2)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-center">
                  <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 block uppercase">
                    Party Fund
                  </span>
                  <span className="text-base font-black text-rose-800 dark:text-rose-300 mt-0.5 block">
                    Rs. {detailsSale.partyAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Remarks / Date / Recorded By */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div>
                Date of Sale:{" "}
                <span className="text-slate-700 dark:text-slate-200 font-semibold">
                  {new Date(detailsSale.saleDate).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              {detailsSale.notes && (
                <div>
                  Remarks / Notes:{" "}
                  <span className="text-slate-700 dark:text-slate-200 font-semibold">
                    {detailsSale.notes}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailsSale(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: PRODUCT SALES HISTORY (For By Products view) ──────── */}
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
                            ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                            : "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
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
                        onClick={() => handleTogglePaymentStatus(sale.id, sale.paymentStatus)}
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
