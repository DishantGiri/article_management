"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

interface CustomMonthPickerProps {
  value: string; // "YYYY-MM"
  onChange: (monthStr: string) => void;
  placeholder?: string;
  className?: string;
  align?: "left" | "right";
}

export default function CustomMonthPicker({
  value,
  onChange,
  placeholder = "Select Month",
  className = "",
  align = "left",
}: CustomMonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropdownAlign, setDropdownAlign] = useState<"left" | "right">(align);

  // Dynamic boundary collision detection so the month picker never clips off the screen/card/modal
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const computeAlignment = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const popupWidth = 270; // w-64 is 256px + padding

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

  const getInitialYear = () => {
    if (value) {
      const parts = value.split("-").map(Number);
      if (parts.length >= 1 && !isNaN(parts[0])) return parts[0];
    }
    return new Date().getFullYear();
  };

  const [viewYear, setViewYear] = useState<number>(getInitialYear);

  useEffect(() => {
    if (value) {
      const parts = value.split("-").map(Number);
      if (parts.length >= 1 && !isNaN(parts[0])) setViewYear(parts[0]);
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

  const monthNames = [
    { short: "Jan", full: "January", index: 1 },
    { short: "Feb", full: "February", index: 2 },
    { short: "Mar", full: "March", index: 3 },
    { short: "Apr", full: "April", index: 4 },
    { short: "May", full: "May", index: 5 },
    { short: "Jun", full: "June", index: 6 },
    { short: "Jul", full: "July", index: 7 },
    { short: "Aug", full: "August", index: 8 },
    { short: "Sep", full: "September", index: 9 },
    { short: "Oct", full: "October", index: 10 },
    { short: "Nov", full: "November", index: 11 },
    { short: "Dec", full: "December", index: 12 },
  ];

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  const handleSelectMonth = (monthIndex: number) => {
    const mStr = String(monthIndex).padStart(2, "0");
    onChange(`${viewYear}-${mStr}`);
    setIsOpen(false);
  };

  const handleSelectCurrentMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    const mStr = String(currentMonth).padStart(2, "0");
    setViewYear(currentYear);
    onChange(`${currentYear}-${mStr}`);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  const getDisplayText = () => {
    if (!value) return placeholder;
    const parts = value.split("-").map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const d = new Date(parts[0], parts[1] - 1, 1);
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    return value;
  };

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
            title="Clear month"
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </button>

      {/* Month Dropdown Popup */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1.5 ${
            dropdownAlign === "right" ? "right-0" : "left-0"
          } w-64 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 animate-fadeIn select-none`}
        >
          {/* Header Year Navigator */}
          <div className="flex items-center justify-between mb-3 px-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewYear((y) => y - 1);
              }}
              className="p-1 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="text-sm font-extrabold text-[#6D8196]">
              {viewYear}
            </span>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewYear((y) => y + 1);
              }}
              className="p-1 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 12 Months Grid */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {monthNames.map((m) => {
              const mStr = String(m.index).padStart(2, "0");
              const isSelected = value === `${viewYear}-${mStr}`;
              const isCurrent = viewYear === currentYear && m.index === currentMonth;

              return (
                <button
                  key={m.short}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectMonth(m.index);
                  }}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#6D8196] text-white shadow-xs font-extrabold scale-102"
                      : isCurrent
                      ? "border border-[#6D8196] text-[#6D8196] dark:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {m.short}
                </button>
              );
            })}
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
              onClick={handleSelectCurrentMonth}
              className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition cursor-pointer"
            >
              This Month
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
