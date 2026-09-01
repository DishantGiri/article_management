"use client";

import { useState, useMemo } from "react";
import { Search, AlertTriangle, Plus, ChevronDown, ChevronUp, LayoutGrid, List, Filter, X, Building2 } from "lucide-react";

interface PendingProduct {
  id: number;
  name: string;
  site?: {
    id?: number;
    name: string;
  };
  createdAt?: string;
}

interface PendingLinkLogsSectionProps {
  products: PendingProduct[];
  onAddLink?: (productId: number) => void;
  title?: string;
  subtitle?: string;
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

  // Filter products by search and site
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.site?.name && p.site.name.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesSite = selectedSite === "ALL" || (p.site?.name || "Unassigned") === selectedSite;
      return matchesSearch && matchesSite;
    });
  }, [products, searchQuery, selectedSite]);

  if (!products || products.length === 0) return null;

  const visibleProducts = displayLimit === -1 ? filteredProducts : filteredProducts.slice(0, displayLimit);
  const hasMore = displayLimit !== -1 && filteredProducts.length > displayLimit;

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
                {products.length} {products.length === 1 ? "Product" : "Products"}
              </span>
            </div>
            <p className="text-xs text-[#737373] dark:text-slate-400 font-medium mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="hidden sm:flex items-center bg-[#FAF9F5] dark:bg-slate-800 p-0.5 rounded-lg border border-[#CBCBCB]/60 dark:border-slate-700 shadow-2xs">
            <button
              onClick={() => setViewMode("grid")}
              title="Grid View"
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewMode === "grid" ? "bg-[#6D8196] text-white shadow-2xs" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              title="List View"
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewMode === "list" ? "bg-[#6D8196] text-white shadow-2xs" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
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
                placeholder="Search pending product..."
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
                      selectedSite === site ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300"
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
            <div className="p-6 text-center bg-[#FAF9F5] rounded-xl border border-dashed border-[#CBCBCB]">
              <p className="text-xs text-slate-500 font-medium">No pending products found matching your search.</p>
              {(searchQuery || selectedSite !== "ALL") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedSite("ALL");
                  }}
                  className="mt-2 text-xs font-bold text-[#6D8196] hover:text-[#4A4A4A] underline cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="max-h-[340px] overflow-y-auto pr-1 space-y-2">
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {visibleProducts.map((p) => (
                    <div
                      key={p.id}
                      className="group bg-white dark:bg-slate-800/70 hover:bg-[#FAF9F5] dark:hover:bg-slate-800 border border-[#CBCBCB]/60 dark:border-slate-700 hover:border-[#6D8196] rounded-xl p-3 shadow-2xs transition-all flex flex-col justify-between gap-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-[#4A4A4A] dark:text-slate-100 truncate group-hover:text-[#6D8196] transition-colors" title={p.name}>
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
                    <div key={p.id} className="p-2.5 px-4 flex items-center justify-between gap-4 hover:bg-[#FAF9F5] dark:hover:bg-slate-800 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-bold text-slate-400">#{p.id}</span>
                        <span className="text-xs font-bold text-[#4A4A4A] dark:text-slate-100 truncate" title={p.name}>
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
              )}
            </div>
          )}

          {/* Footer Count / Show All Controls */}
          <div className="pt-2 flex items-center justify-between text-xs text-[#737373] border-t border-[#CBCBCB]/30">
            <span>
              Showing {visibleProducts.length} of {filteredProducts.length} pending products
            </span>
            {hasMore ? (
              <button
                onClick={() => setDisplayLimit(-1)}
                className="font-bold text-[#6D8196] hover:text-[#4A4A4A] hover:underline cursor-pointer"
              >
                Show all ({filteredProducts.length})
              </button>
            ) : (
              filteredProducts.length > 12 && (
                <button
                  onClick={() => setDisplayLimit(12)}
                  className="font-bold text-[#6D8196] hover:text-[#4A4A4A] hover:underline cursor-pointer"
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
