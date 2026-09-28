"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

interface CustomDatePickerProps {
  value: string; // "YYYY-MM-DD"
  onChange: (dateStr: string) => void;
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
  placeholder = "Select Date",
  className = "",
  align = "left",
  minDate,
  maxDate,
  disableFutureDates = false,
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropdownAlign, setDropdownAlign] = useState<"left" | "right">(align);

  // Dynamic boundary collision detection so the calendar never clips off the screen/card/modal
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const computeAlignment = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const popupWidth = 300; // w-72 is 288px + padding

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

  // Update alignment when align prop changes
  useEffect(() => {
    setDropdownAlign(align);
  }, [align]);

  const getInitialDate = () => {
    if (value) {
      const parts = value.split("-").map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
    }
    return new Date();
  };

  const [viewDate, setViewDate] = useState<Date>(getInitialDate);

  // Sync viewDate when value changes
  useEffect(() => {
    if (value) {
      const parts = value.split("-").map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        setViewDate(new Date(parts[0], parts[1] - 1, parts[2]));
      }
    }
  }, [value]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
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

  const handleSelectDay = (day: number) => {
    const mStr = String(month + 1).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");
    const selectedDateStr = `${year}-${mStr}-${dStr}`;

    if (effectiveMaxDate && selectedDateStr > effectiveMaxDate) return;
    if (minDate && selectedDateStr < minDate) return;

    onChange(selectedDateStr);
    setIsOpen(false);
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date();
    const today = formatYMD(now);
    setViewDate(now);
    onChange(today);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  // Format display text (e.g., "Sep 28, 2026")
  const getDisplayText = () => {
    if (!value) return placeholder;
    const parts = value.split("-").map(Number);
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    return value;
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

    const isSelected = value === cellDateStr;
    const isToday = todayStr === cellDateStr;
    const isDisabled =
      Boolean(effectiveMaxDate && cellDateStr > effectiveMaxDate) ||
      Boolean(minDate && cellDateStr < minDate);

    calendarCells.push(
      <button
        key={`current-${day}`}
        type="button"
        disabled={isDisabled}
        onClick={(e) => {
          e.stopPropagation();
          handleSelectDay(day);
        }}
        className={`h-8 w-8 rounded-full text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
          isDisabled
            ? "text-slate-300 dark:text-slate-700 opacity-40 cursor-not-allowed pointer-events-none"
            : isSelected
            ? "bg-[#6D8196] text-white shadow-xs font-bold scale-105"
            : isToday
            ? "border border-[#6D8196] text-[#6D8196] dark:text-sky-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
      >
        {day}
      </button>
    );
  }

  // Leading days from next month to complete 42 or full rows
  const remainingCells = 42 - calendarCells.length;
  // If we only need 35 cells, cap at 35; otherwise 42
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
          <span className={value ? "text-slate-900 dark:text-slate-100 font-bold" : "text-slate-400 font-normal"}>
            {getDisplayText()}
          </span>
        </div>

        {value && (
          <span
            onClick={handleClear}
            className="p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            title="Clear date"
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
          } w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 animate-fadeIn select-none`}
        >
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
          <div className="grid grid-cols-7 gap-1 justify-items-center mb-3">
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
            <button
              type="button"
              onClick={handleSelectToday}
              className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition cursor-pointer"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
