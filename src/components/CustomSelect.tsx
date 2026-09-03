"use client";

import { useState, useRef, useEffect, ReactNode, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X, Check, Plus } from "lucide-react";
import { fuzzyMatchAny } from "@/lib/fuzzy";

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
  searchable?: boolean;
  searchPlaceholder?: string;
  allowCustom?: boolean;
  portal?: boolean;
  minWidth?: number;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "w-full",
  triggerClassName = "w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-[#CBCBCB] dark:border-slate-700 hover:border-[#6D8196] dark:hover:border-[#6D8196] rounded-xl text-xs font-semibold text-[#4A4A4A] dark:text-slate-100 shadow-2xs",
  popupClassName = "",
  disabled = false,
  searchable,
  searchPlaceholder = "Search...",
  allowCustom = false,
  portal = true,
  minWidth,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Enable search if explicitly set, or auto-enable if > 6 options
  const isSearchable = searchable ?? options.length > 6;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update popup position when using portal
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedHeight = Math.min(280, Math.max(120, (options.length + (isSearchable ? 1 : 0)) * 36));
    const showAbove = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

    const targetWidth = minWidth ? Math.max(rect.width, minWidth) : rect.width;
    let left = rect.left;
    if (left + targetWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - targetWidth - 12);
    }

    setDropdownStyle({
      position: "fixed",
      top: showAbove ? undefined : `${rect.bottom + 4}px`,
      bottom: showAbove ? `${window.innerHeight - rect.top + 4}px` : undefined,
      left: `${left}px`,
      width: `${targetWidth}px`,
      maxHeight: "280px",
      zIndex: 99999,
    });
  }, [options.length, isSearchable, minWidth]);

  // Handle position on open, scroll, resize
  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      return;
    }

    updatePosition();

    // Auto focus search input when opened
    const timer = setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 50);

    const handleScroll = (e: Event) => {
      // Don't close if scrolling inside the dropdown itself
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) {
        return;
      }
      updatePosition();
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
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

  // Filter options by search query using fuzzy matching
  const filteredOptions = options.filter((opt) => {
    if (!search.trim()) return true;
    if (opt.isAction) return true;
    const labelStr = typeof opt.label === "string" ? opt.label : opt.value;
    return fuzzyMatchAny([labelStr, opt.value], search);
  });

  const exactMatchExists = options.some(
    (o) =>
      o.value.toLowerCase() === search.trim().toLowerCase() ||
      (typeof o.label === "string" && o.label.toLowerCase() === search.trim().toLowerCase())
  );

  const renderDropdownContent = () => (
    <div
      ref={dropdownRef}
      style={portal ? dropdownStyle : undefined}
      className={`${
        portal
          ? "bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-[#CBCBCB] dark:border-slate-700 flex flex-col animate-in fade-in zoom-in-95 duration-150 overflow-hidden text-slate-800 dark:text-slate-100"
          : `absolute z-50 mt-1.5 left-0 shadow-xl border border-[#CBCBCB] dark:border-slate-700 bg-white dark:bg-slate-900 py-1 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150 text-slate-800 dark:text-slate-100 ${popupClassName}`
      }`}
    >
      {/* Search Input Box */}
      {isSearchable && (
        <div className="p-2 border-b border-[#CBCBCB]/60 dark:border-slate-800 bg-[#FAF9F5] dark:bg-slate-950 shrink-0 sticky top-0 z-10">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-[#6D8196] absolute left-2.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-7 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-[#CBCBCB] dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#6D8196] focus:ring-1 focus:ring-[#6D8196]"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsOpen(false);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (filteredOptions.length > 0) {
                    handleSelect(filteredOptions[0].value);
                  } else if (allowCustom && search.trim()) {
                    handleSelect(search.trim());
                  }
                }
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Options Scroll List */}
      <div className="overflow-y-auto flex-1 py-1 max-h-56 divide-y divide-slate-50 dark:divide-slate-800/60">
        {/* Placeholder / Empty Option */}
        {placeholder && !options.some((o) => o.value === "") && !search && (
          <div
            onClick={() => handleSelect("")}
            className={`mx-1 my-0.5 px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
              !value
                ? "bg-[#6D8196]/15 dark:bg-[#6D8196]/30 text-[#3D4F61] dark:text-sky-200 font-bold"
                : "text-[#737373] dark:text-slate-400 hover:bg-[#FAF9F5] dark:hover:bg-slate-800/80 dark:hover:text-slate-100"
            }`}
          >
            {placeholder}
          </div>
        )}

        {/* Filtered Options */}
        {filteredOptions.length > 0 ? (
          filteredOptions.map((opt, idx) => {
            const isSelected = opt.value === value;
            if (opt.isAction) {
              return (
                <div
                  key={opt.value || idx}
                  onClick={() => handleSelect(opt.value)}
                  className="mx-1 my-0.5 px-3 py-2 text-xs font-bold text-[#6D8196] dark:text-sky-400 hover:bg-[#6D8196]/10 dark:hover:bg-[#6D8196]/20 rounded-lg cursor-pointer border-t border-[#CBCBCB]/40 dark:border-slate-800 transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{opt.label}</span>
                </div>
              );
            }
            return (
              <div
                key={opt.value || idx}
                onClick={() => handleSelect(opt.value)}
                className={`mx-1 my-0.5 px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-all flex items-center justify-between group ${
                  isSelected
                    ? "bg-[#6D8196]/15 dark:bg-[#6D8196]/30 text-[#3D4F61] dark:text-sky-200 font-bold"
                    : "text-[#4A4A4A] dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-slate-800/80 hover:text-[#1F2937] dark:hover:text-white"
                }`}
              >
                <div className="truncate flex-1 min-w-0">{opt.label}</div>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#6D8196] dark:text-sky-400 shrink-0 ml-2" />}
              </div>
            );
          })
        ) : (
          <div className="px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500 italic">
            No matching options found
          </div>
        )}

        {/* Allow Custom Option */}
        {allowCustom && search.trim() && !exactMatchExists && (
          <div
            onClick={() => handleSelect(search.trim())}
            className="px-3 py-2 text-xs font-bold text-[#6D8196] dark:text-sky-400 bg-[#6D8196]/5 dark:bg-[#6D8196]/20 hover:bg-[#6D8196]/15 dark:hover:bg-[#6D8196]/30 cursor-pointer border-t border-[#CBCBCB]/40 dark:border-slate-800 transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Use &ldquo;{search.trim()}&rdquo;</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Selector Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between transition-all cursor-pointer select-none text-left disabled:opacity-50 disabled:cursor-not-allowed ${triggerClassName}`}
      >
        <span className="truncate">
          {selectedOption ? (
            selectedOption.label
          ) : value ? (
            value
          ) : (
            <span className="text-[#737373] dark:text-slate-400 font-medium">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#737373] dark:text-slate-400 shrink-0 ml-1.5 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[#6D8196] dark:text-sky-400" : ""
          }`}
        />
      </button>

      {/* Styled Popup List Dropdown */}
      {isOpen && (portal && mounted ? createPortal(renderDropdownContent(), document.body) : renderDropdownContent())}
    </div>
  );
}
