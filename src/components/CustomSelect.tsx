"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export interface CustomSelectOption {
  value: string;
  label: string | ReactNode;
  isAction?: boolean;
}

export interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  popupClassName?: string;
  disabled?: boolean;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "w-full",
  triggerClassName = "w-full px-3.5 py-2.5 bg-white border border-[#CBCBCB] hover:border-[#6D8196] rounded-xl text-xs font-semibold text-[#4A4A4A] shadow-2xs",
  popupClassName = "w-full bg-white rounded-xl shadow-xl border border-[#CBCBCB]/60 py-1.5 max-h-60 overflow-y-auto",
  disabled = false,
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
    if (disabled) return;
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Selector Trigger Input */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between transition-all cursor-pointer select-none text-left disabled:opacity-50 disabled:cursor-not-allowed ${triggerClassName}`}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : <span className="text-[#737373] font-medium">{placeholder}</span>}
        </span>
        <ChevronDown className={`w-4 h-4 text-[#737373] shrink-0 ml-2 transition-transform duration-200 ${isOpen ? "rotate-180 text-[#6D8196]" : ""}`} />
      </button>

      {/* Styled Popup List Dropdown */}
      {isOpen && (
        <div className={`absolute z-50 mt-1.5 left-0 shadow-xl border border-[#CBCBCB]/60 py-1 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150 ${popupClassName}`}>
          {placeholder && !options.some((o) => o.value === "") && (
            <div
              onClick={() => handleSelect("")}
              className={`px-3.5 py-2 text-xs font-semibold cursor-pointer transition-colors ${
                !value ? "bg-[#6D8196]/15 text-[#3D4F61] font-bold" : "text-[#737373] hover:bg-[#FAF9F5]"
              }`}
            >
              {placeholder}
            </div>
          )}

          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            if (opt.isAction) {
              return (
                <div
                  key={opt.value || idx}
                  onClick={() => handleSelect(opt.value)}
                  className="px-3.5 py-2 text-xs font-bold text-[#6D8196] hover:bg-[#6D8196]/10 cursor-pointer border-t border-[#CBCBCB]/40 transition-colors"
                >
                  {opt.label}
                </div>
              );
            }
            return (
              <div
                key={opt.value || idx}
                onClick={() => handleSelect(opt.value)}
                className={`px-3.5 py-2 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-between ${
                  isSelected
                    ? "bg-[#6D8196]/15 text-[#3D4F61] font-bold"
                    : "text-[#4A4A4A] hover:bg-[#FAF9F5] hover:text-[#1F2937]"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#6D8196] shrink-0 ml-2" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
