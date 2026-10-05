"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Tag,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  Lock,
  Sparkles,
  BarChart3,
  Package,
  Users,
  ExternalLink,
  ChevronRight,
  ArrowUpRight,
  Award,
  Calendar,
  CalendarDays,
  RotateCcw,
} from "lucide-react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import CustomDatePicker from "@/components/CustomDatePicker";
import CustomMonthPicker from "@/components/CustomMonthPicker";

type TimePeriod = "all" | "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom";

export interface AffiliateItem {
  id: number;
  name: string;
  createdAt: string;
}

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
  updatedByName?: string | null;
  updatedById?: number | null;
  updatedByRole?: string | null;
  updatedAt?: string | null;
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

export default function AffiliateSettingsTab() {
  const { data: session } = useSession();
  const [subTab, setSubTab] = useState<"analytics" | "manage">("analytics");
  const [affiliates, setAffiliates] = useState<AffiliateItem[]>([]);
  const [analyticsAffiliates, setAnalyticsAffiliates] = useState<AffiliateData[]>([]);
  const [analyticsLinkers, setAnalyticsLinkers] = useState<LinkerSummary[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Date Filter States (Daily & Monthly)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  // New Affiliate Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit Inline State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);

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
  const [inspectSearch, setInspectSearch] = useState("");

  const userRole = session?.user?.role || "WRITER";
  const canManage =
    userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "LINKER";

  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const handlePeriodChange = (period: TimePeriod) => {
    setTimePeriod(period);
    const now = new Date();

    if (period === "all") {
      setStartDate("");
      setEndDate("");
      setSelectedDay("");
      setSelectedMonth("");
    } else if (period === "today") {
      const todayStr = formatYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
      setSelectedDay(todayStr);
    } else if (period === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = formatYMD(yesterday);
      setStartDate(yStr);
      setEndDate(yStr);
      setSelectedDay(yStr);
    } else if (period === "this_week") {
      const day = now.getDay();
      const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setDate(diffToMonday);
      setStartDate(formatYMD(monday));
      setEndDate(formatYMD(now));
    } else if (period === "this_month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(lastDay));
      setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    } else if (period === "last_month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(lastDay));
      setSelectedMonth(`${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, "0")}`);
    } else if (period === "custom") {
      if (customStart && customEnd) {
        setStartDate(customStart);
        setEndDate(customEnd);
      }
    }
  };

  const handleSpecificDayChange = (dayStr: string) => {
    setSelectedDay(dayStr);
    if (dayStr) {
      setStartDate(dayStr);
      setEndDate(dayStr);
    }
  };

  const handleSpecificMonthChange = (monthStr: string) => {
    setSelectedMonth(monthStr);
    if (monthStr) {
      const [year, month] = monthStr.split("-").map(Number);
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(lastDay));
    }
  };

  const handleApplyCustomDates = () => {
    if (!customStart) {
      toast.error("Please pick a start date");
      return;
    }
    if (customEnd && customStart > customEnd) {
      toast.error("Start date cannot be after end date");
      return;
    }
    setStartDate(customStart);
    setEndDate(customEnd || customStart);
  };

  const activePeriodLabel = useMemo(() => {
    if (timePeriod === "today") {
      if (selectedDay) {
        const [y, m, d] = selectedDay.split("-").map(Number);
        const dateObj = new Date(y, m - 1, d);
        return `Daily (${dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})`;
      }
      return "Daily (Today)";
    }
    if (timePeriod === "yesterday") return "Yesterday";
    if (timePeriod === "this_week") return "This Week";
    if (timePeriod === "this_month") {
      if (selectedMonth) {
        const [y, m] = selectedMonth.split("-").map(Number);
        const d = new Date(y, m - 1, 1);
        return `Monthly (${d.toLocaleDateString("en-US", { month: "long", year: "numeric" })})`;
      }
      return "Monthly (This Month)";
    }
    if (timePeriod === "last_month") return "Monthly (Last Month)";
    if (timePeriod === "custom") {
      return `Custom: ${startDate || "Start"} to ${endDate || "End"}`;
    }
    return null;
  }, [timePeriod, selectedDay, selectedMonth, startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const statsUrl = new URL("/api/affiliates/stats", window.location.origin);
      if (startDate) statsUrl.searchParams.set("startDate", startDate);
      if (endDate) statsUrl.searchParams.set("endDate", endDate);

      const [affRes, statsRes] = await Promise.all([
        fetch("/api/affiliates"),
        fetch(statsUrl.toString()),
      ]);

      const affData = await affRes.json();
      if (affRes.ok && Array.isArray(affData)) {
        setAffiliates(affData);
      }

      const statsData = await statsRes.json();
      if (statsRes.ok) {
        setSummary(statsData.summary);
        setAnalyticsAffiliates(statsData.affiliates || []);
        setAnalyticsLinkers(statsData.linkers || []);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load affiliate data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      toast.error("Affiliate Name is required.");
      return;
    }

    if (!/^[a-zA-Z0-9 ]+$/.test(trimmed)) {
      toast.error("Special characters are not allowed. Only letters, numbers, and spaces are permitted for affiliate names.");
      return;
    }

    if (trimmed.length < 2 || trimmed.length > 50) {
      toast.error("Affiliate name must be between 2 and 50 characters.");
      return;
    }

    const existing = affiliates.find(
      (a) => a.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      toast.error(`Affiliate "${existing.name}" already exists`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          callerId: session?.user?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create affiliate");

      toast.success(`Affiliate "${trimmed}" saved!`);
      setNewName("");
      setShowAddForm(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save affiliate");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (item: AffiliateItem) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  const handleUpdate = async (id: number) => {
    const trimmed = editName.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      toast.error("Affiliate Name is required.");
      return;
    }

    if (!/^[a-zA-Z0-9 ]+$/.test(trimmed)) {
      toast.error("Special characters are not allowed. Only letters, numbers, and spaces are permitted for affiliate names.");
      return;
    }

    if (trimmed.length < 2 || trimmed.length > 50) {
      toast.error("Affiliate name must be between 2 and 50 characters.");
      return;
    }

    const currentItem = affiliates.find((a) => a.id === id);
    if (currentItem && currentItem.name.trim() === trimmed) {
      toast.error(`Affiliate "${currentItem.name}" has no changes made.`);
      setEditingId(null);
      return;
    }

    const existing = affiliates.find(
      (a) => a.id !== id && a.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      toast.error(`Affiliate "${existing.name}" already exists`);
      return;
    }

    setUpdatingId(id);
    try {
      const res = await fetch(`/api/affiliates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          callerId: session?.user?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update affiliate");

      toast.success("Affiliate updated!");
      setEditingId(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update affiliate");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = (id: number, name: string) => {
    setPendingDelete({ id, name });
    setConfirmOpen(true);
  };

  const doDelete = async () => {
    if (!pendingDelete) return;
    const { id, name } = pendingDelete;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/affiliates/${id}?callerId=${session?.user?.id || 1}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to delete");
      }
      toast.success(`"${name}" deleted.`);
      setAffiliates((prev) => prev.filter((a) => a.id !== id));
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredAffiliates = useMemo(() => {
    return affiliates.filter((a) =>
      a.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [affiliates, search]);

  const filteredAnalyticsAffiliates = useMemo(() => {
    return analyticsAffiliates.filter(
      (a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.linkers.some((l) => l.userName.toLowerCase().includes(search.toLowerCase()))
    );
  }, [analyticsAffiliates, search]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Affiliate Details & Volumes
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  <Lock className="w-3 h-3 text-blue-500" /> Admins & Linkers Only
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Inspect how many products are added from each affiliate and which linker contributed them.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/affiliates"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition shadow-2xs cursor-pointer"
              title="Open full page view"
            >
              <span>Full Dashboard</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
            </Link>

            {canManage && subTab === "manage" && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#6D8196] hover:bg-[#5A6D81] text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                {showAddForm ? (
                  <>
                    <X className="w-3.5 h-3.5" /> Cancel
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" /> Add Network
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => setSubTab("analytics")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              subTab === "analytics"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border border-transparent dark:border-slate-700/60"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Product Volume & Linkers ({summary?.totalAffiliateProducts || 0})</span>
          </button>

          <button
            onClick={() => setSubTab("manage")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              subTab === "manage"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border border-transparent dark:border-slate-700/60"
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Manage Names ({affiliates.length})</span>
          </button>
        </div>

        {/* Add Form */}
        {showAddForm && canManage && subTab === "manage" && (
          <form
            onSubmit={handleCreate}
            className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3 animate-fadeIn"
          >
            <div className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-500" /> New Affiliate Network
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/[^a-zA-Z0-9 ]/.test(val)) {
                    toast.error("Special characters are not allowed. Only letters, numbers, and spaces are permitted.", { id: "affiliate-char-error" });
                  }
                  setNewName(val.replace(/[^a-zA-Z0-9 ]/g, ""));
                }}
                maxLength={50}
                placeholder="e.g. ClickBank, MaxWeb"
                className="flex-1 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !newName.trim()}
                className="px-4 py-2 rounded-xl bg-[#6D8196] text-white text-xs font-bold hover:bg-[#5A6D81] disabled:opacity-50 transition cursor-pointer"
              >
                {submitting ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* KPI Stats in Analytics Mode */}
      {subTab === "analytics" && summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Affiliate Prods
            </span>
            <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400 block mt-0.5">
              {summary.totalAffiliateProducts}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Networks
            </span>
            <span className="text-xl font-extrabold text-slate-800 dark:text-slate-200 block mt-0.5">
              {summary.activeAffiliatesCount}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Contributing Linkers
            </span>
            <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 block mt-0.5">
              {summary.totalContributingLinkers}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Top Network
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block mt-1" title={summary.topAffiliate?.name}>
              {summary.topAffiliate?.name || "None"}
            </span>
          </div>
        </div>
      )}

      {/* Filter Controls & Search (Analytics Mode) */}
      {subTab === "analytics" && (
        <div className="bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Quick Period Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                Period:
              </span>
              <button
                type="button"
                onClick={() => handlePeriodChange("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  timePeriod === "all"
                    ? "bg-blue-600 text-white shadow-xs font-bold"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => handlePeriodChange("today")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                  timePeriod === "today"
                    ? "bg-blue-600 text-white shadow-xs font-bold"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                }`}
              >
                <CalendarDays className="w-3 h-3" />
                <span>Daily (Today)</span>
              </button>
              <button
                type="button"
                onClick={() => handlePeriodChange("this_month")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                  timePeriod === "this_month"
                    ? "bg-blue-600 text-white shadow-xs font-bold"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                }`}
              >
                <Calendar className="w-3 h-3" />
                <span>Monthly (This Month)</span>
              </button>
              <button
                type="button"
                onClick={() => handlePeriodChange("last_month")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  timePeriod === "last_month"
                    ? "bg-blue-600 text-white shadow-xs font-bold"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                }`}
              >
                Last Month
              </button>
              <button
                type="button"
                onClick={() => setTimePeriod("custom")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  timePeriod === "custom"
                    ? "bg-blue-600 text-white shadow-xs font-bold"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                }`}
              >
                Custom Range
              </button>
            </div>

            {/* Contextual Date/Month Pickers (Custom components) */}
            <div className="flex flex-wrap items-center gap-2">
              {timePeriod === "today" && (
                <div className="flex items-center gap-1.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 px-2 py-0.5 rounded-xl">
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">Date Range:</span>
                  <CustomDatePicker
                    startDate={startDate}
                    endDate={endDate}
                    onRangeChange={(s, e) => {
                      setStartDate(s);
                      setEndDate(e);
                      if (s && e && s !== e) {
                        setTimePeriod("custom");
                      } else if (s) {
                        setSelectedDay(s);
                      } else {
                        setTimePeriod("all");
                      }
                    }}
                    align="right"
                  />
                </div>
              )}

              {timePeriod === "this_month" && (
                <div className="flex items-center gap-1.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 px-2 py-0.5 rounded-xl">
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">Pick Month:</span>
                  <CustomMonthPicker
                    value={selectedMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
                    onChange={(m) => handleSpecificMonthChange(m)}
                    align="right"
                  />
                </div>
              )}

              {timePeriod === "custom" && (
                <div className="flex items-center gap-1.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 px-2 py-0.5 rounded-xl">
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">Select Range:</span>
                  <CustomDatePicker
                    startDate={startDate}
                    endDate={endDate}
                    onRangeChange={(s, e) => {
                      setStartDate(s);
                      setEndDate(e);
                      if (!s && !e) setTimePeriod("all");
                    }}
                    placeholder="Click to pick date range"
                    align="right"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Active Period Notification */}
          {activePeriodLabel && (
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-blue-50/90 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 text-xs">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-blue-900 dark:text-blue-200 text-[11px]">
                  Filtered by: <strong>{activePeriodLabel}</strong> ({summary?.totalAffiliateProducts || 0} products)
                </span>
              </div>
              <button
                type="button"
                onClick={() => handlePeriodChange("all")}
                className="text-[10px] font-bold text-blue-700 dark:text-blue-300 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Clear Filter</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            subTab === "analytics"
              ? "Search affiliate networks, linkers..."
              : "Search affiliate names..."
          }
          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
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

      {/* SUBTAB 1: ANALYTICS & PRODUCT VOLUMES */}
      {subTab === "analytics" && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-12 text-center text-xs font-semibold text-slate-500">
              Loading affiliate volumes...
            </div>
          ) : filteredAnalyticsAffiliates.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 italic">
              No affiliate product details found matching your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredAnalyticsAffiliates.map((aff) => (
                <div
                  key={aff.id || aff.name}
                  className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between gap-3"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {aff.name}
                        </h4>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                        aff.productCount > 0
                          ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      }`}>
                        {aff.productCount} {aff.productCount === 1 ? "Product" : "Products"}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2.5 space-y-1">
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.max(aff.percentage, aff.productCount > 0 ? 5 : 0)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 block text-right font-medium">
                        {aff.percentage}% of volume
                      </span>
                    </div>

                    {/* Linkers Breakdown */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Added By:
                      </span>
                      {aff.linkers.length === 0 ? (
                        <span className="text-[10px] text-slate-400 italic">No products added yet</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {aff.linkers.map((l) => (
                            <span
                              key={l.userId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-semibold border border-slate-200/80 dark:border-slate-700"
                            >
                              <span>{l.userName}</span>
                              <span className="font-extrabold text-blue-600 dark:text-blue-400">
                                ({l.count})
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer button */}
                  {aff.productCount > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                      <button
                        onClick={() => {
                          setInspectModal({
                            isOpen: true,
                            title: `Products for ${aff.name}`,
                            subtitle: `${aff.productCount} total products configured with ${aff.name}`,
                            products: aff.products,
                          });
                          setInspectSearch("");
                        }}
                        className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 dark:text-blue-300 dark:border-blue-800 text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>View Products</span>
                        <ChevronRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Linker Leaderboard in modal */}
          {analyticsLinkers.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-emerald-500" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Linker Product Contribution Breakdown
                </h4>
              </div>

              <div className="space-y-2">
                {analyticsLinkers.map((linker) => (
                  <div
                    key={linker.userId}
                    className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                          {linker.userName}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-extrabold uppercase">
                          {linker.userRole.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {linker.affiliates.map((aff) => (
                          <span
                            key={aff.name}
                            className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-200/60 dark:border-blue-900/60"
                          >
                            {aff.name}: {aff.count}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100 block">
                        {linker.affiliateProductsCount} prods
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {linker.totalProducts} total
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: MANAGE AFFILIATE NAMES */}
      {subTab === "manage" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-xs font-semibold text-slate-500">
              Loading affiliate networks...
            </div>
          ) : filteredAffiliates.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 italic">
              No affiliate networks found matching your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-5 py-3">Affiliate Name</th>
                    {canManage && <th className="px-5 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {filteredAffiliates.map((item) => {
                    const isEditing = editingId === item.id;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                        {isEditing ? (
                          <>
                            <td className="px-5 py-3">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (/[^a-zA-Z0-9 ]/.test(val)) {
                                    toast.error("Special characters are not allowed. Only letters, numbers, and spaces are permitted.", { id: "affiliate-char-error" });
                                  }
                                  setEditName(val.replace(/[^a-zA-Z0-9 ]/g, ""));
                                }}
                                maxLength={50}
                                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-blue-400 rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100"
                              />
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleUpdate(item.id)}
                                  disabled={updatingId === item.id}
                                  className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer"
                                  title="Save"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-slate-100">
                              <div className="flex items-center gap-2.5">
                                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                <span>{item.name}</span>
                              </div>
                            </td>
                            {canManage && (
                              <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => startEdit(item)}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 dark:hover:bg-slate-800 transition cursor-pointer"
                                    title="Edit Affiliate Name"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(item.id, item.name)}
                                    disabled={deletingId === item.id}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                                    title="Delete Affiliate"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* INSPECT MODAL */}
      {inspectModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 bg-[#4A4A4A] dark:bg-slate-800 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {inspectModal.title}
                </h3>
                <p className="text-xs text-white/70">{inspectModal.subtitle}</p>
              </div>
              <button
                onClick={() => setInspectModal((prev) => ({ ...prev, isOpen: false }))}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <input
                type="text"
                value={inspectSearch}
                onChange={(e) => setInspectSearch(e.target.value)}
                placeholder="Search products in this list..."
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {inspectModal.products
                  .filter((p) =>
                    p.name.toLowerCase().includes(inspectSearch.toLowerCase()) ||
                    p.addedByName.toLowerCase().includes(inspectSearch.toLowerCase()) ||
                    (p.updatedByName && p.updatedByName.toLowerCase().includes(inspectSearch.toLowerCase()))
                  )
                  .map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          {p.name}
                        </span>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                          <span>Site: {p.siteName}</span>
                          <span>•</span>
                          <span>
                            Added by: <strong className="text-slate-600 dark:text-slate-300">{p.addedByName}</strong>
                            <span className="text-[10px] text-slate-400 ml-1">
                              ({p.addedByRole ? p.addedByRole.replace(/_/g, " ") : "USER"})
                            </span>
                          </span>
                          {p.updatedByName && (
                            <>
                              <span>•</span>
                              <span>
                                Modified by: <strong className="text-slate-600 dark:text-slate-300">{p.updatedByName}</strong>
                                <span className="text-[10px] text-slate-400 ml-1">
                                  ({p.updatedByRole ? p.updatedByRole.replace(/_/g, " ") : "USER"})
                                </span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <Link
                        href={`/products?search=${encodeURIComponent(p.name)}`}
                        target="_blank"
                        className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold text-[11px] hover:bg-blue-100 flex items-center gap-1"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  ))}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end">
              <button
                onClick={() => setInspectModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete Affiliate"
        message={`Are you sure you want to delete "${pendingDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete Affiliate"
        onConfirm={() => {
          setConfirmOpen(false);
          doDelete();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
