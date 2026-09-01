/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import moment from "moment";
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
  Sparkles,
  ArrowRight,
  Search,
} from "lucide-react";
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
}

interface CalendarDay {
  date: string;
  dayNumber: number;
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
    id: number;
    name: string;
    email: string;
    role: string | null;
    image?: string | null;
  };
  currentMonth: string;
  monthLabel: string;
  selectableUsers: Array<{
    id: number;
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

  const [selectedMonth, setSelectedMonth] = useState(
    searchParams.get("month") || moment().format("YYYY-MM")
  );
  const [selectedUserId, setSelectedUserId] = useState<number | null>(
    searchParams.get("userId") ? parseInt(searchParams.get("userId")!) : null
  );

  const [inspectingDay, setInspectingDay] = useState<CalendarDay | null>(null);
  const isWriter = session?.user?.role === "WRITER";

  // Synchronize when query params change or month changes
  useEffect(() => {
    if (!session?.user?.id) return;

    const uId = selectedUserId || session.user.id;
    setLoading(true);
    setError("");

    const url = `/api/calendar?userId=${uId}&month=${selectedMonth}`;
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
  }, [session?.user?.id, selectedMonth, selectedUserId]);

  const handlePrevMonth = () => {
    const prev = moment(selectedMonth, "YYYY-MM").subtract(1, "month").format("YYYY-MM");
    setSelectedMonth(prev);
  };

  const handleNextMonth = () => {
    const next = moment(selectedMonth, "YYYY-MM").add(1, "month").format("YYYY-MM");
    setSelectedMonth(next);
  };

  const handleTodayMonth = () => {
    setSelectedMonth(moment().format("YYYY-MM"));
  };

  const formatWritingTime = (mins: number) => {
    if (!mins) return "0m";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // Calendar grid padding days (first day of month offset)
  const paddingDays = useMemo(() => {
    if (!data || data.days.length === 0) return [];
    const firstDayOfWeek = data.days[0].dayOfWeek; // 0 is Sunday
    return Array.from({ length: firstDayOfWeek });
  }, [data]);

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
                  const idNum = parseInt(val);
                  setSelectedUserId(idNum);
                  router.push(`/calendar?userId=${idNum}&month=${selectedMonth}`);
                }}
                options={userOptions}
                placeholder="Select User"
                className="min-w-[200px]"
              />
            </div>
          )}

          {data?.targetUser && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span className="text-xs font-semibold text-slate-700">{data.targetUser.name}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLE_BADGES[data.targetUser.role || ""] || "bg-slate-100 text-slate-600"}`}>
                {data.targetUser.role?.replace("_", " ") || "Member"}
              </span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Summary Cards ── */}
      {data && (
        <div className={`grid grid-cols-2 sm:grid-cols-3 ${isWriter ? "lg:grid-cols-4" : "lg:grid-cols-5"} gap-3.5`}>
          {/* Card 1: Working Days */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-sm transition space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Working Days</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs ring-4 ring-emerald-100" />
            </div>
            <p className="text-2xl font-extrabold text-emerald-600 tracking-tight">
              {data.summary.totalWorkingDays}
            </p>
            <p className="text-[11px] font-medium text-slate-400">Recorded productivity</p>
          </div>

          {/* Card 2: Non-Working / Inactive Days */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-sm transition space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Inactive Days</span>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs ring-4 ring-rose-100" />
            </div>
            <p className="text-2xl font-extrabold text-rose-600 tracking-tight">
              {data.summary.totalNonWorkingDays}
            </p>
            <p className="text-[11px] font-medium text-slate-400">Past days with 0 activities</p>
          </div>

          {/* Card 3: Articles Completed */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-sm transition space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Completed Articles</span>
              <FileText className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {data.summary.totalArticlesCompleted}
            </p>
            <p className="text-[11px] font-medium text-slate-400">Drafted & finalized</p>
          </div>

          {/* Card 4: Links Actioned */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-sm transition space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Links Actioned</span>
              <Link2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {data.summary.totalLinksActioned}
            </p>
            <p className="text-[11px] font-medium text-slate-400">Logged or modified</p>
          </div>

          {/* Card 5: Writing Time — Hidden from writers */}
          {!isWriter && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-sm transition space-y-1 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Writing Time</span>
                <Clock className="w-4 h-4 text-[#6D8196]" />
              </div>
              <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {formatWritingTime(data.summary.totalWritingTimeMin)}
              </p>
              <p className="text-[11px] font-medium text-slate-400">Total hours spent</p>
            </div>
          )}
        </div>
      )}

      {/* ── Main Calendar Container ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Calendar Controls Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">{data?.monthLabel}</h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Worked Day
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/60 font-bold text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Non-Working Day
              </span>
            </div>
          </div>

          {/* Month Steppers */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTodayMonth}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Current Month
            </button>
            <div className="flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <button
                onClick={handlePrevMonth}
                className="p-2 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs font-mono font-bold text-slate-700">{selectedMonth}</span>
              <button
                onClick={handleNextMonth}
                className="p-2 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Weekday Labels Header ── */}
        <div className="grid grid-cols-7 border-b border-slate-100 text-center text-xs font-bold text-slate-400 bg-slate-50/50 py-2.5">
          <div>SUN</div>
          <div>MON</div>
          <div>TUE</div>
          <div>WED</div>
          <div>THU</div>
          <div>FRI</div>
          <div>SAT</div>
        </div>

        {/* ── Calendar Days Grid ── */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100">
          {/* Padding empty cells for previous month remainder */}
          {paddingDays.map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[105px] sm:min-h-[120px] bg-slate-50/40 opacity-40 p-2 select-none" />
          ))}

          {/* Actual days of month */}
          {data?.days.map((day) => {
            const hasActivities = day.activities.length > 0;
            const isWork = day.isWorkingDay;
            const isPast = day.isPast || day.isToday;

            return (
              <div
                key={day.date}
                onClick={() => setInspectingDay(day)}
                className={`min-h-[105px] sm:min-h-[120px] p-2 sm:p-2.5 transition-all duration-150 relative flex flex-col justify-between cursor-pointer group ${
                  day.isToday ? "bg-indigo-50/30" : "bg-white hover:bg-slate-50/80"
                }`}
              >
                {/* Day Header Row */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold rounded-lg px-2 py-0.5 transition ${
                      day.isToday
                        ? "bg-[#6D8196] text-white shadow-xs"
                        : "text-slate-700 group-hover:text-slate-900"
                    }`}
                  >
                    {day.dayNumber}
                  </span>

                  {/* 🟢 Green Dot / 🔴 Red Dot Status Indicator */}
                  <div className="flex items-center gap-1">
                    {isPast ? (
                      isWork ? (
                        <div
                          className="flex items-center gap-1"
                          title={`${day.activityCount} work activities recorded`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 animate-pulse" />
                        </div>
                      ) : (
                        <div className="flex items-center" title="No work activity recorded">
                          <span className="w-2 h-2 rounded-full bg-rose-500/80 ring-2 ring-rose-100" />
                        </div>
                      )
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-200" title="Future date" />
                    )}
                  </div>
                </div>

                {/* Day Activity Preview Badges */}
                <div className="my-1.5 space-y-1 overflow-hidden">
                  {hasActivities ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 truncate">
                          ✓ {day.activityCount} action{day.activityCount > 1 ? "s" : ""}
                        </span>
                      </div>
                      {/* Short list of first 1-2 items */}
                      <p className="text-[10px] text-slate-500 font-medium truncate">
                        {day.activities[0].title}
                      </p>
                      {day.activities.length > 1 && (
                        <p className="text-[9px] text-slate-400 font-semibold truncate">
                          +{day.activities.length - 1} more
                        </p>
                      )}
                    </>
                  ) : isPast ? (
                    <p className="text-[10px] text-rose-400 font-medium italic opacity-75">No activity</p>
                  ) : null}
                </div>

                {/* Bottom Card Footer */}
                <div className="text-[10px] text-slate-400 font-semibold opacity-0 group-hover:opacity-100 transition flex items-center justify-end">
                  <span className="text-[#6D8196] font-bold flex items-center gap-0.5">
                    Inspect <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Day Detail Work History Modal ── */}
      {inspectingDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col border border-slate-100 overflow-hidden animate-scaleIn">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#FAF9F5] border-b border-slate-200/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#6D8196] shadow-2xs font-bold font-mono">
                  {inspectingDay.dayNumber}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {moment(inspectingDay.date).format("dddd, MMMM D, YYYY")}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {inspectingDay.isWorkingDay ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active Working Day ({inspectingDay.activityCount} Activities)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Inactive / No Work Recorded
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setInspectingDay(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Timeline Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {inspectingDay.activities.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                    <CalendarIcon className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700">No Activity Logged</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    There are no articles written, links added, or updates recorded for {data?.targetUser.name} on this date.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Work Activity Timeline ({inspectingDay.activities.length})
                  </p>

                  <div className="space-y-2.5">
                    {inspectingDay.activities.map((item) => {
                      const meta = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.ARTICLE;
                      const IconComponent = meta.icon;

                      return (
                        <div
                          key={item.id}
                          className="p-4 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 transition shadow-2xs space-y-2"
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
                                <h4 className="text-sm font-bold text-slate-900 mt-1">{item.title}</h4>
                              </div>
                            </div>

                            <span className="text-[11px] font-mono font-semibold text-slate-400 whitespace-nowrap">
                              {item.time}
                            </span>
                          </div>

                          {/* Subtitle & Details */}
                          <div className="pl-8 space-y-1">
                            <p className="text-xs text-slate-600 font-medium">{item.subtitle}</p>
                            {item.details && (
                              <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 font-sans">
                                {item.details}
                              </p>
                            )}

                            {/* Extra Info: duration or link */}
                            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
                              {!isWriter && item.durationMin && item.durationMin > 0 && (
                                <span className="flex items-center gap-1 font-semibold text-slate-500">
                                  <Clock className="w-3 h-3 text-[#6D8196]" /> Time: {formatWritingTime(item.durationMin)}
                                </span>
                              )}
                              {item.status && (
                                <span className="font-bold text-indigo-600">
                                  Status: {item.status}
                                </span>
                              )}
                              {item.link && (
                                <a
                                  href={item.link.startsWith("http") ? item.link : `https://${item.link}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 font-semibold text-[#6D8196] hover:underline"
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
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
              <span>{data?.targetUser.name} &bull; {data?.targetUser.role?.replace("_", " ")}</span>
              <button
                onClick={() => setInspectingDay(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition cursor-pointer"
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

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAF9F5]">
          <LoadingScreen message="Loading Work History Calendar..." size="md" />
        </div>
      }
    >
      <CalendarContent />
    </Suspense>
  );
}
