/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  formatDualLongDate,
  getCurrentBsMonthKey,
  getCurrentNptAdMonthKey,
  shiftBsMonthKey,
} from "@/lib/bs-date";

function shiftYearMonth(ym: string, deltaMonths: number): string {
  const [yStr, mStr] = ym.split("-");
  const d = new Date(Date.UTC(Number(yStr), Number(mStr) - 1 + deltaMonths, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Link2,
  Package,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  User as UserIcon,
  Activity,
  Layers,
  Search,
} from "lucide-react";
import { Calendar as BentoCalendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import CustomSelect from "@/components/CustomSelect";
import LoadingScreen from "@/components/LoadingScreen";

interface ActivityItem {
  id: string;
  time: string;
  category: "ARTICLE" | "LINK" | "PRODUCT" | "REVIEW";
  badge: string;
  title: string;
  subtitle: string;
  details?: string | null;
  status?: string | null;
  link?: string | null;
  durationMin?: number | null;
  rawTimestamp?: string;
}

interface CalendarDay {
  date: string;
  dayNumber: number;
  adShortLabel?: string;
  bsDate?: string;
  bsDay?: number;
  bsMonth?: number;
  bsMonthName?: string;
  bsYear?: number;
  dayOfWeek: number;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  isWorkingDay: boolean;
  activityCount: number;
  activities: ActivityItem[];
}

interface CalendarResponse {
  targetUser: {
    id: string;
    name: string;
    email: string;
    role: string | null;
    image?: string | null;
  };
  calendarMode?: "BS" | "AD";
  currentMonth: string;
  monthLabel: string;
  secondaryMonthLabel?: string;
  selectableUsers: Array<{
    id: string;
    name: string;
    email: string;
    role: string | null;
  }>;
  summary: {
    totalWorkingDays: number;
    totalNonWorkingDays: number;
    totalArticlesCompleted: number;
    totalLinksActioned: number;
    totalWritingTimeMin: number;
  };
  days: CalendarDay[];
}

const ROLE_BADGES: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-800 border-purple-200",
  ADMIN: "bg-blue-100 text-blue-800 border-blue-200",
  TEAM_LEAD: "bg-indigo-100 text-indigo-800 border-indigo-200",
  LINKER: "bg-emerald-100 text-emerald-800 border-emerald-200",
  WRITER: "bg-amber-100 text-amber-800 border-amber-200",
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; icon: any }> = {
  ARTICLE: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: FileText },
  LINK: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: Link2 },
  PRODUCT: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", icon: Package },
  REVIEW: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: CheckCircle2 },
};

function CalendarContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [error, setError] = useState("");

  const initialAdMonth = searchParams.get("month");
  const initialBsMonth = searchParams.get("bsMonth");

  const [calendarMode, setCalendarMode] = useState<"BS" | "AD">(
    initialAdMonth && !initialBsMonth ? "AD" : "BS"
  );
  const [selectedBsMonth, setSelectedBsMonth] = useState(
    initialBsMonth || getCurrentBsMonthKey()
  );
  const [selectedAdMonth, setSelectedAdMonth] = useState(
    initialAdMonth || getCurrentNptAdMonthKey()
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    searchParams.get("userId") || null
  );

  const [inspectingDay, setInspectingDay] = useState<CalendarDay | null>(null);
  const isWriter = session?.user?.role === "WRITER";

  // Deduplicate activities in modal if any review event generated both ARTICLE and REVIEW entries
  const sanitizedActivities = useMemo(() => {
    if (!inspectingDay?.activities) return [];
    const reviews = inspectingDay.activities.filter((a) => a.category === "REVIEW");
    return inspectingDay.activities.filter((a) => {
      if (a.category === "ARTICLE" && (a.status === "REDO" || a.status === "APPROVED" || a.badge === "Revision Required")) {
        const hasMatchingReview = reviews.some((rev) => {
          if (rev.title !== a.title) return false;
          const timeMatch = rev.time === a.time;
          const rawTimeDiff =
            rev.rawTimestamp && a.rawTimestamp
              ? Math.abs(new Date(rev.rawTimestamp).getTime() - new Date(a.rawTimestamp).getTime()) < 5 * 60 * 1000
              : false;
          const detailsMatch =
            rev.details && a.details && (a.details.includes(rev.details) || rev.details.includes(a.details));
          return (timeMatch || rawTimeDiff) && (Boolean(detailsMatch) || rev.status === a.status);
        });
        if (hasMatchingReview) return false;
      }
      return true;
    });
  }, [inspectingDay?.activities]);

  // Synchronize when query params change or month changes
  useEffect(() => {
    if (!session?.user?.id) return;

    const uId = selectedUserId || session.user.id;
    setLoading(true);
    setError("");

    const monthQuery =
      calendarMode === "BS"
        ? `bsMonth=${selectedBsMonth}`
        : `month=${selectedAdMonth}`;
    const url = `/api/calendar?userId=${uId}&${monthQuery}`;
    fetch(url)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) {
          setError(res.error);
          setData(null);
        } else {
          setData(res);
          if (!selectedUserId) {
            setSelectedUserId(res.targetUser.id);
          }
        }
      })
      .catch(() => setError("Failed to fetch calendar activity data"))
      .finally(() => setLoading(false));
  }, [session?.user?.id, calendarMode, selectedBsMonth, selectedAdMonth, selectedUserId]);

  const activeMonthKey = calendarMode === "BS" ? selectedBsMonth : selectedAdMonth;

  const handlePrevMonth = () => {
    if (calendarMode === "BS") {
      setSelectedBsMonth(shiftBsMonthKey(selectedBsMonth, -1));
    } else {
      setSelectedAdMonth(shiftYearMonth(selectedAdMonth, -1));
    }
  };

  const handleNextMonth = () => {
    if (calendarMode === "BS") {
      setSelectedBsMonth(shiftBsMonthKey(selectedBsMonth, 1));
    } else {
      setSelectedAdMonth(shiftYearMonth(selectedAdMonth, 1));
    }
  };

  const handleTodayMonth = () => {
    if (calendarMode === "BS") {
      setSelectedBsMonth(getCurrentBsMonthKey());
    } else {
      setSelectedAdMonth(getCurrentNptAdMonthKey());
    }
  };

  const formatWritingTime = (mins: number) => {
    if (!mins) return "0m";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const sanitizeDetailText = (text?: string | null) => {
    if (!text) return null;
    if (data?.targetUser?.role === "ADMIN" || data?.targetUser?.role === "SUPER_ADMIN") {
      const roleTitle = data.targetUser.role === "SUPER_ADMIN" ? "Super Admin" : "Admin";
      let result = text;
      if (data.targetUser.name) {
        const escaped = data.targetUser.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        result = result.replace(new RegExp(`Team Lead\\s+${escaped}`, "gi"), `${roleTitle} ${data.targetUser.name}`);
      }
      result = result.replace(/\bFlagged for update by Team Lead\b/gi, `Flagged for update by ${roleTitle}`);
      result = result.replace(/\bUpdate request (approved|rejected) by Team Lead\b/gi, `Update request $1 by ${roleTitle}`);
      result = result.replace(/\bby Team Lead\b/gi, `by ${roleTitle}`);
      return result;
    }
    return text;
  };

  const userOptions = useMemo(() => {
    if (!data?.selectableUsers) return [];
    return data.selectableUsers.map((u) => ({
      value: String(u.id),
      label: `${u.name} (${u.role?.replace("_", " ") || "No Role"})`,
    }));
  }, [data?.selectableUsers]);

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAF9F5]">
        <LoadingScreen
          message="Loading Work History Calendar..."
          subtext="Fetching activity timelines and calculating working days"
          size="md"
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] text-[#4A4A4A] space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#6D8196] flex items-center justify-center text-white shadow-xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#4A4A4A] tracking-tight">Work History Calendar</h1>
              <p className="text-xs text-[#737373] font-medium mt-0.5">
                Track daily working attendance, article throughput, and link operations
              </p>
            </div>
          </div>
        </div>

        {/* User Selector Dropdown & Role Scope */}
        <div className="flex flex-wrap items-center gap-3">
          {data && data.selectableUsers.length > 1 && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              <UserIcon className="w-4 h-4 text-[#6D8196]" />
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Viewing:</span>
              <CustomSelect
                value={String(selectedUserId || data.targetUser.id)}
                onChange={(val) => {
                  const nextUserId = String(val).trim();
                  setSelectedUserId(nextUserId || null);
                  const mq = calendarMode === "BS" ? `bsMonth=${selectedBsMonth}` : `month=${selectedAdMonth}`;
                  router.push(`/calendar?userId=${encodeURIComponent(nextUserId)}&${mq}`);
                }}
                options={userOptions}
                placeholder="Select User"
                className="min-w-[200px]"
              />
            </div>
          )}

          {data?.targetUser && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{data.targetUser.name}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLE_BADGES[data.targetUser.role || ""] || "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>
                {data.targetUser.role?.replace("_", " ") || "Member"}
              </span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Summary Cards ── */}
      {data && (
        <div className={`grid grid-cols-2 sm:grid-cols-3 ${isWriter ? "lg:grid-cols-4" : "lg:grid-cols-5"} gap-3.5`}>
          {/* Card 1: Working Days */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-sm transition space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>Working Days</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs ring-4 ring-emerald-100 dark:ring-emerald-950/60" />
            </div>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {data.summary.totalWorkingDays}
            </p>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Recorded productivity</p>
          </div>

          {/* Card 2: Non-Working / Inactive Days */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-sm transition space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>Inactive Days</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs ring-4 ring-amber-100 dark:ring-amber-950/60" />
            </div>
            <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
              {data.summary.totalNonWorkingDays}
            </p>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Excluding Saturday holiday</p>
          </div>

          {/* Card 3: Articles Completed */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-sm transition space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>Completed Articles</span>
              <FileText className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {data.summary.totalArticlesCompleted}
            </p>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Drafted & finalized</p>
          </div>

          {/* Card 4: Links Actioned */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-sm transition space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>Links Actioned</span>
              <Link2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {data.summary.totalLinksActioned}
            </p>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Logged or modified</p>
          </div>

          {/* Card 5: Writing Time - Hidden from writers */}
          {!isWriter && (
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-sm transition space-y-1 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                <span>Writing Time</span>
                <Clock className="w-4 h-4 text-[#6D8196] dark:text-sky-400" />
              </div>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {formatWritingTime(data.summary.totalWritingTimeMin)}
              </p>
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Total hours spent</p>
            </div>
          )}
        </div>
      )}

      {/* ── Main Bento Calendar Container ── */}
      <BentoCalendar
        days={data?.days || []}
        monthLabel={data?.monthLabel}
        secondaryMonthLabel={data?.secondaryMonthLabel}
        onSelectDay={(day) => setInspectingDay(day)}
        headerRight={
          <div className="flex flex-wrap items-center gap-2">
            {/* BS / AD Month Boundary Toggle */}
            <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-zinc-700 bg-[#FAF9F5] dark:bg-zinc-900 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setCalendarMode("BS")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  calendarMode === "BS"
                    ? "bg-[#6D8196] text-white shadow-2xs"
                    : "text-slate-500 dark:text-zinc-400 hover:text-[#4A4A4A] dark:hover:text-zinc-200"
                }`}
                title="Browse by Bikram Sambat (BS) months"
              >
                BS
              </button>
              <button
                type="button"
                onClick={() => setCalendarMode("AD")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  calendarMode === "AD"
                    ? "bg-[#6D8196] text-white shadow-2xs"
                    : "text-slate-500 dark:text-zinc-400 hover:text-[#4A4A4A] dark:hover:text-zinc-200"
                }`}
                title="Browse by Gregorian (AD) months"
              >
                AD
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTodayMonth}
              className="rounded-xl border-slate-200 dark:border-zinc-700 text-xs font-bold text-[#4A4A4A] dark:text-zinc-200 hover:border-[#6D8196] hover:text-[#6D8196] cursor-pointer"
            >
              Current Month
            </Button>
            <div className="flex items-center rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-2 hover:bg-[#FAF9F5] dark:hover:bg-zinc-800 text-[#6D8196] dark:text-zinc-300 transition cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2.5 text-xs font-mono font-bold text-[#4A4A4A] dark:text-zinc-200">
                {activeMonthKey}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-2 hover:bg-[#FAF9F5] dark:hover:bg-zinc-800 text-[#6D8196] dark:text-zinc-300 transition cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        }
      />

      {/* ── Day Detail Work History Modal ── */}
      {inspectingDay && (() => {
        const dualDate = formatDualLongDate(inspectingDay.date);
        const isSaturday = inspectingDay.dayOfWeek === 6;
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col border border-slate-100 dark:border-slate-800 overflow-hidden animate-scaleIn">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#FAF9F5] dark:bg-slate-850 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center shadow-2xs ${
                    isSaturday
                      ? "bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-[#6D8196] dark:text-sky-400"
                  }`}
                >
                  <span className="text-lg font-extrabold leading-none">{dualDate.dual.bsDay}</span>
                  <span
                    className={`text-[9px] font-semibold mt-0.5 leading-none ${
                      isSaturday
                        ? "text-red-500/80 dark:text-red-400/80"
                        : "text-slate-400 dark:text-zinc-400"
                    }`}
                  >
                    {dualDate.dual.adShortLabel}
                  </span>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                    {dualDate.bsLong}
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    {dualDate.adLong}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {isSaturday && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Saturday • Holiday
                      </span>
                    )}
                    {inspectingDay.isWorkingDay ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active Working Day ({sanitizedActivities.length} {sanitizedActivities.length === 1 ? "Activity" : "Activities"})
                      </span>
                    ) : !isSaturday ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Inactive / No Work Recorded
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setInspectingDay(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Timeline Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {sanitizedActivities.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${
                      isSaturday
                        ? "bg-red-50 dark:bg-red-950/50 text-red-500"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    }`}
                  >
                    <CalendarIcon className="w-6 h-6" />
                  </div>
                  <h4
                    className={`text-sm font-bold ${
                      isSaturday
                        ? "text-red-600 dark:text-red-400"
                        : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {isSaturday ? "Saturday — Holiday" : "No Activity Logged"}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {isSaturday
                      ? `Saturday is a scheduled holiday. No work activities recorded for ${data?.targetUser.name}.`
                      : `There are no articles written, links added, or updates recorded for ${data?.targetUser.name} on this date.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Work Activity Timeline ({sanitizedActivities.length})
                    </p>
                    <span className="text-[10px] font-bold text-[#6D8196] dark:text-sky-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700">
                      NPT (UTC+5:45)
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {sanitizedActivities.map((item) => {
                      const meta = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.ARTICLE;
                      const IconComponent = meta.icon;

                      return (
                        <div
                          key={item.id}
                          className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700 transition shadow-2xs space-y-2"
                        >
                          {/* Item Top Row */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`p-1.5 rounded-lg ${meta.bg} ${meta.text} border ${meta.border}`}>
                                <IconComponent className="w-4 h-4" />
                              </span>
                              <div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.text} ${meta.border}`}>
                                  {item.badge}
                                </span>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">{item.title}</h4>
                              </div>
                            </div>

                            <span
                              className="text-[11px] font-mono font-semibold text-slate-400 whitespace-nowrap"
                              title="Nepal Time (NPT)"
                            >
                              {item.rawTimestamp
                                ? new Date(item.rawTimestamp).toLocaleTimeString("en-US", {
                                  timeZone: "Asia/Kathmandu",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                })
                                : item.time}
                            </span>
                          </div>

                          {/* Subtitle & Details */}
                          <div className="pl-8 space-y-1">
                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{item.subtitle}</p>
                            {item.details && !item.details.toLowerCase().includes("writing timer initiated") && (
                              <p className="text-xs text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/90 p-2 rounded-lg border border-slate-100 dark:border-slate-800 font-sans">
                                {sanitizeDetailText(item.details)}
                              </p>
                            )}

                            {/* Extra Info: duration or link */}
                            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
                              {!isWriter && item.durationMin && item.durationMin > 0 && (
                                <span className="flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
                                  <Clock className="w-3 h-3 text-[#6D8196] dark:text-sky-400" /> Time: {formatWritingTime(item.durationMin)}
                                </span>
                              )}
                              {item.status && (
                                <span className="font-bold text-[#6D8196] dark:text-slate-300">
                                  Status: {item.status}
                                </span>
                              )}
                              {item.link && (
                                <a
                                  href={item.link.startsWith("http") ? item.link : `https://${item.link}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 font-semibold text-[#6D8196] dark:text-sky-400 hover:underline"
                                >
                                  View Item <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{data?.targetUser.name} &bull; {data?.targetUser.role?.replace("_", " ")}</span>
              <button
                onClick={() => setInspectingDay(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white dark:border dark:border-slate-700 font-bold shadow-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
      {/* ── Modal closing wrapper ── */}
          </div>
        </div>
        );
      })()}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAF9F5] dark:bg-slate-950">
          <LoadingScreen message="Loading Work History Calendar..." size="md" />
        </div>
      }
    >
      <CalendarContent />
    </Suspense>
  );
}
