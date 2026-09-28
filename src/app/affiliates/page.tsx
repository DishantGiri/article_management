"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Tag,
  Package,
  Users,
  Award,
  Search,
  Plus,
  RefreshCw,
  Download,
  ExternalLink,
  ChevronRight,
  X,
  Filter,
  BarChart3,
  UserCheck,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpDown,
  Edit2,
  Trash2,
  ShieldCheck,
  Check,
} from "lucide-react";
import { toast } from "react-hot-toast";
import LoadingScreen from "@/components/LoadingScreen";
import ConfirmDialog from "@/components/ConfirmDialog";

interface LinkerContribution {
  userId: number;
  userName: string;
  userEmail?: string;
  userRole: string;
  count: number;
}

interface ProductItem {
  id: number;
  name: string;
  slug: string | null;
  siteName: string;
  addedByName: string;
  addedById: number;
  addedByRole: string;
  addedAt: string;
  previewLink: string | null;
  trendLink: string | null;
}

interface AffiliateData {
  id: number;
  name: string;
  productCount: number;
  percentage: number;
  linkers: LinkerContribution[];
  products: ProductItem[];
}

interface LinkerSummary {
  userId: number;
  userName: string;
  userEmail?: string;
  userRole: string;
  totalProducts: number;
  affiliateProductsCount: number;
  affiliates: Array<{ name: string; count: number }>;
}

interface SiteItem {
  id: number;
  name: string;
}

interface StatsSummary {
  totalAffiliates: number;
  activeAffiliatesCount: number;
  totalAffiliateProducts: number;
  totalAllProducts: number;
  unassignedProductsCount: number;
  totalContributingLinkers: number;
  topAffiliate: {
    name: string;
    count: number;
    percentage: number;
  } | null;
}

export default function AffiliatesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const userRole = session?.user?.role || "USER";
  const canAccess =
    userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "LINKER";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [affiliates, setAffiliates] = useState<AffiliateData[]>([]);
  const [linkers, setLinkers] = useState<LinkerSummary[]>([]);
  const [sites, setSites] = useState<SiteItem[]>([]);

  // Filter States
  const [activeTab, setActiveTab] = useState<"affiliates" | "linkers">("affiliates");
  const [search, setSearch] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"count" | "name">("count");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Product Inspection Modal
  const [inspectModal, setInspectModal] = useState<{
    isOpen: boolean;
    title: string;
    subtitle: string;
    products: ProductItem[];
  }>({
    isOpen: false,
    title: "",
    subtitle: "",
    products: [],
  });
  const [modalSearch, setModalSearch] = useState("");

  // Add Affiliate Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAffiliateName, setNewAffiliateName] = useState("");
  const [addingSubmitting, setAddingSubmitting] = useState(false);

  // Edit Inline State
  const [editingAffiliate, setEditingAffiliate] = useState<{ id: number; name: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Delete Confirm State
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);

  const fetchStats = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const url = new URL("/api/affiliates/stats", window.location.origin);
      if (selectedSiteId && selectedSiteId !== "all") {
        url.searchParams.set("siteId", selectedSiteId);
      }

      const res = await fetch(url.toString());
      if (res.status === 403 || res.status === 401) {
        toast.error("You do not have permission to view affiliate statistics.");
        router.push("/");
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load affiliate analytics");

      setSummary(data.summary);
      setAffiliates(data.affiliates || []);
      setLinkers(data.linkers || []);
      setSites(data.sites || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch affiliate statistics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (status === "loading") return;
    if (!canAccess) {
      router.push("/");
      return;
    }
    fetchStats();
  }, [status, selectedSiteId]);

  // Filtered & Sorted Affiliates
  const filteredAffiliates = useMemo(() => {
    let result = [...affiliates];

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.linkers.some((l) => l.userName.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      if (sortBy === "count") {
        return sortOrder === "desc"
          ? b.productCount - a.productCount
          : a.productCount - b.productCount;
      }
      return sortOrder === "desc"
        ? b.name.localeCompare(a.name)
        : a.name.localeCompare(b.name);
    });

    return result;
  }, [affiliates, search, sortBy, sortOrder]);

  // Filtered & Sorted Linkers
  const filteredLinkers = useMemo(() => {
    let result = [...linkers];

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (l) =>
          l.userName.toLowerCase().includes(q) ||
          (l.userEmail && l.userEmail.toLowerCase().includes(q)) ||
          l.affiliates.some((aff) => aff.name.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      if (sortBy === "count") {
        return sortOrder === "desc"
          ? b.affiliateProductsCount - a.affiliateProductsCount
          : a.affiliateProductsCount - b.affiliateProductsCount;
      }
      return sortOrder === "desc"
        ? b.userName.localeCompare(a.userName)
        : a.userName.localeCompare(b.userName);
    });

    return result;
  }, [linkers, search, sortBy, sortOrder]);

  // Handle Add Affiliate
  const handleAddAffiliate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newAffiliateName.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      toast.error("Affiliate Name is required.");
      return;
    }

    if (!/^[a-zA-Z0-9 ]+$/.test(trimmed)) {
      toast.error("Special characters are not allowed. Only letters, numbers, and spaces are permitted.");
      return;
    }

    setAddingSubmitting(true);
    try {
      const res = await fetch("/api/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create affiliate");

      toast.success(`Affiliate "${trimmed}" added successfully!`);
      setNewAffiliateName("");
      setShowAddModal(false);
      fetchStats(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to create affiliate");
    } finally {
      setAddingSubmitting(false);
    }
  };

  // Handle Update Affiliate Name
  const handleUpdateAffiliate = async (id: number) => {
    const trimmed = editName.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      toast.error("Affiliate Name is required.");
      return;
    }

    setUpdatingId(id);
    try {
      const res = await fetch(`/api/affiliates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update affiliate");

      toast.success("Affiliate name updated!");
      setEditingAffiliate(null);
      fetchStats(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to update affiliate");
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle Delete Affiliate
  const handleDeleteAffiliate = (id: number, name: string) => {
    setPendingDelete({ id, name });
    setConfirmOpen(true);
  };

  const doDeleteAffiliate = async () => {
    if (!pendingDelete) return;
    const { id, name } = pendingDelete;
    try {
      const res = await fetch(`/api/affiliates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to delete");
      }
      toast.success(`"${name}" deleted.`);
      fetchStats(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (activeTab === "affiliates") {
      let csv = "Affiliate Name,Total Products,Share (%),Contributing Linkers & Counts\n";
      filteredAffiliates.forEach((a) => {
        const linkersStr = a.linkers.map((l) => `${l.userName} (${l.count})`).join(" | ");
        csv += `"${a.name}",${a.productCount},${a.percentage}%,"${linkersStr}"\n`;
      });
      downloadCSV(csv, "affiliate_product_volume.csv");
    } else {
      let csv = "Linker Name,Role,Affiliate Products,Total Products,Affiliate Breakdown\n";
      filteredLinkers.forEach((l) => {
        const affStr = l.affiliates.map((aff) => `${aff.name} (${aff.count})`).join(" | ");
        csv += `"${l.userName}","${l.userRole}",${l.affiliateProductsCount},${l.totalProducts},"${affStr}"\n`;
      });
      downloadCSV(csv, "linker_affiliate_contributions.csv");
    }
  };

  const downloadCSV = (csvContent: string, fileName: string) => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] dark:bg-slate-950 p-8 flex items-center justify-center">
        <LoadingScreen message="Loading affiliate insights & products..." size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F5] dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-6 animate-fadeIn transition-colors">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#6D8196]/15 dark:bg-[#6D8196]/30 border border-[#6D8196]/30 dark:border-[#6D8196]/50 flex items-center justify-center text-[#3D4F61] dark:text-sky-300">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                <span>Affiliate Details & Product Insights</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-extrabold bg-[#6D8196]/15 text-[#3D4F61] dark:text-sky-300 border border-[#6D8196]/30">
                  {summary?.totalAffiliateProducts || 0} Products
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Track how many products are added from each affiliate network and inspect which linker added each product.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/60 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-blue-500" : ""}`} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/60 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-[#6D8196] hover:bg-[#5A6D81] text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Affiliate</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Affiliate Products */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Total Affiliate Products
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                {summary?.totalAffiliateProducts || 0}
              </span>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {summary?.totalAllProducts
                  ? `${Math.round(((summary.totalAffiliateProducts || 0) / summary.totalAllProducts) * 100)}% of all`
                  : "Active"}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
              Across {summary?.activeAffiliatesCount || 0} active networks
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Top Affiliate Network */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Top Affiliate Network
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-extrabold text-slate-900 dark:text-slate-100 truncate max-w-[150px]" title={summary?.topAffiliate?.name || "None"}>
                {summary?.topAffiliate?.name || "N/A"}
              </span>
              {summary?.topAffiliate && (
                <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                  {summary.topAffiliate.count} prods
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
              {summary?.topAffiliate ? `${summary.topAffiliate.percentage}% of affiliate volume` : "No products mapped"}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* Registered Affiliate Networks */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Affiliate Networks
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                {summary?.totalAffiliates || 0}
              </span>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Registered
              </span>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
              {summary?.activeAffiliatesCount || 0} currently with products
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Tag className="w-6 h-6" />
          </div>
        </div>

        {/* Contributing Linkers */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Contributing Linkers
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                {summary?.totalContributingLinkers || 0}
              </span>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Active
              </span>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
              Users adding affiliate products
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs & Controls */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          {/* Main Switcher Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setActiveTab("affiliates")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === "affiliates"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Tag className="w-3.5 h-3.5 text-blue-500" />
              <span>By Affiliate Network ({filteredAffiliates.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("linkers")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === "linkers"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5 text-emerald-500" />
              <span>By Linker Contributions ({filteredLinkers.length})</span>
            </button>
          </div>

          {/* Site Filter & Sort Options */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Site selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">Site:</span>
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer"
              >
                <option value="all">All Sites</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort toggle */}
            <button
              onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition cursor-pointer"
              title={`Sorting ${sortOrder === "desc" ? "Highest to Lowest" : "Lowest to Highest"}`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === "affiliates"
                ? "Search affiliate networks, linkers..."
                : "Search linkers, email, affiliates..."
            }
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: BY AFFILIATE NETWORK */}
      {activeTab === "affiliates" && (
        <div className="space-y-4">
          {filteredAffiliates.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200/80 dark:border-slate-800">
              <Tag className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">No Affiliate Networks Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No affiliates match your current search criteria. Try clearing filters or add a new affiliate network.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAffiliates.map((aff) => {
                const isEditing = editingAffiliate?.id === aff.id;

                return (
                  <div
                    key={aff.id || aff.name}
                    className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-4 group"
                  >
                    <div>
                      {/* Card Header: Affiliate Name & Actions */}
                      <div className="flex items-start justify-between gap-2">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 flex-1 mr-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="px-2.5 py-1 text-xs font-bold border border-blue-400 rounded-lg w-full bg-white dark:bg-slate-800"
                              autoFocus
                            />
                            <button
                              onClick={() => handleUpdateAffiliate(aff.id)}
                              disabled={updatingId === aff.id}
                              className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setEditingAffiliate(null)}
                              className="p-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {aff.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                <span>{aff.name}</span>
                              </h3>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                ID: #{aff.id || "system"}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Top Badge: Product Count */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${
                            aff.productCount > 0
                              ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                              : "bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
                          }`}>
                            {aff.productCount} {aff.productCount === 1 ? "Product" : "Products"}
                          </span>
                        </div>
                      </div>

                      {/* Percentage Bar */}
                      <div className="mt-3.5 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          <span>Share of Volume</span>
                          <span className="font-extrabold text-slate-800 dark:text-slate-200">{aff.percentage}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(aff.percentage, aff.productCount > 0 ? 3 : 0)}%` }}
                          />
                        </div>
                      </div>

                      {/* Contributing Linkers Breakdown */}
                      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                          Linkers Who Added Products ({aff.linkers.length})
                        </span>

                        {aff.linkers.length === 0 ? (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 italic block">
                            No products added yet for this affiliate.
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {aff.linkers.map((linker) => (
                              <span
                                key={linker.userId}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold"
                                title={`User: ${linker.userName} (${linker.userRole})`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>{linker.userName}</span>
                                <span className="font-extrabold text-blue-600 dark:text-blue-400 bg-blue-100/60 dark:bg-blue-900/60 px-1.5 py-0.2 rounded-md text-[10px]">
                                  {linker.count}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer: View Products & Quick Manage */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {aff.id > 0 && !isEditing && (
                          <>
                            <button
                              onClick={() => {
                                setEditingAffiliate({ id: aff.id, name: aff.name });
                                setEditName(aff.name);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition cursor-pointer"
                              title="Rename Affiliate"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAffiliate(aff.id, aff.name)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition cursor-pointer"
                              title="Delete Affiliate"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setInspectModal({
                            isOpen: true,
                            title: `Products for ${aff.name}`,
                            subtitle: `${aff.productCount} total products configured with ${aff.name}`,
                            products: aff.products,
                          });
                          setModalSearch("");
                        }}
                        disabled={aff.productCount === 0}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                          aff.productCount > 0
                            ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                        }`}
                      >
                        <span>View Products</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BY LINKER CONTRIBUTIONS */}
      {activeTab === "linkers" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Linker Contributions Across Affiliates
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Shows which team member added products for each affiliate network.
              </p>
            </div>
            <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {filteredLinkers.length} Contributing Users
            </span>
          </div>

          {filteredLinkers.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">No Linker Contributions Found</h4>
              <p className="text-xs text-slate-400 mt-1">No products match the selected criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Linker / User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Affiliate Products</th>
                    <th className="py-3 px-4">Total Products</th>
                    <th className="py-3 px-4 min-w-[280px]">Affiliate Breakdown</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {filteredLinkers.map((linker) => (
                    <tr
                      key={linker.userId}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200 shrink-0">
                            {linker.userName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-slate-100 block">
                              {linker.userName}
                            </span>
                            {linker.userEmail && (
                              <span className="text-[11px] text-slate-400 block truncate max-w-[180px]">
                                {linker.userEmail}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {linker.userRole.replace("_", " ")}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                          {linker.affiliateProductsCount}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          {linker.totalProducts}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {linker.affiliates.map((aff) => (
                            <span
                              key={aff.name}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold text-[11px]"
                            >
                              <span>{aff.name}</span>
                              <span className="font-extrabold text-[10px] bg-blue-200/60 dark:bg-blue-800/80 px-1 rounded">
                                {aff.count}
                              </span>
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            // Find all products by this linker
                            const linkerProducts: ProductItem[] = [];
                            affiliates.forEach((a) => {
                              a.products.forEach((p) => {
                                if (p.addedById === linker.userId) {
                                  linkerProducts.push(p);
                                }
                              });
                            });

                            setInspectModal({
                              isOpen: true,
                              title: `Products Added by ${linker.userName}`,
                              subtitle: `${linkerProducts.length} affiliate products added by ${linker.userName}`,
                              products: linkerProducts,
                            });
                            setModalSearch("");
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
                        >
                          View Products
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PRODUCT INSPECTION MODAL */}
      {inspectModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[88vh] border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#4A4A4A] dark:bg-slate-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    {inspectModal.title}
                  </h2>
                  <p className="text-xs text-white/70 font-medium">
                    {inspectModal.subtitle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectModal((prev) => ({ ...prev, isOpen: false }))}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Search */}
            <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Filter products in this list..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            {/* Modal Products List */}
            <div className="p-6 overflow-y-auto flex-1">
              {(() => {
                const filteredModalProducts = inspectModal.products.filter(
                  (p) =>
                    p.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
                    p.siteName.toLowerCase().includes(modalSearch.toLowerCase()) ||
                    p.addedByName.toLowerCase().includes(modalSearch.toLowerCase())
                );

                if (filteredModalProducts.length === 0) {
                  return (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No products found matching your filter.
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Product Name</th>
                          <th className="py-2.5 px-3">Site</th>
                          <th className="py-2.5 px-3">Added By Linker</th>
                          <th className="py-2.5 px-3">Date Added</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                        {filteredModalProducts.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-3 px-3">
                              <span className="font-bold text-slate-900 dark:text-slate-100 block">
                                {p.name}
                              </span>
                              {p.slug && (
                                <span className="text-[10px] font-mono text-slate-400 block truncate">
                                  /{p.slug}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#6D8196]/15 text-[#3D4F61] dark:text-sky-300 border border-[#6D8196]/30">
                                {p.siteName}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {p.addedByName}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                ({p.addedByRole})
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-500">
                              {new Date(p.addedAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <Link
                                href={`/products?search=${encodeURIComponent(p.name)}`}
                                target="_blank"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold text-[11px] transition"
                              >
                                <span>Inspect</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center shrink-0">
              <span className="text-xs text-slate-500">
                Total Products: <strong>{inspectModal.products.length}</strong>
              </span>
              <button
                onClick={() => setInspectModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD AFFILIATE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 bg-[#4A4A4A] dark:bg-slate-800 text-white flex items-center justify-between">
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <Tag className="w-4 h-4" />
                <span>Add New Affiliate Network</span>
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddAffiliate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Affiliate Network Name
                </label>
                <input
                  type="text"
                  value={newAffiliateName}
                  onChange={(e) => setNewAffiliateName(e.target.value)}
                  placeholder="e.g. MaxWeb, ClickBank, Admitad"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  autoFocus
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Only letters, numbers, and spaces are permitted.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingSubmitting}
                  className="px-4 py-2 bg-[#6D8196] hover:bg-[#5A6D81] text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  {addingSubmitting ? "Saving..." : "Create Affiliate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete Affiliate Network"
        message={`Are you sure you want to delete "${pendingDelete?.name}"? Existing products mapped to this affiliate will remain untouched.`}
        confirmLabel="Delete Affiliate"
        onConfirm={() => {
          doDeleteAffiliate();
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
