"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

interface DateRangePickerProps {
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  onChange: (start: string, end: string) => void;
  placeholder?: string;
}

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  placeholder = "Select Date Range"
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
    daysArray.push(<div key={`empty-${i}`} className="h-9 w-9" />);
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

    const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;

    daysArray.push(
      <div
        key={day}
        className={`h-9 w-9 flex items-center justify-center relative ${
          isBetween ? "bg-indigo-50/70" : ""
        } ${
          isStart && (endDate || hoveredDate) ? "rounded-l-full bg-indigo-50/70" : ""
        } ${
          isEnd ? "rounded-r-full bg-indigo-50/70" : ""
        }`}
        onMouseEnter={() => handleDayMouseEnter(day)}
      >
        <button
          type="button"
          onClick={() => handleSelectDay(day)}
          className={`h-8 w-8 rounded-full text-xs font-semibold transition-all flex items-center justify-center cursor-pointer relative z-10 ${
            isStart || isEnd
              ? "bg-indigo-650 text-white shadow-md font-bold"
              : isToday
              ? "border border-indigo-300 text-indigo-600 font-bold"
              : "text-slate-650 hover:bg-slate-100"
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
    <div className="relative" ref={containerRef}>
      {/* Date Range Input Box */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between border border-slate-200 hover:border-indigo-400 bg-white rounded-lg px-3 py-1.5 min-w-[230px] text-sm font-semibold text-slate-700 shadow-sm transition-all cursor-pointer select-none"
      >
        <span className={startDate ? "text-slate-700" : "text-slate-400 font-medium"}>
          {displayValue()}
        </span>
        <div className="flex items-center gap-1">
          {startDate && (
            <button
              onClick={handleClear}
              className="p-0.5 rounded-full hover:bg-slate-100 text-slate-450 hover:text-slate-600 transition"
              type="button"
              title="Clear date range"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <Calendar className="w-4 h-4 text-indigo-550 shrink-0" />
        </div>
      </div>

      {/* Styled Dropdown Calendar Popup */}
      {isOpen && (
        <div className="absolute z-45 mt-1.5 left-0 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header Month / Year Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg border border-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-700">
              {months[month]} <span className="text-indigo-650 font-extrabold">{year}</span>
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-lg border border-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-y-1 justify-items-center">
            {daysArray}
          </div>
        </div>
      )}
    </div>
  );
}
