"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

interface CustomDatePickerProps {
  value?: string; // single date "YYYY-MM-DD"
  onChange?: (dateStr: string) => void;
  startDate?: string; // range start "YYYY-MM-DD"
  endDate?: string; // range end "YYYY-MM-DD"
  onRangeChange?: (start: string, end: string) => void;
  selectRange?: boolean; // enable range selection (default true)
  placeholder?: string;
  className?: string;
  align?: "left" | "right";
  minDate?: string;
  maxDate?: string;
  disableFutureDates?: boolean;
}

export default function CustomDatePicker({
  value,
  onChange,
  startDate,
  endDate,
  onRangeChange,
  selectRange = true,
  placeholder = "Select Date Range",
  className = "",
  align = "left",
  minDate,
  maxDate,
  disableFutureDates = false,
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropdownAlign, setDropdownAlign] = useState<"left" | "right">(align);

  // Active range states
  const activeStart = startDate !== undefined ? startDate : value || "";
  const activeEnd = endDate !== undefined ? endDate : (selectRange ? "" : value || "");

  const [tempStart, setTempStart] = useState<string>(activeStart);
  const [tempEnd, setTempEnd] = useState<string>(activeEnd);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Keep internal state in sync with external props
  useEffect(() => {
    setTempStart(activeStart);
    setTempEnd(activeEnd);
  }, [activeStart, activeEnd]);

  // Dynamic boundary collision detection so the calendar never clips off the screen/card/modal
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const computeAlignment = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const popupWidth = 330;

      // Space between trigger left and window right
      const windowSpaceRight = window.innerWidth - rect.left;

      // Check nearest overflow/scroll container right edge
      let containerSpaceRight = window.innerWidth;
      let el = containerRef.current.parentElement;
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        if (
          style.overflow === "hidden" ||
          style.overflow === "auto" ||
          style.overflowX === "hidden" ||
          style.overflowX === "auto" ||
          style.overflowY === "auto"
        ) {
          const parentRect = el.getBoundingClientRect();
          containerSpaceRight = Math.min(containerSpaceRight, parentRect.right);
        }
        el = el.parentElement;
      }

      const availableRight = Math.min(windowSpaceRight, containerSpaceRight - rect.left);

      if (align === "right" || availableRight < popupWidth) {
        setDropdownAlign("right");
      } else {
        setDropdownAlign("left");
      }
    };

    computeAlignment();
    window.addEventListener("resize", computeAlignment);
    return () => window.removeEventListener("resize", computeAlignment);
  }, [isOpen, align]);

  useEffect(() => {
    setDropdownAlign(align);
  }, [align]);

  const getInitialDate = () => {
    const dStr = activeStart || activeEnd || value;
    if (dStr) {
      const parts = dStr.split("-").map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
    }
    return new Date();
  };

  const [viewDate, setViewDate] = useState<Date>(getInitialDate);

  useEffect(() => {
    const dStr = activeStart || value;
    if (dStr) {
      const parts = dStr.split("-").map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        setViewDate(new Date(parts[0], parts[1] - 1, parts[2]));
      }
    }
  }, [activeStart, value]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHoveredDate(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        setHoveredDate(null);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const todayStr = formatYMD(new Date());
  const effectiveMaxDate = maxDate || (disableFutureDates ? todayStr : undefined);

  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(year, month + 1, 1));
  };

  // Format single date for display
  const formatSingleDisplay = (dStr: string) => {
    if (!dStr) return "";
    const parts = dStr.split("-").map(Number);
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    return dStr;
  };

  // Trigger text display
  const getDisplayText = () => {
    if (selectRange) {
      if (tempStart && tempEnd) {
        if (tempStart === tempEnd) {
          return formatSingleDisplay(tempStart);
        }
        return `${formatSingleDisplay(tempStart)} – ${formatSingleDisplay(tempEnd)}`;
      } else if (tempStart) {
        return `${formatSingleDisplay(tempStart)} – Pick end`;
      }
      return placeholder;
    } else {
      if (tempStart) return formatSingleDisplay(tempStart);
      return placeholder;
    }
  };

  // Day selection click
  const handleSelectDay = (day: number) => {
    const mStr = String(month + 1).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");
    const clickedDateStr = `${year}-${mStr}-${dStr}`;

    if (effectiveMaxDate && clickedDateStr > effectiveMaxDate) return;
    if (minDate && clickedDateStr < minDate) return;

    if (!selectRange) {
      // Single selection mode
      setTempStart(clickedDateStr);
      setTempEnd(clickedDateStr);
      onChange?.(clickedDateStr);
      onRangeChange?.(clickedDateStr, clickedDateStr);
      setIsOpen(false);
      return;
    }

    // Range selection mode
    if (!tempStart || (tempStart && tempEnd)) {
      // New range start
      setTempStart(clickedDateStr);
      setTempEnd("");
      setHoveredDate(null);
    } else {
      // We have a start date and are picking end date
      if (clickedDateStr < tempStart) {
        // Clicked date is earlier than start date, so reset start
        setTempStart(clickedDateStr);
        setTempEnd("");
        setHoveredDate(null);
      } else {
        // Complete the range
        setTempEnd(clickedDateStr);
        setHoveredDate(null);
        onRangeChange?.(tempStart, clickedDateStr);
        onChange?.(tempStart);
        setTimeout(() => setIsOpen(false), 120);
      }
    }
  };

  // Preset Handlers
  const handlePreset = (preset: "TODAY" | "YESTERDAY" | "LAST_7" | "THIS_MONTH" | "LAST_MONTH" | "ALL") => {
    const now = new Date();
    if (preset === "ALL") {
      setTempStart("");
      setTempEnd("");
      onRangeChange?.("", "");
      onChange?.("");
    } else if (preset === "TODAY") {
      const today = formatYMD(now);
      setTempStart(today);
      setTempEnd(today);
      onRangeChange?.(today, today);
      onChange?.(today);
      setViewDate(now);
    } else if (preset === "YESTERDAY") {
      const yDate = new Date(now);
      yDate.setDate(yDate.getDate() - 1);
      const yStr = formatYMD(yDate);
      setTempStart(yStr);
      setTempEnd(yStr);
      onRangeChange?.(yStr, yStr);
      onChange?.(yStr);
      setViewDate(yDate);
    } else if (preset === "LAST_7") {
      const pDate = new Date(now);
      pDate.setDate(pDate.getDate() - 6);
      const pStr = formatYMD(pDate);
      const nowStr = formatYMD(now);
      setTempStart(pStr);
      setTempEnd(nowStr);
      onRangeChange?.(pStr, nowStr);
      onChange?.(pStr);
      setViewDate(now);
    } else if (preset === "THIS_MONTH") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const firstStr = formatYMD(first);
      const lastStr = formatYMD(last);
      setTempStart(firstStr);
      setTempEnd(lastStr);
      onRangeChange?.(firstStr, lastStr);
      onChange?.(firstStr);
      setViewDate(now);
    } else if (preset === "LAST_MONTH") {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      const firstStr = formatYMD(first);
      const lastStr = formatYMD(last);
      setTempStart(firstStr);
      setTempEnd(lastStr);
      onRangeChange?.(firstStr, lastStr);
      onChange?.(firstStr);
      setViewDate(first);
    }
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTempStart("");
    setTempEnd("");
    setHoveredDate(null);
    onRangeChange?.("", "");
    onChange?.("");
  };

  // Calendar calculations
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Grid elements
  const calendarCells = [];

  // Trailing days from previous month
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const prevDay = daysInPrevMonth - i;
    calendarCells.push(
      <div
        key={`prev-${prevDay}`}
        className="h-8 w-8 flex items-center justify-center text-xs text-slate-300 dark:text-slate-600 select-none pointer-events-none"
      >
        {prevDay}
      </div>
    );
  }

  // Days of current month
  for (let day = 1; day <= daysInMonth; day++) {
    const mStr = String(month + 1).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");
    const cellDateStr = `${year}-${mStr}-${dStr}`;

    const effectiveEnd = tempEnd || (tempStart && !tempEnd && hoveredDate && hoveredDate >= tempStart ? hoveredDate : "");

    const isStart = tempStart === cellDateStr;
    const isEnd = effectiveEnd === cellDateStr;
    const isSingle = isStart && isEnd;
    const isBetween =
      Boolean(tempStart && effectiveEnd && cellDateStr > tempStart && cellDateStr < effectiveEnd);

    const isToday = todayStr === cellDateStr;
    const isDisabled =
      Boolean(effectiveMaxDate && cellDateStr > effectiveMaxDate) ||
      Boolean(minDate && cellDateStr < minDate);

    calendarCells.push(
      <div
        key={`current-${day}`}
        className={`h-8 w-8 flex items-center justify-center relative ${
          isBetween ? "bg-indigo-50 dark:bg-indigo-950/60" : ""
        } ${
          isStart && effectiveEnd && !isSingle ? "rounded-l-full bg-indigo-50 dark:bg-indigo-950/60" : ""
        } ${
          isEnd && tempStart && !isSingle ? "rounded-r-full bg-indigo-50 dark:bg-indigo-950/60" : ""
        }`}
        onMouseEnter={() => {
          if (tempStart && !tempEnd && !isDisabled) {
            setHoveredDate(cellDateStr);
          }
        }}
      >
        <button
          type="button"
          disabled={isDisabled}
          onClick={(e) => {
            e.stopPropagation();
            handleSelectDay(day);
          }}
          className={`h-8 w-8 rounded-full text-xs font-semibold flex items-center justify-center transition-all cursor-pointer relative z-10 ${
            isDisabled
              ? "text-slate-300 dark:text-slate-700 opacity-40 cursor-not-allowed pointer-events-none"
              : isStart || isEnd
              ? "bg-[#6D8196] text-white shadow-xs font-bold scale-105"
              : isBetween
              ? "text-[#3D4F61] dark:text-sky-300 font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
              : isToday
              ? "border border-[#6D8196] text-[#6D8196] dark:text-sky-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          {day}
        </button>
      </div>
    );
  }

  // Leading days from next month
  const totalTargetCells = calendarCells.length <= 35 ? 35 : 42;
  const nextMonthCount = totalTargetCells - calendarCells.length;

  for (let day = 1; day <= nextMonthCount; day++) {
    calendarCells.push(
      <div
        key={`next-${day}`}
        className="h-8 w-8 flex items-center justify-center text-xs text-slate-300 dark:text-slate-600 select-none pointer-events-none"
      >
        {day}
      </div>
    );
  }

  const hasValue = Boolean(tempStart || tempEnd);

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 border border-slate-200 dark:border-slate-700 hover:border-[#6D8196] dark:hover:border-[#6D8196] bg-white dark:bg-slate-900 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs transition-all cursor-pointer select-none"
      >
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#6D8196] shrink-0" />
          <span className={hasValue ? "text-slate-900 dark:text-slate-100 font-bold" : "text-slate-400 font-normal"}>
            {getDisplayText()}
          </span>
        </div>

        {hasValue && (
          <span
            onClick={handleClear}
            className="p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            title="Clear date range"
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </button>

      {/* Custom Calendar Dropdown Popup */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1.5 ${
            dropdownAlign === "right" ? "right-0" : "left-0"
          } w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 animate-fadeIn select-none`}
        >
          {/* Quick Preset Buttons */}
          <div className="grid grid-cols-5 gap-1 mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => handlePreset("TODAY")}
              className="py-1 px-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#6D8196] hover:text-white transition text-center cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handlePreset("YESTERDAY")}
              className="py-1 px-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#6D8196] hover:text-white transition text-center cursor-pointer"
            >
              Y'day
            </button>
            <button
              type="button"
              onClick={() => handlePreset("LAST_7")}
              className="py-1 px-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#6D8196] hover:text-white transition text-center cursor-pointer"
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => handlePreset("THIS_MONTH")}
              className="py-1 px-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#6D8196] hover:text-white transition text-center cursor-pointer"
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => handlePreset("ALL")}
              className="py-1 px-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white transition text-center cursor-pointer"
            >
              All
            </button>
          </div>

          {/* Header: Month / Year Navigation */}
          <div className="flex items-center justify-between mb-3 px-1">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {monthNames[month]} <span className="text-[#6D8196] font-extrabold">{year}</span>
            </span>

            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
            <div>Su</div>
            <div>Mo</div>
            <div>Tu</div>
            <div>We</div>
            <div>Th</div>
            <div>Fr</div>
            <div>Sa</div>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-y-0.5 justify-items-center mb-3">
            {calendarCells}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={handleClear}
              className="px-2 py-1 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Clear
            </button>
            <div className="flex items-center gap-1.5">
              {tempStart && !tempEnd && (
                <button
                  type="button"
                  onClick={() => {
                    setTempEnd(tempStart);
                    onRangeChange?.(tempStart, tempStart);
                    onChange?.(tempStart);
                    setIsOpen(false);
                  }}
                  className="px-2 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-[11px]"
                >
                  Single Day
                </button>
              )}
              <button
                type="button"
                onClick={() => handlePreset("TODAY")}
                className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition cursor-pointer"
              >
                Today
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
