"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  AlertTriangle,
  Plus,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  X,
  Building2,
  Layers,
  Check,
} from "lucide-react";
import { fuzzyMatchAny } from "@/lib/fuzzy";

interface PendingProduct {
  id: number;
  name: string;
  site?: {
    id?: number;
    name: string;
  };
  createdAt?: string;
}

interface GroupedPendingProduct {
  name: string;
  items: PendingProduct[];
}

interface PendingLinkLogsSectionProps {
  products: PendingProduct[];
  onAddLink?: (productId: number) => void;
  title?: string;
  subtitle?: string;
}

/**
 * Grouped Product Card for Grid View
 */
function GroupedProductCard({
  group,
  onAddLink,
}: {
  group: GroupedPendingProduct;
  onAddLink?: (productId: number) => void;
}) {
  const [selectedProductId, setSelectedProductId] = useState<number>(group.items[0]?.id);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isExpandedList, setIsExpandedList] = useState(false);

  // Sync selectedProductId if items change
  useEffect(() => {
    if (!group.items.some((i) => i.id === selectedProductId)) {
      setSelectedProductId(group.items[0]?.id);
    }
  }, [group.items, selectedProductId]);

  const selectedItem = group.items.find((i) => i.id === selectedProductId) || group.items[0];
  const hasMultipleSites = group.items.length > 1;

  // Dropdown portal positioning
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedHeight = Math.min(260, group.items.length * 44 + 40);
    const showAbove = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

    const width = Math.max(rect.width, 240);
    let left = rect.left;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12);
    }

    setDropdownStyle({
      position: "fixed",
      top: showAbove ? undefined : `${rect.bottom + 4}px`,
      bottom: showAbove ? `${window.innerHeight - rect.top + 4}px` : undefined,
      left: `${left}px`,
      width: `${width}px`,
      maxHeight: "260px",
      zIndex: 99999,
    });
  }, [group.items.length]);

  useEffect(() => {
    if (!isDropdownOpen) return;
    updatePosition();

    const handleScroll = (e: Event) => {
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) return;
      updatePosition();
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDropdownOpen(false);
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", updatePosition);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDropdownOpen, updatePosition]);

  return (
    <div className="group bg-white dark:bg-slate-800/80 hover:bg-[#FAF9F5] dark:hover:bg-slate-800 border border-[#CBCBCB]/60 dark:border-slate-700 hover:border-[#6D8196] rounded-xl p-3 shadow-2xs transition-all flex flex-col justify-between gap-2.5 relative">
      {/* Top title & count */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <h4
            className="text-xs font-bold text-[#4A4A4A] dark:text-slate-100 truncate group-hover:text-[#6D8196] transition-colors flex-1"
            title={group.name}
          >
            {group.name}
          </h4>
          {hasMultipleSites ? (
            <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-950/60 border border-amber-300/60 dark:border-amber-700/50 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>{group.items.length} Sites</span>
            </span>
          ) : (
            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded-md shrink-0">
              #{group.items[0]?.id}
            </span>
          )}
        </div>

        {/* Site Display or Dropdown */}
        <div className="mt-2">
          {!hasMultipleSites ? (
            <div className="flex items-center gap-1.5 text-[11px] text-[#737373] dark:text-slate-400 font-medium py-1">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{group.items[0]?.site?.name || "Unassigned"}</span>
            </div>
          ) : (
            <div className="relative">
              <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[#FAF9F5] dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 border border-[#CBCBCB] dark:border-slate-700 hover:border-[#6D8196] rounded-lg text-xs font-semibold text-[#4A4A4A] dark:text-slate-200 shadow-2xs transition-all cursor-pointer select-none"
              >
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <Building2 className="w-3.5 h-3.5 text-[#6D8196] shrink-0" />
                  <span className="truncate font-bold">{selectedItem?.site?.name || "Select site"}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                  <span className="text-[10px] font-mono text-slate-400 bg-white dark:bg-slate-800 px-1 py-0.2 rounded border border-[#CBCBCB]/60 dark:border-slate-600">
                    #{selectedItem?.id}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      isDropdownOpen ? "rotate-180 text-[#6D8196]" : ""
                    }`}
                  />
                </div>
              </button>

              {/* Portal Dropdown Menu */}
              {isDropdownOpen &&
                typeof document !== "undefined" &&
                createPortal(
                  <div
                    ref={dropdownRef}
                    style={dropdownStyle}
                    className="bg-white dark:bg-slate-900 border border-[#CBCBCB] dark:border-slate-700 rounded-xl shadow-xl overflow-hidden flex flex-col text-xs animate-in fade-in zoom-in-95 duration-100"
                  >
                    <div className="px-3 py-1.5 bg-[#FAF9F5] dark:bg-slate-800/90 border-b border-[#CBCBCB]/60 dark:border-slate-700 flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-300">
                      <span>Available Sites ({group.items.length})</span>
                      <span className="text-[10px] text-slate-400 font-normal">Select or add</span>
                    </div>
                    <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 py-1">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedProductId(item.id);
                            setIsDropdownOpen(false);
                          }}
                          className={`px-3 py-1.5 flex items-center justify-between gap-2 hover:bg-[#FAF9F5] dark:hover:bg-slate-800 cursor-pointer transition-colors ${
                            item.id === selectedProductId
                              ? "bg-[#6D8196]/10 dark:bg-[#6D8196]/20 font-bold"
                              : ""
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 truncate">
                            <Building2 className="w-3.5 h-3.5 text-[#6D8196] shrink-0" />
                            <span className="text-xs text-[#4A4A4A] dark:text-slate-200 truncate">
                              {item.site?.name || "Unassigned"}
                            </span>
                            {item.id === selectedProductId && (
                              <Check className="w-3 h-3 text-[#6D8196] shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              #{item.id}
                            </span>
                            {onAddLink && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsDropdownOpen(false);
                                  onAddLink(item.id);
                                }}
                                className="px-1.5 py-0.5 text-[10px] font-bold bg-[#6D8196] hover:bg-[#5A6D81] text-white rounded shadow-2xs cursor-pointer flex items-center gap-0.5"
                                title={`Add link for ${item.site?.name || "this site"}`}
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>,
                  document.body
                )}
            </div>
          )}
        </div>
      </div>

      {/* Action Button & Expand All List */}
      <div className="space-y-1.5">
        {onAddLink && (
          <button
            type="button"
            onClick={() => onAddLink(selectedProductId)}
            className="w-full py-1.5 px-3 bg-[#6D8196] hover:bg-[#5A6D81] active:scale-[0.98] text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              Add Link {hasMultipleSites ? `(${selectedItem?.site?.name || "Site"})` : ""}
            </span>
          </button>
        )}

        {hasMultipleSites && (
          <div>
            <button
              type="button"
              onClick={() => setIsExpandedList(!isExpandedList)}
              className="w-full py-0.5 text-[11px] font-semibold text-[#6D8196] dark:text-sky-400 hover:text-[#4A4A4A] dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              <span>{isExpandedList ? "Hide all sites" : `View all ${group.items.length} sites`}</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform duration-200 ${
                  isExpandedList ? "rotate-180" : ""
                }`}
              />
            </button>

            {isExpandedList && (
              <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-700/60 max-h-36 overflow-y-auto space-y-1 pr-0.5">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-1 px-2 rounded-md bg-[#FAF9F5] dark:bg-slate-900/50 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate font-medium text-[#4A4A4A] dark:text-slate-200 text-[11px]">
                        {item.site?.name || "Unassigned"}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400">#{item.id}</span>
                    </div>
                    {onAddLink && (
                      <button
                        type="button"
                        onClick={() => onAddLink(item.id)}
                        className="px-1.5 py-0.5 text-[10px] font-bold bg-[#6D8196] hover:bg-[#5A6D81] text-white rounded cursor-pointer shrink-0"
                      >
                        Add
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Grouped Product Row for List View
 */
function GroupedProductRow({
  group,
  onAddLink,
}: {
  group: GroupedPendingProduct;
  onAddLink?: (productId: number) => void;
}) {
  const [selectedProductId, setSelectedProductId] = useState<number>(group.items[0]?.id);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const selectedItem = group.items.find((i) => i.id === selectedProductId) || group.items[0];
  const hasMultipleSites = group.items.length > 1;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedHeight = Math.min(260, group.items.length * 44 + 40);
    const showAbove = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

    const width = Math.max(rect.width, 220);
    let left = rect.left;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12);
    }

    setDropdownStyle({
      position: "fixed",
      top: showAbove ? undefined : `${rect.bottom + 4}px`,
      bottom: showAbove ? `${window.innerHeight - rect.top + 4}px` : undefined,
      left: `${left}px`,
      width: `${width}px`,
      maxHeight: "260px",
      zIndex: 99999,
    });
  }, [group.items.length]);

  useEffect(() => {
    if (!isDropdownOpen) return;
    updatePosition();

    const handleScroll = (e: Event) => {
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) return;
      updatePosition();
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDropdownOpen(false);
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", updatePosition);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDropdownOpen, updatePosition]);

  return (
    <div className="p-2.5 px-4 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 hover:bg-[#FAF9F5] dark:hover:bg-slate-800 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-xs font-bold text-[#4A4A4A] dark:text-slate-100 truncate" title={group.name}>
          {group.name}
        </span>
        {hasMultipleSites ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100/90 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/50 shrink-0">
            {group.items.length} Sites
          </span>
        ) : (
          <span className="text-xs font-bold text-slate-400 shrink-0">#{group.items[0]?.id}</span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!hasMultipleSites ? (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#6D8196]/10 dark:bg-[#6D8196]/30 text-[#3D4F61] dark:text-slate-200 border border-[#6D8196]/20 dark:border-[#6D8196]/40 shrink-0">
            {group.items[0]?.site?.name || "Unassigned"}
          </span>
        ) : (
          <div className="relative">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-1.5 px-2 py-1 bg-[#FAF9F5] dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 border border-[#CBCBCB] dark:border-slate-700 rounded-lg text-xs font-semibold text-[#4A4A4A] dark:text-slate-200 cursor-pointer shadow-2xs transition-all"
            >
              <Building2 className="w-3.5 h-3.5 text-[#6D8196] shrink-0" />
              <span className="truncate max-w-[100px]">{selectedItem?.site?.name || "Select"}</span>
              <span className="text-[9px] font-mono text-slate-400 bg-white dark:bg-slate-800 px-1 py-0.2 rounded border border-[#CBCBCB]/60">
                #{selectedItem?.id}
              </span>
              <ChevronDown
                className={`w-3 h-3 text-slate-400 transition-transform ${
                  isDropdownOpen ? "rotate-180 text-[#6D8196]" : ""
                }`}
              />
            </button>

            {isDropdownOpen &&
              typeof document !== "undefined" &&
              createPortal(
                <div
                  ref={dropdownRef}
                  style={dropdownStyle}
                  className="bg-white dark:bg-slate-900 border border-[#CBCBCB] dark:border-slate-700 rounded-xl shadow-xl overflow-hidden flex flex-col text-xs animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="px-3 py-1.5 bg-[#FAF9F5] dark:bg-slate-800/90 border-b border-[#CBCBCB]/60 dark:border-slate-700 flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-300">
                    <span>Available Sites ({group.items.length})</span>
                  </div>
                  <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 py-1">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedProductId(item.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`px-3 py-1.5 flex items-center justify-between gap-2 hover:bg-[#FAF9F5] dark:hover:bg-slate-800 cursor-pointer transition-colors ${
                          item.id === selectedProductId
                            ? "bg-[#6D8196]/10 dark:bg-[#6D8196]/20 font-bold"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                          <Building2 className="w-3.5 h-3.5 text-[#6D8196] shrink-0" />
                          <span className="text-xs text-[#4A4A4A] dark:text-slate-200 truncate">
                            {item.site?.name || "Unassigned"}
                          </span>
                          {item.id === selectedProductId && (
                            <Check className="w-3 h-3 text-[#6D8196] shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            #{item.id}
                          </span>
                          {onAddLink && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsDropdownOpen(false);
                                onAddLink(item.id);
                              }}
                              className="px-1.5 py-0.5 text-[10px] font-bold bg-[#6D8196] hover:bg-[#5A6D81] text-white rounded shadow-2xs cursor-pointer flex items-center gap-0.5"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>,
                document.body
              )}
          </div>
        )}

        {onAddLink && (
          <button
            type="button"
            onClick={() => onAddLink(selectedProductId)}
            className="py-1 px-3 bg-[#6D8196] hover:bg-[#5A6D81] active:scale-[0.98] text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Link</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function PendingLinkLogsSection({
  products,
  onAddLink,
  title = "Products Pending Link Logs",
  subtitle = "Newly added products requiring link logs",
}: PendingLinkLogsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSite, setSelectedSite] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isGrouped, setIsGrouped] = useState<boolean>(true);
  const [displayLimit, setDisplayLimit] = useState<number>(12);

  // Extract unique site names with counts
  const siteCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      const siteName = p.site?.name || "Unassigned";
      counts[siteName] = (counts[siteName] || 0) + 1;
    });
    return counts;
  }, [products]);

  const uniqueSites = useMemo(() => Object.keys(siteCounts).sort(), [siteCounts]);

  // Filter individual product records
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !searchQuery.trim() ||
        fuzzyMatchAny([p.name, p.site?.name], searchQuery);
      const matchesSite = selectedSite === "ALL" || (p.site?.name || "Unassigned") === selectedSite;
      return matchesSearch && matchesSite;
    });
  }, [products, searchQuery, selectedSite]);

  // Group filtered products by product name
  const groupedProducts = useMemo(() => {
    const groupsMap = new Map<string, GroupedPendingProduct>();

    filteredProducts.forEach((p) => {
      const key = (p.name || "Untitled Product").trim();
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          name: key,
          items: [],
        });
      }
      groupsMap.get(key)!.items.push(p);
    });

    return Array.from(groupsMap.values());
  }, [filteredProducts]);

  if (!products || products.length === 0) return null;

  const visibleGroups = displayLimit === -1 ? groupedProducts : groupedProducts.slice(0, displayLimit);
  const visibleProducts = displayLimit === -1 ? filteredProducts : filteredProducts.slice(0, displayLimit);
  const totalItemsCount = isGrouped ? groupedProducts.length : filteredProducts.length;
  const hasMore = displayLimit !== -1 && totalItemsCount > displayLimit;

  return (
    <div className="mb-6 bg-white dark:bg-slate-900 border border-[#CBCBCB]/70 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-all duration-200">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-500/20 dark:border-amber-800/50 shadow-xs">
            <AlertTriangle className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#4A4A4A] dark:text-slate-100 tracking-tight">{title}</h3>
              <span className="px-2.5 py-0.5 text-xs font-extrabold bg-[#FFFFE3] dark:bg-amber-950/60 text-[#4A4A4A] dark:text-amber-300 border border-[#CBCBCB] dark:border-amber-800/60 rounded-full">
                {isGrouped
                  ? `${groupedProducts.length} ${groupedProducts.length === 1 ? "Product" : "Products"} (${filteredProducts.length} Links)`
                  : `${products.length} ${products.length === 1 ? "Product" : "Products"}`}
              </span>
            </div>
            <p className="text-xs text-[#737373] dark:text-slate-400 font-medium mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Group Mode Toggle */}
          <div className="flex items-center bg-[#FAF9F5] dark:bg-slate-800 p-0.5 rounded-lg border border-[#CBCBCB]/60 dark:border-slate-700 shadow-2xs">
            <button
              type="button"
              onClick={() => setIsGrouped(true)}
              title="Group by Product Name"
              className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                isGrouped
                  ? "bg-[#6D8196] text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grouped</span>
            </button>
            <button
              type="button"
              onClick={() => setIsGrouped(false)}
              title="Flat View (All Individual Products)"
              className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                !isGrouped
                  ? "bg-[#6D8196] text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <span className="hidden sm:inline">Flat</span>
              <span className="sm:hidden">All</span>
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="hidden sm:flex items-center bg-[#FAF9F5] dark:bg-slate-800 p-0.5 rounded-lg border border-[#CBCBCB]/60 dark:border-slate-700 shadow-2xs">
            <button
              onClick={() => setViewMode("grid")}
              title="Grid View"
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewMode === "grid"
                  ? "bg-[#6D8196] text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              title="List View"
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewMode === "list"
                  ? "bg-[#6D8196] text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Collapse/Expand Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-[#FAF9F5] dark:hover:bg-slate-700 text-[#4A4A4A] dark:text-slate-200 border border-[#CBCBCB] dark:border-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer"
          >
            {isExpanded ? (
              <>
                <span>Collapse</span>
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              </>
            ) : (
              <>
                <span>View ({products.length})</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-[#CBCBCB]/40 dark:border-slate-800 space-y-3">
          {/* Filters & Search Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search pending product or site..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-white dark:bg-slate-800 border border-[#CBCBCB] dark:border-slate-700 rounded-xl text-[#4A4A4A] dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196] shadow-2xs transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Site Chips / Filter Dropdown */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
              <button
                onClick={() => setSelectedSite("ALL")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedSite === "ALL"
                    ? "bg-[#6D8196] text-white shadow-xs"
                    : "bg-white dark:bg-slate-800 hover:bg-[#FAF9F5] dark:hover:bg-slate-700 text-[#4A4A4A] dark:text-slate-200 border border-[#CBCBCB] dark:border-slate-700"
                }`}
              >
                All ({products.length})
              </button>
              {uniqueSites.map((site) => (
                <button
                  key={site}
                  onClick={() => setSelectedSite(site)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                    selectedSite === site
                      ? "bg-[#6D8196] text-white shadow-xs"
                      : "bg-white dark:bg-slate-800 hover:bg-[#FAF9F5] dark:hover:bg-slate-700 text-[#4A4A4A] dark:text-slate-200 border border-[#CBCBCB] dark:border-slate-700"
                  }`}
                >
                  <span>{site}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                      selectedSite === site
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300"
                    }`}
                  >
                    {siteCounts[site]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Product Items Display Area with Scroll Limit */}
          {filteredProducts.length === 0 ? (
            <div className="p-6 text-center bg-[#FAF9F5] dark:bg-slate-800/40 rounded-xl border border-dashed border-[#CBCBCB] dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                No pending products found matching your search.
              </p>
              {(searchQuery || selectedSite !== "ALL") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedSite("ALL");
                  }}
                  className="mt-2 text-xs font-bold text-[#6D8196] hover:text-[#4A4A4A] dark:hover:text-white underline cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="max-h-[380px] overflow-y-auto pr-1 space-y-2">
              {isGrouped ? (
                /* Grouped Views */
                viewMode === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {visibleGroups.map((group) => (
                      <GroupedProductCard key={group.name} group={group} onAddLink={onAddLink} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-[#CBCBCB]/60 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-2xs">
                    {visibleGroups.map((group) => (
                      <GroupedProductRow key={group.name} group={group} onAddLink={onAddLink} />
                    ))}
                  </div>
                )
              ) : (
                /* Flat (Ungrouped) Views */
                viewMode === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {visibleProducts.map((p) => (
                      <div
                        key={p.id}
                        className="group bg-white dark:bg-slate-800/70 hover:bg-[#FAF9F5] dark:hover:bg-slate-800 border border-[#CBCBCB]/60 dark:border-slate-700 hover:border-[#6D8196] rounded-xl p-3 shadow-2xs transition-all flex flex-col justify-between gap-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4
                              className="text-xs font-bold text-[#4A4A4A] dark:text-slate-100 truncate group-hover:text-[#6D8196] transition-colors"
                              title={p.name}
                            >
                              {p.name}
                            </h4>
                            <div className="flex items-center gap-1 mt-1 text-[11px] text-[#737373] dark:text-slate-400 font-medium">
                              <Building2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{p.site?.name || "No Site"}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded-md flex-shrink-0">
                            #{p.id}
                          </span>
                        </div>

                        {onAddLink && (
                          <button
                            onClick={() => onAddLink(p.id)}
                            className="w-full py-1.5 px-3 bg-[#6D8196] hover:bg-[#5A6D81] active:scale-[0.98] text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Link</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-[#CBCBCB]/60 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-2xs">
                    {visibleProducts.map((p) => (
                      <div
                        key={p.id}
                        className="p-2.5 px-4 flex items-center justify-between gap-4 hover:bg-[#FAF9F5] dark:hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-bold text-slate-400">#{p.id}</span>
                          <span
                            className="text-xs font-bold text-[#4A4A4A] dark:text-slate-100 truncate"
                            title={p.name}
                          >
                            {p.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#6D8196]/10 dark:bg-[#6D8196]/30 text-[#3D4F61] dark:text-slate-200 border border-[#6D8196]/20 dark:border-[#6D8196]/40 flex-shrink-0">
                            {p.site?.name || "Unassigned"}
                          </span>
                        </div>

                        {onAddLink && (
                          <button
                            onClick={() => onAddLink(p.id)}
                            className="py-1 px-3 bg-[#6D8196] hover:bg-[#5A6D81] active:scale-[0.98] text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer flex-shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Link</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

          {/* Footer Count / Show All Controls */}
          <div className="pt-2 flex items-center justify-between text-xs text-[#737373] dark:text-slate-400 border-t border-[#CBCBCB]/30 dark:border-slate-800">
            <span>
              {isGrouped ? (
                <>
                  Showing {visibleGroups.length} of {groupedProducts.length} unique products ({filteredProducts.length} pending links)
                </>
              ) : (
                <>
                  Showing {visibleProducts.length} of {filteredProducts.length} pending products
                </>
              )}
            </span>
            {hasMore ? (
              <button
                onClick={() => setDisplayLimit(-1)}
                className="font-bold text-[#6D8196] hover:text-[#4A4A4A] dark:hover:text-white hover:underline cursor-pointer"
              >
                Show all ({isGrouped ? groupedProducts.length : filteredProducts.length})
              </button>
            ) : (
              (isGrouped ? groupedProducts.length : filteredProducts.length) > 12 && (
                <button
                  onClick={() => setDisplayLimit(12)}
                  className="font-bold text-[#6D8196] hover:text-[#4A4A4A] dark:hover:text-white hover:underline cursor-pointer"
                >
                  Show less
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
