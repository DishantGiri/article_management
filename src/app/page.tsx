/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Package, Clock, CheckCircle2, PlayCircle, FileText, Users, UserCheck, Crown, LayoutGrid, Globe, Network, AlertTriangle, Link as LinkIcon, Calendar, Activity, Star, ClipboardList, Check, X, Lock, ExternalLink, Flag, MoreHorizontal, Copy, Bell } from "lucide-react";
import { ChartPieInteractive } from "@/components/ChartPieInteractive";
import { ChartLineLabelCustom } from "@/components/ChartLineLabelCustom";
import { toast } from "react-hot-toast";

interface DashboardData {
  role: "ADMIN" | "LINKER" | "WRITER" | "TEAM_LEAD";
  general: {
    totalProducts: number;
    pendingArticles: number;
    inProgressArticles: number;
    completedArticles: number;
    totalLinks: number;
    requestedLinks: number;
    acceptedLinks: number;
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
  teamLead?: {
    pendingReview: number;
    completedToday: number;
    specialApprovals: number;
    issueLinks: number;
    writerPerformance: { name: string; completed: number }[];
    reviewQueue: { id: number; product: string; writer: string; site: string; completedAt: string | null; remark?: string | null }[];
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
  PENDING: "bg-slate-100 text-slate-600 border border-slate-200/50",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border border-blue-200/50",
  COMPLETED: "bg-indigo-50 text-indigo-700 border border-indigo-200/50",
  APPROVED: "bg-emerald-50 text-emerald-700 border border-emerald-200/50",
  REDO: "bg-rose-50 text-rose-700 border border-rose-200/50",
};

const LINK_STATUS_COLORS: Record<string, string> = {
  REQUESTED: "bg-blue-50 text-blue-700 border border-blue-200/40",
  ACCEPTED: "bg-emerald-50 text-emerald-700 border border-emerald-200/40",
  CANCELED: "bg-rose-50 text-rose-700 border border-rose-200/40",
  ISSUE: "bg-amber-50 text-amber-700 border border-amber-200/40",
  NEED_TO_CHECK: "bg-slate-50 text-slate-700 border border-slate-200/40",
};

function StatCard({ label, value, sub, color, icon }: { label: string; value: number | string; sub?: string; color: string; icon: React.ReactNode }) {
  return (
    <div className={`rounded-2xl p-5 ${color} flex items-start justify-between shadow-sm border border-slate-100`}>
      <div>
        <p className="text-sm font-semibold opacity-70">{label}</p>
        <p className="text-3xl font-extrabold mt-1 tracking-tight">{value}</p>
        {sub && <p className="text-xs mt-1.5 opacity-60 font-medium">{sub}</p>}
      </div>
      <div className="opacity-70">{icon}</div>
    </div>
  );
}

import { useSession } from "next-auth/react";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>("ADMIN");
  const [currentUserId, setCurrentUserId] = useState<number>(1);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showBellDropdown, setShowBellDropdown] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    const uId = session.user.id;
    setCurrentUserId(uId);

    setLoading(true);
    fetch(`/api/dashboard?userId=${uId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch dashboard");
        return r.json();
      })
      .then((resData) => {
        setData(resData);
        setCurrentUserRole(resData.role);
      })
      .catch((e) => console.error("Failed to load dashboard data", e))
      .finally(() => setLoading(false));

    fetch(`/api/notifications?userId=${uId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch notifications");
        return r.json();
      })
      .then(setNotifications)
      .catch((e) => console.error("Failed to load notifications", e));

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(console.error);
    }

    const handleLiveNotif = (e: Event) => {
      const notif = (e as CustomEvent).detail;
      if (notif.type === "ARTICLE_STATUS_UPDATED") {
        fetch(`/api/dashboard?userId=${uId}`)
          .then((r) => r.json())
          .then((resData) => {
            setData(resData);
          })
          .catch(() => {});
      }
      setNotifications((prev) => [notif, ...prev]);
      
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("New Workflow Update", {
          body: notif.message,
          icon: "/icon-192.png"
        });
      }
    };
    window.addEventListener("live-notification", handleLiveNotif);

    return () => {
      window.removeEventListener("live-notification", handleLiveNotif);
    };
  }, [session?.user?.id]);

  const handleStartWriting = async (articleId: number) => {
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS", writerId: currentUserId }),
      });
      if (res.ok) {
        toast.success("Assignment started!");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to start writing");
      }
    } catch {
      toast.error("Failed to start writing");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" suppressHydrationWarning>
        <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" suppressHydrationWarning />
      </div>
    );
  }

  if (!data) return <div className="p-8 text-red-500" suppressHydrationWarning>Failed to load dashboard.</div>;

  const activeArticle = data.writerInProgressArticles?.[0];

  if (currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN") {
    const sa = data.superAdmin || {
      totalWriters: 0, totalLinkers: 0, totalTeamLeads: 0,
      totalSites: 0, totalCategories: 0, affiliateNetworks: 0,
      deadLinks: 0, issueLinks: 0, todaysProducts: 0, avgWritingTime: "0.0",
      monthlyData: [], writerPerformance: [], recentActivity: []
    };

    const monthlyData = sa.monthlyData || [];

    const statusData = [
      { name: "Completed", value: data.general.completedArticles, color: "#4ade80" }, // emerald-400
      { name: "In Progress", value: data.general.inProgressArticles, color: "#60a5fa" }, // blue-400
      { name: "Pending", value: data.general.pendingArticles, color: "#fbbf24" }, // amber-400
    ].filter(s => s.value > 0);

    const writerPerformance = sa.writerPerformance || [];
    return (
      <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-[#f8fafc]" suppressHydrationWarning>
        <div className="mb-8">
          <h1 className="text-[28px] font-bold text-slate-900 tracking-tight">
            {currentUserRole === "SUPER_ADMIN" ? "Super Admin Dashboard" : "Admin Dashboard"}
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Full platform overview — all metrics and activity</p>
        </div>





        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="w-full">
            <ChartLineLabelCustom 
              data={monthlyData.map((d: any) => ({ month: d.name, articles: d.articles, products: d.products }))} 
              title="Monthly Productivity" 
              description="Overview of your productivity" 
            />
          </div>

          <div className="w-full">
            <ChartPieInteractive 
              data={statusData} 
              title="Articles by Status" 
              description="Status overview of all articles" 
            />
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-6">Writer Performance</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={writerPerformance} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dx={0} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="completed" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {sa.recentActivity?.length === 0 ? (
                <p className="text-center text-slate-400 text-xs py-8">No recent activity.</p>
              ) : (
                sa.recentActivity?.map((act: any) => {
                  let icon = <Activity className="w-3.5 h-3.5" />;
                  let bg = "bg-slate-50 text-slate-500";
                  let message = <><span className="font-bold text-slate-800">{act.user}</span> interacted with <span className="font-semibold text-slate-800">{act.item}</span></>;

                  if (act.type === "product_added") {
                    icon = <Package className="w-3.5 h-3.5" />;
                    bg = "bg-indigo-50 text-indigo-500";
                    message = <><span className="font-bold text-slate-800">{act.user}</span> added <span className="font-semibold text-slate-800">{act.item}</span></>;
                  } else if (act.type === "article_completed") {
                    icon = <CheckCircle2 className="w-3.5 h-3.5" />;
                    bg = "bg-emerald-50 text-emerald-500";
                    message = <><span className="font-bold text-slate-800">{act.user}</span> completed <span className="font-semibold text-slate-800">{act.item}</span></>;
                  } else if (act.type === "link_issue") {
                    icon = <AlertTriangle className="w-3.5 h-3.5" />;
                    bg = "bg-rose-50 text-rose-500";
                    message = <><span className="font-bold text-rose-600">Link Issue</span> flagged on <span className="font-semibold text-slate-800">{act.item}</span></>;
                  } else if (act.type.startsWith("link_")) {
                    icon = <LinkIcon className="w-3.5 h-3.5" />;
                    bg = "bg-blue-50 text-blue-500";
                    message = <><span className="font-bold text-slate-800">{act.user}</span> added a link to <span className="font-semibold text-slate-800">{act.item}</span></>;
                  } else if (act.type.startsWith("article_")) {
                    icon = <FileText className="w-3.5 h-3.5" />;
                    bg = "bg-amber-50 text-amber-500";
                    message = <><span className="font-bold text-slate-800">{act.user}</span> started writing <span className="font-semibold text-slate-800">{act.item}</span></>;
                  }

                  const timeLabel = new Date(act.date).toLocaleDateString();

                  return (
                    <div key={act.id} className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${bg}`}>{icon}</div>
                      <div className="flex-1 flex justify-between gap-4">
                        <p className="text-sm text-slate-600 font-medium">{message}</p>
                        <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">{timeLabel}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6" suppressHydrationWarning>
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            {currentUserRole === "TEAM_LEAD" && "Team Lead Overview"}
            {currentUserRole === "LINKER" && "Linker Workspace"}
            {currentUserRole === "WRITER" && "Writer Workspace"}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">
            {currentUserRole === "TEAM_LEAD" && "Approve completed articles, flag broken links, and direct workflows"}
            {currentUserRole === "LINKER" && "Add and optimize buy links, affiliate tags, and monitor alerts"}
            {currentUserRole === "WRITER" && "Submit quality articles, respond to lead suggestions, and view assignments"}
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowBellDropdown(!showBellDropdown)}
            className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition duration-150 border border-slate-200/50 shadow-sm bg-white cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white" />
            )}
          </button>

          {showBellDropdown && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-semibold">Notifications</span>
                <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-full">{notifications.length}</span>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2.5">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-4">No notifications</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="p-3 bg-slate-50 rounded-xl border border-slate-250/30 text-xs flex flex-col gap-1">
                      <p className="font-semibold text-slate-700 leading-snug">{n.message}</p>
                      <span className="text-[10px] text-slate-400 font-medium self-end">{new Date(n.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>



      {/* Unlinked Alert Warning (Linkers only) */}
      {currentUserRole === "LINKER" && data.unlinkedProducts && data.unlinkedProducts.length > 0 && (
        <div className="p-5 bg-rose-50 border border-rose-100 rounded-2xl shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0 border border-rose-200/50">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-rose-800 text-sm">Action Required: Unimplemented Links</h2>
              <p className="text-xs text-rose-600/80 mt-0.5">The following products do not have any affiliate links set up. Click to configure links.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.unlinkedProducts.map((p) => (
                  <Link
                    key={p.id}
                    href={`/links?productId=${p.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-rose-100/50 border border-rose-200/50 text-rose-700 text-xs font-semibold rounded-xl transition-colors"
                  >
                    <span>{p.name}</span>
                    <span className="text-[10px] opacity-60">({p.site.name})</span>
                    <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ROLE-SPECIFIC VIEW: TEAM_LEAD ───────────────────────── */}
      {currentUserRole === "TEAM_LEAD" && (() => {
        const tl = data.teamLead || { pendingReview: 0, completedToday: 0, specialApprovals: 0, issueLinks: 0, writerPerformance: [], reviewQueue: [] };
        return (
          <>
            {/* Stat Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500 mb-2">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-slate-800">{tl.pendingReview}</p>
                  <p className="text-[11px] font-semibold text-slate-400 mt-1">Pending Review</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500 mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-slate-800">{tl.completedToday}</p>
                  <p className="text-[11px] font-semibold text-slate-400 mt-1">Completed Today</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-500 mb-2">
                  <Star className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-slate-800">{tl.specialApprovals}</p>
                  <p className="text-[11px] font-semibold text-slate-400 mt-1">Special Approvals</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32 relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-bold text-slate-800">{tl.issueLinks}</p>
                  <p className="text-[11px] font-semibold text-slate-400 mt-1">Link Issues</p>
                </div>
              </div>
            </div>

            {/* Main Grid: Writer Performance & Review Queue */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* Writer Performance Bar Chart */}
              <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-6">Writer Performance</h3>
                <div className="h-64">
                  {tl.writerPerformance.length === 0 ? (
                    <p className="text-center text-slate-400 text-xs pt-20">No writer data available.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={tl.writerPerformance}
                        margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="completed" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Review Queue List */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm flex flex-col">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Review Queue (Top {tl.reviewQueue.length})</h3>
                <div className="divide-y divide-slate-100 flex-1">
                  {tl.reviewQueue.length === 0 ? (
                    <p className="text-center text-slate-400 text-xs py-8">No articles pending review.</p>
                  ) : (
                    tl.reviewQueue.map((item) => (
                      <div key={item.id} className="py-3 flex items-center justify-between group">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{item.product}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{item.writer} — {item.site}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={async () => {
                              const res = await fetch(`/api/articles/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "APPROVED", callerId: currentUserId }) });
                              if (res.ok) { toast.success("Article approved!"); setTimeout(() => window.location.reload(), 800); }
                              else { const e = await res.json(); toast.error(e.error || "Failed to approve"); }
                            }}
                            className="text-emerald-500 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                          <button
                            onClick={async () => {
                              const res = await fetch(`/api/articles/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "REDO", callerId: currentUserId }) });
                              if (res.ok) { toast.success("Article sent for redo!"); setTimeout(() => window.location.reload(), 800); }
                              else { const e = await res.json(); toast.error(e.error || "Failed to reject"); }
                            }}
                            className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* ─── ROLE-SPECIFIC VIEW: LINKER ─────────────────────────────────── */}
      {currentUserRole === "LINKER" && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Products Added by You"
              value={data.linkerProducts.length}
              sub="products managed by you"
              color="bg-white text-slate-800"
              icon={<svg className="w-8 h-8 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /></svg>}
            />
            <StatCard
              label="Links Added by You"
              value={data.linkerLinks.length}
              sub="active affiliate integrations"
              color="bg-white text-slate-800"
              icon={<svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /></svg>}
            />
            <StatCard
              label="Link Flag Issues"
              value={data.linkerLinks.filter((l: any) => l.status === "ISSUE").length}
              sub="flagged by Team Lead"
              color="bg-white text-slate-800"
              icon={<svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01" /></svg>}
            />
          </div>

          {/* Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-800 text-sm">Your Added Products</h2>
                <Link href="/products" className="text-xs text-violet-600 hover:text-violet-700 font-semibold">View all →</Link>
              </div>
              <div className="divide-y divide-slate-50">
                {data.linkerProducts.length === 0 ? (
                  <p className="p-8 text-center text-slate-400 text-xs">You haven&apos;t added any products yet.</p>
                ) : (
                  data.linkerProducts.map((p) => (
                    <div key={p.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{p.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{p.site.name} · {p.category.name}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[p.article?.status || "PENDING"]}`}>
                        {p.article ? p.article.status.replace("_", " ") : "Pending"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-800 text-sm">Your Configured Links</h2>
                <Link href="/links" className="text-xs text-violet-600 hover:text-violet-700 font-semibold">Manage Links →</Link>
              </div>
              <div className="divide-y divide-slate-50">
                {data.linkerLinks.length === 0 ? (
                  <p className="p-8 text-center text-slate-400 text-xs">No links added yet.</p>
                ) : (
                  data.linkerLinks.map((l) => (
                    <div key={l.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{l.affiliateName}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Product: {l.product.name}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${LINK_STATUS_COLORS[l.status]}`}>
                        {l.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ─── ROLE-SPECIFIC VIEW: WRITER & TEAM_LEAD ─────────────────────── */}
      {(currentUserRole === "WRITER" || currentUserRole === "TEAM_LEAD") && (
        <>
          {data.writerInProgressArticles && data.writerInProgressArticles.length > 0 ? (
            // STATE 2: ACTIVE ASSIGNMENT
            <WriterActiveWorkspace 
              article={data.writerInProgressArticles[0]} 
              completedArticles={data.writerCompletedArticles || []}
              currentUserId={currentUserId}
              onSuccess={() => window.location.reload()}
            />
          ) : (
            // STATE 1: NO ACTIVE ASSIGNMENT (AVAILABLE PRODUCTS)
            <WriterAvailableAssignments 
              pendingArticles={data.writerPendingArticles || []}
              completedArticles={data.writerCompletedArticles || []}
              currentUserId={currentUserId}
              onStartWriting={handleStartWriting}
            />
          )}
        </>
      )}

      {/* Quick Access Actions Links (Hide for WRITER since their view is completely different now) */}
      {currentUserRole !== "WRITER" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          {[
            { href: "/products/add", label: "Add Product", desc: "Configure new product specs", bg: "bg-white text-slate-700 border border-slate-100 hover:border-violet-300 hover:bg-violet-50/20", roles: ["LINKER"] },
            { href: "/articles", label: "View Articles", desc: "Monitor statuses & logs", bg: "bg-white text-slate-700 border border-slate-100 hover:border-violet-300 hover:bg-violet-50/20", roles: ["TEAM_LEAD"] },
            { href: "/links", label: "Manage Links", desc: "Integrate affiliate pathways", bg: "bg-white text-slate-700 border border-slate-100 hover:border-violet-300 hover:bg-violet-50/20", roles: ["LINKER", "TEAM_LEAD"] },
          ].filter(act => act.roles.includes(currentUserRole)).map((a) => (
            <Link key={a.href} href={a.href}
              className={`rounded-2xl p-5 ${a.bg} transition-all duration-200 shadow-sm block`}>
              <p className="font-bold text-sm text-slate-800">{a.label}</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">{a.desc}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── WRITER WORKSPACE COMPONENTS ──────────────────────────────────────────────────────────

function WriterActiveWorkspace({ article, completedArticles, currentUserId, onSuccess }: any) {
  const [articleLink, setArticleLink] = useState(article.articleLink || "");
  const [articleLinkError, setArticleLinkError] = useState("");
  const [writerNotes, setWriterNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalReason, setApprovalReason] = useState("");

  const [elapsed, setElapsed] = useState(0);

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

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
    if (articleLinkError) {
      toast.error("Please fix the URL validation error before submitting.");
      return;
    }
    if (!isValidUrl(articleLink)) {
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
      setTimeout(() => onSuccess(), 1000);
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
        body: JSON.stringify({ specialApprovalRequested: true, specialApprovalRequestReason: approvalReason, callerId: currentUserId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setShowApprovalModal(false);
      toast.success("Approval requested!");
      setTimeout(() => onSuccess(), 1000); // Trigger reload to update UI
    } catch (e: any) {
      toast.error(e.message || "Failed to request approval");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Lock className="w-5 h-5 text-emerald-600" />
        <span className="text-sm font-medium text-slate-600">Complete current article to unlock next assignment.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative">
          <div className="flex items-center justify-between mb-6">
            {article.status === 'REDO' ? (
              <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200/40 rounded-full text-xs font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                Needs Changes
              </span>
            ) : (
              <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200/40 rounded-full text-xs font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                In Progress
              </span>
            )}
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                {article.status === 'REDO' ? 'Revision Timer' : 'Writing Timer'}
              </p>
              <p className="text-xl font-bold text-slate-800 font-mono tracking-tight">{formatTime(elapsed)}</p>
            </div>
          </div>

          {article.status === 'REDO' && article.reviews && article.reviews.length > 0 && (
            <div className="mb-6 p-4 bg-rose-50/50 border border-rose-200/60 rounded-2xl text-left space-y-1.5">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                Revision Requested by {article.reviews[0].reviewedBy?.name || "Team Lead"}
              </div>
              <p className="text-[11px] text-rose-600/90 font-medium">
                Please make the requested modifications and resubmit:
              </p>
              {article.reviews[0].suggestion && (
                <p className="text-xs text-rose-700 italic bg-rose-50 p-3 rounded-xl border border-rose-100">
                  &quot;{article.reviews[0].suggestion}&quot;
                </p>
              )}
              {article.updateTimeMin !== undefined && article.updateTimeMin !== null && (
                <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wider mt-2.5">
                  Total Redo Time from Previous Rounds: {article.updateTimeMin >= 60 ? `${Math.floor(article.updateTimeMin / 60)}h ${article.updateTimeMin % 60}m` : `${article.updateTimeMin}m`}
                </p>
              )}
            </div>
          )}

          <h2 className="text-2xl font-bold text-slate-900 mb-3">{article.product.name}</h2>
          
          <div className="flex items-center gap-4 text-sm text-slate-500 font-medium mb-8">
            <span className="flex items-center gap-1.5"><FileText className="w-4 h-4" /> {article.product.site.name}</span>
            <span className="flex items-center gap-1.5"><LayoutGrid className="w-4 h-4" /> {article.product.category.name}</span>
          </div>

          <div className="flex items-center gap-3 mb-8 pb-8 border-b border-slate-100">
            {article.product.trendLink && (
              <a href={article.product.trendLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition">
                <ExternalLink className="w-4 h-4" /> Trend Link
              </a>
            )}
            {article.product.previewLink && (
              <a href={article.product.previewLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-semibold transition">
                <Globe className="w-4 h-4" /> Preview Link
              </a>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-4">Affiliate Links & Geos</h3>
            {article.product.linkLogs?.length > 0 ? (
              <div className="space-y-3">
                {article.product.linkLogs.map((log: any) => (
                  <div key={log.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-bold text-slate-800 text-sm">{log.affiliateName}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          log.status === "ISSUE" ? "bg-rose-100 text-rose-700" : "bg-blue-50 text-blue-700 border border-blue-200/50"
                        }`}>
                          {log.status}
                        </span>
                        {log.status !== "ISSUE" && (
                          <button
                            onClick={async () => {
                              const issue = prompt(`Describe the issue with link "${log.affiliateName}":`);
                              if (!issue || !issue.trim()) return;
                              try {
                                const res = await fetch(`/api/links/${log.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    status: "ISSUE",
                                    issueMessage: issue,
                                    callerId: currentUserId
                                  })
                                });
                                if (res.ok) {
                                  toast.success("Link issue flagged successfully!");
                                  setTimeout(() => window.location.reload(), 1000);
                                } else {
                                  const err = await res.json();
                                  toast.error(err.error || "Failed to flag link issue");
                                }
                              } catch (e: any) {
                                toast.error(e.message || "Failed to flag link issue");
                              }
                            }}
                            className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-0.5 rounded border border-rose-200/50 transition cursor-pointer"
                          >
                            Flag Issue
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5 mb-2">
                      {log.affiliateLink && (
                        <div><span className="text-[10px] font-bold text-slate-400 uppercase">Affiliate Link:</span> <a href={log.affiliateLink} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline break-all">{log.affiliateLink}</a></div>
                      )}
                      {log.bridgePageLink && (
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Bridge Page:</span> 
                          <div className="flex items-center gap-2 mt-0.5">
                            <a href={log.bridgePageLink} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline break-all">{log.bridgePageLink}</a>
                            <button onClick={() => { navigator.clipboard.writeText(log.bridgePageLink); alert("Copied bridge page link!"); }} className="p-1 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition" title="Copy Bridge Page Link"><Copy className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      )}
                      {log.buyLink && (
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Buy Link:</span> 
                          <div className="flex items-center gap-2 mt-0.5">
                            <a href={log.buyLink} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline break-all">{log.buyLink}</a>
                            <button onClick={() => { navigator.clipboard.writeText(log.buyLink); alert("Copied buy link!"); }} className="p-1 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition" title="Copy Buy Link"><Copy className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      )}
                      {log.linkerRemarks && (
                        <div className="mt-2 bg-slate-100 p-2 rounded text-xs text-slate-600"><span className="font-bold">Remarks:</span> {log.linkerRemarks}</div>
                      )}
                    </div>
                    {log.geos?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {log.geos.map((g: any) => (
                          <span key={g.geo} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-500">{g.geo}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No links available for this product.</p>
            )}
          </div>
        </div>

        <div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sticky top-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Submit Work</h3>
            <p className="text-xs text-slate-500 mb-6">Paste your document URL below to complete this assignment.</p>
            
             <div className="mb-6">
               <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Article URL (GDocs/WP)</label>
               <input 
                 type="url"
                 value={articleLink}
                 onChange={e => {
                   const val = e.target.value;
                   setArticleLink(val);
                   if (val && !isValidUrl(val)) {
                     setArticleLinkError("Must start with http:// or https:// and be a valid URL");
                   } else {
                     setArticleLinkError("");
                   }
                 }}
                 placeholder="https://docs.google.com/..."
                 className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition bg-slate-50 focus:bg-white ${
                   articleLinkError
                     ? "border-rose-400 focus:ring-2 focus:ring-rose-400"
                     : "border-slate-200 focus:ring-2 focus:ring-indigo-500"
                 }`}
               />
               {articleLinkError && (
                 <p className="text-[11px] font-semibold text-rose-500 mt-1">{articleLinkError}</p>
               )}
             </div>

             <div className="mb-6">
               <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Remarks / Comments (optional)</label>
               <textarea 
                 value={writerNotes}
                 onChange={e => setWriterNotes(e.target.value)}
                 placeholder="Tell the team lead about your updates or changes..."
                 rows={3}
                 className="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition bg-slate-50 focus:bg-white border-slate-200 focus:ring-2 focus:ring-indigo-500"
               />
             </div>

            <div className="space-y-3">
              <button 
                onClick={handleMarkCompleted}
                disabled={!articleLink.trim() || submitting}
                className="w-full py-3 bg-black hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition"
              >
                <CheckCircle2 className="w-5 h-5" /> {article.status === 'REDO' ? 'Submit Update' : 'Mark Completed'}
              </button>
              
              <button 
                onClick={() => setShowApprovalModal(true)}
                disabled={submitting || article.specialApprovalRequested}
                className="w-full py-3 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition"
              >
                <Flag className="w-4 h-4" /> {article.specialApprovalRequested ? "Approval Pending..." : "Request Special Approval"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <RecentCompletionsTable completedArticles={completedArticles} />

      {/* Special Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Request Special Approval</h3>
            <p className="text-xs text-slate-500 mb-4">Explain why you need to submit this article without a document link.</p>
            <textarea 
              rows={3}
              value={approvalReason}
              onChange={e => setApprovalReason(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 mb-4"
              placeholder="e.g. Published directly on site..."
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowApprovalModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold">Cancel</button>
              <button onClick={handleRequestApproval} disabled={submitting || !approvalReason.trim()} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">Submit Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WriterAvailableAssignments({ pendingArticles, completedArticles, currentUserId, onStartWriting }: any) {
  const [selectedArticle, setSelectedArticle] = useState<any>(null);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Available Assignments</h2>
          <p className="text-xs text-slate-500 mt-1">Select a pending article to view details and start writing.</p>
        </div>
        
        {pendingArticles.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">No pending articles available for your authorized sites.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-slate-50/50">
            {pendingArticles.map((a: any) => (
              <div 
                key={a.id} 
                onClick={() => setSelectedArticle(a)}
                className="bg-white p-5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md cursor-pointer transition flex flex-col justify-between h-36"
              >
                <div>
                  <h3 className="font-bold text-slate-800 text-sm line-clamp-2 leading-tight mb-2">{a.product.name}</h3>
                  <div className="flex flex-wrap gap-2 text-[10px] font-bold text-slate-500">
                    <span className="bg-slate-100 px-2 py-0.5 rounded">{a.product.site.name}</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded">{a.product.category.name}</span>
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1 group-hover:gap-2 transition-all">Preview <ExternalLink className="w-3 h-3" /></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RecentCompletionsTable completedArticles={completedArticles} />

      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Assignment Details</h2>
              <button onClick={() => setSelectedArticle(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{selectedArticle.product.name}</h3>
                <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                  <span className="flex items-center gap-1.5"><FileText className="w-4 h-4" /> {selectedArticle.product.site.name}</span>
                  <span className="flex items-center gap-1.5"><LayoutGrid className="w-4 h-4" /> {selectedArticle.product.category.name}</span>
                </div>
              </div>

              {(selectedArticle.product.trendLink || selectedArticle.product.previewLink) && (
                <div className="flex gap-3">
                  {selectedArticle.product.trendLink && (
                    <a href={selectedArticle.product.trendLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition">
                      <ExternalLink className="w-4 h-4" /> Trend Link
                    </a>
                  )}
                  {selectedArticle.product.previewLink && (
                    <a href={selectedArticle.product.previewLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-semibold transition">
                      <Globe className="w-4 h-4" /> Preview Link
                    </a>
                  )}
                </div>
              )}

              {selectedArticle.product.remarks && (
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-sm text-amber-800">
                  <span className="font-bold block mb-1">Remarks:</span>
                  {selectedArticle.product.remarks}
                </div>
              )}

              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-3">Links & Geos</h4>
                {selectedArticle.product.linkLogs?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedArticle.product.linkLogs.map((log: any) => (
                      <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-bold text-slate-800 text-xs">{log.affiliateName}</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{log.status}</span>
                        </div>
                        <div className="space-y-1 mb-2">
                          {log.affiliateLink && (
                            <div><span className="text-[9px] font-bold text-slate-400 uppercase">Affiliate Link:</span> <a href={log.affiliateLink} target="_blank" rel="noopener noreferrer" className="text-[11px] text-indigo-600 hover:underline break-all block truncate">{log.affiliateLink}</a></div>
                          )}
                          {log.bridgePageLink && (
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center justify-between">
                                Bridge Page:
                                <button onClick={() => { navigator.clipboard.writeText(log.bridgePageLink); alert("Copied bridge page link!"); }} className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition"><Copy className="w-3 h-3" /></button>
                              </span> 
                              <a href={log.bridgePageLink} target="_blank" rel="noopener noreferrer" className="text-[11px] text-indigo-600 hover:underline break-all block truncate mt-0.5">{log.bridgePageLink}</a>
                            </div>
                          )}
                          {log.buyLink && (
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center justify-between">
                                Buy Link:
                                <button onClick={() => { navigator.clipboard.writeText(log.buyLink); alert("Copied buy link!"); }} className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition"><Copy className="w-3 h-3" /></button>
                              </span> 
                              <a href={log.buyLink} target="_blank" rel="noopener noreferrer" className="text-[11px] text-indigo-600 hover:underline break-all block truncate mt-0.5">{log.buyLink}</a>
                            </div>
                          )}
                          {log.linkerRemarks && (
                            <div className="mt-1.5 bg-slate-100 p-1.5 rounded text-[10px] text-slate-600"><span className="font-bold">Remarks:</span> {log.linkerRemarks}</div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {log.geos?.map((g: any) => (
                            <span key={g.geo} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-500 uppercase">{g.geo}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No links configured yet.</p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
              <button onClick={() => setSelectedArticle(null)} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-white transition">Close</button>
              <button onClick={() => onStartWriting(selectedArticle.id)} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition flex items-center gap-2">
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
        <h3 className="font-bold text-slate-900 text-sm">Recent Completions</h3>
        <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal className="w-5 h-5" /></button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product Name</th>
              <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Site</th>
              <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Writing Time</th>
              <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {completedArticles.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-xs text-slate-400">No completed articles yet.</td>
              </tr>
            ) : (
              completedArticles.map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-6 py-3.5">
                    <p className="text-xs font-bold text-slate-800 line-clamp-1">{a.product.name}</p>
                  </td>
                  <td className="px-6 py-3.5">
                    <p className="text-[11px] font-medium text-slate-500">{a.product.site.name}</p>
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    <p className="text-[11px] font-bold text-slate-700">
                      {a.writingTimeMin ? (
                        a.writingTimeMin >= 60 
                          ? `${Math.floor(a.writingTimeMin / 60).toString().padStart(2, '0')}:${(a.writingTimeMin % 60).toString().padStart(2, '0')}:00`
                          : `00:${a.writingTimeMin.toString().padStart(2, '0')}:00`
                      ) : (
                        "--"
                      )}
                    </p>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-700">
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
