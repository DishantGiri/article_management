"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  adYmdToDual,
  getBsMonthDetails,
  getCurrentBsMonthKey,
  getCurrentNptYmd,
} from "@/lib/bs-date";

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export interface CalendarActivityPreview {
  id: string;
  title: string;
}

export interface CalendarGridDay {
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
  activities: CalendarActivityPreview[];
}

export interface BentoCardProps {
  children: React.ReactNode;
  height?: string;
  className?: string;
  showHoverGradient?: boolean;
  hideOverflow?: boolean;
  linkTo?: string;
}

/**
 * Reusable Bento-style surface card styled with the app's slate-steel (#6D8196) theme.
 */
export function BentoCard({
  children,
  height = "h-auto",
  className = "",
  showHoverGradient = true,
  hideOverflow = true,
  linkTo,
}: BentoCardProps) {
  const cardContent = (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-[#121214] p-5 sm:p-6 transition-colors duration-200 hover:border-[#6D8196]/50 dark:hover:border-[#6D8196]/50 shadow-2xs",
        hideOverflow && "overflow-hidden",
        height,
        className
      )}
    >
      {linkTo && (
        <div className="absolute bottom-4 right-6 z-40 flex h-11 w-11 rotate-6 items-center justify-center rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-sm opacity-0 transition-all duration-300 ease-in-out group-hover:-translate-y-2 group-hover:rotate-0 group-hover:opacity-100">
          <ArrowUpRight className="h-5 w-5 text-[#6D8196]" />
        </div>
      )}
      {showHoverGradient && (
        <div className="pointer-events-none select-none absolute inset-0 z-10 bg-gradient-to-tl from-[#6D8196]/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100" />
      )}
      <div className="relative z-20">{children}</div>
    </div>
  );

  if (linkTo) {
    return linkTo.startsWith("/") ? (
      <Link href={linkTo} className="block">
        {cardContent}
      </Link>
    ) : (
      <a
        href={linkTo}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {cardContent}
      </a>
    );
  }

  return cardContent;
}

interface CompactCalendarDayProps {
  bsDay?: number;
  adDay?: number;
  label?: string;
  isHeader?: boolean;
  isActive?: boolean;
  isToday?: boolean;
  isSaturday?: boolean;
}

function CompactCalendarDay({
  bsDay,
  adDay,
  label,
  isHeader,
  isActive,
  isToday,
  isSaturday,
}: CompactCalendarDayProps) {
  if (isHeader) {
    return (
      <div
        className={cn(
          "col-span-1 row-span-1 flex h-7 w-10 items-center justify-center",
          isSaturday
            ? "text-red-600 dark:text-red-400"
            : "text-slate-400 dark:text-zinc-500"
        )}
      >
        <span className="text-[11px] font-bold tracking-wider">{label}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "col-span-1 row-span-1 flex h-11 w-10 flex-col items-center justify-center rounded-xl transition-colors",
        isToday && isSaturday && "bg-red-600 text-white shadow-xs",
        isToday && !isSaturday && "bg-[#6D8196] text-white shadow-xs",
        !isToday &&
          isSaturday &&
          "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900/70",
        !isToday &&
          !isSaturday &&
          isActive &&
          "bg-[#6D8196]/15 text-[#4A5B6E] dark:bg-[#6D8196]/25 dark:text-slate-100 border border-[#6D8196]/30",
        !isToday &&
          !isSaturday &&
          !isActive &&
          "text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/70"
      )}
    >
      <span className="text-sm font-extrabold leading-none">{bsDay}</span>
      <span
        className={cn(
          "text-[9px] font-semibold leading-none mt-1",
          isToday
            ? "text-white/85"
            : isSaturday
              ? "text-red-500/80 dark:text-red-400/80"
              : "text-slate-400 dark:text-zinc-500"
        )}
      >
        {adDay}
      </span>
    </div>
  );
}

export interface CalendarProps<TDay extends CalendarGridDay = CalendarGridDay> {
  /** Full work-history days array. When omitted, renders a compact current-month preview card. */
  days?: TDay[];
  monthLabel?: string;
  secondaryMonthLabel?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  onSelectDay?: (day: TDay) => void;
  title?: string;
  description?: string;
  actionLabel?: string;
  linkTo?: string;
  className?: string;
}

/**
 * Framed Bento Calendar component using the app's slate-steel (#6D8196) & warm-stone (#FAF9F5) palette.
 * Displays Bikram Sambat (BS) prominently in big text and Gregorian (AD) in small text, both in English.
 */
export function Calendar<TDay extends CalendarGridDay = CalendarGridDay>({
  days,
  monthLabel,
  secondaryMonthLabel,
  subtitle,
  headerRight,
  onSelectDay,
  title,
  description,
  actionLabel,
  linkTo,
  className,
}: CalendarProps<TDay>) {
  // Interactive Work History Grid Mode
  if (days) {
    const firstDayOfWeek = days.length > 0 ? days[0].dayOfWeek : 0;
    const paddingDays = Array.from({ length: firstDayOfWeek });

    return (
      <BentoCard
        showHoverGradient={false}
        hideOverflow={false}
        className={cn("p-4 sm:p-5", className)}
      >
        {/* Top Toolbar */}
        {(monthLabel || headerRight) && (
          <div className="pb-4 mb-4 border-b border-slate-100 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                {monthLabel && (
                  <h2 className="text-xl sm:text-2xl font-extrabold text-[#4A4A4A] dark:text-zinc-100 tracking-tight leading-tight">
                    {monthLabel} <span className="text-xs font-bold text-[#6D8196] uppercase tracking-wider ml-1">BS</span>
                  </h2>
                )}
                {secondaryMonthLabel && (
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-400 mt-0.5">
                    {secondaryMonthLabel} AD
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60 font-bold text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Worked Day
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/60 font-bold text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Non-Working Day
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/70 font-bold text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Saturday (Holiday)
                </span>
              </div>
            </div>
            {headerRight && <div className="flex flex-wrap items-center gap-2">{headerRight}</div>}
          </div>
        )}

        {/* Double-Framed Inset Calendar Shell */}
        <div className="rounded-[24px] border border-slate-200/90 dark:border-zinc-800 p-2 transition-colors duration-200 hover:border-[#6D8196]/50">
          <div
            className="rounded-2xl border-2 border-[#6D8196]/15 dark:border-zinc-800 bg-[#FAF9F5]/70 dark:bg-zinc-900/50 p-3 sm:p-4"
            style={{ boxShadow: "0px 2px 1.5px 0px rgba(109, 129, 150, 0.22) inset" }}
          >
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-2 pb-3 text-center text-[11px] font-bold tracking-wider text-slate-500 dark:text-zinc-400">
              {DAY_NAMES.map((d) => (
                <div
                  key={d}
                  className={cn(
                    "py-1",
                    d === "SAT" && "text-red-600 dark:text-red-400"
                  )}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day Tiles Grid */}
            <div className="grid grid-cols-7 auto-rows-fr gap-2 sm:gap-2.5">
              {paddingDays.map((_, i) => (
                <div
                  key={`pad-${i}`}
                  className="min-h-[112px] sm:min-h-[126px] rounded-xl border border-dashed border-slate-200/70 dark:border-zinc-800/70 bg-slate-50/40 dark:bg-zinc-900/30 opacity-50 select-none"
                />
              ))}

              {days.map((day) => {
                const hasActivities = day.activities.length > 0;
                const isWork = day.isWorkingDay;
                const isPast = day.isPast || day.isToday;
                const isSaturday = day.dayOfWeek === 6;
                const bsDisplayDay = day.bsDay ?? day.dayNumber;
                const adDisplayLabel = day.adShortLabel ?? String(day.dayNumber);

                return (
                  <button
                    type="button"
                    key={day.date}
                    onClick={() => onSelectDay?.(day)}
                    className={cn(
                      "min-h-[112px] sm:min-h-[126px] p-2.5 rounded-xl border text-left transition-all duration-150 relative flex flex-col justify-between cursor-pointer group/day",
                      isSaturday
                        ? day.isToday
                          ? "bg-red-50 dark:bg-red-950/40 border-red-500 shadow-xs ring-1 ring-red-400/40"
                          : "bg-red-50/75 dark:bg-red-950/25 border-red-200/90 dark:border-red-900/60 hover:border-red-400 dark:hover:border-red-700 hover:bg-red-50 dark:hover:bg-red-950/35"
                        : day.isToday
                          ? "bg-[#6D8196]/10 dark:bg-[#6D8196]/20 border-[#6D8196] shadow-xs ring-1 ring-[#6D8196]/30"
                          : isPast && isWork
                            ? "bg-white dark:bg-zinc-900 border-slate-200/90 dark:border-zinc-800 hover:border-[#6D8196]/70 hover:shadow-xs"
                            : isPast && !isWork
                              ? "bg-white/80 dark:bg-zinc-900/70 border-slate-200/70 dark:border-zinc-800/80 hover:border-amber-300 dark:hover:border-amber-900/60"
                              : "bg-white/60 dark:bg-zinc-900/40 border-slate-200/60 dark:border-zinc-800/60 hover:border-[#6D8196]/50"
                    )}
                  >
                    {/* Day Header Row: Big BS Date + Small AD Date + Status Dot */}
                    <div className="flex items-start justify-between gap-1 w-full">
                      <div className="flex flex-col items-start min-w-0">
                        <div className="flex items-baseline gap-1">
                          <span
                            className={cn(
                              "text-lg sm:text-xl font-extrabold rounded-lg px-2 py-0.5 leading-none transition-colors",
                              isSaturday
                                ? day.isToday
                                  ? "bg-red-600 text-white shadow-2xs"
                                  : "text-red-600 dark:text-red-400 group-hover/day:text-red-700 dark:group-hover/day:text-red-300"
                                : day.isToday
                                  ? "bg-[#6D8196] text-white shadow-2xs"
                                  : "text-[#4A4A4A] group-hover/day:text-slate-950 dark:text-zinc-100 dark:group-hover/day:text-white"
                            )}
                          >
                            {bsDisplayDay}
                          </span>
                          {day.bsDay === 1 && day.bsMonthName && (
                            <span
                              className={cn(
                                "text-[9px] font-bold uppercase truncate",
                                isSaturday
                                  ? "text-red-500 dark:text-red-400"
                                  : "text-[#6D8196] dark:text-slate-300"
                              )}
                            >
                              {day.bsMonthName.slice(0, 3)}
                            </span>
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-1 mt-1 leading-none whitespace-nowrap",
                            isSaturday
                              ? "text-red-500/85 dark:text-red-400/85"
                              : "text-slate-400 dark:text-zinc-500"
                          )}
                        >
                          {adDisplayLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 pt-1 shrink-0">
                        {isSaturday ? (
                          <span
                            className="w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-red-200 dark:ring-red-900"
                            title="Saturday — Weekly Holiday"
                          />
                        ) : isPast ? (
                          isWork ? (
                            <span
                              className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900"
                              title={`${day.activityCount} work activities recorded`}
                            />
                          ) : (
                            <span
                              className="w-2 h-2 rounded-full bg-amber-500/80 ring-2 ring-amber-100 dark:ring-amber-950"
                              title="No work activity recorded"
                            />
                          )
                        ) : (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-700"
                            title="Upcoming date"
                          />
                        )}
                      </div>
                    </div>

                    {/* Day Activity Preview */}
                    <div className="my-1.5 space-y-1 overflow-hidden w-full">
                      {isSaturday && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 inline-flex items-center">
                            Holiday
                          </span>
                        </div>
                      )}
                      {hasActivities ? (
                        <>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#6D8196]/10 dark:bg-[#6D8196]/25 text-[#4A5B6E] dark:text-slate-200 border border-[#6D8196]/20 truncate inline-flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 shrink-0 text-[#6D8196]" />
                              {day.activityCount} action{day.activityCount > 1 ? "s" : ""}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-600 dark:text-zinc-400 font-medium truncate">
                            {day.activities[0].title}
                          </p>
                          {day.activities.length > 1 && (
                            <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-semibold truncate">
                              +{day.activities.length - 1} more
                            </p>
                          )}
                        </>
                      ) : !isSaturday && isPast ? (
                        <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-medium italic">
                          No activity
                        </p>
                      ) : null}
                    </div>

                    {/* Hover Footer */}
                    <div className="text-[10px] font-semibold opacity-0 group-hover/day:opacity-100 transition flex items-center justify-end w-full">
                      <span
                        className={cn(
                          "font-bold flex items-center gap-0.5",
                          isSaturday
                            ? "text-red-600 dark:text-red-400"
                            : "text-[#6D8196] dark:text-slate-300"
                        )}
                      >
                        Inspect <ArrowRight className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </BentoCard>
    );
  }

  // Standalone Compact Bento Preview Mode (BS big + AD small, English)
  const todayDual = adYmdToDual(getCurrentNptYmd());
  const bsMonthDetails = getBsMonthDetails(getCurrentBsMonthKey());
  const firstDayOfWeek = bsMonthDetails.days[0]?.dayOfWeek ?? 0;

  return (
    <BentoCard height="h-auto" linkTo={linkTo} className={className}>
      <div className="grid h-full gap-5">
        <div>
          <h2 className="mb-2 text-lg md:text-2xl font-bold text-[#4A4A4A] dark:text-zinc-100">
            {title || "Work History Calendar"}
          </h2>
          <p className="mb-2 text-xs md:text-sm text-slate-500 dark:text-zinc-400">
            {description || "Track daily working attendance, article throughput, and link operations."}
          </p>
          {actionLabel && (
            <Button
              size="sm"
              className="mt-2 rounded-xl bg-[#6D8196] hover:bg-[#5A6D81] text-white"
            >
              {actionLabel}
            </Button>
          )}
        </div>

        <div className="transition-all duration-500 ease-out">
          <div className="w-full max-w-[550px] rounded-[24px] border border-slate-200 dark:border-zinc-800 p-2 transition-colors duration-150 group-hover:border-[#6D8196]/60">
            <div
              className="h-full rounded-2xl border-2 border-[#6D8196]/15 dark:border-zinc-800 bg-[#FAF9F5]/70 dark:bg-zinc-900/50 p-3 sm:p-4"
              style={{ boxShadow: "0px 2px 1.5px 0px rgba(109, 129, 150, 0.22) inset" }}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-baseline gap-2">
                  <p className="text-base font-extrabold text-[#4A4A4A] dark:text-zinc-100">
                    {monthLabel || bsMonthDetails.bsLabel}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-400 dark:text-zinc-400">
                    {secondaryMonthLabel || bsMonthDetails.adRangeLabel}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#6D8196]" />
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {subtitle || "Daily activity"}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-2 px-1 sm:px-3">
                {DAY_NAMES.map((day) => (
                  <CompactCalendarDay
                    key={`header-${day}`}
                    label={day}
                    isHeader
                    isSaturday={day === "SAT"}
                  />
                ))}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div
                    key={`empty-start-${i}`}
                    className="col-span-1 row-span-1 h-11 w-10"
                  />
                ))}
                {bsMonthDetails.days.map((d) => {
                  const isToday = d.adYmd === todayDual.adYmd;
                  const isPastOrToday = d.adYmd <= todayDual.adYmd;
                  const isActive = isPastOrToday && d.bsDay % 3 !== 0;
                  return (
                    <CompactCalendarDay
                      key={d.bsDateStr}
                      bsDay={d.bsDay}
                      adDay={d.adDay}
                      isToday={isToday}
                      isActive={isActive}
                      isSaturday={d.dayOfWeek === 6}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </BentoCard>
  );
}
