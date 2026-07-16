"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: CustomSelectOption[];
  placeholder: string;
  minWidthClass?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  minWidthClass = "min-w-[145px]"
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${minWidthClass}`} ref={containerRef}>
      {/* Selector Trigger Input */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between border border-slate-200 hover:border-indigo-400 bg-white rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition-all cursor-pointer select-none"
      >
        <span className={value ? "text-slate-750" : "text-slate-400 font-medium"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </div>

      {/* Styled Popup List Dropdown */}
      {isOpen && (
        <div className="absolute z-40 mt-1.5 left-0 w-full bg-white rounded-xl shadow-xl border border-slate-100 py-1 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Default Placeholder Option */}
          <div
            onClick={() => handleSelect("")}
            className={`px-3.5 py-2 text-xs font-semibold cursor-pointer transition-colors ${
              !value ? "bg-indigo-50/70 text-indigo-650 font-bold" : "text-slate-650 hover:bg-slate-50"
            }`}
          >
            {placeholder}
          </div>

          {/* List Options */}
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`px-3.5 py-2 text-xs font-semibold cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-indigo-50/70 text-indigo-650 font-bold"
                    : "text-slate-650 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
