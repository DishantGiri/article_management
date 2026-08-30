/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Package,
  Clock,
  CheckCircle2,
  PlayCircle,
  FileText,
  Users,
  Globe,
  AlertTriangle,
  Link as LinkIcon,
  Calendar,
  Activity,
  Star,
  ClipboardList,
  Check,
  X,
  Lock,
  ExternalLink,
  Flag,
  MoreHorizontal,
  Copy,
  Bell,
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  Filter,
  Search,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  Zap,
  Layers,
  BarChart3,
  Award,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { ChartPieInteractive } from "@/components/ChartPieInteractive";
import { ChartLineLabelCustom } from "@/components/ChartLineLabelCustom";
import { toast } from "react-hot-toast";
import FormattedRemarks from "@/components/FormattedRemarks";
import PendingLinkLogsSection from "@/components/PendingLinkLogsSection";
import LoadingScreen from "@/components/LoadingScreen";

interface DashboardData {
  role: "SUPER_ADMIN" | "ADMIN" | "LINKER" | "WRITER" | "TEAM_LEAD";
  general: {
    totalProducts: number;
    pendingArticles: number;
    inProgressArticles: number;
    completedArticles: number;
    totalLinks: number;
    requestedLinks: number;
    acceptedLinks: number;
    issueLinks: number;
    todaysProducts?: number;
    totalSites?: number;
    totalCategories?: number;
  };
  linkStats?: {
    affiliateNetworks: number;
    deadLinks: number;
    issueLinks: number;
  };
  recentProducts: any[];
  recentArticles: any[];
  unlinkedProducts: any[];
  writerPendingArticles: any[];
  writerInProgressArticles: any[];
  writerCompletedArticles: any[];
  linkerProducts: any[];
  linkerLinks: any[];
  flaggedLinks?: any[];
  teamLead?: {
    pendingReview: number;
    completedToday: number;
    specialApprovals: number;
    issueLinks: number;
    writerPerformance: { name: string; completed: number }[];
    reviewQueue: {
      id: number;
      product: string;
      writer: string;
      site: string;
      completedAt: string | null;
      remark?: string | null;
    }[];
  };
  superAdmin?: {
    totalWriters: number;
    totalLinkers: number;
    totalTeamLeads: number;
    totalSites: number;
    totalCategories: number;
    affiliateNetworks: number;
    deadLinks: number;
    issueLinks: number;
    todaysProducts: number;
    avgWritingTime: string;
    monthlyData?: any[];
    writerPerformance?: any[];
    recentActivity?: any[];
  };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50/80 text-amber-700 border border-amber-200/60",
  IN_PROGRESS: "bg-blue-50/80 text-blue-700 border border-blue-200/60",
  COMPLETED: "bg-indigo-50/80 text-indigo-700 border border-indigo-200/60",
  APPROVED: "bg-emerald-50/80 text-emerald-700 border border-emerald-200/60",
  REDO: "bg-rose-50/80 text-rose-700 border border-rose-200/60",
};

const LINK_STATUS_COLORS: Record<string, string> = {
  REQUESTED: "bg-blue-50/80 text-blue-700 border border-blue-200/50",
  ACCEPTED: "bg-emerald-50/80 text-emerald-700 border border-emerald-200/50",
  CANCELED: "bg-rose-50/80 text-rose-700 border border-rose-200/50",
  ISSUE: "bg-amber-50/80 text-amber-700 border border-amber-200/50",
  NEED_TO_CHECK: "bg-slate-50/80 text-slate-700 border border-slate-200/50",
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showBellDropdown, setShowBellDropdown] = useState(false);

  useEffect(() => {
    if (session?.user?.role) {
      setCurrentUserRole(session.user.role);
    }
    if (session?.user?.id) {
      setCurrentUserId(session.user.id);
    }
  }, [session?.user?.role, session?.user?.id]);

  const fetchDashboardData = (showLoading = false) => {
    if (!session?.user?.id) return;
    const uId = session.user.id;
    setCurrentUserId(uId);
    if (session.user.role) {
      setCurrentUserRole(session.user.role);
    }

    if (showLoading) setLoading(true);
    else setRefreshing(true);

    fetch(`/api/dashboard?userId=${uId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch dashboard");
        return r.json();
      })
      .then((resData) => {
        setData(resData);
        if (resData.role) {
          setCurrentUserRole(resData.role);
        }
      })
      .catch((e) => console.error("Failed to load dashboard data", e))
      .finally(() => {
        if (showLoading) setLoading(false);
        setRefreshing(false);
      });

    fetch(`/api/notifications?userId=${uId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch notifications");
        return r.json();
      })
      .then(setNotifications)
      .catch((e) => console.error("Failed to load notifications", e));
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        window.dispatchEvent(new CustomEvent("notifications-marked-read"));
        toast.success("All notifications marked as read");
      }
    } catch (err) {
      console.error("Failed to mark notifications as read:", err);
    }
  };

  const handleNotificationClick = async (n: any) => {
    if (!n.isRead) {
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: n.id }),
        });
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
        );
        window.dispatchEvent(new CustomEvent("notifications-updated"));
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchDashboardData(true);
    } else if (status === "unauthenticated") {
      setLoading(false);
    }

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(console.error);
    }

    const handleLiveNotif = (e: Event) => {
      const notif = (e as CustomEvent).detail;
      if (notif.type === "ARTICLE_STATUS_UPDATED" || notif.type === "LINK_STATUS_UPDATED") {
        fetchDashboardData(false);
      }
      setNotifications((prev) => [notif, ...prev]);

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Workflow Update", {
          body: notif.message,
          icon: "/favicon.ico",
        });
      }
    };
    window.addEventListener("live-notification", handleLiveNotif);

    return () => {
      window.removeEventListener("live-notification", handleLiveNotif);
    };
  }, [session?.user?.id, status]);

  const handleStartWriting = async (articleId: number) => {
    if (!currentUserId) return;
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS", writerId: currentUserId }),
      });
      if (res.ok) {
        toast.success("Assignment started! Loading workspace...");
        window.scrollTo({ top: 0, behavior: "smooth" });
        fetchDashboardData(false);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to start writing");
      }
    } catch {
      toast.error("Failed to start writing");
    }
  };

  // Loading State
  if (loading || status === "loading") {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-6" suppressHydrationWarning>
        <LoadingScreen
          message="Initializing Workspace..."
          subtext="Synchronizing editorial metrics & real-time queues..."
          size="lg"
        />
      </div>
    );
  }

  // Unauthenticated Public Landing Showcase
  if (status === "unauthenticated" || !session) {
    return <PublicLandingShowcase />;
  }

  if (!data) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4 my-12 bg-white rounded-2xl border border-rose-100 shadow-sm" suppressHydrationWarning>
        <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-800">Unable to load dashboard data</h2>
        <p className="text-xs text-slate-500">Please check your database connection or refresh the page.</p>
        <button
          onClick={() => fetchDashboardData(true)}
          className="px-4 py-2 bg-[#6D8196] text-white rounded-xl text-xs font-bold hover:bg-[#5A6D81] transition cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-8 animate-fadeIn" suppressHydrationWarning>
      {/* ─── TOP GLASS HEADER & GREETING ──────────────────────────── */}
      <div className="glass-panel rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#CBCBCB]/50">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#6D8196]/10 text-[#3D4F61] border border-[#6D8196]/25">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {currentUserRole.replace("_", " ")}
            </span>
            <span className="text-xs text-slate-400 font-medium">·</span>
            <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#6D8196]" />
              Enterprise Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2" suppressHydrationWarning>
            {getGreeting()}, {session?.user?.name || "Team Member"}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {currentUserRole === "SUPER_ADMIN" && "Platform Command Hub — Full visibility across all sites, writers, and networks."}
            {currentUserRole === "ADMIN" && "System Administration & Operations Control Center."}
            {currentUserRole === "TEAM_LEAD" && "Editorial Review Queue & Team Velocity Dispatch."}
            {currentUserRole === "LINKER" && "Affiliate Gateway & Link Log Operations."}
            {currentUserRole === "WRITER" && "Focused Writing Station & Assignment Delivery."}
          </p>
        </div>

        {/* Action Controls & Notifications */}
        <div className="flex items-center gap-3 self-start md:self-center">
          <button
            onClick={() => fetchDashboardData(false)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-[#CBCBCB]/70 bg-white hover:bg-slate-50 text-slate-600 transition duration-150 cursor-pointer shadow-2xs flex items-center gap-1.5 text-xs font-semibold"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 text-[#6D8196] ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Quick Create shortcut for Linkers and Admins */}
          {(currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "LINKER") && (
            <Link
              href="/products"
              className="px-3.5 py-2 rounded-xl bg-[#6D8196] hover:bg-[#5A6D81] text-white transition duration-150 shadow-xs flex items-center gap-1.5 text-xs font-bold"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Products</span>
            </Link>
          )}

          {/* Notification Bell with Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowBellDropdown(!showBellDropdown)}
              className="relative p-2.5 rounded-xl border border-[#CBCBCB]/70 bg-white hover:bg-slate-50 text-slate-600 transition duration-150 shadow-2xs cursor-pointer"
              aria-label="View notifications"
            >
              <Bell className="w-4 h-4 text-[#4A4A4A]" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-extrabold flex items-center justify-center border-2 border-white animate-pulse">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {showBellDropdown && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#CBCBCB]/80 rounded-2xl shadow-xl z-50 p-4 space-y-3 animate-scaleIn">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Notifications</span>
                    {unreadNotificationsCount > 0 && (
                      <span className="text-[10px] bg-[#6D8196]/15 text-[#3D4F61] border border-[#6D8196]/30 font-bold px-2 py-0.5 rounded-full">
                        {unreadNotificationsCount} new
                      </span>
                    )}
                  </div>
                  {unreadNotificationsCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-[11px] font-bold text-[#6D8196] hover:text-slate-900 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Mark read
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-6">No notifications in the past month</p>
                  ) : (
                    notifications.slice(0, 10).map((n) => {
                      const match = n.message.match(/"([^"]+)"/);
                      const prodName = match ? match[1] : "";

                      let linkUrl = "";
                      if (prodName) {
                        linkUrl = currentUserRole === "WRITER"
                          ? `/articles?search=${encodeURIComponent(prodName)}`
                          : `/links?search=${encodeURIComponent(prodName)}`;
                      } else {
                        linkUrl = currentUserRole === "WRITER" ? "/articles" : "/links";
                      }

                      return (
                        <Link
                          key={n.id}
                          href={linkUrl}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3 rounded-xl border text-xs flex flex-col gap-1.5 transition-all block cursor-pointer ${
                            !n.isRead
                              ? "bg-[#FAF9F5] hover:bg-white border-[#6D8196]/40 font-semibold shadow-2xs"
                              : "bg-white hover:bg-[#FAF9F5] border-[#CBCBCB]/50 text-slate-600"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className={`leading-snug ${!n.isRead ? "text-slate-900 font-bold" : "text-slate-600"}`}>
                              {n.message}
                            </p>
                            {!n.isRead && (
                              <span className="w-2 h-2 rounded-full bg-[#6D8196] flex-shrink-0 mt-1" />
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium self-end">
                            {new Date(n.createdAt).toLocaleDateString()}
                          </span>
                        </Link>
                      );
                    })
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <Link
                    href="/notifications"
                    onClick={() => setShowBellDropdown(false)}
                    className="text-[#6D8196] hover:text-slate-900 font-bold transition flex items-center gap-1"
                  >
                    All Notifications →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── ROLE: SUPER_ADMIN & ADMIN VIEW ────────────────────────── */}
      {(currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN") && (
        <ExecutiveCommandCenter data={data} role={currentUserRole} />
      )}

      {/* ─── ROLE: TEAM_LEAD VIEW ──────────────────────────────────── */}
      {currentUserRole === "TEAM_LEAD" && (
        <TeamLeadMissionControl
          data={data}
          currentUserId={currentUserId}
          onRefresh={() => fetchDashboardData(false)}
        />
      )}

      {/* ─── ROLE: LINKER VIEW ─────────────────────────────────────── */}
      {currentUserRole === "LINKER" && (
        <LinkerOperationsStudio data={data} router={router} />
      )}

      {/* ─── ROLE: WRITER VIEW ─────────────────────────────────────── */}
      {currentUserRole === "WRITER" && (
        <WriterFocusStudio
          data={data}
          currentUserId={currentUserId}
          onStartWriting={handleStartWriting}
          onRefresh={() => fetchDashboardData(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. EXECUTIVE COMMAND CENTER (SUPER ADMIN & ADMIN)
// ─────────────────────────────────────────────────────────────────────────────

function ExecutiveCommandCenter({ data, role }: { data: DashboardData; role: string }) {
  const sa = data.superAdmin || {
    totalWriters: 0,
    totalLinkers: 0,
    totalTeamLeads: 0,
    totalSites: data.general.totalSites || 0,
    totalCategories: data.general.totalCategories || 0,
    affiliateNetworks: data.linkStats?.affiliateNetworks || 0,
    deadLinks: data.linkStats?.deadLinks || 0,
    issueLinks: data.general.issueLinks || 0,
    todaysProducts: data.general.todaysProducts || 0,
    avgWritingTime: "0.0",
    monthlyData: [],
    writerPerformance: [],
    recentActivity: [],
  };

  const monthlyData = sa.monthlyData || [];
  const statusData = [
    { name: "Completed", value: data.general.completedArticles, color: "#10b981" },
    { name: "In Progress", value: data.general.inProgressArticles, color: "#3b82f6" },
    { name: "Pending", value: data.general.pendingArticles, color: "#f59e0b" },
  ].filter((s) => s.value > 0);

  const writerPerformance = sa.writerPerformance || [];

  const totalArticles = data.general.completedArticles + data.general.inProgressArticles + data.general.pendingArticles;
  const completionRate = totalArticles > 0 ? Math.round((data.general.completedArticles / totalArticles) * 100) : 0;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 4-KPI HERO METRIC GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Products */}
        <div className="bg-white rounded-2xl p-5 border border-[#CBCBCB]/60 shadow-xs card-hover-effect flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Products</span>
              <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{data.general.totalProducts}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Added Today</span>
            <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200/50">
              +{data.general.todaysProducts || sa.todaysProducts || 0}
            </span>
          </div>
        </div>

        {/* Card 2: Article Pipeline */}
        <div className="bg-white rounded-2xl p-5 border border-[#CBCBCB]/60 shadow-xs card-hover-effect flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Articles Output</span>
              <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{data.general.completedArticles}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Completion Rate</span>
            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
              {completionRate}% ({data.general.inProgressArticles} active)
            </span>
          </div>
        </div>

        {/* Card 3: Link Network */}
        <div className="bg-white rounded-2xl p-5 border border-[#CBCBCB]/60 shadow-xs card-hover-effect flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Affiliate Links</span>
              <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{data.general.totalLinks}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <LinkIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Active Networks</span>
            <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
              {sa.affiliateNetworks || 15} networks
            </span>
          </div>
        </div>

        {/* Card 4: Writing Velocity & Team */}
        <div className="bg-white rounded-2xl p-5 border border-[#CBCBCB]/60 shadow-xs card-hover-effect flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Avg Writing Time</span>
              <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {sa.avgWritingTime}<span className="text-base font-medium text-slate-400 ml-1">hrs</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Writers & Linkers</span>
            <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
              {sa.totalWriters} writers · {sa.totalLinkers} linkers
            </span>
          </div>
        </div>
      </div>

      {/* CHARTS ROW 1: Productivity & Status Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="w-full h-full">
          <ChartLineLabelCustom
            data={monthlyData.map((d: any) => ({
              month: d.name,
              articles: d.articles,
              products: d.products,
            }))}
            title="Monthly Productivity & Production"
            description="Combined volume of newly indexed products and finalized articles"
          />
        </div>

        <div className="w-full h-full">
          <ChartPieInteractive
            data={statusData}
            title="Article Pipeline Distribution"
            description="Active workflow state breakdown across all connected domains"
          />
        </div>
      </div>

      {/* CHARTS ROW 2: Writer Velocity & Live Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Writer Performance */}
        <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-500" />
                Top Writer Output Velocity
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Ranked by total approved articles</p>
            </div>
            <Link href="/reports" className="text-xs font-bold text-[#6D8196] hover:underline flex items-center gap-1">
              Full Report <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="h-64">
            {writerPerformance.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-20">No writer performance metrics available yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={writerPerformance} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#475569", fontWeight: 600 }}
                  />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.05)" }}
                  />
                  <Bar dataKey="completed" fill="#6D8196" radius={[0, 6, 6, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Live Platform Activity Stream */}
        <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                Live System Audit & Events
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Real-time actions across all operational workflows</p>
            </div>
            <Link href="/history" className="text-xs font-bold text-[#6D8196] hover:underline flex items-center gap-1">
              Audit Logs <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 max-h-68 overflow-y-auto pr-1 space-y-2">
            {!sa.recentActivity || sa.recentActivity.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-16">No recent activity logged.</p>
            ) : (
              sa.recentActivity.slice(0, 8).map((act: any) => {
                let icon = <Activity className="w-3.5 h-3.5 text-slate-500" />;
                let bg = "bg-slate-50 border-slate-200";

                if (act.type === "product_added") {
                  icon = <Package className="w-3.5 h-3.5 text-indigo-600" />;
                  bg = "bg-indigo-50 border-indigo-100";
                } else if (act.type === "article_completed" || act.type === "article_approved") {
                  icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
                  bg = "bg-emerald-50 border-emerald-100";
                } else if (act.type === "link_issue") {
                  icon = <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />;
                  bg = "bg-rose-50 border-rose-100";
                } else if (act.type.startsWith("link_")) {
                  icon = <LinkIcon className="w-3.5 h-3.5 text-blue-600" />;
                  bg = "bg-blue-50 border-blue-100";
                } else if (act.type.startsWith("article_")) {
                  icon = <FileText className="w-3.5 h-3.5 text-amber-600" />;
                  bg = "bg-amber-50 border-amber-100";
                }

                const timeLabel = new Date(act.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div key={act.id} className="pt-2.5 pb-2 flex items-start gap-3 text-xs">
                    <div className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5 ${bg}`}>
                      {icon}
                    </div>
                    <div className="flex-1 flex justify-between gap-2">
                      <p className="text-slate-700 leading-snug font-medium">
                        <strong className="text-slate-900 font-bold">{act.user}</strong> — {act.type.replace("_", " ")} on{" "}
                        <span className="font-semibold text-slate-800">{act.item}</span>
                      </p>
                      <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{timeLabel}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* QUICK COMMAND SHORTCUTS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href="/products"
          className="p-4 bg-white rounded-2xl border border-[#CBCBCB]/60 hover:border-[#6D8196] shadow-2xs card-hover-effect flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Products Catalog</p>
              <p className="text-[11px] text-slate-400">Manage all specs & types</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </Link>

        <Link
          href="/articles"
          className="p-4 bg-white rounded-2xl border border-[#CBCBCB]/60 hover:border-[#6D8196] shadow-2xs card-hover-effect flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Editorial Pipeline</p>
              <p className="text-[11px] text-slate-400">Monitor drafts & timing</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </Link>

        <Link
          href="/links"
          className="p-4 bg-white rounded-2xl border border-[#CBCBCB]/60 hover:border-[#6D8196] shadow-2xs card-hover-effect flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <LinkIcon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Link Log Control</p>
              <p className="text-[11px] text-slate-400">Affiliates, Geos & Bridge</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </Link>

        <Link
          href="/reports"
          className="p-4 bg-white rounded-2xl border border-[#CBCBCB]/60 hover:border-[#6D8196] shadow-2xs card-hover-effect flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Analytics & Reports</p>
              <p className="text-[11px] text-slate-400">Writer productivity logs</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. TEAM LEAD MISSION CONTROL
// ─────────────────────────────────────────────────────────────────────────────

function TeamLeadMissionControl({
  data,
  currentUserId,
  onRefresh,
}: {
  data: DashboardData;
  currentUserId: number | null;
  onRefresh: () => void;
}) {
  const tl = data.teamLead || {
    pendingReview: 0,
    completedToday: 0,
    specialApprovals: 0,
    issueLinks: 0,
    writerPerformance: [],
    reviewQueue: [],
  };

  const [rejectingItem, setRejectingItem] = useState<any>(null);
  const [redoFeedback, setRedoFeedback] = useState("");
  const [processing, setProcessing] = useState(false);

  const handleApprove = async (articleId: number) => {
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED", callerId: currentUserId }),
      });
      if (res.ok) {
        toast.success("Article approved successfully!");
        onRefresh();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to approve article");
      }
    } catch {
      toast.error("Failed to approve article");
    }
  };

  const handleConfirmRedo = async () => {
    if (!rejectingItem) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/articles/${rejectingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "REDO",
          suggestion: redoFeedback,
          callerId: currentUserId,
        }),
      });
      if (res.ok) {
        toast.success("Article returned to writer for changes!");
        setRejectingItem(null);
        setRedoFeedback("");
        onRefresh();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to submit redo request");
      }
    } catch {
      toast.error("Failed to submit redo request");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#CBCBCB]/60 shadow-xs flex flex-col justify-between card-hover-effect">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Pending Review</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-slate-900">{tl.pendingReview}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Articles awaiting quality check</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#CBCBCB]/60 shadow-xs flex flex-col justify-between card-hover-effect">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Approved Today</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-slate-900">{tl.completedToday}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Successfully finalized today</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#CBCBCB]/60 shadow-xs flex flex-col justify-between card-hover-effect">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600">Special Exceptions</span>
            <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
              <Star className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-slate-900">{tl.specialApprovals}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">No-link submissions pending</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#CBCBCB]/60 shadow-xs flex flex-col justify-between card-hover-effect">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Reported Link Issues</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-slate-900">{tl.issueLinks}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Needs linker attention</p>
          </div>
        </div>
      </div>

      {/* Main Review Section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Review Queue (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-[#CBCBCB]/60 p-6 shadow-xs flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[#6D8196]" />
                Review Dispatch Queue ({tl.reviewQueue.length})
              </h3>
              <p className="text-xs text-slate-400 font-medium">Verify article links and approve or request revisions</p>
            </div>
            <Link href="/articles" className="text-xs font-bold text-[#6D8196] hover:underline flex items-center gap-1">
              All Articles <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {tl.reviewQueue.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700">All caught up!</p>
                <p className="text-xs text-slate-400">No submitted articles are currently waiting for your review.</p>
              </div>
            ) : (
              tl.reviewQueue.map((item) => (
                <div key={item.id} className="py-4 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition px-2 rounded-xl">
                  <div className="space-y-1 flex-1">
                    <p className="text-xs font-bold text-slate-900 leading-tight">{item.product}</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">{item.writer}</span>
                      <span>·</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-600">{item.site}</span>
                      {item.completedAt && (
                        <>
                          <span>·</span>
                          <span className="text-[10px] text-slate-400">{new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </>
                      )}
                    </div>
                    {item.remark && (
                      <p className="text-[11px] text-slate-600 bg-amber-50/80 p-2 rounded-lg border border-amber-200/50 mt-1.5 italic">
                        &quot;{item.remark}&quot;
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(item.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        setRejectingItem(item);
                        setRedoFeedback("");
                      }}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 stroke-[3]" />
                      Redo
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Writer Performance Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#CBCBCB]/60 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#6D8196]" />
              Assigned Writers Velocity
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Articles approved across your team</p>
          </div>

          <div className="h-64 mt-4">
            {tl.writerPerformance.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-20">No writer performance logs yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tl.writerPerformance} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                  />
                  <Bar dataKey="completed" fill="#6D8196" radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Redo Reason Dialog Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 border border-slate-100 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                Request Changes & Revisions
              </h3>
              <button onClick={() => setRejectingItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Returning <strong className="text-slate-900">&quot;{rejectingItem.product}&quot;</strong> to writer{" "}
              <strong className="text-slate-900">{rejectingItem.writer}</strong>.
            </p>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Feedback / Required Changes
              </label>
              <textarea
                rows={4}
                value={redoFeedback}
                onChange={(e) => setRedoFeedback(e.target.value)}
                placeholder="Explain what modifications the writer needs to make before resubmission..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none font-medium"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setRejectingItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRedo}
                disabled={processing || !redoFeedback.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {processing ? "Submitting..." : "Send Back for Redo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. LINKER OPERATIONS STUDIO
// ─────────────────────────────────────────────────────────────────────────────

function LinkerOperationsStudio({ data, router }: { data: DashboardData; router: any }) {
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-[#CBCBCB]/60 shadow-xs card-hover-effect flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Products Added by You</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-slate-900">{data.linkerProducts.length}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Under your management</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#CBCBCB]/60 shadow-xs card-hover-effect flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Configured Links</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <LinkIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-slate-900">{data.linkerLinks.length}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Active affiliate logs</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#CBCBCB]/60 shadow-xs card-hover-effect flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Link Flag Issues</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-slate-900">{data.general.issueLinks || 0}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Writers flagged issues</p>
          </div>
        </div>
      </div>

      {/* Unlinked Products Warning Section */}
      {data.unlinkedProducts && data.unlinkedProducts.length > 0 && (
        <PendingLinkLogsSection
          products={data.unlinkedProducts}
          onAddLink={(productId) => router.push(`/links?productId=${productId}`)}
        />
      )}

      {/* Flagged Alert Warning */}
      {data.flaggedLinks && data.flaggedLinks.length > 0 && (
        <div className="p-5 bg-rose-50/80 border border-rose-200/80 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="font-bold text-rose-900 text-sm">Action Required: Flagged Link Issues</h2>
              <p className="text-xs text-rose-700/90 mt-0.5">
                Writers have flagged potential dead links or configuration issues with the following entries.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {data.flaggedLinks.map((l: any) => (
              <Link
                key={l.id}
                href={`/links?editLinkId=${l.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-rose-100/50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl transition shadow-2xs"
              >
                <span>⚠️ {l.affiliateName}</span>
                <span className="text-[10px] opacity-70">({l.product.name})</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Log View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Your Added Products */}
        <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Your Added Products</h3>
            <Link href="/products" className="text-xs text-[#6D8196] hover:underline font-semibold">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {data.linkerProducts.length === 0 ? (
              <p className="p-8 text-center text-slate-400 text-xs">You haven&apos;t added any products yet.</p>
            ) : (
              data.linkerProducts.map((p) => (
                <div key={p.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{p.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {p.site.name} · {p.category.name}
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[p.article?.status || "PENDING"]}`}>
                    {p.article ? p.article.status.replace("_", " ") : "Pending"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Your Configured Links */}
        <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Your Configured Links</h3>
            <Link href="/links" className="text-xs text-[#6D8196] hover:underline font-semibold">
              Manage Links →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {data.linkerLinks.length === 0 ? (
              <p className="p-8 text-center text-slate-400 text-xs">No links configured yet.</p>
            ) : (
              data.linkerLinks.map((l) => (
                <div key={l.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{l.affiliateName}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Product: {l.product.name}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${LINK_STATUS_COLORS[l.status]}`}>
                    {l.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. WRITER FOCUS STUDIO
// ─────────────────────────────────────────────────────────────────────────────

function WriterFocusStudio({
  data,
  currentUserId,
  onStartWriting,
  onRefresh,
}: {
  data: DashboardData;
  currentUserId: number | null;
  onStartWriting: (articleId: number) => void;
  onRefresh: () => void;
}) {
  const activeArticle = data.writerInProgressArticles?.[0];

  return (
    <div className="space-y-8 animate-fadeIn">
      {activeArticle ? (
        // STATE 1: ACTIVE ASSIGNMENT FOCUS WORKSTATION
        <WriterActiveFocusWorkspace
          article={activeArticle}
          completedArticles={data.writerCompletedArticles || []}
          currentUserId={currentUserId}
          onSuccess={onRefresh}
        />
      ) : (
        // STATE 2: AVAILABLE ASSIGNMENTS DISCOVERY
        <WriterAvailableAssignments
          pendingArticles={data.writerPendingArticles || []}
          completedArticles={data.writerCompletedArticles || []}
          currentUserId={currentUserId}
          onStartWriting={onStartWriting}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

function WriterActiveFocusWorkspace({
  article,
  completedArticles,
  currentUserId,
  onSuccess,
}: {
  article: any;
  completedArticles: any[];
  currentUserId: number | null;
  onSuccess: () => void;
}) {
  const [articleLink, setArticleLink] = useState(article.articleLink || "");
  const [articleLinkError, setArticleLinkError] = useState("");
  const [writerNotes, setWriterNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalReason, setApprovalReason] = useState("");

  const [elapsed, setElapsed] = useState(0);
  const [startingRevision, setStartingRevision] = useState(false);
  const revisionStarted = article.status !== "REDO" || !!article.startedAt;

  const [reportingLink, setReportingLink] = useState<any>(null);
  const [issueMessage, setIssueMessage] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    if (article.articleLink) {
      setArticleLink(article.articleLink);
    }
  }, [article.articleLink]);

  useEffect(() => {
    if (article.startedAt) {
      const start = new Date(article.startedAt).getTime();
      const interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [article.startedAt]);

  const handleStartRevision = async () => {
    setStartingRevision(true);
    try {
      const res = await fetch(`/api/articles/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redoStarted: true, callerId: currentUserId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Revision started! Timer is running.");
      setTimeout(() => onSuccess(), 600);
    } catch (e: any) {
      toast.error(e.message || "Failed to start revision");
      setStartingRevision(false);
    }
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isValidUrl = (url: string) => {
    if (!url) return true;
    try {
      if (!/^https?:\/\//i.test(url)) return false;
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleMarkCompleted = async () => {
    if (!articleLink.trim()) return;
    if (articleLinkError || !isValidUrl(articleLink)) {
      toast.error("Please enter a valid Article Link (must start with http:// or https://)");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/articles/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED", articleLink, callerId: currentUserId, notes: writerNotes }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Article submitted successfully!");
      setWriterNotes("");
      setTimeout(() => onSuccess(), 800);
    } catch (e: any) {
      toast.error(e.message || "Failed to submit");
      setSubmitting(false);
    }
  };

  const handleRequestApproval = async () => {
    if (!approvalReason.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/articles/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specialApprovalRequested: true,
          specialApprovalRequestReason: approvalReason,
          callerId: currentUserId,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setShowApprovalModal(false);
      toast.success("Approval requested!");
      setTimeout(() => onSuccess(), 800);
    } catch (e: any) {
      toast.error(e.message || "Failed to request approval");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Focus Alert Banner */}
      <div className="p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-bold text-emerald-900">
            Active Assignment in Progress — Complete this article to unlock the next assignment.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Product Specs & Links */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-xs p-6 relative space-y-6">
          {/* Header Status & Timer */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              {article.status === "REDO" ? (
                <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200/60 rounded-full text-xs font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  Needs Changes / Revision
                </span>
              ) : (
                <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-full text-xs font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  In Progress
                </span>
              )}
            </div>

            <div className="text-right">
              {article.status === "REDO" && !article.startedAt ? (
                <span className="text-xs font-semibold text-slate-400">Timer not started</span>
              ) : (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#6D8196]" />
                  <p className="text-xl font-extrabold text-slate-900 font-mono tracking-tight">{formatTime(elapsed)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Redo Notice Banner */}
          {article.status === "REDO" && article.reviews && article.reviews.length > 0 && (
            <div className="p-4 bg-rose-50/70 border border-rose-200/80 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Revision Requested by {article.reviews[0].reviewedBy?.name || "Team Lead"}
              </div>
              {article.reviews[0].suggestion && (
                <p className="text-xs text-rose-800 bg-white p-3 rounded-xl border border-rose-100 italic">
                  &quot;{article.reviews[0].suggestion}&quot;
                </p>
              )}
            </div>
          )}

          {/* Start Revision CTA Button */}
          {article.status === "REDO" && !article.startedAt && (
            <div className="flex flex-col items-center gap-3 py-8 border border-dashed border-rose-200 rounded-2xl bg-rose-50/40 text-center">
              <p className="text-sm font-bold text-slate-800">Ready to start revision?</p>
              <button
                onClick={handleStartRevision}
                disabled={startingRevision}
                className="px-6 py-2.5 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 disabled:opacity-50 transition flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <PlayCircle className="w-4 h-4" />
                {startingRevision ? "Starting..." : "Start Revision Stopwatch"}
              </button>
            </div>
          )}

          {/* Product Specs */}
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{article.product.name}</h2>
            <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold mt-2">
              <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700">{article.product.site.name}</span>
              <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700">{article.product.category.name}</span>
            </div>
          </div>

          {/* External Links */}
          <div className="flex flex-wrap gap-3 pt-2">
            {article.product.trendLink && (
              <a
                href={article.product.trendLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Trend Link
              </a>
            )}
            {article.product.previewLink && (
              <a
                href={article.product.previewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition"
              >
                <Globe className="w-3.5 h-3.5" /> Preview Link
              </a>
            )}
          </div>

          {/* Affiliate Links Section */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Affiliate & Bridge Links</h3>
            {article.product.linkLogs?.length > 0 ? (
              <div className="space-y-3">
                {article.product.linkLogs.map((log: any) => (
                  <div key={log.id} className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/70 space-y-2">
                    <div className="flex justify-between items-start">
                      <p className="font-bold text-slate-900 text-xs">{log.affiliateName}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          log.status === "ISSUE" ? "bg-rose-100 text-rose-700" : "bg-blue-50 text-blue-700 border border-blue-200/50"
                        }`}>
                          {log.status}
                        </span>
                        {log.status !== "ISSUE" && (
                          <button
                            onClick={() => {
                              setReportingLink(log);
                              setIssueMessage("");
                            }}
                            className="text-[10px] font-bold text-rose-600 hover:bg-rose-50 px-2 py-0.5 rounded border border-rose-200 transition cursor-pointer"
                          >
                            Flag Issue
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      {log.bridgePageLink && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Bridge:</span>
                          <a href={log.bridgePageLink} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate flex-1 font-mono text-[11px]">
                            {log.bridgePageLink}
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(log.bridgePageLink);
                              toast.success("Bridge link copied!");
                            }}
                            className="p-1 rounded hover:bg-slate-200 text-slate-500"
                            title="Copy Bridge Link"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {log.buyLink && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Buy Link:</span>
                          <a href={log.buyLink} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate flex-1 font-mono text-[11px]">
                            {log.buyLink}
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(log.buyLink);
                              toast.success("Buy link copied!");
                            }}
                            className="p-1 rounded hover:bg-slate-200 text-slate-500"
                            title="Copy Buy Link"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <FormattedRemarks remarks={log.linkerRemarks} textClass="text-[11px]" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No links configured for this product.</p>
            )}
          </div>
        </div>

        {/* Right 1 Col: Submit Work Station */}
        <div>
          <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-xs p-6 sticky top-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">Submit Finished Article</h3>
              <p className="text-xs text-slate-400 mt-0.5">Paste your Google Docs or WordPress link below.</p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Article Document URL <span className="text-rose-500">*</span>
              </label>
              <input
                type="url"
                disabled={!revisionStarted}
                value={articleLink}
                onChange={(e) => {
                  const val = e.target.value;
                  setArticleLink(val);
                  if (val && !isValidUrl(val)) {
                    setArticleLinkError("Must start with http:// or https://");
                  } else {
                    setArticleLinkError("");
                  }
                }}
                placeholder="https://docs.google.com/..."
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs text-slate-900 focus:outline-none transition bg-slate-50 focus:bg-white ${
                  articleLinkError ? "border-rose-400 focus:ring-1 focus:ring-rose-400" : "border-slate-200 focus:ring-2 focus:ring-[#6D8196]"
                } ${!revisionStarted ? "opacity-50 cursor-not-allowed" : ""}`}
              />
              {articleLinkError && <p className="text-[10px] font-bold text-rose-500 mt-1">{articleLinkError}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Remarks / Writer Notes (optional)
              </label>
              <textarea
                disabled={!revisionStarted}
                value={writerNotes}
                onChange={(e) => setWriterNotes(e.target.value)}
                placeholder="Mention any key updates or considerations for the team lead..."
                rows={3}
                className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#6D8196] resize-none ${
                  !revisionStarted ? "opacity-50 cursor-not-allowed" : ""
                }`}
              />
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={handleMarkCompleted}
                disabled={!revisionStarted || !articleLink.trim() || submitting}
                className="w-full py-3 bg-[#6D8196] hover:bg-[#5A6D81] disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                {article.status === "REDO" ? "Submit Revision" : "Mark as Completed"}
              </button>

              <button
                onClick={() => setShowApprovalModal(true)}
                disabled={!revisionStarted || submitting || article.specialApprovalRequested}
                className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" />
                {article.specialApprovalRequested ? "Approval Pending..." : "Request Special Approval"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <RecentCompletionsTable completedArticles={completedArticles} />

      {/* Special Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 border border-slate-100 animate-scaleIn">
            <h3 className="text-base font-bold text-slate-900">Request Special Approval</h3>
            <p className="text-xs text-slate-500">Explain why this article can be finalized without a document link.</p>
            <textarea
              rows={3}
              value={approvalReason}
              onChange={(e) => setApprovalReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6D8196]"
              placeholder="e.g. Published directly on CMS, bypass required..."
            />
            <div className="flex justify-end gap-2.5">
              <button onClick={() => setShowApprovalModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold">
                Cancel
              </button>
              <button
                onClick={handleRequestApproval}
                disabled={submitting || !approvalReason.trim()}
                className="px-4 py-2 rounded-xl bg-[#6D8196] text-white text-xs font-bold disabled:opacity-50"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Link Issue Modal */}
      {reportingLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 border border-slate-100 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                Report Link Issue
              </h3>
              <button onClick={() => setReportingLink(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Reporting issue for link <strong className="text-slate-900">&quot;{reportingLink.affiliateName}&quot;</strong>:
            </p>
            <textarea
              rows={4}
              value={issueMessage}
              onChange={(e) => setIssueMessage(e.target.value)}
              placeholder="Describe the issue (e.g. 404 dead link, wrong redirection)..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2.5">
              <button onClick={() => setReportingLink(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold">
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!issueMessage.trim()) {
                    toast.error("Please enter a description");
                    return;
                  }
                  setSubmittingReport(true);
                  try {
                    const res = await fetch(`/api/links/${reportingLink.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: "ISSUE", issueMessage, callerId: currentUserId }),
                    });
                    if (res.ok) {
                      toast.success("Issue reported to linkers!");
                      setReportingLink(null);
                      onSuccess();
                    } else {
                      const err = await res.json();
                      toast.error(err.error || "Failed to flag issue");
                    }
                  } catch {
                    toast.error("Failed to flag issue");
                  } finally {
                    setSubmittingReport(false);
                  }
                }}
                disabled={submittingReport}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold disabled:opacity-50"
              >
                {submittingReport ? "Submitting..." : "Send Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WriterAvailableAssignments({
  pendingArticles,
  completedArticles,
  currentUserId,
  onStartWriting,
  onRefresh,
}: {
  pendingArticles: any[];
  completedArticles: any[];
  currentUserId: number | null;
  onStartWriting: (articleId: number) => void;
  onRefresh: () => void;
}) {
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [siteFilter, setSiteFilter] = useState("ALL");

  const sites = useMemo(() => {
    const s = new Set<string>();
    pendingArticles.forEach((a) => {
      if (a.product?.site?.name) s.add(a.product.site.name);
    });
    return Array.from(s);
  }, [pendingArticles]);

  const filteredArticles = useMemo(() => {
    return pendingArticles.filter((a) => {
      const matchSearch = a.product?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchSite = siteFilter === "ALL" || a.product?.site?.name === siteFilter;
      return matchSearch && matchSite;
    });
  }, [pendingArticles, searchQuery, siteFilter]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Available Assignments ({filteredArticles.length})</h2>
            <p className="text-xs text-slate-400 mt-0.5">Select a product assignment to inspect details and claim it</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#6D8196] text-slate-800"
              />
            </div>

            {sites.length > 1 && (
              <select
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Sites</option>
                {sites.map((site) => (
                  <option key={site} value={site}>
                    {site}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {filteredArticles.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs">
            No pending articles available for your authorized sites at this time.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-slate-50/50">
            {filteredArticles.map((a: any) => (
              <div
                key={a.id}
                onClick={() => setSelectedArticle(a)}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 hover:border-[#6D8196] shadow-2xs card-hover-effect cursor-pointer flex flex-col justify-between h-40"
              >
                <div>
                  <h3 className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug">{a.product.name}</h3>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                      {a.product.site.name}
                    </span>
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                      {a.product.category.name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <span className="text-[11px] text-slate-400 font-medium">{a.product.linkLogs?.length || 0} links ready</span>
                  <span className="font-bold text-[#6D8196] flex items-center gap-1 text-xs">
                    Inspect & Claim <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RecentCompletionsTable completedArticles={completedArticles} />

      {/* Assignment Preview Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Assignment Brief</h2>
              <button onClick={() => setSelectedArticle(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div>
                <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">{selectedArticle.product.name}</h3>
                <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold mt-2">
                  <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700">{selectedArticle.product.site.name}</span>
                  <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700">{selectedArticle.product.category.name}</span>
                </div>
              </div>

              {(selectedArticle.product.trendLink || selectedArticle.product.previewLink) && (
                <div className="flex gap-3">
                  {selectedArticle.product.trendLink && (
                    <a
                      href={selectedArticle.product.trendLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Trend Link
                    </a>
                  )}
                  {selectedArticle.product.previewLink && (
                    <a
                      href={selectedArticle.product.previewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition"
                    >
                      <Globe className="w-3.5 h-3.5" /> Preview Link
                    </a>
                  )}
                </div>
              )}

              {selectedArticle.product.remarks && (
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200/60 text-xs text-amber-900">
                  <span className="font-bold block mb-1">Remarks from Linker:</span>
                  {selectedArticle.product.remarks}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setSelectedArticle(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onStartWriting(selectedArticle.id);
                  setSelectedArticle(null);
                }}
                className="px-5 py-2 rounded-xl bg-[#6D8196] hover:bg-[#5A6D81] text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <PlayCircle className="w-4 h-4" /> Start Writing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecentCompletionsTable({ completedArticles }: { completedArticles: any[] }) {
  return (
    <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-xs overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
        <h3 className="font-bold text-slate-900 text-sm">Your Recent Completions</h3>
        <span className="text-xs text-slate-400 font-medium">Logged writing time</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="px-6 py-3">Product Name</th>
              <th className="px-6 py-3">Site</th>
              <th className="px-6 py-3 text-center">Writing Time</th>
              <th className="px-6 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {completedArticles.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-xs text-slate-400">
                  No completed articles yet.
                </td>
              </tr>
            ) : (
              completedArticles.map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-3.5">
                    <p className="text-xs font-bold text-slate-900 line-clamp-1">{a.product.name}</p>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="text-[11px] font-medium text-slate-500">{a.product.site.name}</span>
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    <span className="text-xs font-mono font-bold text-slate-700">
                      {a.writingTimeMin
                        ? a.writingTimeMin >= 60
                          ? `${Math.floor(a.writingTimeMin / 60)}h ${a.writingTimeMin % 60}m`
                          : `${a.writingTimeMin}m`
                        : "--"}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-[10px] font-bold text-emerald-700">
                      <Check className="w-3 h-3" /> Submitted
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. PUBLIC LANDING & PORTAL SHOWCASE
// ─────────────────────────────────────────────────────────────────────────────

function PublicLandingShowcase() {
  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-6 space-y-12 animate-fadeIn max-w-5xl mx-auto">
      {/* Hero Header */}
      <div className="text-center space-y-4 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#6D8196]/10 text-[#3D4F61] border border-[#6D8196]/30 text-xs font-bold">
          <Sparkles className="w-4 h-4 text-[#6D8196]" />
          Next-Gen Content & Affiliate Command Engine
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
          High-Velocity Article & Affiliate Management
        </h1>
        <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
          Orchestrate multi-site publishing, automated affiliate link routing, real-time writer timers, and editorial quality controls in one unified platform.
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            href="/auth/signin"
            className="px-6 py-3 bg-[#6D8196] hover:bg-[#5A6D81] text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2"
          >
            <span>Sign In to Workspace</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        <div className="p-6 bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Package className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-bold text-slate-900">Multi-Site Nutra & Ecom</h2>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Seamlessly catalog products and propagate across authorized domain categories automatically.
          </p>
        </div>

        <div className="p-6 bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-bold text-slate-900">Precision Writing Timers</h2>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Track author output times to the second with automated revision rounds and velocity scoring.
          </p>
        </div>

        <div className="p-6 bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <LinkIcon className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-bold text-slate-900">Multi-Geo Affiliate Log</h2>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Assign multiple GEO links, bridge pages, and affiliate networks with instant dead-link alerts.
          </p>
        </div>
      </div>
    </div>
  );
}
