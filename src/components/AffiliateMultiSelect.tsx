"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X, Check, Plus, Ban, Building2 } from "lucide-react";
import { toast } from "react-hot-toast";

export interface AffiliateOption {
  id?: number | string;
  name: string;
}

export interface AffiliateMultiSelectProps {
  value: string; // e.g. "ClickBank, BuyGoods" or "No Affiliate" or ""
  onChange: (value: string) => void;
  affiliates: AffiliateOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  portal?: boolean;
  compact?: boolean;
  minWidth?: number;
  error?: boolean;
  onAddCustomAffiliate?: (name: string) => Promise<void> | void;
}

const NO_AFFILIATE = "No Affiliate";

export default function AffiliateMultiSelect({
  value,
  onChange,
  affiliates,
  placeholder = "Select Affiliate Network(s)...",
  className = "w-full",
  triggerClassName = "",
  disabled = false,
  portal = true,
  compact = false,
  minWidth,
  error = false,
  onAddCustomAffiliate,
}: AffiliateMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Parse selected list from comma-separated string
  const selectedList = value
    ? value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const isNoAffiliateSelected =
    selectedList.includes(NO_AFFILIATE) || value.trim().toLowerCase() === "no affiliate";

  // Update popup position when using portal
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    const estimatedHeight = 320;
    const showAbove = spaceBelow < Math.max(140, estimatedHeight) && spaceAbove > spaceBelow;
    const effectiveMinWidth = minWidth || (compact ? 240 : 280);
    const targetWidth = Math.max(rect.width, effectiveMinWidth);

    let left = rect.left;
    if (left + targetWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - targetWidth - 12);
    }
    left = Math.max(12, left);

    const availableSpace = showAbove ? spaceAbove - 16 : spaceBelow - 16;
    const maxH = Math.min(360, Math.max(120, Math.floor(availableSpace)));

    setDropdownStyle({
      position: "fixed",
      top: showAbove ? undefined : `${Math.floor(rect.bottom + 4)}px`,
      bottom: showAbove ? `${Math.floor(window.innerHeight - rect.top + 4)}px` : undefined,
      left: `${Math.floor(left)}px`,
      width: `${Math.floor(targetWidth)}px`,
      maxHeight: `${maxH}px`,
      zIndex: 99999,
    });
  }, [minWidth, compact]);

  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setShowAddCustom(false);
      setCustomName("");
      return;
    }

    updatePosition();

    const timer = setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 50);

    const handleScroll = (e: Event) => {
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
    if (!isOpen) return;
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
  }, [isOpen]);

  const toggleNoAffiliate = () => {
    if (disabled) return;
    if (isNoAffiliateSelected) {
      onChange("");
    } else {
      onChange(NO_AFFILIATE);
    }
  };

  const toggleAffiliate = (affName: string) => {
    if (disabled) return;
    // Strip "No Affiliate" if selecting an actual affiliate network
    const cleaned = selectedList.filter((s) => s !== NO_AFFILIATE);
    const exists = cleaned.some((s) => s.toLowerCase() === affName.toLowerCase());

    let updated: string[];
    if (exists) {
      updated = cleaned.filter((s) => s.toLowerCase() !== affName.toLowerCase());
    } else {
      updated = [...cleaned, affName];
    }

    onChange(updated.join(", "));
  };

  const removeAffiliate = (e: React.MouseEvent, affName: string) => {
    e.stopPropagation();
    if (disabled) return;
    const updated = selectedList.filter((s) => s.toLowerCase() !== affName.toLowerCase());
    onChange(updated.join(", "));
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customName.trim().replace(/\s+/g, " ");
    if (!trimmed) return;

    if (!/^[a-zA-Z0-9 ]+$/.test(trimmed)) {
      toast.error("Special characters are not allowed. Only letters, numbers, and spaces are permitted.", {
        id: "aff-char-err",
      });
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 50) {
      toast.error("Affiliate name must be between 2 and 50 characters.");
      return;
    }

    setIsAddingCustom(true);
    try {
      if (onAddCustomAffiliate) {
        await onAddCustomAffiliate(trimmed);
      } else {
        // Fallback default save to /api/affiliates
        await fetch("/api/affiliates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
      }

      // Add to selected networks
      toggleAffiliate(trimmed);
      setCustomName("");
      setShowAddCustom(false);
      toast.success(`Affiliate "${trimmed}" added!`);
    } catch (err: any) {
      console.error("Failed to add custom affiliate:", err);
      toast.error("Failed to save custom affiliate");
    } finally {
      setIsAddingCustom(false);
    }
  };

  // Filter options based on search query
  const searchLower = search.trim().toLowerCase();
  const showNoAffiliate = !searchLower || NO_AFFILIATE.toLowerCase().includes(searchLower);

  const filteredAffiliates = affiliates.filter((aff) => {
    if (!searchLower) return true;
    return aff.name.toLowerCase().includes(searchLower);
  });

  const exactMatchExists =
    affiliates.some((a) => a.name.toLowerCase() === searchLower) ||
    NO_AFFILIATE.toLowerCase() === searchLower;

  const renderDropdown = () => (
    <div
      ref={dropdownRef}
      style={portal ? dropdownStyle : undefined}
      className={`${
        portal ? "" : "absolute left-0 mt-1 w-full"
      } bg-white dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl flex flex-col overflow-hidden text-xs z-[99999] animate-fadeIn`}
    >
      {/* Search Header */}
      <div className="p-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search affiliate networks..."
            className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Options List */}
      <div className="overflow-y-auto flex-1 p-1.5 space-y-1 max-h-[220px]">
        {/* NO AFFILIATE OPTION */}
        {showNoAffiliate && (
          <button
            type="button"
            onClick={toggleNoAffiliate}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition cursor-pointer ${
              isNoAffiliateSelected
                ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border border-slate-300 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                  isNoAffiliateSelected
                    ? "bg-slate-700 dark:bg-slate-300 border-slate-700 dark:border-slate-300 text-white dark:text-slate-900"
                    : "border-slate-300 dark:border-slate-700"
                }`}
              >
                {isNoAffiliateSelected && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <span className="flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-semibold">No Affiliate</span>
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-normal">None</span>
          </button>
        )}

        {showNoAffiliate && filteredAffiliates.length > 0 && (
          <div className="my-1 border-t border-slate-100 dark:border-slate-800/80 px-2 pt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Affiliate Networks
          </div>
        )}

        {/* Regular Affiliate Networks */}
        {filteredAffiliates.map((aff) => {
          const isSelected =
            !isNoAffiliateSelected &&
            selectedList.some((s) => s.toLowerCase() === aff.name.toLowerCase());
          return (
            <button
              key={aff.id || aff.name}
              type="button"
              onClick={() => toggleAffiliate(aff.name)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer ${
                isSelected
                  ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition ${
                    isSelected
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-slate-300 dark:border-slate-700"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span className="truncate">{aff.name}</span>
              </div>
              {isSelected && <span className="text-[10px] text-blue-500 font-bold shrink-0">Selected</span>}
            </button>
          );
        })}

        {filteredAffiliates.length === 0 && !showNoAffiliate && (
          <div className="py-4 text-center text-xs text-slate-400 italic">No matching networks found</div>
        )}
      </div>

      {/* Add Custom Affiliate Inline Form */}
      {showAddCustom ? (
        <form onSubmit={handleCreateCustom} className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#0f172a] space-y-1.5">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="New affiliate name..."
              className="flex-1 px-2.5 py-1.5 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={isAddingCustom || !customName.trim()}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition cursor-pointer"
            >
              {isAddingCustom ? "Adding..." : "Add"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddCustom(false)}
              className="px-2 py-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="p-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/30 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowAddCustom(true)}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Custom</span>
          </button>

          <div className="flex items-center gap-2">
            {selectedList.length > 0 && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="text-[11px] font-medium text-slate-500 hover:text-rose-500 cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-[11px] font-bold hover:bg-slate-700 dark:hover:bg-slate-600 transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={
          triggerClassName
            ? `${triggerClassName} ${error ? "!border-rose-500 !bg-rose-50/20" : ""}`
            : compact
            ? `w-full px-2 py-1.5 text-xs text-left ${error ? "bg-rose-50/20 border-rose-500 text-rose-900" : "bg-slate-50 dark:bg-[#131d31] border-slate-200 dark:border-slate-800 hover:border-blue-500 text-slate-800 dark:text-slate-200"} border rounded-lg flex items-center justify-between gap-1 transition focus:outline-none`
            : `w-full px-3.5 py-2.5 text-xs text-left ${error ? "bg-rose-50/20 border-rose-500 text-rose-900" : "bg-white dark:bg-[#0b1120] border-slate-200 dark:border-slate-800 hover:border-blue-500 text-slate-800 dark:text-slate-200"} border rounded-xl flex items-center justify-between gap-2 transition focus:outline-none shadow-xs`
        }
      >
        <div className="flex-1 flex flex-wrap items-center gap-1.5 overflow-hidden">
          {selectedList.length === 0 ? (
            <span className="text-slate-400 dark:text-slate-500 truncate">{placeholder}</span>
          ) : isNoAffiliateSelected ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
              <Ban className="w-3 h-3 text-slate-500" />
              <span>No Affiliate</span>
              <X
                className="w-3 h-3 hover:text-rose-500 ml-0.5 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
              />
            </span>
          ) : compact ? (
            <div className="flex items-center gap-1 truncate">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-semibold truncate max-w-[130px]">
                {selectedList[0]}
              </span>
              {selectedList.length > 1 && (
                <span className="text-[10px] font-bold text-slate-500 shrink-0">
                  +{selectedList.length - 1}
                </span>
              )}
            </div>
          ) : (
            selectedList.map((aff) => (
              <span
                key={aff}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold"
              >
                <Building2 className="w-3 h-3 text-blue-500" />
                <span className="truncate max-w-[150px]">{aff}</span>
                <X
                  className="w-3 h-3 hover:text-rose-500 ml-0.5 cursor-pointer shrink-0"
                  onClick={(e) => removeAffiliate(e, aff)}
                />
              </span>
            ))
          )}
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-blue-500" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen &&
        mounted &&
        (portal ? createPortal(renderDropdown(), document.body) : renderDropdown())}
    </div>
  );
}
