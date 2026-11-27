/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users,
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
  CheckCircle2,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCountryFlag } from "@/lib/geo-constants";
import CustomSelect from "@/components/CustomSelect";
import LoadingScreen from "@/components/LoadingScreen";

interface LinkLog {
  id: string;
  allLinkIds?: string[];
  productId: string;
  affiliateName: string;
  affiliateLink: string;
  bridgePageLink?: string;
  buyLink?: string;
  linkerRemarks?: string | null;
  status: string;
  addedAt: string;
  geos: { id?: string; geo: string; affiliateLink?: string | null; affiliateName?: string | null }[];
  addedBy?: { id?: string; name?: string; role?: string | null; email?: string | null } | null;
  updatedBy?: { id?: string; name?: string; role?: string | null; email?: string | null } | null;
  product: {
    name: string;
    slug?: string | null;
    site?: { id?: string; name: string };
    article?: { articleLink?: string | null };
  };
}

interface UserGroupSummary {
  userId: string;
  userName: string;
  userRole?: string | null;
  userEmail?: string | null;
  filteredCount: number;
  totalLinks: number;
  acceptedCount: number;
  requestedCount: number;
  issueCount: number;
  sites: string[];
  latestDate: string;
}

interface UserLinksPageState {
  items: LinkLog[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
}

interface UserLinksViewProps {
  onEditLink?: (link: LinkLog) => void;
  onViewHistory?: (link: LinkLog) => void;
  onViewRemarks?: (data: { remarks: string; date?: string; productName?: string }) => void;
  currentUserRole?: string;
  refreshTrigger?: number;
}

const LINKS_PER_USER_PAGE = 10;
const USERS_PER_PAGE = 15;

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
  onEditLink,
  onViewHistory,
  onViewRemarks,
  currentUserRole,
  refreshTrigger = 0,
}: UserLinksViewProps) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>("ALL");
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"most-links" | "recent" | "name">("most-links");
  const [userPage, setUserPage] = useState(1);

  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summary, setSummary] = useState({
    totalUsers: 0,
    totalLinks: 0,
    accepted: 0,
    pending: 0,
    issues: 0,
  });
  const [allUsersForFilter, setAllUsersForFilter] = useState<
    Array<{ userId: string; userName: string; totalLinks: number }>
  >([]);
  const [allSites, setAllSites] = useState<string[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroupSummary[]>([]);
  const [userPagination, setUserPagination] = useState({
    total: 0,
    page: 1,
    limit: USERS_PER_PAGE,
    totalPages: 1,
  });

  // Collapsed by default so large datasets (17k+ links) never mount all DOM cards at once
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
  const [userLinksMap, setUserLinksMap] = useState<Record<string, UserLinksPageState>>({});
  const [copyingUserId, setCopyingUserId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedGeosByLink, setSelectedGeosByLink] = useState<Record<string, string>>({});

  const expandedRef = useRef(expandedUsers);
  expandedRef.current = expandedUsers;

  const canEdit =
    currentUserRole === "SUPER_ADMIN" ||
    currentUserRole === "ADMIN" ||
    currentUserRole === "LINKER";

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setUserPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchUserLinksPage = useCallback(
    async (targetUserId: string, pageNum: number) => {
      setUserLinksMap((prev) => ({
        ...prev,
        [targetUserId]: {
          items: prev[targetUserId]?.items || [],
          total: prev[targetUserId]?.total || 0,
          page: pageNum,
          totalPages: prev[targetUserId]?.totalPages || 1,
          loading: true,
        },
      }));

      try {
        const params = new URLSearchParams({
          targetUserId,
          page: String(pageNum),
          limit: String(LINKS_PER_USER_PAGE),
        });
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (selectedSiteFilter !== "ALL") params.set("site", selectedSiteFilter);
        if (selectedStatusFilter !== "ALL") params.set("status", selectedStatusFilter);

        const res = await fetch(`/api/links/by-user?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load user links");
        const data = await res.json();

        setUserLinksMap((prev) => ({
          ...prev,
          [targetUserId]: {
            items: Array.isArray(data.items) ? data.items : [],
            total: data.pagination?.total || 0,
            page: data.pagination?.page || pageNum,
            totalPages: data.pagination?.totalPages || 1,
            loading: false,
          },
        }));
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch links for user");
        setUserLinksMap((prev) => ({
          ...prev,
          [targetUserId]: {
            items: prev[targetUserId]?.items || [],
            total: prev[targetUserId]?.total || 0,
            page: pageNum,
            totalPages: prev[targetUserId]?.totalPages || 1,
            loading: false,
          },
        }));
      }
    },
    [debouncedSearch, selectedSiteFilter, selectedStatusFilter]
  );

  // Fetch user summaries from server
  useEffect(() => {
    let active = true;
    const loadSummary = async () => {
      setLoadingSummary(true);
      try {
        const params = new URLSearchParams({
          page: String(userPage),
          limit: String(USERS_PER_PAGE),
          sortBy,
        });
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (selectedUserFilter !== "ALL") params.set("selectedUserId", selectedUserFilter);
        if (selectedSiteFilter !== "ALL") params.set("site", selectedSiteFilter);
        if (selectedStatusFilter !== "ALL") params.set("status", selectedStatusFilter);

        const res = await fetch(`/api/links/by-user?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load summary");
        const data = await res.json();
        if (!active) return;

        setSummary(
          data.summary || { totalUsers: 0, totalLinks: 0, accepted: 0, pending: 0, issues: 0 }
        );
        setAllUsersForFilter(Array.isArray(data.allUsersForFilter) ? data.allUsersForFilter : []);
        setAllSites(Array.isArray(data.allSites) ? data.allSites : []);
        const nextUsers: UserGroupSummary[] = Array.isArray(data.users) ? data.users : [];
        setUserGroups(nextUsers);
        setUserPagination(
          data.pagination || { total: nextUsers.length, page: 1, limit: USERS_PER_PAGE, totalPages: 1 }
        );

        // Reset cached per-user link pages on filter/refresh and re-fetch any currently expanded users
        setUserLinksMap({});
        const visibleIds = new Set(nextUsers.map((u) => u.userId));
        for (const [uid, isExp] of Object.entries(expandedRef.current)) {
          if (isExp && visibleIds.has(uid)) {
            fetchUserLinksPage(uid, 1);
          }
        }
      } catch (err) {
        console.error(err);
        if (active) toast.error("Failed to load Links by User");
      } finally {
        if (active) setLoadingSummary(false);
      }
    };

    loadSummary();
    return () => {
      active = false;
    };
  }, [
    userPage,
    sortBy,
    debouncedSearch,
    selectedUserFilter,
    selectedSiteFilter,
    selectedStatusFilter,
    refreshTrigger,
    fetchUserLinksPage,
  ]);

  const handleCopy = (text: string, key: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Copied ${label}!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyAllUserLinks = async (targetUserId: string, userName: string) => {
    setCopyingUserId(targetUserId);
    try {
      const params = new URLSearchParams({
        targetUserId,
        all: "true",
      });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (selectedSiteFilter !== "ALL") params.set("site", selectedSiteFilter);
      if (selectedStatusFilter !== "ALL") params.set("status", selectedStatusFilter);

      const res = await fetch(`/api/links/by-user?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch links to copy");
      const data = await res.json();
      const userLinks: LinkLog[] = Array.isArray(data.items) ? data.items : [];

      if (userLinks.length === 0) {
        toast.error("No links to copy");
        return;
      }

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
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success(`Copied ${userLinks.length} links for ${userName}!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to copy links");
    } finally {
      setCopyingUserId(null);
    }
  };

  const toggleUserExpand = (uid: string) => {
    const nextExpanded = !(expandedUsers[uid] ?? false);
    setExpandedUsers((prev) => ({
      ...prev,
      [uid]: nextExpanded,
    }));
    if (nextExpanded && !userLinksMap[uid]) {
      fetchUserLinksPage(uid, 1);
    }
  };

  const expandVisible = () => {
    const next: Record<string, boolean> = { ...expandedUsers };
    userGroups.forEach((u) => {
      next[u.userId] = true;
      if (!userLinksMap[u.userId]) {
        fetchUserLinksPage(u.userId, 1);
      }
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
            {summary.totalUsers}
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
            {summary.totalLinks}
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
            {summary.accepted}
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
            {summary.issues}
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
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search user, product, site, or affiliate..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter by Specific User */}
            <div className="w-48 shrink-0">
              <CustomSelect
                value={selectedUserFilter}
                onChange={(val) => {
                  setSelectedUserFilter(val || "ALL");
                  setUserPage(1);
                }}
                options={[
                  { value: "ALL", label: "All Users" },
                  ...allUsersForFilter.map((u) => ({
                    value: u.userId,
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
                onChange={(val) => {
                  setSelectedSiteFilter(val || "ALL");
                  setUserPage(1);
                }}
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
                onChange={(val) => {
                  setSelectedStatusFilter(val || "ALL");
                  setUserPage(1);
                }}
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
                onChange={(val: any) => {
                  setSortBy(val);
                  setUserPage(1);
                }}
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
              onClick={expandVisible}
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
      {loadingSummary ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 border border-slate-200 dark:border-slate-800">
          <LoadingScreen
            message="Loading user link summaries..."
            subtext="Aggregating statistics and user activity"
            size="md"
          />
        </div>
      ) : userGroups.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800">
          <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            No users or link logs match the current filters
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Try resetting the search query or status/site filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setDebouncedSearch("");
              setSelectedUserFilter("ALL");
              setSelectedSiteFilter("ALL");
              setSelectedStatusFilter("ALL");
              setUserPage(1);
            }}
            className="mt-3 px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {userGroups.map((userItem) => {
            const isExpanded = expandedUsers[userItem.userId] ?? false;
            const pageState = userLinksMap[userItem.userId];
            const roleStyle = userItem.userRole
              ? ROLE_BADGE_STYLES[userItem.userRole] || "bg-slate-100 text-slate-700"
              : "bg-slate-100 text-slate-700";

            const userItemPages = pageState?.totalPages || 1;
            const userItemCurrentPage = pageState?.page || 1;
            const userItemTotal = pageState?.total ?? userItem.filteredCount;
            const blockSize = 5;
            const blockIdx = Math.floor((userItemCurrentPage - 1) / blockSize);
            const blockStart = blockIdx * blockSize + 1;
            const blockEnd = Math.min(userItemPages, blockStart + blockSize - 1);
            const innerPages: number[] = [];
            for (let p = blockStart; p <= blockEnd; p++) innerPages.push(p);

            return (
              <div
                key={userItem.userId}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden transition-all duration-200"
              >
                {/* User Header Accordion Trigger */}
                <div
                  onClick={() => toggleUserExpand(userItem.userId)}
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
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${roleStyle}`}
                          >
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
                          Active on {userItem.sites.length} site
                          {userItem.sites.length !== 1 ? "s" : ""}
                        </span>
                        <span>•</span>
                        <span>
                          Last added{" "}
                          {new Date(userItem.latestDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Metrics + Action Buttons */}
                  <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-between md:justify-end shrink-0">
                    {/* Metric Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold">
                        {userItem.filteredCount} Link{userItem.filteredCount !== 1 ? "s" : ""}
                      </span>

                      {userItem.acceptedCount > 0 && (
                        <span className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold">
                          ✓ {userItem.acceptedCount} Accepted
                        </span>
                      )}

                      {userItem.issueCount > 0 && (
                        <span className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold">
                          ⚠ {userItem.issueCount} Issues
                        </span>
                      )}
                    </div>

                    {/* Copy All Links Button */}
                    <button
                      type="button"
                      disabled={copyingUserId === userItem.userId}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyAllUserLinks(userItem.userId, userItem.userName);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer flex items-center gap-1 shrink-0 disabled:opacity-50"
                      title="Copy all links for this user"
                    >
                      {copyingUserId === userItem.userId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">Copy All</span>
                    </button>

                    {/* Expand/Collapse Chevron */}
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Links Section (Server-Side Paginated 10/page) */}
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

                    {pageState?.loading ? (
                      <div className="py-8 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        <span>Loading {userItem.userName}&apos;s links (Page {userItemCurrentPage})...</span>
                      </div>
                    ) : !pageState || pageState.items.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400 italic">
                        No matching links found for {userItem.userName}.
                      </div>
                    ) : (
                      <>
                        {/* User Link Cards Grid */}
                        <div className="grid grid-cols-1 gap-2.5 pt-2">
                          {pageState.items.map((link) => {
                            const statusStyle =
                              STATUS_STYLES[link.status] || STATUS_STYLES.REQUESTED;
                            const selectedGeo = selectedGeosByLink[link.productId] || "";
                            const selectedGeoItem = (link.geos || []).find(
                              (g) => g.geo === selectedGeo
                            );

                            const activeAffiliateName = selectedGeoItem
                              ? selectedGeoItem.affiliateName || link.affiliateName || "-"
                              : link.affiliateName || link.geos?.[0]?.affiliateName || "-";

                            const activeAffiliateLink = selectedGeoItem
                              ? selectedGeoItem.affiliateLink || link.affiliateLink || ""
                              : link.affiliateLink || link.geos?.[0]?.affiliateLink || "";

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
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${statusStyle}`}
                                    >
                                      {link.status}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                                    <span className="font-mono text-[11px] text-slate-400">
                                      /{link.product?.slug ||
                                        link.product?.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
                                    </span>
                                    <span>•</span>
                                    <span>
                                      Added{" "}
                                      {new Date(link.addedAt).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      })}
                                    </span>
                                    {link.updatedBy?.name &&
                                      link.updatedBy.name !== userItem.userName && (
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
                                                [link.productId]:
                                                  prev[link.productId] === g.geo ? "" : g.geo,
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
                                          <span className="text-[9px] text-slate-400">
                                            +{link.geos.length - 3}
                                          </span>
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
                                          onClick={() =>
                                            handleCopy(
                                              activeAffiliateLink,
                                              `aff-${link.id}`,
                                              "Affiliate Link"
                                            )
                                          }
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
                                      <span className="text-[10px] text-slate-400 italic">
                                        No link
                                      </span>
                                    )}
                                  </div>

                                  {/* Bridge Page Link */}
                                  {link.bridgePageLink && (
                                    <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 min-w-[150px] max-w-[200px] flex items-center justify-between gap-1">
                                      <div className="min-w-0">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase block">
                                          Bridge
                                        </span>
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
                                        onClick={() =>
                                          handleCopy(
                                            link.bridgePageLink!,
                                            `bridge-${link.id}`,
                                            "Bridge Link"
                                          )
                                        }
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
                                        <span className="text-[9px] font-bold text-slate-400 uppercase block">
                                          Buy Now
                                        </span>
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
                                        onClick={() =>
                                          handleCopy(link.buyLink!, `buy-${link.id}`, "Buy Link")
                                        }
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

                        {/* Server-Side Per-User Pagination Bar */}
                        {userItemPages > 1 && (
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-[11px] font-semibold text-slate-400">
                              Showing{" "}
                              {(userItemCurrentPage - 1) * LINKS_PER_USER_PAGE + 1}-
                              {Math.min(
                                userItemCurrentPage * LINKS_PER_USER_PAGE,
                                userItemTotal
                              )}{" "}
                              of {userItemTotal}
                            </p>
                            <div className="flex items-center gap-1 flex-wrap">
                              <button
                                type="button"
                                onClick={() => fetchUserLinksPage(userItem.userId, 1)}
                                disabled={userItemCurrentPage === 1}
                                className="px-2 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                              >
                                First
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  fetchUserLinksPage(
                                    userItem.userId,
                                    Math.max(1, userItemCurrentPage - 1)
                                  )
                                }
                                disabled={userItemCurrentPage === 1}
                                className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                              >
                                &lt;
                              </button>
                              {blockStart > 1 && (
                                <button
                                  type="button"
                                  onClick={() => fetchUserLinksPage(userItem.userId, blockStart - 1)}
                                  className="px-1 text-xs font-bold text-slate-400 hover:text-blue-600 cursor-pointer"
                                >
                                  ...
                                </button>
                              )}
                              {innerPages.map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => fetchUserLinksPage(userItem.userId, p)}
                                  className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    userItemCurrentPage === p
                                      ? "bg-[#6D8196] text-white border border-[#6D8196]"
                                      : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                                  }`}
                                >
                                  {p}
                                </button>
                              ))}
                              {blockEnd < userItemPages && (
                                <button
                                  type="button"
                                  onClick={() => fetchUserLinksPage(userItem.userId, blockEnd + 1)}
                                  className="px-1 text-xs font-bold text-slate-400 hover:text-blue-600 cursor-pointer"
                                >
                                  ...
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  fetchUserLinksPage(
                                    userItem.userId,
                                    Math.min(userItemPages, userItemCurrentPage + 1)
                                  )
                                }
                                disabled={userItemCurrentPage === userItemPages}
                                className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                              >
                                &gt;
                              </button>
                              <button
                                type="button"
                                onClick={() => fetchUserLinksPage(userItem.userId, userItemPages)}
                                disabled={userItemCurrentPage === userItemPages}
                                className="px-2 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                              >
                                Last
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Outer Users List Pagination (when more than 15 users exist) */}
          {userPagination.totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-2 px-1">
              <p className="text-xs font-semibold text-slate-400">
                Showing {(userPagination.page - 1) * userPagination.limit + 1}-
                {Math.min(userPagination.page * userPagination.limit, userPagination.total)} of{" "}
                {userPagination.total} users
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={userPagination.page === 1}
                  onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-xs font-bold text-slate-500 px-2">
                  Page {userPagination.page} of {userPagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={userPagination.page >= userPagination.totalPages}
                  onClick={() => setUserPage((p) => Math.min(userPagination.totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
