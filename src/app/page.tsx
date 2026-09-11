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
  Wallet,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { ChartPieInteractive } from "@/components/ChartPieInteractive";
import { ChartLineLabelCustom } from "@/components/ChartLineLabelCustom";
import { toast } from "react-hot-toast";
import FormattedRemarks from "@/components/FormattedRemarks";
import PendingLinkLogsSection from "@/components/PendingLinkLogsSection";
import LoadingScreen from "@/components/LoadingScreen";
import { fuzzyMatchAny } from "@/lib/fuzzy";
import CustomSelect from "@/components/CustomSelect";
import { getNotificationTargetUrl } from "@/lib/notificationRouting";

interface DashboardData {
  role: "SUPER_ADMIN" | "ADMIN" | "LINKER" | "WRITER" | "TEAM_LEAD";
  individualCommission?: {
    unpaidAmount: number;
    pendingSalesCount: number;
    recentPendingSales?: {
      saleId: number;
      productName: string;
      siteName: string;
      saleType: string;
      saleDate: string;
      roleEarnedAs: string;
      amount: number;
    }[];
  } | null;
  writerStats?: {
    approvedCount: number;
    inReviewCount: number;
    redoCount: number;
    completedToday: number;
    totalCompleted: number;
    avgWritingTimeMin: number | null;
  } | null;
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
    editRequests?: {
      id: number;
      product: string;
      writer: string;
      site: string;
      status: string;
      reason: string;
      updatedAt: string;
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
  const [tlTab, setTlTab] = useState<"check" | "write">("check");
  const [showCommission, setShowCommission] = useState(false);
  const [showCommissionDetailsModal, setShowCommissionDetailsModal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "write" || tabParam === "check") {
        setTlTab(tabParam);
      }
    }
  }, []);

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
    setShowBellDropdown(false);
    const targetUrl = getNotificationTargetUrl(n, currentUserRole);
    router.push(targetUrl);
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
      if (!notif.silent && notif.message) {
        setNotifications((prev) => [notif, ...prev]);

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Workflow Update", {
            body: notif.message,
            icon: "/favicon.ico",
          });
        }
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
        setTlTab("write");
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
              {(currentUserRole || "USER").replace("_", " ")}
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
        <div className="flex items-center gap-3 self-start md:self-center flex-wrap">
          {/* Individual Unpaid Commission Widget (WRITER, LINKER, TEAM_LEAD) */}
          {(currentUserRole === "WRITER" || currentUserRole === "LINKER" || currentUserRole === "TEAM_LEAD") && (
            <div
              onClick={() => setShowCommission((prev) => !prev)}
              className="flex items-center bg-white/95 dark:bg-slate-800/95 border border-[#CBCBCB]/70 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-700/80 rounded-2xl px-3.5 py-1.5 shadow-2xs gap-2.5 cursor-pointer select-none transition group hover:shadow-xs"
              title={showCommission ? "Click to hide (display in XXXX)" : "Click to unhide commission"}
            >
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/70 dark:border-amber-800/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Wallet className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                    Unpaid Commission
                  </span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Pending Payout" />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-sm sm:text-base font-black text-slate-800 dark:text-white font-mono tracking-tight">
                    {showCommission
                      ? `Rs. ${(data?.individualCommission?.unpaidAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "Rs. XXXX"}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCommission((prev) => !prev);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition cursor-pointer"
                    title={showCommission ? "Hide unpaid commission" : "Show unpaid commission"}
                    aria-label={showCommission ? "Hide unpaid commission" : "Show unpaid commission"}
                  >
                    {showCommission ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
                  </button>
                  {showCommission && (data?.individualCommission?.recentPendingSales?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCommissionDetailsModal(true);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition cursor-pointer"
                      title="View Pending Sales Breakdown"
                      aria-label="View Pending Sales Breakdown"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

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
                      const linkUrl = getNotificationTargetUrl(n, currentUserRole);

                      return (
                        <div
                          key={n.id}
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
                        </div>
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
        <div className="space-y-6 animate-fadeIn">
          {/* Dual Perspective Tabs for Team Lead */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTlTab("check")}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
                  tlTab === "check"
                    ? "bg-[#6D8196] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                <span>Check Article</span>
                {(data?.teamLead?.reviewQueue?.length ?? 0) > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      tlTab === "check"
                        ? "bg-white text-[#6D8196]"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {data?.teamLead?.reviewQueue?.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setTlTab("write")}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
                  tlTab === "write"
                    ? "bg-[#6D8196] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Write Article</span>
                {(data?.writerInProgressArticles?.length ?? 0) > 0 ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    In Progress
                  </span>
                ) : (data?.writerPendingArticles?.length ?? 0) > 0 ? (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      tlTab === "write"
                        ? "bg-white text-[#6D8196]"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {data?.writerPendingArticles?.length} pool
                  </span>
                ) : null}
              </button>
            </div>

            <div className="text-xs font-semibold text-slate-400 px-3 hidden md:block">
              {tlTab === "check"
                ? "Reviewing submissions from assigned team members"
                : "Active authoring station & product claim directory"}
            </div>
          </div>

          {/* Tab View Content */}
          {tlTab === "check" ? (
            <TeamLeadMissionControl
              data={data}
              currentUserId={currentUserId}
              onRefresh={() => fetchDashboardData(false)}
            />
          ) : (
            <WriterFocusStudio
              data={data}
              currentUserId={currentUserId}
              onStartWriting={handleStartWriting}
              onRefresh={() => fetchDashboardData(false)}
            />
          )}
        </div>
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

      {/* ─── MODAL: INDIVIDUAL UNPAID COMMISSION BREAKDOWN ────────── */}
      {showCommissionDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-scaleIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Unpaid Commission Details
                  </h3>
                  <p className="text-xs text-slate-400">
                    Your individual pending commission payouts
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCommissionDetailsModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                  Total Individual Pending
                </span>
                <span className="text-xl font-black text-amber-900 dark:text-amber-200 font-mono">
                  Rs. {(data?.individualCommission?.unpaidAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                {data?.individualCommission?.pendingSalesCount || 0} sales
              </span>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Pending Sales Breakdown
              </span>
              {data?.individualCommission?.recentPendingSales && data.individualCommission.recentPendingSales.length > 0 ? (
                data.individualCommission.recentPendingSales.map((sale) => (
                  <div
                    key={sale.saleId}
                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-extrabold text-slate-800 dark:text-white truncate">
                        {sale.productName}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {sale.siteName} • {sale.roleEarnedAs} • {sale.saleType === "FIRST_SALE" ? "1st Sale" : "Resale"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-black text-amber-600 dark:text-amber-400">
                        +Rs. {sale.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                      <span className="inline-block text-[10px] font-bold text-amber-500 uppercase">
                        Pending
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-4">No pending sales recorded</p>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCommissionDetailsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
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
        <div className="w-full min-h-[380px] flex flex-col">
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

        <div className="w-full min-h-[380px] flex flex-col">
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
            <Link href="/team-members" className="text-xs font-bold text-[#6D8196] hover:underline flex items-center gap-1">
              Full Report <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="h-64">
            {writerPerformance.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-20">No writer performance metrics available yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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

const generateSlug = (productName: string) => {
  return (productName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
};

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
            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600">Edit Requests</span>
            <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
              <Star className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-slate-900">{tl.specialApprovals}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Writers requesting to edit approved articles</p>
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

      {/* Pending Edit Requests on Approved Articles */}
      {tl.editRequests && tl.editRequests.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 shadow-xs space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Approved Article Edit Requests ({tl.editRequests.length})
            </h3>
            <span className="text-[11px] font-bold text-amber-700">Writers requesting permission to update approved articles</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tl.editRequests.map((req: any) => (
              <div key={req.id} className="bg-white p-4 rounded-xl border border-amber-200 shadow-2xs flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{req.product}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">{req.site}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Requested by: <strong className="text-slate-700">{req.writer}</strong>
                  </p>
                  <p className="text-xs text-amber-950 bg-amber-50/60 p-2 rounded-lg border border-amber-100 mt-2 italic font-medium">
                    &quot;{req.reason}&quot;
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Link
                    href={`/articles/${req.id}-${generateSlug(req.product)}`}
                    className="px-3.5 py-1.5 rounded-lg bg-[#6D8196] hover:bg-[#5A6D81] text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    Review & Decide
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                    <Link
                      href={`/articles/${item.id}-${generateSlug(item.product)}`}
                      className="px-3.5 py-2 bg-[#6D8196] hover:bg-[#5A6D81] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Review Article
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Writer Performance Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#CBCBCB]/60 p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#6D8196]" />
                Assigned Writers Velocity
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Articles approved across your team</p>
            </div>
            <Link href="/team-members" className="text-xs font-bold text-[#6D8196] hover:underline flex items-center gap-1">
              Full Report <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="h-64 mt-4">
            {tl.writerPerformance.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-20">No writer performance logs yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={tl.writerPerformance} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
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
  const stats = data.writerStats || {
    approvedCount: 0,
    inReviewCount: 0,
    redoCount: 0,
    completedToday: 0,
    totalCompleted: 0,
    avgWritingTimeMin: null,
  };
  const availableCount = data.writerPendingArticles?.length || 0;

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn">
      {/* ─── WRITER TOP STATS OVERVIEW CARDS ─────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* 1. Available Products */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs flex flex-col justify-between card-hover-effect">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-400">
              Available Products
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{availableCount}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Ready to claim</p>
          </div>
        </div>

        {/* 2. Today's Output */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs flex flex-col justify-between card-hover-effect">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Delivered Today
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{stats.completedToday}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Submitted today</p>
          </div>
        </div>

        {/* 3. In Editorial Review */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs flex flex-col justify-between card-hover-effect">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              In Quality Review
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{stats.inReviewCount}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Awaiting TL check</p>
          </div>
        </div>

        {/* 4. Total Approved */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs flex flex-col justify-between card-hover-effect">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Approved Articles
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{stats.approvedCount}</p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
              {stats.avgWritingTimeMin ? `⚡ ~${stats.avgWritingTimeMin}m avg velocity` : "Passed review"}
            </p>
          </div>
        </div>
      </div>

      {/* Redo Warning Alert (if any article has been sent back for revisions) */}
      {stats.redoCount > 0 && (
        <div className="p-4 bg-rose-50/90 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between shadow-2xs gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-rose-900 dark:text-rose-200">
                Action Required: {stats.redoCount} article{stats.redoCount === 1 ? "" : "s"} need{stats.redoCount === 1 ? "s" : ""} revision
              </p>
              <p className="text-[11px] text-rose-700 dark:text-rose-300">
                Please review Team Lead notes and update the requested changes.
              </p>
            </div>
          </div>
          {activeArticle?.status === "REDO" && (
            <span className="self-start sm:self-auto px-3 py-1 bg-rose-600 text-white rounded-xl text-xs font-bold shrink-0">
              Active in Workspace Below
            </span>
          )}
        </div>
      )}

      {activeArticle ? (
        // STATE 1: ACTIVE ASSIGNMENT FOCUS WORKSTATION
        <WriterActiveFocusWorkspace
          article={activeArticle}
          completedArticles={data.writerCompletedArticles || []}
          currentUserId={currentUserId}
          onSuccess={onRefresh}
        />
      ) : (
        // STATE 2: AVAILABLE PRODUCTS DISCOVERY
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const handleCopyLink = (url: string, id: string, label: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 2000);
  };

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
      <div className="p-4 bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20 dark:border-emerald-800/60 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <div>
            <span className="text-xs font-black text-emerald-950 dark:text-emerald-200">
              Active Focus Mode — Currently Writing
            </span>
            <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400 ml-2 hidden sm:inline font-medium">
              Complete and submit this article to unlock subsequent assignments.
            </span>
          </div>
        </div>
        {article.startedAt && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/90 dark:bg-slate-900/90 border border-emerald-200/70 dark:border-emerald-800/50 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Time on task: {formatTime(elapsed)}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Product Specs, External Links & Affiliate Links */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-6 sm:p-7 relative space-y-6">
          {/* Header Status Bar & Meta */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              {article.status === "REDO" ? (
                <span className="px-3 py-1 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800/70 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  Needs Changes / Revision
                </span>
              ) : (
                <span className="px-3 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/70 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  In Progress
                </span>
              )}

              {article.priority === "HIGH" && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 flex items-center gap-1">
                  <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> High Priority
                </span>
              )}
            </div>

            <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500">
              ART-#{article.id}
            </span>
          </div>

          {/* Redo Notice Banner */}
          {article.status === "REDO" && article.reviews && article.reviews.length > 0 && (
            <div className="p-4 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-rose-900 dark:text-rose-300 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>Revision Requested by {article.reviews[0].reviewedBy?.name || "Team Lead"}</span>
              </div>
              {article.reviews[0].suggestion && (
                <p className="text-xs text-rose-800 dark:text-rose-200 bg-white dark:bg-slate-900/90 p-3 rounded-xl border border-rose-100 dark:border-rose-900/40 italic">
                  &quot;{article.reviews[0].suggestion}&quot;
                </p>
              )}
            </div>
          )}

          {/* Start Revision CTA Button */}
          {article.status === "REDO" && !article.startedAt && (
            <div className="flex flex-col items-center gap-3 py-8 border border-dashed border-rose-200 dark:border-rose-900/60 rounded-2xl bg-rose-50/40 dark:bg-rose-950/30 text-center">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Ready to start revision?</p>
              <button
                onClick={handleStartRevision}
                disabled={startingRevision}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl disabled:opacity-50 transition flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <PlayCircle className="w-4 h-4" />
                {startingRevision ? "Starting..." : "Start Revision"}
              </button>
            </div>
          )}

          {/* Product Specs */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    {article.product.name}
                  </h2>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(article.product.name);
                      toast.success("Product name copied!");
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    title="Copy product name"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  {/* Site Pill */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700 rounded-lg text-xs font-bold shadow-2xs">
                    <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    {article.product.site.name}
                  </span>

                  {/* Category Pill */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700 rounded-lg text-xs font-bold shadow-2xs">
                    <Layers className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    {article.product.category.name}
                  </span>

                  {/* Defined Product Category if present */}
                  {article.product.productCategory && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60 rounded-lg text-xs font-bold">
                      {article.product.productCategory}
                    </span>
                  )}

                  {/* Trend Velocity if present */}
                  {article.product.trendLevel && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      article.product.trendLevel === "HIGH"
                        ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-700"
                    }`}>
                      <TrendingUp className="w-3 h-3" />
                      {article.product.trendLevel} Velocity
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* External Reference & Preview Links */}
          {(article.product.trendLink || article.product.previewLink) && (
            <div className="flex flex-wrap gap-2.5 pt-1">
              {article.product.trendLink && (
                <a
                  href={article.product.trendLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition border border-slate-200/60 dark:border-slate-700 shadow-2xs hover:shadow-xs group cursor-pointer"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200 transition" />
                  <span>Trend Reference</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 opacity-60 group-hover:opacity-100 transition" />
                </a>
              )}
              {article.product.previewLink && (
                <a
                  href={article.product.previewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50/90 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition border border-indigo-200/60 dark:border-indigo-800/60 shadow-2xs hover:shadow-xs group cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 text-indigo-500 group-hover:text-indigo-700 dark:text-indigo-400 dark:group-hover:text-indigo-200 transition" />
                  <span>Live Site Preview</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400 opacity-60 group-hover:opacity-100 transition" />
                </a>
              )}
            </div>
          )}

          {/* Product Editorial Brief / Remarks */}
          {article.product.remarks && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                Product Brief & Research Notes
              </div>
              <FormattedRemarks remarks={article.product.remarks} date={article.product.addedAt} textClass="text-xs text-slate-600 dark:text-slate-300" />
            </div>
          )}

          {/* Affiliate Links Section */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <LinkIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Affiliate & Bridge Links
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Copy and embed these verified tracking links inside your article content.
                  </p>
                </div>
              </div>
              {article.product.linkLogs?.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  {article.product.linkLogs.length} {article.product.linkLogs.length === 1 ? "Link" : "Links"} Configured
                </span>
              )}
            </div>

            {article.product.linkLogs?.length > 0 ? (
              <div className="space-y-4">
                {article.product.linkLogs.map((log: any) => {
                  const hasGeos = log.geos && log.geos.length > 0;
                  return (
                    <div
                      key={log.id}
                      className="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-4 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-2xs"
                    >
                      {/* Card Header: Network Name, Geos, Status, and Flag Issue */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                            <p className="font-black text-slate-900 dark:text-white text-sm">
                              {log.affiliateName || "Affiliate Network"}
                            </p>
                          </div>

                          {/* Target GEOs if available */}
                          {hasGeos && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {log.geos.map((g: any) => (
                                <span
                                  key={g.id || g.geo}
                                  className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-700 text-[10px] font-extrabold text-slate-700 dark:text-slate-200 shadow-2xs"
                                  title={`Target country: ${g.geo}`}
                                >
                                  🌍 {g.geo}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Status Pill */}
                          <span
                            className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                              log.status === "ISSUE"
                                ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60"
                                : log.status === "APPROVED"
                                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/60"
                            }`}
                          >
                            {log.status === "ISSUE" ? "Issue Reported" : log.status === "APPROVED" ? "Verified Active" : "Requested"}
                          </span>

                          {/* Flag Issue Button */}
                          {log.status !== "ISSUE" && (
                            <button
                              onClick={() => {
                                setReportingLink(log);
                                setIssueMessage("");
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 px-2.5 py-1 rounded-lg border border-rose-200/80 dark:border-rose-900/50 transition cursor-pointer shadow-2xs"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              <span>Flag Issue</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Links Section */}
                      <div className="space-y-3">
                        {/* Buy Link */}
                        {log.buyLink && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Buy Link
                              </span>
                              <span className="text-[10px] text-slate-400">Primary CTA / Purchase URL</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-xl p-1.5 pl-3 transition-all hover:border-slate-300 dark:hover:border-slate-600 focus-within:border-indigo-500">
                              <span className="text-[10px] font-black font-mono text-slate-400 uppercase select-none">
                                URL:
                              </span>
                              <a
                                href={log.buyLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 text-xs font-mono text-indigo-600 dark:text-indigo-400 hover:underline truncate"
                                title={log.buyLink}
                              >
                                {log.buyLink}
                              </a>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => handleCopyLink(log.buyLink, `buy-${log.id}`, "Buy link")}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    copiedId === `buy-${log.id}`
                                      ? "bg-emerald-600 text-white shadow-xs"
                                      : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                                  }`}
                                  title="Copy Buy Link"
                                >
                                  {copiedId === `buy-${log.id}` ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                                <a
                                  href={log.buyLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                  title="Open in new tab"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Bridge Page Link */}
                        {log.bridgePageLink && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                Bridge Page Link
                              </span>
                              <span className="text-[10px] text-slate-400">Presell / Bridge Page URL</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-xl p-1.5 pl-3 transition-all hover:border-slate-300 dark:hover:border-slate-600 focus-within:border-indigo-500">
                              <span className="text-[10px] font-black font-mono text-slate-400 uppercase select-none">
                                URL:
                              </span>
                              <a
                                href={log.bridgePageLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 text-xs font-mono text-indigo-600 dark:text-indigo-400 hover:underline truncate"
                                title={log.bridgePageLink}
                              >
                                {log.bridgePageLink}
                              </a>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => handleCopyLink(log.bridgePageLink, `bridge-${log.id}`, "Bridge link")}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    copiedId === `bridge-${log.id}`
                                      ? "bg-emerald-600 text-white shadow-xs"
                                      : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                                  }`}
                                  title="Copy Bridge Link"
                                >
                                  {copiedId === `bridge-${log.id}` ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                                <a
                                  href={log.bridgePageLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                  title="Open in new tab"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Fallback if neither bridge nor buy is entered yet */}
                        {!log.buyLink && !log.bridgePageLink && (
                          <p className="text-xs text-slate-400 italic">No specific URLs entered yet for this network.</p>
                        )}
                      </div>

                      {/* Linker Remarks */}
                      {log.linkerRemarks && (
                        <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/50 rounded-xl space-y-1 text-xs">
                          <p className="font-bold text-amber-900 dark:text-amber-200 text-[11px] uppercase tracking-wider">
                            Linker Instructions:
                          </p>
                          <FormattedRemarks remarks={log.linkerRemarks} date={log.addedAt} textClass="text-xs text-amber-900/90 dark:text-amber-200/90" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Affiliate Links Configured Yet</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  The linking team is preparing the tracking links for this product. You can continue writing your article in the meantime.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Submit Work Station */}
        <div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-6 sticky top-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Submit Finished Article</h3>
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
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs text-slate-900 dark:text-slate-100 focus:outline-none transition bg-slate-50 dark:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-900 ${
                  articleLinkError ? "border-rose-400 focus:ring-1 focus:ring-rose-400" : "border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-[#6D8196]"
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
                className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none bg-slate-50 dark:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#6D8196] resize-none ${
                  !revisionStarted ? "opacity-50 cursor-not-allowed" : ""
                }`}
              />
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={handleMarkCompleted}
                disabled={!revisionStarted || !articleLink.trim() || submitting}
                className="w-full py-3 bg-[#6D8196] hover:bg-[#5A6D81] dark:bg-indigo-600 dark:hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:border dark:disabled:border-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                {article.status === "REDO" ? "Submit Revision" : "Mark as Completed"}
              </button>

              <button
                onClick={() => setShowApprovalModal(true)}
                disabled={!revisionStarted || submitting || article.specialApprovalRequested}
                className="w-full py-2.5 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-100 dark:border-slate-800 animate-scaleIn">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Request Special Approval</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Explain why this article can be finalized without a document link.</p>
            <textarea
              rows={3}
              value={approvalReason}
              onChange={(e) => setApprovalReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6D8196]"
              placeholder="e.g. Published directly on CMS, bypass required..."
            />
            <div className="flex justify-end gap-2.5">
              <button onClick={() => setShowApprovalModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-100 dark:border-slate-800 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                Report Link Issue
              </h3>
              <button onClick={() => setReportingLink(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Reporting issue for link <strong className="text-slate-900 dark:text-white">&quot;{reportingLink.affiliateName}&quot;</strong>:
            </p>
            <textarea
              rows={4}
              value={issueMessage}
              onChange={(e) => setIssueMessage(e.target.value)}
              placeholder="Describe the issue (e.g. 404 dead link, wrong redirection)..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2.5">
              <button onClick={() => setReportingLink(null)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition">
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
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const sites = useMemo(() => {
    const s = new Set<string>();
    pendingArticles.forEach((a) => {
      if (a.product?.site?.name) s.add(a.product.site.name);
    });
    return Array.from(s).sort();
  }, [pendingArticles]);

  const categories = useMemo(() => {
    const c = new Set<string>();
    pendingArticles.forEach((a) => {
      if (a.product?.category?.name) c.add(a.product.category.name);
    });
    return Array.from(c).sort();
  }, [pendingArticles]);

  const filteredArticles = useMemo(() => {
    return pendingArticles.filter((a) => {
      const matchSearch =
        !searchQuery.trim() ||
        fuzzyMatchAny([a.product?.name, a.product?.slug, a.product?.site?.name, a.product?.category?.name], searchQuery);
      const matchSite = siteFilter === "ALL" || a.product?.site?.name === siteFilter;
      const matchCategory = categoryFilter === "ALL" || a.product?.category?.name === categoryFilter;
      return matchSearch && matchSite && matchCategory;
    });
  }, [pendingArticles, searchQuery, siteFilter, categoryFilter]);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Header & Filter Controls */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Available Products ({filteredArticles.length})
              </h2>
              {filteredArticles.length !== pendingArticles.length && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#6D8196]/15 text-[#3D4F61] dark:text-slate-300">
                  filtered from {pendingArticles.length}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Select any ready product to inspect links, guidelines, and claim it
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, site, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#6D8196] text-slate-800 dark:text-slate-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Site Filter */}
            {sites.length > 1 && (
              <CustomSelect
                value={siteFilter}
                onChange={(val) => setSiteFilter(val)}
                options={[
                  { value: "ALL", label: "All Sites" },
                  ...sites.map((site) => ({ value: site, label: site })),
                ]}
                className="w-36"
                triggerClassName="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#6D8196] rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs"
                portal={true}
              />
            )}

            {/* Category Filter */}
            {categories.length > 1 && (
              <CustomSelect
                value={categoryFilter}
                onChange={(val) => setCategoryFilter(val)}
                options={[
                  { value: "ALL", label: "All Categories" },
                  ...categories.map((cat) => ({ value: cat, label: cat })),
                ]}
                className="w-36"
                triggerClassName="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#6D8196] rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs"
                portal={true}
              />
            )}

            {/* Reset Filters */}
            {(searchQuery || siteFilter !== "ALL" || categoryFilter !== "ALL") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSiteFilter("ALL");
                  setCategoryFilter("ALL");
                }}
                className="px-2.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Product Cards Grid */}
        {filteredArticles.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs">
            <Package className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="font-semibold text-slate-600 dark:text-slate-400">No matching products found</p>
            <p className="text-[11px] mt-1 text-slate-400">Try adjusting your search query or active site/category filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5 sm:p-6 bg-slate-50/50 dark:bg-slate-950/30">
            {filteredArticles.map((a: any) => {
              const linkCount = a.product.linkLogs?.length || 0;
              const geosSet = new Set<string>();
              const affiliateSet = new Set<string>();

              a.product.linkLogs?.forEach((l: any) => {
                if (l.affiliateName) affiliateSet.add(l.affiliateName);
                l.geos?.forEach((g: any) => geosSet.add(g.geo));
              });

              const affiliateNames = Array.from(affiliateSet);
              const geos = Array.from(geosSet);

              return (
                <div
                  key={a.id}
                  onClick={() => setSelectedArticle(a)}
                  className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-[#6D8196] dark:hover:border-[#6D8196] shadow-2xs card-hover-effect cursor-pointer flex flex-col justify-between transition-all group min-h-[175px]"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold border border-slate-200/60 dark:border-slate-700">
                          {a.product.site.name}
                        </span>
                        {a.product.category?.name && (
                          <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border border-indigo-200/50 dark:border-indigo-900/40">
                            {a.product.category.name}
                          </span>
                        )}
                      </div>
                      {a.priority === "HIGH" && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center gap-1 shrink-0">
                          <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> High Priority
                        </span>
                      )}
                    </div>

                    <h3 className="font-extrabold text-slate-900 dark:text-white text-sm line-clamp-2 leading-snug group-hover:text-[#6D8196] transition-colors">
                      {a.product.name}
                    </h3>

                    {/* Affiliate Networks & Geos Tags */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {affiliateNames.slice(0, 2).map((aff) => (
                        <span
                          key={aff}
                          className="text-[10px] font-medium bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md border border-slate-200/50 dark:border-slate-700"
                        >
                          {aff}
                        </span>
                      ))}
                      {affiliateNames.length > 2 && (
                        <span className="text-[10px] text-slate-400">+{affiliateNames.length - 2}</span>
                      )}
                      {geos.length > 0 && (
                        <span className="text-[10px] text-slate-400 font-mono ml-auto">
                          🌍 {geos.slice(0, 3).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs mt-3">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                      <LinkIcon className="w-3 h-3 text-slate-400" />
                      {linkCount} link{linkCount === 1 ? "" : "s"} ready
                    </span>
                    <span className="font-bold text-[#6D8196] group-hover:text-[#5A6D81] flex items-center gap-1 text-xs">
                      Inspect & Claim <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RecentCompletionsTable completedArticles={completedArticles} />

      {/* Product Preview Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Product Brief</h2>
                  <p className="text-[11px] text-slate-400">Review specs and claim article</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedArticle(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
                  {selectedArticle.product.name}
                </h3>
                <div className="flex items-center gap-2 text-xs font-bold mt-2.5 flex-wrap">
                  <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200">
                    {selectedArticle.product.site.name}
                  </span>
                  {selectedArticle.product.category?.name && (
                    <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg text-indigo-700 dark:text-indigo-300">
                      {selectedArticle.product.category.name}
                    </span>
                  )}
                  {selectedArticle.product.linkLogs?.length > 0 && (
                    <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg text-emerald-700 dark:text-emerald-300">
                      {selectedArticle.product.linkLogs.length} Links Available
                    </span>
                  )}
                </div>
              </div>

              {(selectedArticle.product.trendLink || selectedArticle.product.previewLink) && (
                <div className="flex gap-2.5 flex-wrap">
                  {selectedArticle.product.trendLink && (
                    <a
                      href={selectedArticle.product.trendLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Trend Link
                    </a>
                  )}
                  {selectedArticle.product.previewLink && (
                    <a
                      href={selectedArticle.product.previewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition"
                    >
                      <Globe className="w-3.5 h-3.5" /> Preview Link
                    </a>
                  )}
                </div>
              )}

              {/* Configured Links Preview */}
              {selectedArticle.product.linkLogs && selectedArticle.product.linkLogs.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Configured Links ({selectedArticle.product.linkLogs.length})
                  </span>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedArticle.product.linkLogs.map((log: any) => (
                      <div
                        key={log.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 rounded-xl text-xs flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <span className="font-extrabold text-slate-800 dark:text-slate-200 block truncate">
                            {log.affiliateName || "Affiliate Link"}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Status: {log.status} • Geos: {log.geos?.map((g: any) => g.geo).join(", ") || "Global"}
                          </span>
                        </div>
                        {log.buyLink && (
                          <a
                            href={log.buyLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline shrink-0"
                          >
                            Buy Link ↗
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedArticle.product.remarks && (
                <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-xl border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200">
                  <span className="font-bold block mb-1">Remarks from Linker:</span>
                  <FormattedRemarks remarks={selectedArticle.product.remarks} date={selectedArticle.product.addedAt} />
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-b-3xl">
              <button
                onClick={() => setSelectedArticle(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
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
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs overflow-hidden">
      <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Your Recent Completions</h3>
          <p className="text-xs text-slate-400 mt-0.5">Track live editorial review and approvals</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl self-start sm:self-auto">
          {completedArticles.length} recent articles
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              <th className="px-6 py-3.5">Product</th>
              <th className="px-6 py-3.5">Site & Category</th>
              <th className="px-6 py-3.5 text-center">Completed</th>
              <th className="px-6 py-3.5 text-center">Writing Duration</th>
              <th className="px-6 py-3.5 text-right">Editorial Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {completedArticles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-xs text-slate-400">
                  <p className="font-semibold text-slate-500">No completed articles yet</p>
                  <p className="text-[11px] mt-1 text-slate-400">Claim an available product above and start writing</p>
                </td>
              </tr>
            ) : (
              completedArticles.map((a: any) => {
                const isApproved = a.status === "APPROVED";
                const isCompleted = a.status === "COMPLETED";
                const isRedo = a.status === "REDO";
                const review = a.reviews?.[0];

                return (
                  <tr key={a.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white line-clamp-1">
                          {a.product?.name}
                        </p>
                        {a.articleLink && (
                          <a
                            href={a.articleLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition shrink-0"
                            title="Open submitted article link"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                      {review?.suggestion && (
                        <p className="text-[11px] text-slate-400 italic mt-0.5 line-clamp-1" title={review.suggestion}>
                          &quot;{review.suggestion}&quot;
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          {a.product?.site?.name}
                        </span>
                        {a.product?.category?.name && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            {a.product.category.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-center whitespace-nowrap">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {a.completedAt
                          ? new Date(a.completedAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "--"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center whitespace-nowrap">
                      {a.writingTimeMin && a.writingTimeMin > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {a.writingTimeMin >= 60
                            ? `${Math.floor(a.writingTimeMin / 60)}h ${a.writingTimeMin % 60}m`
                            : `${a.writingTimeMin}m`}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">--</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
                      {isApproved && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" /> Approved
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-[10px] font-black text-sky-700 dark:text-sky-300">
                          <Clock className="w-3 h-3" /> Under Review
                        </span>
                      )}
                      {isRedo && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-[10px] font-black text-rose-700 dark:text-rose-300">
                          <AlertTriangle className="w-3 h-3" /> Needs Changes
                        </span>
                      )}
                      {!isApproved && !isCompleted && !isRedo && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                          {a.status}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
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
