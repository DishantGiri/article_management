"use client";

import { useState, useMemo } from "react";
import {
  Users,
  User,
  Search,
  Globe,
  Link2,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Edit,
  Clock,
  Info,
  ShieldCheck,
  Filter,
  Layers,
  CheckCircle2,
  Building2,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCountryFlag } from "@/lib/geo-constants";
import CustomSelect from "@/components/CustomSelect";

interface LinkLog {
  id: number;
  allLinkIds?: number[];
  productId: number;
  affiliateName: string;
  affiliateLink: string;
  bridgePageLink?: string;
  buyLink?: string;
  linkerRemarks?: string | null;
  status: string;
  addedAt: string;
  geos: { id?: number; geo: string; affiliateLink?: string | null; affiliateName?: string | null }[];
  addedBy?: { id?: number; name?: string; role?: string | null; email?: string | null } | null;
  updatedBy?: { id?: number; name?: string; role?: string | null; email?: string | null } | null;
  product: {
    name: string;
    slug?: string | null;
    site?: { id?: number; name: string };
    article?: { articleLink?: string | null };
  };
}

interface UserLinksViewProps {
  links: LinkLog[];
  onEditLink?: (link: LinkLog) => void;
  onViewHistory?: (link: LinkLog) => void;
  onViewRemarks?: (data: { remarks: string; date?: string; productName?: string }) => void;
  currentUserRole?: string;
}

const ensureExternalUrl = (url: string | null | undefined) => {
  if (!url) return "";
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const STATUS_STYLES: Record<string, string> = {
  ACCEPTED: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  REQUESTED: "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  CANCELED: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  ISSUE: "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 animate-pulse",
  NEED_TO_CHECK: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
};

const ROLE_BADGE_STYLES: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  ADMIN: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
  LINKER: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  PRODUCT_RESEARCHER: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  TEAM_LEAD: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  WRITER: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
};

export default function UserLinksView({
  links,
  onEditLink,
  onViewHistory,
  onViewRemarks,
  currentUserRole,
}: UserLinksViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>("ALL");
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"most-links" | "recent" | "name">("most-links");
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedGeosByLink, setSelectedGeosByLink] = useState<Record<number, string>>({});

  const canEdit =
    currentUserRole === "SUPER_ADMIN" ||
    currentUserRole === "ADMIN" ||
    currentUserRole === "LINKER";

  const handleCopy = (text: string, key: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Copied ${label}!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyAllUserLinks = (userLinks: LinkLog[], userName: string) => {
    const lines: string[] = [];
    userLinks.forEach((l) => {
      lines.push(`Product: ${l.product?.name || "Product"}`);
      lines.push(`Site: ${l.product?.site?.name || "Site"}`);
      if (l.bridgePageLink) lines.push(`Bridge: ${l.bridgePageLink}`);
      if (l.buyLink) lines.push(`Buy Now: ${l.buyLink}`);
      if (l.affiliateLink) lines.push(`Affiliate: ${l.affiliateLink}`);
      (l.geos || []).forEach((g) => {
        if (g.affiliateLink && g.affiliateLink !== l.affiliateLink) {
          lines.push(`  - ${g.geo}: ${g.affiliateLink}`);
        }
      });
      lines.push("---");
    });
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success(`Copied all links for ${userName}!`);
  };

  // Group all links by adder user
  const groupedUserData = useMemo(() => {
    const userMap = new Map<
      string,
      {
        userName: string;
        userId?: number;
        userRole?: string | null;
        userEmail?: string | null;
        links: LinkLog[];
        acceptedCount: number;
        requestedCount: number;
        issueCount: number;
        sitesSet: Set<string>;
        affiliatesSet: Set<string>;
        geosSet: Set<string>;
        latestDate: Date;
      }
    >();

    for (const l of links) {
      const uName = l.addedBy?.name?.trim() || "Unassigned";
      const uId = l.addedBy?.id;
      const uRole = l.addedBy?.role;
      const uEmail = l.addedBy?.email;

      if (!userMap.has(uName)) {
        userMap.set(uName, {
          userName: uName,
          userId: uId,
          userRole: uRole,
          userEmail: uEmail,
          links: [],
          acceptedCount: 0,
          requestedCount: 0,
          issueCount: 0,
          sitesSet: new Set<string>(),
          affiliatesSet: new Set<string>(),
          geosSet: new Set<string>(),
          latestDate: new Date(l.addedAt || 0),
        });
      }

      const entry = userMap.get(uName)!;
      entry.links.push(l);

      if (l.status === "ACCEPTED") entry.acceptedCount += 1;
      else if (l.status === "REQUESTED") entry.requestedCount += 1;
      else if (l.status === "ISSUE" || l.status === "NEED_TO_CHECK" || l.status === "ALERT") {
        entry.issueCount += 1;
      }

      if (l.product?.site?.name) entry.sitesSet.add(l.product.site.name);
      if (l.affiliateName) entry.affiliatesSet.add(l.affiliateName);
      (l.geos || []).forEach((g) => {
        if (g.geo) entry.geosSet.add(g.geo);
      });

      const itemDate = new Date(l.addedAt);
      if (itemDate > entry.latestDate) {
        entry.latestDate = itemDate;
      }
    }

    const list = Array.from(userMap.values()).map((u) => ({
      ...u,
      totalLinks: u.links.length,
      sites: Array.from(u.sitesSet).sort(),
      affiliates: Array.from(u.affiliatesSet).sort(),
      geos: Array.from(u.geosSet).sort(),
    }));

    return list;
  }, [links]);

  // Extract all distinct sites across all links
  const allSites = useMemo(() => {
    const set = new Set<string>();
    links.forEach((l) => {
      if (l.product?.site?.name) set.add(l.product.site.name);
    });
    return Array.from(set).sort();
  }, [links]);

  // Filter and sort user groups
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return groupedUserData
      .map((u) => {
        // If a specific user is selected, skip others
        if (selectedUserFilter !== "ALL" && u.userName !== selectedUserFilter) {
          return null;
        }

        // Filter this user's links based on search query, site, and status
        const matchedLinks = u.links.filter((l) => {
          // Site filter
          if (selectedSiteFilter !== "ALL" && l.product?.site?.name !== selectedSiteFilter) {
            return false;
          }

          // Status filter
          if (selectedStatusFilter !== "ALL") {
            if (selectedStatusFilter === "ISSUE") {
              if (l.status !== "ISSUE" && l.status !== "NEED_TO_CHECK" && l.status !== "ALERT") {
                return false;
              }
            } else if (l.status !== selectedStatusFilter) {
              return false;
            }
          }

          // Search query matching
          if (!q) return true;

          const matchName = l.product?.name?.toLowerCase().includes(q);
          const matchSlug = l.product?.slug?.toLowerCase().includes(q);
          const matchSite = l.product?.site?.name?.toLowerCase().includes(q);
          const matchAff = l.affiliateName?.toLowerCase().includes(q);
          const matchRemarks = l.linkerRemarks?.toLowerCase().includes(q);
          const matchGeos = (l.geos || []).some((g) => g.geo?.toLowerCase().includes(q));
          const matchUserName = u.userName.toLowerCase().includes(q);

          return matchName || matchSlug || matchSite || matchAff || matchRemarks || matchGeos || matchUserName;
        });

        if (matchedLinks.length === 0 && q && !u.userName.toLowerCase().includes(q)) {
          return null;
        }

        return {
          ...u,
          filteredLinks: matchedLinks,
        };
      })
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
      .sort((a, b) => {
        if (sortBy === "most-links") {
          return b.filteredLinks.length - a.filteredLinks.length;
        }
        if (sortBy === "recent") {
          return b.latestDate.getTime() - a.latestDate.getTime();
        }
        return a.userName.localeCompare(b.userName);
      });
  }, [groupedUserData, searchQuery, selectedUserFilter, selectedSiteFilter, selectedStatusFilter, sortBy]);

  // High-level metrics across all links in this view
  const totalStats = useMemo(() => {
    let accepted = 0;
    let pending = 0;
    let issues = 0;
    links.forEach((l) => {
      if (l.status === "ACCEPTED") accepted += 1;
      else if (l.status === "REQUESTED") pending += 1;
      else if (l.status === "ISSUE" || l.status === "NEED_TO_CHECK" || l.status === "ALERT") issues += 1;
    });
    return {
      totalUsers: groupedUserData.length,
      totalLinks: links.length,
      accepted,
      pending,
      issues,
    };
  }, [groupedUserData, links]);

  const toggleUserExpand = (userName: string) => {
    setExpandedUsers((prev) => ({
      ...prev,
      [userName]: !prev[userName],
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    filteredUsers.forEach((u) => {
      next[u.userName] = true;
    });
    setExpandedUsers(next);
  };

  const collapseAll = () => {
    setExpandedUsers({});
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Stat Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Users
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white mt-1">
            {totalStats.totalUsers}
          </p>
          <span className="text-[10px] text-slate-400 font-medium">Linkers & Admins</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Mapped Links
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Link2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
            {totalStats.totalLinks}
          </p>
          <span className="text-[10px] text-slate-400 font-medium">Across all network sites</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Accepted Links
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {totalStats.accepted}
          </p>
          <span className="text-[10px] text-slate-400 font-medium">Verified active links</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Flagged / Issues
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
            {totalStats.issues}
          </p>
          <span className="text-[10px] text-slate-400 font-medium">Requires linker check</span>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user, product, site, or affiliate..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter by Specific User */}
            <div className="w-44 shrink-0">
              <CustomSelect
                value={selectedUserFilter}
                onChange={(val) => setSelectedUserFilter(val || "ALL")}
                options={[
                  { value: "ALL", label: "All Users" },
                  ...groupedUserData.map((u) => ({
                    value: u.userName,
                    label: `${u.userName} (${u.totalLinks})`,
                  })),
                ]}
                placeholder="Select User..."
                triggerClassName="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs"
              />
            </div>

            {/* Filter by Site */}
            <div className="w-44 shrink-0">
              <CustomSelect
                value={selectedSiteFilter}
                onChange={(val) => setSelectedSiteFilter(val || "ALL")}
                options={[
                  { value: "ALL", label: "All Sites" },
                  ...allSites.map((s) => ({ value: s, label: s })),
                ]}
                placeholder="All Sites"
                triggerClassName="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs"
              />
            </div>

            {/* Filter by Status */}
            <div className="w-36 shrink-0">
              <CustomSelect
                value={selectedStatusFilter}
                onChange={(val) => setSelectedStatusFilter(val || "ALL")}
                options={[
                  { value: "ALL", label: "All Statuses" },
                  { value: "ACCEPTED", label: "Accepted" },
                  { value: "REQUESTED", label: "Requested" },
                  { value: "ISSUE", label: "Issues" },
                  { value: "CANCELED", label: "Canceled" },
                ]}
                placeholder="All Statuses"
                triggerClassName="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs"
              />
            </div>
          </div>

          {/* Controls: Sort and Expand/Collapse */}
          <div className="flex items-center gap-2">
            <div className="w-36 shrink-0">
              <CustomSelect
                value={sortBy}
                onChange={(val: any) => setSortBy(val)}
                options={[
                  { value: "most-links", label: "Most Links" },
                  { value: "recent", label: "Recent Activity" },
                  { value: "name", label: "Name (A-Z)" },
                ]}
                placeholder="Sort By"
                triggerClassName="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs"
              />
            </div>

            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer whitespace-nowrap"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer whitespace-nowrap"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* User Groups List */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800">
          <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No users or link logs match the current filters</p>
          <p className="text-xs text-slate-400 mt-1">Try resetting the search query or status/site filters.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedUserFilter("ALL");
              setSelectedSiteFilter("ALL");
              setSelectedStatusFilter("ALL");
            }}
            className="mt-3 px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredUsers.map((userItem) => {
            const isExpanded = expandedUsers[userItem.userName] ?? true; // Default expanded for ease of access
            const roleStyle = userItem.userRole ? ROLE_BADGE_STYLES[userItem.userRole] || "bg-slate-100 text-slate-700" : "bg-slate-100 text-slate-700";

            return (
              <div
                key={userItem.userName}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden transition-all duration-200"
              >
                {/* User Header Accordion Trigger */}
                <div
                  onClick={() => toggleUserExpand(userItem.userName)}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-850/60 cursor-pointer transition select-none border-b border-transparent data-[expanded=true]:border-slate-100 dark:data-[expanded=true]:border-slate-800"
                  data-expanded={isExpanded}
                >
                  {/* Left: User Avatar + Name + Badges */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                      {userItem.userName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                          {userItem.userName}
                        </h3>
                        {userItem.userRole && (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${roleStyle}`}>
                            {userItem.userRole.replace(/_/g, " ")}
                          </span>
                        )}
                        {userItem.userEmail && (
                          <span className="hidden sm:inline text-xs text-slate-400 font-normal">
                            ({userItem.userEmail})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                        <span>
                          Active on {userItem.sites.length} site{userItem.sites.length !== 1 ? "s" : ""}
                        </span>
                        <span>•</span>
                        <span>
                          Last added {userItem.latestDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Metrics + Action Buttons */}
                  <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-between md:justify-end shrink-0">
                    {/* Metric Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold">
                        {userItem.filteredLinks.length} Link{userItem.filteredLinks.length !== 1 ? "s" : ""}
                      </span>

                      {userItem.acceptedCount > 0 && (
                        <span className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold">
                          ✓ {userItem.acceptedCount} Accepted
                        </span>
                      )}

                      {userItem.issueCount > 0 && (
                        <span className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold animate-pulse">
                          ⚠ {userItem.issueCount} Issues
                        </span>
                      )}
                    </div>

                    {/* Copy All Links Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyAllUserLinks(userItem.filteredLinks, userItem.userName);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer flex items-center gap-1 shrink-0"
                      title="Copy all links for this user"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Copy All</span>
                    </button>

                    {/* Expand/Collapse Chevron */}
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Links Section */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 pt-0 space-y-3">
                    {/* Sites Chips for this user */}
                    {userItem.sites.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mr-1">
                          <Globe className="w-3 h-3 text-slate-400" />
                          Publishing Sites:
                        </span>
                        {userItem.sites.map((siteName) => (
                          <span
                            key={siteName}
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#6D8196]/15 dark:bg-[#6D8196]/30 text-[#3D4F61] dark:text-sky-200 border border-[#6D8196]/30"
                          >
                            {siteName}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* User Link Cards Grid */}
                    <div className="grid grid-cols-1 gap-2.5 pt-2">
                      {userItem.filteredLinks.map((link) => {
                        const statusStyle = STATUS_STYLES[link.status] || STATUS_STYLES.REQUESTED;
                        const selectedGeo = selectedGeosByLink[link.productId] || "";
                        const selectedGeoItem = (link.geos || []).find((g) => g.geo === selectedGeo);

                        const activeAffiliateName = selectedGeoItem
                          ? (selectedGeoItem.affiliateName || link.affiliateName || "-")
                          : (link.affiliateName || link.geos?.[0]?.affiliateName || "-");

                        const activeAffiliateLink = selectedGeoItem
                          ? (selectedGeoItem.affiliateLink || link.affiliateLink || "")
                          : (link.affiliateLink || link.geos?.[0]?.affiliateLink || "");

                        return (
                          <div
                            key={link.id}
                            className="p-3.5 sm:p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 hover:bg-white dark:hover:bg-slate-850 transition flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs group"
                          >
                            {/* Product & Site Info */}
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                                  {link.product?.name}
                                </span>
                                {link.product?.site?.name && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#6D8196]/15 dark:bg-[#6D8196]/30 text-[#3D4F61] dark:text-sky-200 border border-[#6D8196]/30">
                                    {link.product.site.name}
                                  </span>
                                )}
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${statusStyle}`}>
                                  {link.status}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                                <span className="font-mono text-[11px] text-slate-400">
                                  /{link.product?.slug || link.product?.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
                                </span>
                                <span>•</span>
                                <span>Added {new Date(link.addedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                                {link.updatedBy?.name && link.updatedBy.name !== userItem.userName && (
                                  <>
                                    <span>•</span>
                                    <span className="text-blue-600 dark:text-blue-400">
                                      Modified by {link.updatedBy.name}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* URLs & Routing Columns */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap md:flex-nowrap shrink-0">
                              {/* Affiliate Link with Country Selector */}
                              <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1 min-w-[200px] max-w-[280px]">
                                <div className="flex items-center justify-between gap-1 text-[10px]">
                                  <span className="font-bold text-slate-600 dark:text-slate-300 truncate">
                                    {activeAffiliateName}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {(link.geos || []).slice(0, 3).map((g) => (
                                      <button
                                        key={g.geo}
                                        type="button"
                                        onClick={() =>
                                          setSelectedGeosByLink((prev) => ({
                                            ...prev,
                                            [link.productId]: prev[link.productId] === g.geo ? "" : g.geo,
                                          }))
                                        }
                                        className={`px-1 py-0.2 rounded text-[9px] font-bold uppercase cursor-pointer border ${
                                          selectedGeo === g.geo
                                            ? "bg-blue-600 text-white border-blue-600"
                                            : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600"
                                        }`}
                                      >
                                        {getCountryFlag(g.geo)} {g.geo}
                                      </button>
                                    ))}
                                    {(link.geos?.length || 0) > 3 && (
                                      <span className="text-[9px] text-slate-400">+{link.geos.length - 3}</span>
                                    )}
                                  </div>
                                </div>

                                {activeAffiliateLink ? (
                                  <div className="flex items-center gap-1">
                                    <a
                                      href={ensureExternalUrl(activeAffiliateLink)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs font-mono text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[190px]"
                                      title={activeAffiliateLink}
                                    >
                                      {activeAffiliateLink.replace(/^https?:\/\/(www\.)?/, "")}
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(activeAffiliateLink, `aff-${link.id}`, "Affiliate Link")}
                                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer ml-auto"
                                      title="Copy affiliate link"
                                    >
                                      {copiedKey === `aff-${link.id}` ? (
                                        <Check className="w-3 h-3 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                    <a
                                      href={ensureExternalUrl(activeAffiliateLink)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                      title="Open link"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">No link</span>
                                )}
                              </div>

                              {/* Bridge Page Link */}
                              {link.bridgePageLink && (
                                <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 min-w-[150px] max-w-[200px] flex items-center justify-between gap-1">
                                  <div className="min-w-0">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Bridge</span>
                                    <a
                                      href={ensureExternalUrl(link.bridgePageLink)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs font-mono text-indigo-600 dark:text-indigo-400 hover:underline truncate block"
                                      title={link.bridgePageLink}
                                    >
                                      {link.bridgePageLink.replace(/^https?:\/\/(www\.)?/, "")}
                                    </a>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(link.bridgePageLink!, `bridge-${link.id}`, "Bridge Link")}
                                    className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    title="Copy bridge link"
                                  >
                                    {copiedKey === `bridge-${link.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              )}

                              {/* Buy Now Link */}
                              {link.buyLink && (
                                <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 min-w-[150px] max-w-[200px] flex items-center justify-between gap-1">
                                  <div className="min-w-0">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Buy Now</span>
                                    <a
                                      href={ensureExternalUrl(link.buyLink)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs font-mono text-emerald-600 dark:text-emerald-400 hover:underline truncate block"
                                      title={link.buyLink}
                                    >
                                      {link.buyLink.replace(/^https?:\/\/(www\.)?/, "")}
                                    </a>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(link.buyLink!, `buy-${link.id}`, "Buy Link")}
                                    className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    title="Copy buy link"
                                  >
                                    {copiedKey === `buy-${link.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Actions Column */}
                            <div className="flex items-center gap-1.5 shrink-0 justify-end">
                              {link.linkerRemarks && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onViewRemarks?.({
                                      remarks: link.linkerRemarks || "",
                                      date: link.addedAt,
                                      productName: link.product?.name,
                                    })
                                  }
                                  className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold cursor-pointer transition"
                                  title="View Remarks"
                                >
                                  <Info className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {onViewHistory && (
                                <button
                                  type="button"
                                  onClick={() => onViewHistory(link)}
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer transition"
                                  title="View Edit History"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {canEdit && onEditLink && (
                                <button
                                  type="button"
                                  onClick={() => onEditLink(link)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-2xs cursor-pointer"
                                  title="Edit Link Configuration"
                                >
                                  <Edit className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
