"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Package, Clock, CheckCircle2, PlayCircle, FileText, Users, UserCheck, Crown, LayoutGrid, Globe, Network, AlertTriangle, Link as LinkIcon, Calendar, Activity, Star, ClipboardList, Check, X } from "lucide-react";
import { ChartPieInteractive } from "@/components/ChartPieInteractive";
import { ChartLineLabelCustom } from "@/components/ChartLineLabelCustom";

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
  linkerProducts: any[];
  linkerLinks: any[];
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
  IN_PROGRESS: "bg-amber-50 text-amber-700 border border-amber-200/50",
  COMPLETED: "bg-emerald-50 text-emerald-700 border border-emerald-200/50",
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

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>("ADMIN");
  const [currentUserId, setCurrentUserId] = useState<number>(1);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("mockUserId") || "1" : "1";
    let uId = parseInt(stored);
    if (isNaN(uId)) uId = 1;
    
    setCurrentUserId(uId);

    fetch(`/api/dashboard?userId=${uId}`)
      .then((r) => r.json())
      .then((resData) => {
        setData(resData);
        setCurrentUserRole(resData.role);
      })
      .catch((e) => console.error("Failed to load dashboard data", e))
      .finally(() => setLoading(false));

    fetch(`/api/notifications?userId=${uId}`)
      .then((r) => r.json())
      .then(setNotifications)
      .catch((e) => console.error("Failed to load notifications", e));

    const handleLiveNotif = (e: Event) => {
      const notif = (e as CustomEvent).detail;
      setNotifications((prev) => [notif, ...prev]);
    };
    window.addEventListener("live-notification", handleLiveNotif);

    return () => {
      window.removeEventListener("live-notification", handleLiveNotif);
    };
  }, []);

  const handleStartWriting = async (articleId: number) => {
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS", writerId: currentUserId }),
      });
      if (res.ok) {
        router.push(`/articles/${articleId}`);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to start writing");
      }
    } catch {
      alert("Failed to start writing");
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

        {/* 15 Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {/* Row 1 */}
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500"><Package className="w-4 h-4" /></div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">↑ 12%</span>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{data.general.totalProducts}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Total Products</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mb-2"><Clock className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{data.unlinkedProducts?.length || 68}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Pending Products</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32 relative">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500"><CheckCircle2 className="w-4 h-4" /></div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">↑ 8%</span>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{data.general.completedArticles}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Completed Articles</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mb-2"><PlayCircle className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{data.general.inProgressArticles}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">In Progress</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 mb-2"><FileText className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{data.general.pendingArticles}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Pending Articles</p>
            </div>
          </div>

          {/* Row 2 */}
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center text-violet-500 mb-2"><Users className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{sa.totalWriters}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Total Writers</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-fuchsia-50 flex items-center justify-center text-fuchsia-500 mb-2"><LinkIcon className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{sa.totalLinkers}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Total Linkers</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-500 mb-2"><Crown className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{sa.totalTeamLeads}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Team Leads</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-teal-500 mb-2"><Globe className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{sa.totalSites}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Total Sites</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center text-sky-500 mb-2"><LayoutGrid className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{sa.totalCategories}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Total Categories</p>
            </div>
          </div>

          {/* Row 3 */}
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 mb-2"><Network className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{sa.affiliateNetworks}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Affiliate Networks</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32 relative">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-500"><AlertTriangle className="w-4 h-4" /></div>
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full flex items-center gap-1">↓ 2</span>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{sa.deadLinks}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Dead Links</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mb-2"><AlertTriangle className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{sa.issueLinks}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Issue Links</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 mb-2"><Calendar className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{sa.todaysProducts}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Today's Products</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-500 mb-2"><Activity className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{sa.avgWritingTime}h</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Avg Writing Time</p>
            </div>
          </div>
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

      {/* Notifications Alert Inbox */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n.id} className="p-4 bg-violet-50 border border-violet-100 rounded-2xl text-xs flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse flex-shrink-0" />
                <span className="font-semibold text-slate-700">{n.message}</span>
              </div>
              <span className="text-[10px] text-violet-400 font-semibold">{new Date(n.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

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
      {currentUserRole === "TEAM_LEAD" && (
        <>
          {/* Stat Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500 mb-2">
                <ClipboardList className="w-4 h-4" />
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-800">17</p>
                <p className="text-[11px] font-semibold text-slate-400 mt-1">Pending Review</p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500 mb-2">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-800">9</p>
                <p className="text-[11px] font-semibold text-slate-400 mt-1">Completed Today</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-500 mb-2">
                <Star className="w-4 h-4" />
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-800">3</p>
                <p className="text-[11px] font-semibold text-slate-400 mt-1">Special Approvals</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32 relative">
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1">↘ 2</span>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-800">5</p>
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
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={[
                      { name: 'Sarah', completed: 42 },
                      { name: 'James', completed: 38 },
                      { name: 'Aisha', completed: 50 },
                      { name: 'Tom', completed: 28 },
                      { name: 'Elena', completed: 44 },
                      { name: 'Marcus', completed: 32 },
                    ]} 
                    margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="completed" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Review Queue List */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm flex flex-col">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Review Queue (Top 6)</h3>
              <div className="divide-y divide-slate-100 flex-1">
                {[
                  { product: "PureEnergy Plus", writer: "Elena Vasquez", site: "WellnessHub.org" },
                  { product: "CalmMind Blend", writer: "Carlos Rivera", site: "MegaStore.org" },
                  { product: "SleepWell Ultra", writer: "Unassigned", site: "GrabIt.net" },
                  { product: "BrainFuel Elite", writer: "Carlos Rivera", site: "BodyFuel.io" },
                  { product: "B12 Energy Boost", writer: "Elena Vasquez", site: "WellnessHub.org" },
                  { product: "AntioxiBlend Ultra", writer: "Carlos Rivera", site: "MegaStore.org" },
                ].map((item, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between group">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{item.product}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{item.writer} - {item.site}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-100">
                      <button className="text-emerald-500 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                      <button className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors">
                        <X className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

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
                  <p className="p-8 text-center text-slate-400 text-xs">You haven't added any products yet.</p>
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

      {/* ─── ROLE-SPECIFIC VIEW: WRITER ─────────────────────────────────── */}
      {currentUserRole === "WRITER" && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              label="Your In-Progress Articles"
              value={data.writerInProgressArticles.length}
              sub={data.writerInProgressArticles.length >= 1 ? "Complete to write another" : "Ready to accept task"}
              color="bg-white text-slate-800"
              icon={<svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036" /></svg>}
            />
            <StatCard
              label="Unassigned Pending Articles"
              value={data.writerPendingArticles.length}
              sub="available to start on your sites"
              color="bg-white text-slate-800"
              icon={<svg className="w-8 h-8 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12" /></svg>}
            />
            <StatCard
              label="Assigned Sites"
              value="Authorized"
              sub="Access configured by Admin"
              color="bg-white text-slate-800"
              icon={<svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4" /></svg>}
            />
          </div>

          {/* Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Articles */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-800 text-sm">Your Active Assignments</h2>
              </div>
              <div className="p-4 space-y-3">
                {data.writerInProgressArticles.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No active assignments. Select a pending article below to start writing!
                  </div>
                ) : (
                  data.writerInProgressArticles.map((a) => (
                    <div key={a.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{a.product.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{a.product.site.name} · {a.product.category.name}</p>
                      </div>
                      <Link href={`/articles/${a.id}`} className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs rounded-xl transition shadow-sm shadow-violet-500/10">
                        Edit Article
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pending Articles */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-800 text-sm">Available Pending Articles</h2>
              </div>
              <div className="p-4 space-y-3">
                {data.writerPendingArticles.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No pending articles found on your authorized sites.
                  </div>
                ) : (
                  data.writerPendingArticles.map((a) => (
                    <div key={a.id} className="p-4 bg-slate-50/50 border border-slate-100 rounded-xl flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{a.product.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{a.product.site.name} · {a.product.category.name}</p>
                      </div>
                      <button
                        onClick={() => handleStartWriting(a.id)}
                        className="px-3 py-1.5 border border-violet-200 text-violet-700 hover:bg-violet-50 font-semibold text-xs rounded-xl transition"
                      >
                        Claim Task
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Quick Access Actions Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
        {[
          { href: "/products/add", label: "Add Product", desc: "Configure new product specs", bg: "bg-white text-slate-700 border border-slate-100 hover:border-violet-300 hover:bg-violet-50/20", roles: ["LINKER"] },
          { href: "/articles", label: "View Articles", desc: "Monitor statuses & logs", bg: "bg-white text-slate-700 border border-slate-100 hover:border-violet-300 hover:bg-violet-50/20", roles: ["WRITER", "TEAM_LEAD"] },
          { href: "/links", label: "Manage Links", desc: "Integrate affiliate pathways", bg: "bg-white text-slate-700 border border-slate-100 hover:border-violet-300 hover:bg-violet-50/20", roles: ["LINKER", "TEAM_LEAD"] },
        ].filter(act => act.roles.includes(currentUserRole)).map((a) => (
          <Link key={a.href} href={a.href}
            className={`rounded-2xl p-5 ${a.bg} transition-all duration-200 shadow-sm block`}>
            <p className="font-bold text-sm text-slate-800">{a.label}</p>
            <p className="text-xs text-slate-400 font-medium mt-0.5">{a.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
