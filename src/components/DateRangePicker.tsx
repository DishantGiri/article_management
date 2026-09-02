"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

interface DateRangePickerProps {
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  onChange: (start: string, end: string) => void;
  placeholder?: string;
  className?: string;
  align?: "left" | "right";
}

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  placeholder = "Select Date Range",
  className = "",
  align = "left",
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => {
    if (startDate) {
      const [year, month, day] = startDate.split("-").map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date();
  });
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync state if startDate prop changes
  useEffect(() => {
    if (startDate) {
      const [year, month, day] = startDate.split("-").map(Number);
      setCurrentDate(new Date(year, month - 1, day));
    }
  }, [startDate]);

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHoveredDate(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Format date display as DD-MM-YYYY
  const formatDisplay = (val: string) => {
    if (!val) return "";
    const [y, m, d] = val.split("-");
    return `${d}-${m}-${y}`;
  };

  const formatDateYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const handleSelectPreset = (preset: "TODAY" | "YESTERDAY" | "LAST_7" | "THIS_MONTH" | "ALL") => {
    const now = new Date();
    if (preset === "ALL") {
      onChange("", "");
    } else if (preset === "TODAY") {
      const formatted = formatDateYMD(now);
      onChange(formatted, formatted);
    } else if (preset === "YESTERDAY") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const formatted = formatDateYMD(y);
      onChange(formatted, formatted);
    } else if (preset === "LAST_7") {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      onChange(formatDateYMD(past), formatDateYMD(now));
    } else if (preset === "THIS_MONTH") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      onChange(formatDateYMD(start), formatDateYMD(now));
    }
    setIsOpen(false);
    setHoveredDate(null);
  };

  const handleSelectDay = (day: number) => {
    const formattedMonth = String(month + 1).padStart(2, "0");
    const formattedDay = String(day).padStart(2, "0");
    const clickedDateStr = `${year}-${formattedMonth}-${formattedDay}`;

    if (!startDate || (startDate && endDate)) {
      // Start a new selection
      onChange(clickedDateStr, "");
    } else {
      // We already have a start date, but no end date
      const start = new Date(startDate);
      const clicked = new Date(clickedDateStr);

      if (clicked < start) {
        // Reset start date if clicked is earlier than start
        onChange(clickedDateStr, "");
      } else {
        // Set end date and close modal
        onChange(startDate, clickedDateStr);
        setIsOpen(false);
        setHoveredDate(null);
      }
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("", "");
    setHoveredDate(null);
  };

  const handleDayMouseEnter = (day: number) => {
    if (startDate && !endDate) {
      const formattedMonth = String(month + 1).padStart(2, "0");
      const formattedDay = String(day).padStart(2, "0");
      setHoveredDate(`${year}-${formattedMonth}-${formattedDay}`);
    }
  };

  // Build grid items
  const daysArray = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(<div key={`empty-${i}`} className="h-8 w-8" />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const formattedMonth = String(month + 1).padStart(2, "0");
    const formattedDay = String(day).padStart(2, "0");
    const dateStr = `${year}-${formattedMonth}-${formattedDay}`;

    const isStart = startDate === dateStr;
    const isEnd = endDate === dateStr;

    // Check if within range (inclusive)
    let inRange = false;
    let isBetween = false;

    if (startDate && endDate) {
      const d = new Date(dateStr);
      const s = new Date(startDate);
      const e = new Date(endDate);
      inRange = d >= s && d <= e;
      isBetween = d > s && d < e;
    } else if (startDate && hoveredDate) {
      const d = new Date(dateStr);
      const s = new Date(startDate);
      const h = new Date(hoveredDate);
      if (h >= s) {
        inRange = d >= s && d <= h;
        isBetween = d > s && d < h;
      }
    }

    const isToday =
      new Date().getDate() === day &&
      new Date().getMonth() === month &&
      new Date().getFullYear() === year;

    daysArray.push(
      <div
        key={day}
        className={`h-8 w-8 flex items-center justify-center relative ${
          isBetween ? "bg-indigo-50/70 dark:bg-indigo-950/40" : ""
        } ${
          isStart && (endDate || hoveredDate)
            ? "rounded-l-full bg-indigo-50/70 dark:bg-indigo-950/40"
            : ""
        } ${
          isEnd ? "rounded-r-full bg-indigo-50/70 dark:bg-indigo-950/40" : ""
        }`}
        onMouseEnter={() => handleDayMouseEnter(day)}
      >
        <button
          type="button"
          onClick={() => handleSelectDay(day)}
          className={`h-7 w-7 rounded-full text-xs font-semibold transition-all flex items-center justify-center cursor-pointer relative z-10 ${
            isStart || isEnd
              ? "bg-[#6D8196] text-white shadow-xs font-bold"
              : isToday
              ? "border border-[#6D8196] text-[#6D8196] dark:text-sky-400 font-bold"
              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          {day}
        </button>
      </div>
    );
  }

  // Display value text
  const displayValue = () => {
    if (startDate && endDate) {
      return `${formatDisplay(startDate)} to ${formatDisplay(endDate)}`;
    } else if (startDate) {
      return `${formatDisplay(startDate)} to ...`;
    }
    return placeholder;
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Date Range Input Box */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between border border-[#CBCBCB]/70 dark:border-slate-700 hover:border-[#6D8196] dark:hover:border-[#6D8196] bg-white dark:bg-slate-850 rounded-xl px-3 py-1.5 min-w-[210px] text-xs font-semibold text-[#4A4A4A] dark:text-slate-200 shadow-2xs transition-all cursor-pointer select-none"
      >
        <span className={startDate ? "text-[#4A4A4A] dark:text-white" : "text-slate-400 font-medium"}>
          {displayValue()}
        </span>
        <div className="flex items-center gap-1.5 ml-2">
          {startDate && (
            <button
              onClick={handleClear}
              className="p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              type="button"
              title="Clear date range"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <Calendar className="w-4 h-4 text-[#6D8196] shrink-0" />
        </div>
      </div>

      {/* Styled Dropdown Calendar Popup */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1.5 ${
            align === "right" ? "right-0" : "left-0"
          } w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-3.5 animate-in fade-in slide-in-from-top-1 duration-150`}
        >
          {/* Preset Buttons */}
          <div className="grid grid-cols-5 gap-1 mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => handleSelectPreset("TODAY")}
              className="py-1 px-1 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#6D8196] hover:text-white transition text-center cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset("YESTERDAY")}
              className="py-1 px-1 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#6D8196] hover:text-white transition text-center cursor-pointer"
            >
              Y'day
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset("LAST_7")}
              className="py-1 px-1 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#6D8196] hover:text-white transition text-center cursor-pointer"
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset("THIS_MONTH")}
              className="py-1 px-1 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#6D8196] hover:text-white transition text-center cursor-pointer"
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset("ALL")}
              className="py-1 px-1 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white transition text-center cursor-pointer"
            >
              All
            </button>
          </div>

          {/* Header Month / Year Navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {months[month]} <span className="text-[#6D8196] font-extrabold">{year}</span>
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
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
          <div className="grid grid-cols-7 gap-y-0.5 justify-items-center">
            {daysArray}
          </div>
        </div>
      )}
    </div>
  );
}
