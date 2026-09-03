"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Calendar as CalendarIcon,
  ArrowRightLeft,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Globe,
  Award,
  Sparkles,
  Check,
  CheckCircle2,
  UserCheck,
  UserX,
  SlidersHorizontal,
  LayoutGrid,
  Table as TableIcon,
  ArrowUpRight,
  ChevronRight,
  UserPlus,
  RefreshCw,
  Mail,
  Building2,
  Eye,
  CheckSquare,
  Square,
  AlertCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";
import CustomSelect from "@/components/CustomSelect";
import { Toggle } from "@/components/ui/toggle";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import LoadingScreen from "@/components/LoadingScreen";
import { fuzzyMatchAny } from "@/lib/fuzzy";

interface Site {
  id: number;
  name: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "LINKER" | "WRITER" | "TEAM_LEAD" | null;
  allowLinkLogAccess: boolean;
  approved: boolean;
  siteAccess: {
    site: {
      id: number;
      name: string;
    };
  }[];
  teamLead?: {
    id: number;
    name: string;
  } | null;
  teamMembers?: {
    id: number;
    name: string;
  }[];
  createdAt?: string;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  LINKER: "Linker",
  WRITER: "Writer",
  TEAM_LEAD: "Team Lead",
};

const ROLE_STYLES: Record<string, { badge: string; avatar: string; border: string }> = {
  SUPER_ADMIN: {
    badge: "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    avatar: "from-purple-600 to-indigo-600 text-white shadow-purple-500/20",
    border: "border-purple-200 dark:border-purple-900/60",
  },
  ADMIN: {
    badge: "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    avatar: "from-blue-600 to-cyan-600 text-white shadow-blue-500/20",
    border: "border-blue-200 dark:border-blue-900/60",
  },
  TEAM_LEAD: {
    badge: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    avatar: "from-emerald-600 to-teal-600 text-white shadow-emerald-500/20",
    border: "border-emerald-200 dark:border-emerald-900/60",
  },
  WRITER: {
    badge: "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    avatar: "from-amber-500 to-orange-600 text-white shadow-amber-500/20",
    border: "border-amber-200 dark:border-amber-900/60",
  },
  LINKER: {
    badge: "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    avatar: "from-rose-500 to-pink-600 text-white shadow-rose-500/20",
    border: "border-rose-200 dark:border-rose-900/60",
  },
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // View Mode: Cards (default requested by user) vs Table
  const [viewMode, setViewMode] = useState<"CARD" | "TABLE">("CARD");

  // Filter States
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [siteFilter, setSiteFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [tlFilter, setTlFilter] = useState("ALL");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = viewMode === "CARD" ? 12 : 10;

  // Session & Access info
  const { data: session, status } = useSession();
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const isSuperAdmin = currentUserRole === "SUPER_ADMIN";
  const isAdminOrSuperAdmin = currentUserRole === "ADMIN" || currentUserRole === "SUPER_ADMIN";

  // Quick Action Modal States
  // 1. Migrate Team Lead Modal
  const [migrateTlUser, setMigrateTlUser] = useState<User | null>(null);
  const [selectedNewTlId, setSelectedNewTlId] = useState<string>("");
  const [migratingTl, setMigratingTl] = useState(false);

  // 2. Migrate / Manage Sites Modal
  const [migrateSitesUser, setMigrateSitesUser] = useState<User | null>(null);
  const [selectedSiteIds, setSelectedSiteIds] = useState<number[]>([]);
  const [migratingSites, setMigratingSites] = useState(false);

  // 3. Promote / Change Role Modal
  const [promoteRoleUser, setPromoteRoleUser] = useState<User | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<string>("");
  const [promotingRole, setPromotingRole] = useState(false);

  // 4. Full Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "WRITER",
    siteIds: [] as number[],
    teamLeadId: "",
    allowLinkLogAccess: false,
    approved: true,
  });

  // 5. Delete Confirm Dialog
  const [deleteTargetUser, setDeleteTargetUser] = useState<User | null>(null);

  // Available Team Leads
  const teamLeads = useMemo(() => users.filter((u) => u.role === "TEAM_LEAD"), [users]);

  // Dashboard Stats
  const [stats, setStats] = useState<any>(null);

  // Fetch Users & Sites
  const fetchData = async () => {
    if (!session?.user?.id) return;
    const stored = session.user.id;
    setCurrentUserId(stored);
    const uRole = session.user.role || "WRITER";
    setCurrentUserRole(uRole);

    if (uRole !== "ADMIN" && uRole !== "SUPER_ADMIN" && uRole !== "TEAM_LEAD") {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [usersRes, sitesRes, dashRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/sites"),
        fetch(`/api/dashboard?userId=${stored}`),
      ]);
      const usersData = usersRes.ok ? await usersRes.json() : [];
      const sitesData = sitesRes.ok ? await sitesRes.json() : [];
      const dashData = dashRes.ok ? await dashRes.json() : null;

      setUsers(Array.isArray(usersData) ? usersData : []);
      setSites(Array.isArray(sitesData) ? sitesData : []);
      setStats(dashData);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load users data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [session?.user?.id, session?.user?.role]);

  // ─────────────────────────────────────────────────────────────────────────
  // QUICK ACTIONS: MIGRATE TL, SITES, ROLE
  // ─────────────────────────────────────────────────────────────────────────

  // 1. Team Lead Migration
  const handleOpenMigrateTl = (u: User) => {
    setMigrateTlUser(u);
    setSelectedNewTlId(u.teamLead ? String(u.teamLead.id) : "");
  };

  const handleExecuteMigrateTl = async () => {
    if (!migrateTlUser) return;
    setMigratingTl(true);
    try {
      const res = await fetch(`/api/users/${migrateTlUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamLeadId: selectedNewTlId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to migrate Team Lead");
      }
      const updatedUser = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === migrateTlUser.id ? updatedUser : u)));
      toast.success(
        selectedNewTlId
          ? `Migrated ${migrateTlUser.name} to new Team Lead!`
          : `Removed Team Lead for ${migrateTlUser.name}`
      );
      setMigrateTlUser(null);
    } catch (e: any) {
      toast.error(e.message || "Migration failed");
    } finally {
      setMigratingTl(false);
    }
  };

  // 2. Sites Migration
  const handleOpenMigrateSites = (u: User) => {
    setMigrateSitesUser(u);
    setSelectedSiteIds(u.siteAccess ? u.siteAccess.map((sa) => sa.site.id) : []);
  };

  const handleToggleSiteSelection = (siteId: number) => {
    setSelectedSiteIds((prev) =>
      prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]
    );
  };

  const handleExecuteMigrateSites = async () => {
    if (!migrateSitesUser) return;
    setMigratingSites(true);
    try {
      const res = await fetch(`/api/users/${migrateSitesUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteIds: selectedSiteIds,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update site access");
      }
      const updatedUser = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === migrateSitesUser.id ? updatedUser : u)));
      toast.success(`Updated site access for ${migrateSitesUser.name}!`);
      setMigrateSitesUser(null);
    } catch (e: any) {
      toast.error(e.message || "Site migration failed");
    } finally {
      setMigratingSites(false);
    }
  };

  // 3. Promote / Change Role
  const handleOpenPromoteRole = (u: User) => {
    setPromoteRoleUser(u);
    setSelectedNewRole(u.role || "WRITER");
  };

  const handleExecutePromoteRole = async () => {
    if (!promoteRoleUser || !selectedNewRole) return;
    setPromotingRole(true);
    try {
      const res = await fetch(`/api/users/${promoteRoleUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: selectedNewRole,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to change role");
      }
      const updatedUser = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === promoteRoleUser.id ? updatedUser : u)));
      toast.success(
        `Changed ${promoteRoleUser.name}'s role to ${ROLE_LABELS[selectedNewRole] || selectedNewRole}!`
      );
      setPromoteRoleUser(null);
    } catch (e: any) {
      toast.error(e.message || "Role change failed");
    } finally {
      setPromotingRole(false);
    }
  };

  // 4. Quick Toggle Approval Status
  const handleQuickToggleApproval = async (u: User) => {
    if (!isAdminOrSuperAdmin) return;
    if (u.role === "SUPER_ADMIN" && !isSuperAdmin) {
      toast.error("Cannot modify Super Admin");
      return;
    }
    const nextApproved = !u.approved;
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: nextApproved }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to toggle status");
      }
      const updatedUser = await res.json();
      setUsers((prev) => prev.map((user) => (user.id === u.id ? updatedUser : user)));
      toast.success(`${u.name} is now ${nextApproved ? "Approved" : "Pending Approval"}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to toggle approval");
    }
  };

  // 5. Delete User
  const handleOpenDelete = (u: User) => {
    if (u.role === "SUPER_ADMIN" && !isSuperAdmin) {
      toast.error("Cannot delete Super Admin");
      return;
    }
    setDeleteTargetUser(u);
  };

  const handleExecuteDelete = async () => {
    if (!deleteTargetUser) return;
    const targetId = deleteTargetUser.id;
    setDeleteTargetUser(null);
    try {
      const res = await fetch(`/api/users/${targetId}?creatorId=${currentUserId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");
      setUsers((prev) => prev.filter((u) => u.id !== targetId));
      toast.success("User deleted successfully!");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete user");
    }
  };

  // 6. Full Add / Edit Modal
  const openAddModal = () => {
    setEditingUserId(null);
    setForm({
      name: "",
      email: "",
      role: "WRITER",
      siteIds: [],
      teamLeadId: "",
      allowLinkLogAccess: false,
      approved: true,
    });
    setError("");
    setShowModal(true);
  };

  const openEditModal = (u: User) => {
    setEditingUserId(u.id);
    setForm({
      name: u.name,
      email: u.email,
      role: u.role || "WRITER",
      siteIds: u.siteAccess ? u.siteAccess.map((sa) => sa.site.id) : [],
      teamLeadId: u.teamLead ? String(u.teamLead.id) : "",
      allowLinkLogAccess: u.allowLinkLogAccess,
      approved: u.approved,
    });
    setError("");
    setShowModal(true);
  };

  const handleSaveUser = async () => {
    setSaving(true);
    setError("");
    try {
      const url = editingUserId ? `/api/users/${editingUserId}` : "/api/users";
      const method = editingUserId ? "PATCH" : "POST";
      const payload = { ...form, creatorId: currentUserId };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save user");

      if (editingUserId) {
        setUsers((prev) => prev.map((u) => (u.id === editingUserId ? data : u)));
        toast.success("User updated successfully!");
      } else {
        setUsers((prev) => [data, ...prev]);
        toast.success("User created successfully!");
      }
      setShowModal(false);
    } catch (e: any) {
      setError(e.message || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // FUZZY SEARCH & FILTERS
  // ─────────────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return users.filter((u) => {
      // Permission filter
      if (currentUserRole === "ADMIN" && u.role === "SUPER_ADMIN") return false;
      if (currentUserRole === "TEAM_LEAD" && u.teamLead?.id !== currentUserId) return false;

      // Role filter
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;

      // Site filter
      if (siteFilter !== "ALL") {
        const hasSite = u.siteAccess?.some((sa) => String(sa.site.id) === siteFilter);
        if (!hasSite) return false;
      }

      // Team Lead filter
      if (tlFilter !== "ALL") {
        if (tlFilter === "NONE") {
          if (u.role === "WRITER" && u.teamLead) return false;
        } else if (String(u.teamLead?.id) !== tlFilter) {
          return false;
        }
      }

      // Status filter
      if (statusFilter === "APPROVED" && !u.approved) return false;
      if (statusFilter === "PENDING" && u.approved) return false;

      // Fuzzy Search
      if (search.trim()) {
        const siteNames = u.siteAccess?.map((sa) => sa.site.name) || [];
        const roleName = u.role ? ROLE_LABELS[u.role] || u.role : "";
        const tlName = u.teamLead?.name || "";
        const isMatch = fuzzyMatchAny([u.name, u.email, roleName, tlName, ...siteNames], search);
        if (!isMatch) return false;
      }

      return true;
    });
  }, [users, currentUserRole, currentUserId, roleFilter, siteFilter, tlFilter, statusFilter, search]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PAGINATION RENDERER
  // ─────────────────────────────────────────────────────────────────────────
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pageSize = 5;
    const currentBlock = Math.floor((currentPage - 1) / pageSize);
    const start = currentBlock * pageSize + 1;
    const end = Math.min(totalPages, start + pageSize - 1);

    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 py-3 px-2 border-t border-slate-200 dark:border-slate-800 text-xs">
        <p className="font-semibold text-slate-400">
          Showing {filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-
          {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} users
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-2.5 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition cursor-pointer"
            title="First Page"
          >
            First
          </button>
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition cursor-pointer"
            title="Previous Page"
          >
            &lt;
          </button>

          {pages.map((p) => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentPage === p
                  ? "bg-[#6D8196] text-white border border-[#6D8196] shadow-xs"
                  : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              {p}
            </button>
          ))}

          <button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition cursor-pointer"
            title="Next Page"
          >
            &gt;
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="px-2.5 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition cursor-pointer"
            title="Last Page"
          >
            Last
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] dark:bg-slate-950 text-[#4A4A4A] dark:text-slate-200 transition-colors">
      {/* ───────────────────────────────────────────────────────────────── */}
      {/* HEADER ROW */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#6D8196] to-slate-800 flex items-center justify-center text-white shadow-md">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#4A4A4A] dark:text-white tracking-tight">
                {currentUserRole === "TEAM_LEAD" ? "Your Team Members" : "User Management"}
              </h1>
              <p className="text-[#737373] dark:text-slate-400 text-xs font-semibold mt-0.5">
                {filtered.length} active profiles • Manage roles, sites, and Team Lead assignments
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Mode Toggle: Cards vs Table */}
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl shadow-2xs">
            <button
              onClick={() => setViewMode("CARD")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === "CARD"
                  ? "bg-[#6D8196] text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
              title="Card View (Default)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              onClick={() => setViewMode("TABLE")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === "TABLE"
                  ? "bg-[#6D8196] text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>

          <Link
            href="/calendar"
            className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs transition flex items-center gap-2 cursor-pointer"
          >
            <CalendarIcon className="w-4 h-4 text-[#6D8196]" />
            <span>Work Calendar</span>
          </Link>

          {isAdminOrSuperAdmin && (
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-[#6D8196] hover:bg-[#5A6D81] text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add User</span>
            </button>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* STATS METRIC CARDS */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {stats && currentUserRole !== "TEAM_LEAD" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Total Writers
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white mt-2">
              {users.filter((u) => u.role === "WRITER").length}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Total Linkers
              </span>
              <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white mt-2">
              {users.filter((u) => u.role === "LINKER").length}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Team Leads
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white mt-2">
              {teamLeads.length}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Approved Users
              </span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white mt-2">
              {users.filter((u) => u.approved).length}{" "}
              <span className="text-xs text-slate-400 font-semibold">/ {users.length}</span>
            </p>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* SEARCH & FILTERS BAR */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs mb-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Fuzzy Search Input */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Fuzzy search name, email, role, site, TL..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs font-semibold bg-[#FAF9F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6D8196]/40"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Role Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Role:</span>
              <CustomSelect
                value={roleFilter}
                onChange={(val) => {
                  setRoleFilter(val);
                  setCurrentPage(1);
                }}
                options={[
                  { value: "ALL", label: "All Roles" },
                  ...(isSuperAdmin ? [{ value: "SUPER_ADMIN", label: "Super Admin" }] : []),
                  { value: "ADMIN", label: "Admin" },
                  { value: "TEAM_LEAD", label: "Team Lead" },
                  { value: "WRITER", label: "Writer" },
                  { value: "LINKER", label: "Linker" },
                ]}
                className="w-auto"
                triggerClassName="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#6D8196] shadow-2xs whitespace-nowrap min-w-[130px]"
              />
            </div>

            {/* Site Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Site:</span>
              <CustomSelect
                value={siteFilter}
                onChange={(val) => {
                  setSiteFilter(val);
                  setCurrentPage(1);
                }}
                options={[
                  { value: "ALL", label: "All Sites" },
                  ...sites.map((s) => ({ value: String(s.id), label: s.name })),
                ]}
                searchable={sites.length > 5}
                searchPlaceholder="Search site..."
                className="w-auto"
                triggerClassName="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#6D8196] shadow-2xs whitespace-nowrap min-w-[130px]"
              />
            </div>

            {/* Team Lead Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase">TL:</span>
              <CustomSelect
                value={tlFilter}
                onChange={(val) => {
                  setTlFilter(val);
                  setCurrentPage(1);
                }}
                options={[
                  { value: "ALL", label: "All Team Leads" },
                  { value: "NONE", label: "No TL Assigned" },
                  ...teamLeads.map((tl) => ({ value: String(tl.id), label: tl.name })),
                ]}
                className="w-auto"
                triggerClassName="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#6D8196] shadow-2xs whitespace-nowrap min-w-[140px]"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Status:</span>
              <CustomSelect
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  setCurrentPage(1);
                }}
                options={[
                  { value: "ALL", label: "All Status" },
                  { value: "APPROVED", label: "Approved Only" },
                  { value: "PENDING", label: "Pending Only" },
                ]}
                className="w-auto"
                triggerClassName="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#6D8196] shadow-2xs whitespace-nowrap min-w-[125px]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* MAIN CONTENT AREA */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800">
          <LoadingScreen
            message="Loading team members..."
            subtext="Fetching user profiles, permissions, sites, and Team Lead linkages"
            size="md"
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No users found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Try adjusting your search query, role filter, site filter, or Team Lead selection.
          </p>
        </div>
      ) : viewMode === "CARD" ? (
        /* ───────────────────────────────────────────────────────────── */
        /* CARD VIEW (DEFAULT AS REQUESTED)                              */
        /* ───────────────────────────────────────────────────────────── */
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {paginated.map((u) => {
              const roleKey = u.role || "WRITER";
              const roleMeta = ROLE_STYLES[roleKey] || ROLE_STYLES.WRITER;
              const isWriter = u.role === "WRITER";
              const isLead = u.role === "TEAM_LEAD";
              const isUserSuperAdmin = u.role === "SUPER_ADMIN";
              const isUserAdmin = u.role === "ADMIN";

              return (
                <div
                  key={u.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                >
                  {/* Top Section */}
                  <div className="p-5 space-y-4">
                    {/* Header: Avatar, Name, Email, Status Indicator */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div
                          className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${roleMeta.avatar} flex items-center justify-center text-sm font-black shadow-sm shrink-0`}
                        >
                          {getInitials(u.name)}
                        </div>

                        {/* Name & Email */}
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                            {u.name}
                          </h3>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 shrink-0" />
                            <span className="truncate">{u.email}</span>
                          </p>
                        </div>
                      </div>

                      {/* Approval Status Badge / Toggle */}
                      {isAdminOrSuperAdmin && (!isUserSuperAdmin || isSuperAdmin) ? (
                        <button
                          onClick={() => handleQuickToggleApproval(u)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border transition cursor-pointer shrink-0 ${
                            u.approved
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100"
                              : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 hover:bg-amber-100"
                          }`}
                          title="Click to toggle approval status"
                        >
                          {u.approved ? "✓ Approved" : "⏳ Pending"}
                        </button>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 ${
                            u.approved
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {u.approved ? "Approved" : "Pending"}
                        </span>
                      )}
                    </div>

                    {/* Role Badge */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Role
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${roleMeta.badge}`}
                      >
                        {ROLE_LABELS[roleKey] || roleKey}
                      </span>
                    </div>

                    {/* Working Sites Section */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Globe className="w-3 h-3 text-[#6D8196]" />
                          Working Sites ({u.siteAccess?.length || 0})
                        </span>
                        {isAdminOrSuperAdmin && (
                          <button
                            onClick={() => handleOpenMigrateSites(u)}
                            className="text-[11px] font-bold text-[#6D8196] hover:text-[#5A6D81] transition cursor-pointer"
                          >
                            Migrate
                          </button>
                        )}
                      </div>

                      {u.siteAccess && u.siteAccess.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
                          {u.siteAccess.map((sa) => (
                            <span
                              key={sa.site.id}
                              className="px-2 py-0.5 rounded-lg bg-[#FAF9F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold whitespace-nowrap"
                            >
                              {sa.site.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">No sites assigned</p>
                      )}
                    </div>

                    {/* Team Lead Section */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Award className="w-3 h-3 text-[#6D8196]" />
                          Team Lead
                        </span>
                        {isAdminOrSuperAdmin && isWriter && (
                          <button
                            onClick={() => handleOpenMigrateTl(u)}
                            className="text-[11px] font-bold text-[#6D8196] hover:text-[#5A6D81] transition cursor-pointer"
                          >
                            Migrate
                          </button>
                        )}
                      </div>

                      {isWriter ? (
                        u.teamLead ? (
                          <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-[11px]">
                            <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-[9px] shrink-0">
                              {getInitials(u.teamLead.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                                {u.teamLead.name}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-[11px] text-amber-700 dark:text-amber-300 font-semibold flex items-center justify-between">
                            <span>No TL Assigned</span>
                            {isAdminOrSuperAdmin && (
                              <button
                                onClick={() => handleOpenMigrateTl(u)}
                                className="underline text-[10px] font-bold cursor-pointer"
                              >
                                Assign TL
                              </button>
                            )}
                          </div>
                        )
                      ) : isLead ? (
                        <div className="p-2 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/40 text-[11px] text-teal-700 dark:text-teal-300 font-semibold flex items-center justify-between">
                          <span>Team Leader</span>
                          <span className="px-1.5 py-0.5 rounded-md bg-teal-200/60 dark:bg-teal-800/60 text-[10px] font-extrabold">
                            {u.teamMembers?.length || 0} Writers
                          </span>
                        </div>
                      ) : (
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 font-medium">
                          {isUserSuperAdmin || isUserAdmin
                            ? "Direct Organization Oversight"
                            : "Independent Role"}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ───────────────────────────────────────────────────────── */}
                  {/* CARD FOOTER / QUICK ACTIONS TOOLBAR                     */}
                  {/* ───────────────────────────────────────────────────────── */}
                  <div className="px-5 py-3.5 bg-[#FAF9F5] dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Promote / Change Role Button */}
                      {isAdminOrSuperAdmin && (!isUserSuperAdmin || isSuperAdmin) && (
                        <button
                          onClick={() => handleOpenPromoteRole(u)}
                          className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#6D8196] hover:text-[#6D8196] text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                          title="Promote or change user role"
                        >
                          <Award className="w-3 h-3 text-purple-500" />
                          <span>Role</span>
                        </button>
                      )}

                      {/* Migrate TL Button */}
                      {isAdminOrSuperAdmin && isWriter && (
                        <button
                          onClick={() => handleOpenMigrateTl(u)}
                          className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#6D8196] hover:text-[#6D8196] text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                          title="Migrate user to another Team Lead"
                        >
                          <ArrowRightLeft className="w-3 h-3 text-emerald-500" />
                          <span>TL</span>
                        </button>
                      )}

                      {/* Migrate Sites Button */}
                      {isAdminOrSuperAdmin && (
                        <button
                          onClick={() => handleOpenMigrateSites(u)}
                          className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#6D8196] hover:text-[#6D8196] text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                          title="Migrate or manage assigned websites"
                        >
                          <Globe className="w-3 h-3 text-blue-500" />
                          <span>Sites</span>
                        </button>
                      )}
                    </div>

                    {/* Secondary Actions (Calendar, Edit, Delete) */}
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/calendar?userId=${u.id}`}
                        className="p-1.5 text-slate-400 hover:text-[#6D8196] hover:bg-white dark:hover:bg-slate-800 rounded-lg transition"
                        title={`View ${u.name}'s calendar`}
                      >
                        <CalendarIcon className="w-3.5 h-3.5" />
                      </Link>

                      {isAdminOrSuperAdmin && (!isUserSuperAdmin || isSuperAdmin) && (
                        <>
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title="Edit full user details"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(u)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title="Delete user"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {renderPagination()}
        </div>
      ) : (
        /* ───────────────────────────────────────────────────────────── */
        /* TABLE VIEW                                                    */
        /* ───────────────────────────────────────────────────────────── */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto p-4">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3.5">User</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Assigned Sites</th>
                  <th className="px-4 py-3.5">Team Lead</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginated.map((u) => {
                  const roleKey = u.role || "WRITER";
                  const roleMeta = ROLE_STYLES[roleKey] || ROLE_STYLES.WRITER;
                  const isWriter = u.role === "WRITER";
                  const isUserSuperAdmin = u.role === "SUPER_ADMIN";

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition group"
                    >
                      {/* User Info */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-xl bg-gradient-to-br ${roleMeta.avatar} flex items-center justify-center text-xs font-black shrink-0`}
                          >
                            {getInitials(u.name)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 dark:text-white block">
                              {u.name}
                            </span>
                            <span className="text-[11px] text-slate-400 block">{u.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black border ${roleMeta.badge}`}
                        >
                          {ROLE_LABELS[roleKey] || roleKey}
                        </span>
                      </td>

                      {/* Working Sites */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                          {u.siteAccess && u.siteAccess.length > 0 ? (
                            u.siteAccess.map((sa) => (
                              <span
                                key={sa.site.id}
                                className="px-2 py-0.5 rounded-md bg-[#FAF9F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold"
                              >
                                {sa.site.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">None</span>
                          )}
                          {isAdminOrSuperAdmin && (
                            <button
                              onClick={() => handleOpenMigrateSites(u)}
                              className="text-[10px] font-bold text-[#6D8196] hover:underline cursor-pointer ml-1"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Team Lead */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isWriter ? (
                          u.teamLead ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {u.teamLead.name}
                              </span>
                              {isAdminOrSuperAdmin && (
                                <button
                                  onClick={() => handleOpenMigrateTl(u)}
                                  className="text-[10px] font-bold text-[#6D8196] hover:underline cursor-pointer"
                                >
                                  (Migrate)
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                No TL
                              </span>
                              {isAdminOrSuperAdmin && (
                                <button
                                  onClick={() => handleOpenMigrateTl(u)}
                                  className="text-[10px] font-bold text-[#6D8196] hover:underline cursor-pointer"
                                >
                                  (Assign)
                                </button>
                              )}
                            </div>
                          )
                        ) : u.role === "TEAM_LEAD" ? (
                          <span className="text-teal-600 dark:text-teal-400 font-bold">
                            Lead ({u.teamMembers?.length || 0} writers)
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Approval Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isAdminOrSuperAdmin && (!isUserSuperAdmin || isSuperAdmin) ? (
                          <button
                            onClick={() => handleQuickToggleApproval(u)}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border transition cursor-pointer ${
                              u.approved
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                            }`}
                          >
                            {u.approved ? "✓ Approved" : "⏳ Pending"}
                          </button>
                        ) : (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                              u.approved
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {u.approved ? "Approved" : "Pending"}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isAdminOrSuperAdmin && (!isUserSuperAdmin || isSuperAdmin) && (
                            <button
                              onClick={() => handleOpenPromoteRole(u)}
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-purple-600 text-[11px] font-bold transition cursor-pointer"
                              title="Promote / Change Role"
                            >
                              Role
                            </button>
                          )}
                          <Link
                            href={`/calendar?userId=${u.id}`}
                            className="p-1 text-slate-400 hover:text-[#6D8196] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                            title={`View ${u.name}'s calendar`}
                          >
                            <CalendarIcon className="w-4 h-4" />
                          </Link>
                          {isAdminOrSuperAdmin && (!isUserSuperAdmin || isSuperAdmin) && (
                            <>
                              <button
                                onClick={() => openEditModal(u)}
                                className="p-1 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition cursor-pointer"
                                title="Edit User"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenDelete(u)}
                                className="p-1 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition cursor-pointer"
                                title="Delete User"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {renderPagination()}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: MIGRATE TEAM LEAD                                        */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {migrateTlUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-md overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Migrate Team Lead
                  </h3>
                  <p className="text-[11px] text-slate-400">Reassign writer to a new lead</p>
                </div>
              </div>
              <button
                onClick={() => setMigrateTlUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Target User Info */}
              <div className="p-3 rounded-2xl bg-[#FAF9F5] dark:bg-slate-850 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Writer</span>
                  <p className="font-black text-slate-800 dark:text-white text-sm">
                    {migrateTlUser.name}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Current TL</span>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                    {migrateTlUser.teamLead?.name || "None (Unassigned)"}
                  </p>
                </div>
              </div>

              {/* Select New Team Lead */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Select New Team Lead
                </label>
                <CustomSelect
                  value={selectedNewTlId}
                  onChange={(val) => setSelectedNewTlId(val)}
                  options={[
                    { value: "", label: "✕ Remove Team Lead (Unassign)" },
                    ...teamLeads.map((tl) => ({
                      value: String(tl.id),
                      label: `${tl.name} (${tl.teamMembers?.length || 0} writers)`,
                    })),
                  ]}
                  placeholder="Select a Team Lead..."
                  searchable={teamLeads.length > 4}
                  searchPlaceholder="Search team lead..."
                  className="w-full"
                  triggerClassName="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F5] dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white font-semibold"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-blue-700 dark:text-blue-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Migrating this writer will redirect future article review requests and TL
                  commission tracking to the newly assigned Team Lead.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#FAF9F5] dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setMigrateTlUser(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteMigrateTl}
                disabled={migratingTl}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>{migratingTl ? "Migrating..." : "Confirm Migration"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: MIGRATE / MANAGE SITES                                   */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {migrateSitesUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center font-bold">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Migrate & Manage Websites
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Assign which websites {migrateSitesUser.name} can cover
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMigrateSitesUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Quick helper buttons */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Available Websites ({selectedSiteIds.length} Selected)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSiteIds(sites.map((s) => s.id))}
                    className="text-[10px] font-bold text-[#6D8196] hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedSiteIds([])}
                    className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Site Pills Grid */}
              <div className="grid grid-cols-2 gap-2.5 max-h-64 overflow-y-auto p-1">
                {sites.map((site) => {
                  const isSelected = selectedSiteIds.includes(site.id);
                  return (
                    <button
                      key={site.id}
                      type="button"
                      onClick={() => handleToggleSiteSelection(site.id)}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200 shadow-2xs"
                          : "bg-[#FAF9F5] dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-xs block truncate">{site.name}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {isSelected ? "Active Coverage" : "No Access"}
                        </span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 bg-[#FAF9F5] dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setMigrateSitesUser(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteMigrateSites}
                disabled={migratingSites}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{migratingSites ? "Saving..." : "Save Website Access"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* MODAL 3: PROMOTE / CHANGE ROLE                                    */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {promoteRoleUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-md overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center font-bold">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Promote & Change Role
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Modify permissions and title for {promoteRoleUser.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPromoteRoleUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Current Role Banner */}
              <div className="p-3 rounded-2xl bg-[#FAF9F5] dark:bg-slate-850 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">User</span>
                  <p className="font-black text-slate-800 dark:text-white text-sm">
                    {promoteRoleUser.name}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Current</span>
                  <p className="font-bold text-purple-600 dark:text-purple-400 text-xs">
                    {ROLE_LABELS[promoteRoleUser.role || "WRITER"] || promoteRoleUser.role}
                  </p>
                </div>
              </div>

              {/* Role Selection List */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Select New Role
                </label>

                <div className="space-y-2">
                  {[
                    {
                      role: "WRITER",
                      label: "Writer",
                      desc: "Writes articles, assigned to a Team Lead, gets writer commissions",
                      color: "text-amber-600",
                    },
                    {
                      role: "LINKER",
                      label: "Linker",
                      desc: "Manages links, adds products, independent tracking",
                      color: "text-rose-600",
                    },
                    {
                      role: "TEAM_LEAD",
                      label: "Team Lead",
                      desc: "Reviews articles, manages writers, earns TL override commissions",
                      color: "text-emerald-600",
                    },
                    ...(isSuperAdmin
                      ? [
                          {
                            role: "ADMIN",
                            label: "Admin",
                            desc: "Full administrative capabilities across users, articles, and logs",
                            color: "text-blue-600",
                          },
                        ]
                      : []),
                  ].map((r) => {
                    const isSelected = selectedNewRole === r.role;
                    return (
                      <button
                        key={r.role}
                        type="button"
                        onClick={() => setSelectedNewRole(r.role)}
                        className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-purple-50/70 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 shadow-2xs"
                            : "bg-[#FAF9F5] dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-black text-xs ${r.color}`}>{r.label}</span>
                            {isSelected && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-200">
                                Selected
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{r.desc}</p>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-purple-600 text-white"
                              : "border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedNewRole === "TEAM_LEAD" && promoteRoleUser.role === "WRITER" && (
                <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <p>
                    <strong>Promotion Note:</strong> Promoting to Team Lead will automatically
                    remove their current Team Lead assignment and allow assigning writers directly to
                    them.
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-[#FAF9F5] dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setPromoteRoleUser(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecutePromoteRole}
                disabled={promotingRole || selectedNewRole === promoteRoleUser.role}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Award className="w-3.5 h-3.5" />
                <span>{promotingRole ? "Updating..." : "Confirm Role Change"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* MODAL 4: FULL ADD / EDIT USER MODAL                               */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-md overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {editingUserId ? "Edit User Profile" : "Add New User"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 text-xs font-bold rounded-xl border border-rose-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F5] dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6D8196]/40"
                  placeholder="e.g. Sarah Mitchell"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  disabled={!!editingUserId}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F5] dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6D8196]/40 disabled:opacity-60"
                  placeholder="sarah@example.com"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Role
                </label>
                <CustomSelect
                  value={form.role}
                  onChange={(val) => setForm({ ...form, role: val })}
                  placeholder="Select Role..."
                  options={[
                    { value: "WRITER", label: "Writer" },
                    { value: "LINKER", label: "Linker" },
                    { value: "TEAM_LEAD", label: "Team Lead" },
                    ...(isSuperAdmin ? [{ value: "ADMIN", label: "Admin" }] : []),
                    ...(form.role === "SUPER_ADMIN"
                      ? [{ value: "SUPER_ADMIN", label: "Super Admin" }]
                      : []),
                  ]}
                  className="w-full"
                  triggerClassName="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F5] dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white font-semibold"
                />
              </div>

              {(form.role === "WRITER" || form.role === "TEAM_LEAD") && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Assign Websites ({form.siteIds.length} Selected)
                  </label>
                  <div className="space-y-2 max-h-36 overflow-y-auto p-3 bg-[#FAF9F5] dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
                    {sites.map((site) => (
                      <Toggle
                        key={site.id}
                        checked={form.siteIds.includes(site.id)}
                        onChange={(checked) => {
                          if (checked) {
                            setForm({ ...form, siteIds: [...form.siteIds, site.id] });
                          } else {
                            setForm({
                              ...form,
                              siteIds: form.siteIds.filter((id) => id !== site.id),
                            });
                          }
                        }}
                        label={site.name}
                      />
                    ))}
                  </div>
                </div>
              )}

              {form.role === "WRITER" && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Assign Team Lead
                  </label>
                  <CustomSelect
                    value={form.teamLeadId}
                    onChange={(val) => setForm({ ...form, teamLeadId: val })}
                    placeholder="No Team Lead"
                    options={[
                      { value: "", label: "No Team Lead" },
                      ...teamLeads.map((tl) => ({ value: String(tl.id), label: tl.name })),
                    ]}
                    className="w-full"
                    triggerClassName="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F5] dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white font-semibold"
                  />
                </div>
              )}

              <div>
                <div className="bg-[#FAF9F5] dark:bg-slate-850 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <Toggle
                    checked={form.approved}
                    onChange={(checked) => setForm({ ...form, approved: checked })}
                    label="Approve User Access"
                    subLabel="Unapproved users cannot log in to the application."
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#FAF9F5] dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                disabled={saving || !form.name || (!editingUserId && !form.email)}
                className="px-5 py-2 bg-[#6D8196] hover:bg-[#5A6D81] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              >
                {saving ? "Saving..." : editingUserId ? "Save Profile" : "Add User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* MODAL 5: CONFIRM DELETE DIALOG                                    */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={deleteTargetUser !== null}
        title="Delete User"
        message={
          deleteTargetUser
            ? `Are you sure you want to delete user ${deleteTargetUser.name} (${deleteTargetUser.email})? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete User"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleExecuteDelete}
        onCancel={() => setDeleteTargetUser(null)}
      />
    </div>
  );
}
