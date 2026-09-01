"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Users,
  FileText,
  Clock,
  Calendar,
  ChevronRight,
  Mail,
  Search,
  LayoutGrid,
  List,
  Award,
  Zap,
  TrendingUp,
  ExternalLink,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  BarChart3,
  X,
} from "lucide-react";
import LoadingScreen from "@/components/LoadingScreen";
import CustomSelect from "@/components/CustomSelect";

interface TeamMember {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  activeArticle?: {
    id: number;
    productName: string;
    status: string;
    startedAt: string | null;
  } | null;
  stats: {
    totalArticles: number;
    avgWritingTimeMin: number;
    avgArticlesPerDay: number;
    avgArticlesPerWeek: number;
  };
  recentArticles: Array<{
    id: number;
    productName: string;
    completedAt: string;
    writingTimeMin: number | null;
  }>;
}

export default function TeamMembersPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("articles_desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    if (!session?.user?.id) return;

    const uId = session.user.id;
    const uRole = session.user.role;

    if (uRole !== "TEAM_LEAD" && uRole !== "ADMIN" && uRole !== "SUPER_ADMIN") {
      router.push("/");
      return;
    }

    fetch(`/api/team-members?userId=${uId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setMembers(data);
        }
      })
      .catch(() => setError("Failed to fetch team member statistics"))
      .finally(() => setLoading(false));
  }, [session?.user?.id, session?.user?.role, router]);

  const formatWritingTime = (mins: number) => {
    if (!mins || mins <= 0) return "N/A";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ""}` : `${m}m`;
  };

  // Aggregate Metrics for Top Summary Bar
  const aggregateMetrics = useMemo(() => {
    if (members.length === 0) return { totalArticles: 0, avgSpeed: 0, topWriter: null, activeCount: 0 };
    
    const totalArticles = members.reduce((sum, m) => sum + m.stats.totalArticles, 0);
    const writersWithSpeed = members.filter((m) => m.stats.avgWritingTimeMin > 0);
    const totalSpeedSum = writersWithSpeed.reduce((sum, m) => sum + m.stats.avgWritingTimeMin, 0);
    const avgSpeed = writersWithSpeed.length > 0 ? Math.round(totalSpeedSum / writersWithSpeed.length) : 0;
    
    const topWriter = [...members].sort((a, b) => b.stats.totalArticles - a.stats.totalArticles)[0] || null;
    const activeCount = members.filter((m) => m.activeArticle).length;

    return { totalArticles, avgSpeed, topWriter, activeCount };
  }, [members]);

  // Filter and Sort Team Members
  const filteredAndSortedMembers = useMemo(() => {
    return members
      .filter(
        (m) =>
          m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === "articles_desc") return b.stats.totalArticles - a.stats.totalArticles;
        if (sortBy === "articles_asc") return a.stats.totalArticles - b.stats.totalArticles;
        if (sortBy === "speed_fastest") {
          const speedA = a.stats.avgWritingTimeMin || 9999;
          const speedB = b.stats.avgWritingTimeMin || 9999;
          return speedA - speedB;
        }
        if (sortBy === "daily_pace") return b.stats.avgArticlesPerDay - a.stats.avgArticlesPerDay;
        if (sortBy === "name_asc") return a.name.localeCompare(b.name);
        return 0;
      });
  }, [members, searchTerm, sortBy]);

  // Get Initials for Avatar
  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Avatar color generator based on name
  const getAvatarGradient = (name: string) => {
    const gradients = [
      "from-indigo-600 to-violet-600",
      "from-blue-600 to-cyan-600",
      "from-emerald-600 to-teal-600",
      "from-amber-600 to-orange-600",
      "from-rose-600 to-pink-600",
      "from-purple-600 to-indigo-600",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return gradients[Math.abs(hash) % gradients.length];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F5]">
        <LoadingScreen
          message="Loading team performance dashboard..."
          subtext="Aggregating writer analytics, writing speeds & article throughput"
          size="md"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-lg mx-auto my-20 text-center bg-white rounded-2xl border border-rose-200 shadow-sm">
        <Users className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900">Unable to Load Team Analytics</h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto min-h-screen bg-[#FAF9F5] space-y-6 font-sans">
      
      {/* ─── HEADER SECTION ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#6D8196]/15 border border-[#6D8196]/30 flex items-center justify-center text-[#3D4F61]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Team Members</h1>
              <p className="text-xs text-[#737373] mt-0.5">
                Analyze productivity metrics, track speed benchmarks, and monitor your writing team.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-white border border-[#CBCBCB] shadow-2xs flex items-center gap-2 text-xs font-semibold text-[#4A4A4A]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{aggregateMetrics.activeCount} Currently Drafting</span>
            <span className="text-slate-300">|</span>
            <span>{members.length} Total Writers</span>
          </div>
        </div>
      </div>

      {/* ─── AGGREGATE KPI CARDS ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Writers */}
        <div className="bg-white rounded-2xl border border-[#CBCBCB]/70 p-5 shadow-xs flex items-center justify-between transition-all hover:border-[#6D8196] hover:shadow-sm">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-[#737373] uppercase tracking-wider block">Writing Staff</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">{members.length}</span>
              <span className="text-xs font-semibold text-indigo-600">Active</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Assigned under your lead</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Total Completed Articles */}
        <div className="bg-white rounded-2xl border border-[#CBCBCB]/70 p-5 shadow-xs flex items-center justify-between transition-all hover:border-[#6D8196] hover:shadow-sm">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-[#737373] uppercase tracking-wider block">Total Articles</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">{aggregateMetrics.totalArticles}</span>
              <span className="text-xs font-semibold text-emerald-600">Completed</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Delivered to editorial review</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        {/* Average Writing Speed */}
        <div className="bg-white rounded-2xl border border-[#CBCBCB]/70 p-5 shadow-xs flex items-center justify-between transition-all hover:border-[#6D8196] hover:shadow-sm">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-[#737373] uppercase tracking-wider block">Team Avg Speed</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">
                {formatWritingTime(aggregateMetrics.avgSpeed)}
              </span>
              <span className="text-xs font-semibold text-blue-600">Per Article</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Stopwatch benchmark pace</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Top Performer */}
        <div className="bg-white rounded-2xl border border-[#CBCBCB]/70 p-5 shadow-xs flex items-center justify-between transition-all hover:border-[#6D8196] hover:shadow-sm">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-[#737373] uppercase tracking-wider block">Top Producer</span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-extrabold text-slate-900 truncate max-w-[130px]" title={aggregateMetrics.topWriter?.name}>
                {aggregateMetrics.topWriter?.name || "N/A"}
              </span>
              <span className="text-xs font-semibold text-amber-600">
                {aggregateMetrics.topWriter ? `${aggregateMetrics.topWriter.stats.totalArticles} Arts` : ""}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Highest completed volume</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shrink-0">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ─── SEARCH & FILTER TOOLBAR ─── */}
      <div className="bg-white rounded-2xl border border-[#CBCBCB]/70 p-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search writers by name or email..."
            className="w-full pl-9 pr-8 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196] transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort & View Mode */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#737373] uppercase tracking-wider hidden lg:inline">Sort:</span>
            <CustomSelect
              value={sortBy}
              onChange={(val) => setSortBy(val)}
              options={[
                { value: "articles_desc", label: "Most Articles Completed" },
                { value: "speed_fastest", label: "Fastest Average Speed" },
                { value: "daily_pace", label: "Highest Daily Velocity" },
                { value: "name_asc", label: "Name (A-Z)" },
              ]}
              className="w-48 sm:w-52"
              triggerClassName="px-3 py-2 bg-slate-50 border border-slate-200 hover:border-[#6D8196] rounded-xl text-xs font-semibold text-slate-700 shadow-2xs"
              portal={true}
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white text-slate-900 shadow-2xs font-bold"
                  : "text-slate-400 hover:text-slate-700"
              }`}
              title="Grid Cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "list"
                  ? "bg-white text-slate-900 shadow-2xs font-bold"
                  : "text-slate-400 hover:text-slate-700"
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── MAIN CONTENT: GRID OR LIST VIEW ─── */}
      {filteredAndSortedMembers.length === 0 ? (
        <div className="bg-white border border-[#CBCBCB]/70 rounded-2xl p-14 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Team Members Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? `No writers matching "${searchTerm}". Clear the search query to show all members.`
              : "No writers are currently assigned under your team leadership."}
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
            >
              Clear Filter
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredAndSortedMembers.map((member, idx) => {
            const isTopProducer = idx === 0 && sortBy === "articles_desc" && member.stats.totalArticles > 0;
            const isFastest = member.stats.avgWritingTimeMin > 0 && member.stats.avgWritingTimeMin < 120;

            return (
              <div
                key={member.id}
                className="bg-white rounded-2xl border border-[#CBCBCB]/70 hover:border-[#6D8196] shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col group"
              >
                {/* Member Header */}
                <div className="p-5 border-b border-slate-100 bg-linear-to-b from-slate-50/50 to-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${getAvatarGradient(
                          member.name
                        )} text-white flex items-center justify-center text-sm font-extrabold shadow-sm shrink-0 tracking-wider`}
                      >
                        {getInitials(member.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                            {member.name}
                          </h3>
                          {isTopProducer && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200/80 shrink-0">
                              🏆 #1
                            </span>
                          )}
                        </div>
                        <a
                          href={`mailto:${member.email}`}
                          className="text-xs text-slate-400 hover:text-slate-600 font-medium truncate flex items-center gap-1 mt-0.5 transition-colors"
                        >
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{member.email}</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Active Drafting Status Badge */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    {member.activeArticle ? (
                      <div
                        onClick={() => router.push(`/articles/${member.activeArticle?.id}`)}
                        className="w-full flex items-center justify-between p-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 cursor-pointer hover:bg-emerald-100/80 transition-all shadow-2xs"
                        title="Click to inspect live drafted article"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                          <span className="text-[11px] font-bold truncate">
                            Drafting: {member.activeArticle.productName}
                          </span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      </div>
                    ) : (
                      <div className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/60 text-slate-500 text-[11px] font-medium">
                        <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                        <span>Available for next article assignment</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4-Stat Metric Grid */}
                <div className="p-4 grid grid-cols-2 gap-2.5 bg-[#FAF9F5]/40 border-b border-slate-100">
                  {/* Total Articles */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Articles</span>
                      <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <p className="text-xl font-extrabold text-slate-900 leading-tight">
                      {member.stats.totalArticles}
                    </p>
                    <span className="text-[10px] text-emerald-700 font-semibold block">Completed</span>
                  </div>

                  {/* Avg Speed */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Avg Speed</span>
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <p className="text-xl font-extrabold text-slate-900 leading-tight truncate">
                      {formatWritingTime(member.stats.avgWritingTimeMin)}
                    </p>
                    <span
                      className={`text-[10px] font-semibold block ${
                        isFastest ? "text-emerald-600" : "text-slate-500"
                      }`}
                    >
                      {isFastest ? "⚡ Fast pace" : "Turnaround"}
                    </span>
                  </div>

                  {/* Daily Pace */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Daily Pace</span>
                      <TrendingUp className="w-3.5 h-3.5 text-sky-600" />
                    </div>
                    <p className="text-lg font-extrabold text-slate-900 leading-tight">
                      {member.stats.avgArticlesPerDay}
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium block">arts / active day</span>
                  </div>

                  {/* Weekly Pace */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Weekly Pace</span>
                      <Zap className="w-3.5 h-3.5 text-violet-600" />
                    </div>
                    <p className="text-lg font-extrabold text-slate-900 leading-tight">
                      {member.stats.avgArticlesPerWeek}
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium block">arts / week</span>
                  </div>
                </div>

                {/* Recent Articles Activity */}
                <div className="p-5 flex-1 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#6D8196]" />
                      Recent Completed Work ({member.recentArticles.length})
                    </h4>
                  </div>

                  {member.recentArticles.length === 0 ? (
                    <div className="py-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                      <p className="text-xs text-slate-400 italic">No completed articles yet</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {member.recentArticles.map((article) => (
                        <div
                          key={article.id}
                          onClick={() => router.push(`/articles/${article.id}`)}
                          className="group/item flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-all cursor-pointer border border-transparent hover:border-slate-200/80"
                        >
                          <div className="min-w-0 pr-3">
                            <p className="text-xs font-bold text-slate-800 group-hover/item:text-indigo-600 truncate transition-colors">
                              {article.productName}
                            </p>
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{new Date(article.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {article.writingTimeMin && (
                              <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/60 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {formatWritingTime(article.writingTimeMin)}
                              </span>
                            )}
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover/item:text-indigo-600 group-hover/item:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>
                    Joined {new Date(member.createdAt).toLocaleDateString([], { month: 'short', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => router.push(`/articles?search=${encodeURIComponent(member.name)}`)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#6D8196] hover:text-[#3D4F61] transition cursor-pointer"
                  >
                    <span>View All Articles</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ─── LIST / TABLE VIEW ─── */
        <div className="bg-white rounded-2xl border border-[#CBCBCB]/70 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-[#FAF9F5] border-b border-slate-200/80">
                <tr>
                  <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Team Member
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Current Activity
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Total Articles
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Avg Speed
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Velocity (Day / Wk)
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Joined Date
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredAndSortedMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(
                            member.name
                          )} text-white flex items-center justify-center text-xs font-extrabold shadow-2xs shrink-0`}
                        >
                          {getInitials(member.name)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{member.name}</div>
                          <div className="text-[11px] text-slate-400 font-medium">{member.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {member.activeArticle ? (
                        <span
                          onClick={() => router.push(`/articles/${member.activeArticle?.id}`)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="truncate max-w-[140px]">{member.activeArticle.productName}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          <span>Available</span>
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200/60">
                        {member.stats.totalArticles}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/60">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatWritingTime(member.stats.avgWritingTimeMin)}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-center text-xs text-slate-600 font-semibold">
                      <span>{member.stats.avgArticlesPerDay} / day</span>
                      <span className="text-slate-300 mx-1.5">·</span>
                      <span className="text-slate-500">{member.stats.avgArticlesPerWeek} / wk</span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">
                      {new Date(member.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => router.push(`/articles?search=${encodeURIComponent(member.name)}`)}
                        className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                        title="View member articles"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
