"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Plus,
  Pencil,
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
  hasLeftCompany?: boolean;
  commissionToPartyFund?: boolean;
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
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({});
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "WRITER",
    siteIds: [] as number[],
    teamLeadId: "",
    allowLinkLogAccess: false,
    approved: true,
    hasLeftCompany: false,
    commissionToPartyFund: false,
  });

  // Email validation for Add User
  const emailValidationError = useMemo(() => {
    if (editingUserId) return null;
    const trimmed = form.email.trim();
    if (!trimmed) return null;

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmed)) {
      return "Invalid email format (e.g. name@fishtailinfosolutions.com)";
    }
    if (!trimmed.toLowerCase().endsWith("@fishtailinfosolutions.com")) {
      return "Email must belong to @fishtailinfosolutions.com";
    }
    if (users.some((u) => u.email.toLowerCase() === trimmed.toLowerCase())) {
      return "This email is already in use by another user";
    }
    return null;
  }, [form.email, editingUserId, users]);

  const isEmailValid = useMemo(() => {
    if (editingUserId) return true;
    const trimmed = form.email.trim();
    if (!trimmed) return false;
    return emailValidationError === null;
  }, [form.email, editingUserId, emailValidationError]);

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
    if (u.hasLeftCompany) {
      toast.error("Cannot approve access for a former employee. Please restore them to active first.");
      return;
    }
    const nextApproved = !u.approved;
    try {
      const payload: any = { approved: nextApproved };
      if (nextApproved) {
        payload.hasLeftCompany = false;
      }
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  // Quick Toggle Left Company Status
  const handleQuickToggleLeftCompany = async (u: User) => {
    if (!isAdminOrSuperAdmin) return;
    if (u.role === "SUPER_ADMIN" && !isSuperAdmin) {
      toast.error("Cannot modify Super Admin");
      return;
    }
    const nextLeft = !u.hasLeftCompany;
    try {
      const payload: any = { hasLeftCompany: nextLeft };
      if (nextLeft) {
        payload.approved = false;
        payload.commissionToPartyFund = false;
      }
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to toggle departure status");
      }
      const updatedUser = await res.json();
      setUsers((prev) => prev.map((user) => (user.id === u.id ? updatedUser : user)));
      toast.success(
        nextLeft
          ? `${u.name} marked as Left Company. Access revoked & commissions routed to Party Fund!`
          : `${u.name} marked as active employee.`
      );
    } catch (e: any) {
      toast.error(e.message || "Failed to toggle departure status");
    }
  };

  // Quick Toggle Commission to Party Fund
  const handleQuickTogglePartyFund = async (u: User) => {
    if (!isAdminOrSuperAdmin) return;
    if (u.role === "SUPER_ADMIN" && !isSuperAdmin) {
      toast.error("Cannot modify Super Admin");
      return;
    }
    const nextParty = !u.commissionToPartyFund;
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionToPartyFund: nextParty }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to toggle party fund routing");
      }
      const updatedUser = await res.json();
      setUsers((prev) => prev.map((user) => (user.id === u.id ? updatedUser : user)));
      toast.success(
        nextParty
          ? `${u.name}'s commissions will route directly to Party Fund!`
          : `${u.name}'s commissions restored to standard payout.`
      );
    } catch (e: any) {
      toast.error(e.message || "Failed to toggle party fund routing");
    }
  };

  // 5. Full Add / Edit Modal
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
      hasLeftCompany: false,
      commissionToPartyFund: false,
    });
    setError("");
    setFieldErrors({});
    setFormSubmitted(false);
    setShowModal(true);
  };

  const openEditModal = (u: User) => {
    setEditingUserId(u.id);
    const hasLeft = Boolean(u.hasLeftCompany);
    setForm({
      name: u.name,
      email: u.email,
      role: u.role || "WRITER",
      siteIds: u.siteAccess ? u.siteAccess.map((sa) => sa.site.id) : [],
      teamLeadId: u.teamLead ? String(u.teamLead.id) : "",
      allowLinkLogAccess: u.allowLinkLogAccess,
      approved: hasLeft ? false : Boolean(u.approved),
      hasLeftCompany: hasLeft,
      commissionToPartyFund: hasLeft ? false : Boolean(u.commissionToPartyFund),
    });
    setError("");
    setFieldErrors({});
    setFormSubmitted(false);
    setShowModal(true);
  };

  const handleSaveUser = async () => {
    setFormSubmitted(true);
    const trimmedName = form.name.trim();
    const trimmedEmail = form.email.trim().toLowerCase();

    const errors: { name?: string; email?: string } = {};

    if (!trimmedName) {
      errors.name = "Please enter a user name";
    }

    if (!editingUserId) {
      if (!trimmedEmail) {
        errors.email = "Please enter an email address";
      } else {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(trimmedEmail)) {
          errors.email = "Invalid email format (e.g. name@fishtailinfosolutions.com)";
        } else if (!trimmedEmail.endsWith("@fishtailinfosolutions.com")) {
          errors.email = "Email must belong to @fishtailinfosolutions.com corporate domain";
        } else if (users.some((u) => u.email.toLowerCase() === trimmedEmail)) {
          errors.email = "A user with this email address already exists";
        }
      }
    }

    setFieldErrors(errors);

    if (errors.name && errors.email) {
      const msg = "Please enter full name and email address";
      setError(msg);
      toast.error(msg);
      return;
    }

    if (errors.name) {
      setError(errors.name);
      toast.error(errors.name);
      return;
    }

    if (errors.email) {
      setError(errors.email);
      toast.error(errors.email);
      return;
    }

    if (form.hasLeftCompany && form.approved) {
      const msg = "A former employee (Has Left Company) cannot have login access approved.";
      setError(msg);
      toast.error(msg);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const url = editingUserId ? `/api/users/${editingUserId}` : "/api/users";
      const method = editingUserId ? "PATCH" : "POST";
      const payload: any = {
        ...form,
        name: trimmedName,
        email: form.email.trim().toLowerCase(),
        creatorId: currentUserId,
      };

      if (payload.hasLeftCompany) {
        payload.approved = false;
        payload.commissionToPartyFund = false;
      } else if (payload.approved) {
        payload.hasLeftCompany = false;
      }

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
      if (statusFilter === "LEFT" && !u.hasLeftCompany) return false;
      if (statusFilter === "ACTIVE" && u.hasLeftCompany) return false;

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
                  { value: "ACTIVE", label: "Active Employees" },
                  { value: "LEFT", label: "Left Company" },
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

                      {/* Status Badges */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {u.hasLeftCompany && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-2xs flex items-center gap-1"
                            title="User has left company. Future commissions will transfer to Office Party Fund."
                          >
                            <UserX className="w-2.5 h-2.5" />
                            Left Co.
                          </span>
                        )}
                        {u.commissionToPartyFund && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-2xs flex items-center gap-1"
                            title="Commissions route directly to Office Party Fund while user remains active."
                          >
                            <Sparkles className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" />
                            Party Fund
                          </span>
                        )}
                        {/* Approval Status Badge / Toggle */}
                        {u.hasLeftCompany ? (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 bg-slate-100 dark:bg-slate-850 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed"
                            title="Former employee: Login access revoked"
                          >
                            ✕ No Access
                          </span>
                        ) : isAdminOrSuperAdmin && (!isUserSuperAdmin || isSuperAdmin) ? (
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

                      {/* Left Company Departure Toggle */}
                      {isAdminOrSuperAdmin && (!isUserSuperAdmin || isSuperAdmin) && (
                        <button
                          onClick={() => handleQuickToggleLeftCompany(u)}
                          className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs ${
                            u.hasLeftCompany
                              ? "bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100"
                              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-rose-300 hover:text-rose-600"
                          }`}
                          title={
                            u.hasLeftCompany
                              ? "Writer marked as departed (Commissions divert to Party Fund). Click to reactivate."
                              : "Mark writer as departed from company (future commissions will route to Office Party Fund)"
                          }
                        >
                          <UserX className={`w-3 h-3 ${u.hasLeftCompany ? "text-rose-600" : "text-slate-400"}`} />
                          <span>{u.hasLeftCompany ? "Left Co." : "Depart"}</span>
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
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                          title="Edit full user details"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
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
                        <div className="flex items-center gap-1.5">
                          {isAdminOrSuperAdmin && (!isUserSuperAdmin || isSuperAdmin) ? (
                            <button
                              onClick={() => handleQuickToggleLeftCompany(u)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border transition cursor-pointer flex items-center gap-1 ${
                                u.hasLeftCompany
                                  ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100"
                                  : "bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-rose-300 hover:text-rose-600"
                              }`}
                              title={
                                u.hasLeftCompany
                                  ? "Marked as Left Company (Commissions divert to Party Fund). Click to reactivate."
                                  : "Click to mark as Left Company (commissions route to Party Fund)"
                              }
                            >
                              <UserX className="w-2.5 h-2.5" />
                              {u.hasLeftCompany ? "Left Co." : "Active"}
                            </button>
                          ) : u.hasLeftCompany ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 flex items-center gap-1">
                              <UserX className="w-2.5 h-2.5" />
                              Left Co.
                            </span>
                          ) : null}

                          {isAdminOrSuperAdmin && (!isUserSuperAdmin || isSuperAdmin) ? (
                            <button
                              onClick={() => handleQuickTogglePartyFund(u)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border transition cursor-pointer flex items-center gap-1 ${
                                u.commissionToPartyFund
                                  ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100"
                                  : "bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-purple-300 hover:text-purple-600"
                              }`}
                              title={
                                u.commissionToPartyFund
                                  ? "Commissions route directly to Party Fund. Click to restore personal payout."
                                  : "Click to route this user's commissions directly to Party Fund"
                              }
                            >
                              <Sparkles className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" />
                              {u.commissionToPartyFund ? "Party Fund" : "Personal"}
                            </button>
                          ) : u.commissionToPartyFund ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" />
                              Party Fund
                            </span>
                          ) : null}

                          {u.hasLeftCompany ? (
                            <span
                              className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border bg-slate-100 dark:bg-slate-850 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed"
                              title="Former employee: Login access revoked"
                            >
                              ✕ No Access
                            </span>
                          ) : isAdminOrSuperAdmin && (!isUserSuperAdmin || isSuperAdmin) ? (
                            <button
                              onClick={() => handleQuickToggleApproval(u)}
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border transition cursor-pointer ${
                                u.approved
                                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                  : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                              }`}
                              title="Click to toggle approval status"
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
                        </div>
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
                            <button
                              onClick={() => openEditModal(u)}
                              className="p-1 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition cursor-pointer"
                              title="Edit User"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
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
                          {
                            role: "SUPER_ADMIN",
                            label: "Super Admin",
                            desc: "Complete platform command, full authority to manage all roles and super admins",
                            color: "text-purple-600",
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-2xl sm:max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-scaleIn">
            {/* Modal Header */}
            <div className="px-6 sm:px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#6D8196] to-slate-800 flex items-center justify-center text-white shadow-sm">
                  {editingUserId ? <Users className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {editingUserId ? "Edit User Profile" : "Add New User"}
                  </h2>
                  <p className="text-[11px] text-slate-400 font-semibold">
                    {editingUserId
                      ? "Update user details, permissions, and site assignments"
                      : "Create a new corporate account with custom role and site access"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-8 space-y-5 text-xs overflow-y-auto flex-1">
              {error && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 text-xs font-bold rounded-xl border border-rose-200 dark:border-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Name & Email in 2-column Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => {
                        setForm({ ...form, name: e.target.value });
                        if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                        if (error) setError("");
                      }}
                      className={`w-full px-3.5 py-2.5 bg-[#FAF9F5] dark:bg-slate-850 border rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:outline-none transition placeholder:text-slate-400 ${
                        (formSubmitted || fieldErrors.name) && !form.name.trim()
                          ? "border-rose-400 dark:border-rose-600 focus:ring-2 focus:ring-rose-400/30"
                          : "border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-[#6D8196]/40"
                      }`}
                      placeholder="e.g. Sarah Mitchell"
                    />
                    {(formSubmitted || fieldErrors.name) && !form.name.trim() && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <AlertCircle className="w-4 h-4 text-rose-500" />
                      </div>
                    )}
                  </div>
                  {(formSubmitted || fieldErrors.name) && !form.name.trim() && (
                    <p className="text-[11px] text-rose-500 font-semibold flex items-center gap-1 mt-1.5 animate-fadeIn">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{fieldErrors.name || "Please enter a user name"}</span>
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    {!editingUserId && form.email.trim() && !form.email.toLowerCase().endsWith("@fishtailinfosolutions.com") && (
                      <button
                        type="button"
                        onClick={() => {
                          const prefix = form.email.trim().split("@")[0];
                          if (prefix) {
                            setForm({ ...form, email: `${prefix}@fishtailinfosolutions.com` });
                            if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                            if (error) setError("");
                          }
                        }}
                        className="text-[10px] font-bold text-[#6D8196] hover:text-[#5A6D81] bg-[#6D8196]/10 hover:bg-[#6D8196]/20 px-2 py-0.5 rounded-md transition cursor-pointer"
                        title="Auto-append corporate domain"
                      >
                        + @fishtailinfosolutions.com
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="email"
                      value={form.email}
                      disabled={!!editingUserId}
                      onChange={(e) => {
                        setForm({ ...form, email: e.target.value });
                        if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                        if (error) setError("");
                      }}
                      className={`w-full px-3.5 py-2.5 bg-[#FAF9F5] dark:bg-slate-850 border rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:outline-none transition disabled:opacity-60 pr-9 placeholder:text-slate-400 ${
                        !editingUserId && (
                          ((formSubmitted || fieldErrors.email) && !form.email.trim()) ||
                          fieldErrors.email ||
                          (form.email.trim() && emailValidationError)
                        )
                          ? "border-rose-400 dark:border-rose-600 focus:ring-2 focus:ring-rose-400/30"
                          : !editingUserId && form.email.trim() && !emailValidationError
                          ? "border-emerald-400 dark:border-emerald-600 focus:ring-2 focus:ring-emerald-400/30"
                          : "border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-[#6D8196]/40"
                      }`}
                      placeholder="name@fishtailinfosolutions.com"
                    />
                    {!editingUserId && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        {((formSubmitted || fieldErrors.email) && !form.email.trim()) ||
                        fieldErrors.email ||
                        (form.email.trim() && emailValidationError) ? (
                          <AlertCircle className="w-4 h-4 text-rose-500" />
                        ) : form.email.trim() && !emailValidationError ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : null}
                      </div>
                    )}
                  </div>
                  {!editingUserId && ((formSubmitted || fieldErrors.email) && !form.email.trim()) && (
                    <p className="text-[11px] text-rose-500 font-semibold flex items-center gap-1 mt-1.5 animate-fadeIn">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{fieldErrors.email || "Please enter an email address"}</span>
                    </p>
                  )}
                  {!editingUserId && form.email.trim() && fieldErrors.email && (
                    <p className="text-[11px] text-rose-500 font-semibold flex items-center gap-1 mt-1.5 animate-fadeIn">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{fieldErrors.email}</span>
                    </p>
                  )}
                  {!editingUserId && form.email.trim() && !fieldErrors.email && emailValidationError && (
                    <p className="text-[11px] text-rose-500 font-semibold flex items-center gap-1 mt-1.5 animate-fadeIn">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{emailValidationError}</span>
                    </p>
                  )}
                  {!editingUserId && form.email.trim() && !fieldErrors.email && !emailValidationError && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-1.5 animate-fadeIn">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Valid corporate email address</span>
                    </p>
                  )}
                  {editingUserId && (
                    <p className="text-[10px] text-slate-400 font-medium mt-1">
                      Email address cannot be changed after account creation.
                    </p>
                  )}
                </div>
              </div>

              {/* Role & Assign Team Lead in 2-column Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Role <span className="text-rose-500">*</span>
                  </label>
                  <CustomSelect
                    value={form.role}
                    onChange={(val) => setForm({ ...form, role: val })}
                    placeholder="Select Role..."
                    options={[
                      { value: "WRITER", label: "Writer" },
                      { value: "LINKER", label: "Linker" },
                      { value: "TEAM_LEAD", label: "Team Lead" },
                      ...(isSuperAdmin
                        ? [
                            { value: "ADMIN", label: "Admin" },
                            { value: "SUPER_ADMIN", label: "Super Admin" },
                          ]
                        : []),
                    ]}
                    className="w-full"
                    triggerClassName="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F5] dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white font-semibold"
                  />
                </div>

                {form.role === "WRITER" ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
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
                ) : (
                  <div className="hidden sm:block" />
                )}
              </div>

              {/* Assign Websites */}
              {(form.role === "WRITER" || form.role === "TEAM_LEAD") && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Assign Websites ({form.siteIds.length} Selected)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, siteIds: sites.map((s) => s.id) })}
                        className="text-[10px] font-bold text-[#6D8196] hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, siteIds: [] })}
                        className="text-[10px] font-bold text-slate-400 hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-3.5 bg-[#FAF9F5] dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800">
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

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div
                  className={`p-4 rounded-2xl border transition ${
                    form.hasLeftCompany
                      ? "bg-slate-100/70 dark:bg-slate-900/60 border-slate-200/50 dark:border-slate-800/50 opacity-60 cursor-not-allowed"
                      : "bg-[#FAF9F5] dark:bg-slate-850 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <Toggle
                    checked={form.hasLeftCompany ? false : form.approved}
                    disabled={form.hasLeftCompany}
                    onChange={(checked) =>
                      setForm((prev) => ({
                        ...prev,
                        approved: checked,
                        ...(checked ? { hasLeftCompany: false } : {}),
                      }))
                    }
                    label="Approve User Access"
                    subLabel={
                      form.hasLeftCompany
                        ? "Disabled: Former employees cannot log in or have active access."
                        : "Unapproved users cannot log in to the application."
                    }
                  />
                </div>

                <div className="bg-[#FAF9F5] dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <Toggle
                    checked={form.hasLeftCompany}
                    onChange={(checked) =>
                      setForm((prev) => ({
                        ...prev,
                        hasLeftCompany: checked,
                        ...(checked ? { approved: false, commissionToPartyFund: false } : {}),
                      }))
                    }
                    label="Has Left Company (Former Employee)"
                    subLabel="Employee departed. Historical records are preserved, but login is restricted."
                  />
                </div>

                <div
                  className={`p-4 rounded-2xl border transition ${
                    form.hasLeftCompany
                      ? "bg-slate-100/70 dark:bg-slate-900/60 border-slate-200/50 dark:border-slate-800/50 opacity-60 cursor-not-allowed"
                      : "bg-[#FAF9F5] dark:bg-slate-850 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <Toggle
                    checked={form.hasLeftCompany ? false : form.commissionToPartyFund}
                    disabled={form.hasLeftCompany}
                    onChange={(checked) =>
                      setForm((prev) => ({
                        ...prev,
                        commissionToPartyFund: checked,
                        ...(checked ? { hasLeftCompany: false } : {}),
                      }))
                    }
                    label="Commission in Party Fund"
                    subLabel={
                      form.hasLeftCompany
                        ? "Disabled: Commissions automatically route to Party Fund for former employees."
                        : "Directly diverts all earned commissions to Office Party Fund while user remains active."
                    }
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 sm:px-8 py-4 bg-[#FAF9F5] dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="text-[11px] font-semibold text-slate-400">
                {!editingUserId && !isEmailValid && form.email.trim() ? (
                  <span className="text-rose-500 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Fix email error to proceed
                  </span>
                ) : (
                  <span>
                    Fields marked with <span className="text-rose-500 font-bold">*</span> are required
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUser}
                  disabled={saving}
                  className="px-6 py-2.5 bg-[#6D8196] hover:bg-[#5A6D81] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : editingUserId ? "Save Profile" : "Add User"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
