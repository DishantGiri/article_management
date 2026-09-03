"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Coins,
  Globe,
  PenTool,
  Link2,
  ReceiptText,
  RefreshCw,
  X,
  Calendar,
  AlertCircle,
  ChevronRight,
  ArrowUpDown,
  Check,
  Award,
  ShieldCheck,
  Eye,
  SlidersHorizontal,
  Package,
} from "lucide-react";
import { toast } from "react-hot-toast";
import LoadingScreen from "@/components/LoadingScreen";
import CustomSelect from "@/components/CustomSelect";
import DateRangePicker from "@/components/DateRangePicker";
import ConfirmDialog from "@/components/ConfirmDialog";
import { fuzzyMatchAny } from "@/lib/fuzzy";

interface UserSaleItem {
  saleId: number;
  productId: number;
  productName: string;
  siteId: number;
  siteName: string;
  saleType: "FIRST_SALE" | "RESALE";
  saleDate: string;
  roleEarnedAs: string;
  amount: number;
  paymentStatus: "PENDING" | "PAID";
  notes: string | null;
}

interface UserCommissionRow {
  id: number;
  name: string;
  email: string;
  role: string;
  image: string | null;
  teamLeadName: string | null;
  firstSalesCount: number;
  firstSalesAmount: number;
  resalesCount: number;
  resalesAmount: number;
  totalSalesCount: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentStatus: "PAID" | "PENDING" | "PARTIAL" | "NO_SALES";
  sales: UserSaleItem[];
}

interface SiteOption {
  id: number;
  name: string;
}

export default function UserCommissionsPage() {
  const { data: session, status } = useSession();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [users, setUsers] = useState<UserCommissionRow[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    activeUsersCount: 0,
    totalEarnings: 0,
    totalPaid: 0,
    totalPending: 0,
    totalFirstSales: 0,
    totalResales: 0,
  });

  // Advanced Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [siteFilter, setSiteFilter] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("totalDesc");

  // Statement / Breakdown Modal
  const [statementUser, setStatementUser] = useState<UserCommissionRow | null>(null);
  const [settlingUserId, setSettlingUserId] = useState<number | null>(null);
  const [payoutTargetUser, setPayoutTargetUser] = useState<UserCommissionRow | null>(null);

  // Fetch Data
  const fetchData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (roleFilter !== "ALL") params.append("role", roleFilter);
      if (statusFilter !== "ALL") params.append("paymentStatus", statusFilter);
      if (siteFilter !== "ALL") params.append("siteId", siteFilter);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (sortBy) params.append("sortBy", sortBy);

      const res = await fetch(`/api/commissions/users?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load user commissions");

      const data = await res.json();
      setUsers(data.users || []);
      setSites(data.sites || []);
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
      fetchData();
    }
  }, [roleFilter, statusFilter, siteFilter, startDate, endDate, sortBy, status]);

  // Open Custom Confirmation Popup for Payout
  const handleOpenPayoutConfirm = (user: UserCommissionRow) => {
    if (user.pendingAmount <= 0) {
      toast.error("No pending commissions to settle for this user");
      return;
    }
    setPayoutTargetUser(user);
  };

  // Settle All Pending Payouts for a User (Triggered by Custom Popup)
  const handleExecutePayout = async () => {
    if (!payoutTargetUser) return;
    const user = payoutTargetUser;
    setPayoutTargetUser(null);
    setSettlingUserId(user.id);
    try {
      const res = await fetch("/api/commissions/users/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Payout processing failed");
      }

      toast.success(`Settled Rs. ${user.pendingAmount.toFixed(2)} for ${user.name}!`);

      if (statementUser && statementUser.id === user.id) {
        setStatementUser(null);
      }
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to process payout");
    } finally {
      setSettlingUserId(null);
    }
  };

  // Toggle single sale status inside statement modal
  const handleToggleSingleSale = async (saleId: number, currentStatus: string) => {
    const nextStatus = currentStatus === "PAID" ? "PENDING" : "PAID";
    try {
      const res = await fetch(`/api/commissions/${saleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: nextStatus }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      toast.success(`Marked as ${nextStatus}`);

      if (statementUser) {
        const updatedSales = statementUser.sales.map((s) =>
          s.saleId === saleId ? { ...s, paymentStatus: nextStatus as "PAID" | "PENDING" } : s
        );
        const newPaid = updatedSales
          .filter((s) => s.paymentStatus === "PAID")
          .reduce((acc, s) => acc + s.amount, 0);
        const newPending = updatedSales
          .filter((s) => s.paymentStatus === "PENDING")
          .reduce((acc, s) => acc + s.amount, 0);

        setStatementUser({
          ...statementUser,
          sales: updatedSales,
          paidAmount: parseFloat(newPaid.toFixed(2)),
          pendingAmount: parseFloat(newPending.toFixed(2)),
        });
      }
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  // Filter users by text search using fuzzy matching
  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    return users.filter((u) => {
      const productNames = u.sales?.map((s) => s.productName) || [];
      return fuzzyMatchAny([u.name, u.email, u.role, ...productNames], search);
    });
  }, [users, search]);

  const isAdminOrSuperAdmin =
    session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "ADMIN";

  if (loading && status !== "loading") {
    return (
      <div className="p-6 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] dark:bg-slate-950">
        <LoadingScreen
          message="Loading user commissions..."
          subtext="Aggregating sales, 1st sale & resale pools, and payment records"
          size="lg"
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] dark:bg-slate-950 text-[#4A4A4A] dark:text-slate-100 space-y-6">
      {/* ─── TOP HEADER BANNER ────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-indigo-100/40 dark:from-indigo-950/20 via-sky-100/20 dark:via-sky-950/10 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#6D8196] via-[#5A6D81] to-[#3D4F61] text-white flex items-center justify-center font-bold shadow-md shrink-0">
              <Users className="w-8 h-8 drop-shadow-sm" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#4A4A4A] dark:text-white">
                  User Commissions
                </h1>
                <span className="text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Beneficiary Payouts
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#737373] dark:text-slate-400 mt-1 font-medium max-w-2xl leading-relaxed">
                Review individual commission earnings for Writers, Linkers, and Team Leads. Track 1st sale totals, resales, paid balances, and settle pending payouts.
              </p>
            </div>
          </div>

          {/* Navigation Toggle & Actions */}
          <div className="flex items-center gap-2.5 self-stretch sm:self-auto flex-wrap">
            {/* View Switcher: Commission List vs Products vs Users */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-bold shrink-0">
              {session?.user?.role === "SUPER_ADMIN" && (
                <>
                  <Link
                    href="/commissions"
                    className="px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1.5"
                  >
                    <ReceiptText className="w-3.5 h-3.5" />
                    <span>Commission List</span>
                  </Link>
                  <Link
                    href="/commissions?tab=products"
                    className="px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1.5"
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>By Products</span>
                  </Link>
                </>
              )}
              <span className="px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 text-[#4A4A4A] dark:text-white shadow-2xs font-extrabold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#6D8196]" />
                <span>By Users</span>
              </span>
            </div>

            <button
              onClick={() => fetchData(true)}
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
                <span>Settings</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ─── SUMMARY STATS STRIP ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] uppercase font-bold text-[#737373] dark:text-slate-400">
            Total User Earnings
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-black text-[#6D8196] dark:text-sky-400">
              Rs. {metrics.totalEarnings.toFixed(2)}
            </span>
            <Coins className="w-4 h-4 text-[#6D8196] opacity-60" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
            Total Paid Out
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
            Pending Payout Balance
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400">
              Rs. {metrics.totalPending.toFixed(2)}
            </span>
            <Clock className="w-4 h-4 text-amber-500 opacity-70" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] uppercase font-bold text-indigo-600 dark:text-indigo-400">
            Active Beneficiaries
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-400">
              {metrics.activeUsersCount} / {metrics.totalUsers}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
              Users
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <span className="text-[11px] uppercase font-bold text-purple-600 dark:text-purple-400">
            1st Sales / Resales
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-black text-purple-600 dark:text-purple-400">
              {metrics.totalFirstSales} / {metrics.totalResales}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
              Sales
            </span>
          </div>
        </div>
      </div>

      {/* ─── ADVANCED FILTERING STRIP ──────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search user name or email..."
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

          {/* Role Filter Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-bold overflow-x-auto max-w-full">
            {[
              { key: "ALL", label: "All Roles" },
              { key: "WRITER", label: "Writers" },
              { key: "LINKER", label: "Linkers" },
              { key: "TEAM_LEAD", label: "Team Leads" },
              { key: "ADMIN", label: "Admins" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setRoleFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer text-[11px] whitespace-nowrap ${
                  roleFilter === tab.key
                    ? "bg-white dark:bg-slate-700 text-[#4A4A4A] dark:text-white shadow-2xs font-extrabold"
                    : "text-slate-500 dark:text-slate-400 hover:text-[#4A4A4A]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filters: Status, Site, Date Range, Sort */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Payment Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Status:</span>
              <CustomSelect
                value={statusFilter}
                onChange={(val) => setStatusFilter(val)}
                options={[
                  { value: "ALL", label: "All Payment Statuses" },
                  { value: "PENDING", label: "Pending Balance" },
                  { value: "PAID", label: "Fully Paid" },
                  { value: "PARTIAL", label: "Partially Paid" },
                  { value: "NO_SALES", label: "No Earnings Yet" },
                ]}
                className="w-auto"
                triggerClassName="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#6D8196] shadow-2xs whitespace-nowrap min-w-[155px]"
              />
            </div>

            {/* Site Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Site:</span>
              <CustomSelect
                value={siteFilter}
                onChange={(val) => setSiteFilter(val)}
                options={[
                  { value: "ALL", label: "All Sites" },
                  ...sites.map((s) => ({ value: String(s.id), label: s.name })),
                ]}
                searchable={sites.length > 5}
                searchPlaceholder="Search sites..."
                className="w-auto"
                triggerClassName="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#6D8196] shadow-2xs whitespace-nowrap min-w-[125px]"
              />
            </div>

            {/* Date Range Filters */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Period:</span>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={(start, end) => {
                  setStartDate(start);
                  setEndDate(end);
                }}
                placeholder="Select Period Range"
              />
            </div>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-bold text-slate-400 uppercase">Sort:</span>
              <CustomSelect
                value={sortBy}
                onChange={(val) => setSortBy(val)}
                options={[
                  { value: "totalDesc", label: "Highest Total (Rs.)" },
                  { value: "pendingDesc", label: "Highest Pending (Rs.)" },
                  { value: "firstSalesDesc", label: "Most 1st Sales" },
                  { value: "resalesDesc", label: "Most Resales" },
                  { value: "nameAsc", label: "Name (A-Z)" },
                ]}
                className="w-auto"
                triggerClassName="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#6D8196] shadow-2xs whitespace-nowrap min-w-[170px]"
              />
            </div>

            {(roleFilter !== "ALL" ||
              statusFilter !== "ALL" ||
              siteFilter !== "ALL" ||
              startDate ||
              endDate ||
              search) && (
              <button
                onClick={() => {
                  setRoleFilter("ALL");
                  setStatusFilter("ALL");
                  setSiteFilter("ALL");
                  setStartDate("");
                  setEndDate("");
                  setSearch("");
                }}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── MAIN USER COMMISSIONS TABLE ──────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9F5] dark:bg-slate-850/80 border-b border-[#CBCBCB]/50 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-[#737373] dark:text-slate-400">
              <tr>
                <th className="py-3.5 px-4">User Details</th>
                <th className="py-3.5 px-3">Role</th>
                <th className="py-3.5 px-3 text-center">1st Sale Total</th>
                <th className="py-3.5 px-3 text-center">Resale Total</th>
                <th className="py-3.5 px-4 text-right">Total Commission (Rs.)</th>
                <th className="py-3.5 px-3 text-center">Payment Status</th>
                <th className="py-3.5 px-4 text-right">Pending Payout</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <p className="text-sm font-semibold">No user records matched your criteria</p>
                    <p className="text-xs mt-1">Try resetting the filters or modifying your search</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const roleStyles: Record<string, string> = {
                    WRITER: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50",
                    LINKER: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800/50",
                    TEAM_LEAD: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/50",
                    ADMIN: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
                    SUPER_ADMIN: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800/50",
                  };

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition group"
                    >
                      {/* User Avatar, Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6D8196] to-[#4A5D70] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-extrabold text-slate-900 dark:text-white block truncate">
                              {user.name}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role Pill */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            roleStyles[user.role] || roleStyles.WRITER
                          }`}
                        >
                          {user.role}
                        </span>
                        {user.teamLeadName && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            TL: {user.teamLeadName}
                          </span>
                        )}
                      </td>

                      {/* 1st Sale Total */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {user.firstSalesCount}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          Rs. {user.firstSalesAmount.toFixed(2)}
                        </span>
                      </td>

                      {/* Resale Total */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {user.resalesCount}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          Rs. {user.resalesAmount.toFixed(2)}
                        </span>
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="font-black text-sm text-[#6D8196] dark:text-sky-400">
                          Rs. {user.totalAmount.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {user.totalSalesCount} total sales
                        </span>
                      </td>

                      {/* Payment Status */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {user.paymentStatus === "PAID" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                            <Check className="w-3 h-3" />
                            <span>Paid</span>
                          </span>
                        ) : user.paymentStatus === "PARTIAL" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                            <Clock className="w-3 h-3" />
                            <span>Partial</span>
                          </span>
                        ) : user.paymentStatus === "PENDING" ? (
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

                      {/* Pending Balance */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-black text-xs ${
                            user.pendingAmount > 0
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-slate-400"
                          }`}
                        >
                          Rs. {user.pendingAmount.toFixed(2)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setStatementUser(user)}
                            className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3 text-[#6D8196]" />
                            <span>Statement</span>
                          </button>

                          {isAdminOrSuperAdmin && user.pendingAmount > 0 && (
                            <button
                              onClick={() => handleOpenPayoutConfirm(user)}
                              disabled={settlingUserId === user.id}
                              className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs transition flex items-center gap-1 cursor-pointer"
                              title="Settle all pending payouts for this user"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{settlingUserId === user.id ? "Settling..." : "Payout"}</span>
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

      {/* ─── MODAL: USER STATEMENT / BREAKDOWN ───────────────────────── */}
      {statementUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#6D8196]/15 dark:bg-[#6D8196]/30 text-[#6D8196] dark:text-slate-200 flex items-center justify-center font-bold text-sm">
                  {statementUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-black text-[#4A4A4A] dark:text-white">
                    {statementUser.name} — Earnings Statement
                  </h3>
                  <p className="text-xs text-[#737373] dark:text-slate-400 mt-0.5">
                    {statementUser.role} • {statementUser.email}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setStatementUser(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Statement Summary Card */}
            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-[#FAF9F5] dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Earned:</span>
                <span className="text-sm font-black text-[#4A4A4A] dark:text-white block">
                  Rs. {statementUser.totalAmount.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Paid Out:</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 block">
                  Rs. {statementUser.paidAmount.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-amber-600 uppercase">Pending Balance:</span>
                <span className="text-sm font-black text-amber-600 dark:text-amber-400 block">
                  Rs. {statementUser.pendingAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* List of Contributing Sales */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Itemized Sales Log ({statementUser.sales.length})
              </span>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 pr-1">
                {statementUser.sales.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No sales or commissions recorded for this user yet.
                  </div>
                ) : (
                  statementUser.sales.map((sale) => (
                    <div
                      key={sale.saleId}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.2 rounded-full text-[9px] font-black ${
                              sale.saleType === "FIRST_SALE"
                                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                                : "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                            }`}
                          >
                            {sale.saleType === "FIRST_SALE" ? "1st" : "Re"}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-100">
                            {sale.productName}
                          </span>
                          <span className="text-[10px] text-slate-400">({sale.siteName})</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Credited as {sale.roleEarnedAs} •{" "}
                          {new Date(sale.saleDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-slate-900 dark:text-white">
                          Rs. {sale.amount.toFixed(2)}
                        </span>

                        <button
                          onClick={() => handleToggleSingleSale(sale.saleId, sale.paymentStatus)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border transition cursor-pointer ${
                            sale.paymentStatus === "PAID"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-700 dark:text-emerald-300"
                              : "bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-700 dark:text-amber-300"
                          }`}
                          title="Click to toggle status"
                        >
                          {sale.paymentStatus === "PAID" ? "✓ Paid" : "⏳ Pending"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                {isAdminOrSuperAdmin && statementUser.pendingAmount > 0 && (
                  <button
                    onClick={() => handleOpenPayoutConfirm(statementUser)}
                    disabled={settlingUserId === statementUser.id}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {settlingUserId === statementUser.id
                        ? "Settling..."
                        : `Settle All Pending (Rs. ${statementUser.pendingAmount.toFixed(2)})`}
                    </span>
                  </button>
                )}
              </div>

              <button
                onClick={() => setStatementUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog for Commission Payout */}
      <ConfirmDialog
        isOpen={!!payoutTargetUser}
        title="Confirm Commission Payout"
        message={
          payoutTargetUser
            ? `Are you sure you want to mark all pending commissions (Rs. ${payoutTargetUser.pendingAmount.toFixed(
                2
              )}) as PAID for ${payoutTargetUser.name}? This will record the payout as settled.`
            : ""
        }
        confirmLabel="Confirm Payout"
        cancelLabel="Cancel"
        variant="success"
        onConfirm={handleExecutePayout}
        onCancel={() => setPayoutTargetUser(null)}
      />
    </div>
  );
}
