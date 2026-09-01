"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Megaphone,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Trash2,
  Edit3,
  Users,
  AlertTriangle,
  Sparkles,
  Info,
  Bell,
  X,
  Check,
  Calendar,
  Globe,
  FileText,
  Link as LinkIcon,
  Shield,
} from "lucide-react";
import toast from "react-hot-toast";

type NoticeCategoryType = "IMPORTANT" | "GENERAL" | "SUGGESTION" | "URGENT" | "ANNOUNCEMENT";
type TargetRoleType = "ALL" | "WRITER" | "LINKER" | "TEAM_LEAD" | "ADMIN";

interface Notice {
  id: number;
  title: string;
  content: string;
  category: NoticeCategoryType;
  targetRoles?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: number; name: string; role: string; image?: string };
  isRead: boolean;
  readAt: string | null;
  totalAcknowledgments: number;
}

interface NoticeDetail extends Notice {
  acknowledgments?: {
    id: number;
    readAt: string;
    user: { id: number; name: string; role: string; email: string };
  }[];
}

const CATEGORY_CONFIG: Record<
  NoticeCategoryType,
  { label: string; bg: string; text: string; border: string; darkBg: string; darkText: string; darkBorder: string; icon: any }
> = {
  URGENT: {
    label: "Urgent",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    darkBg: "dark:bg-rose-950/40",
    darkText: "dark:text-rose-300",
    darkBorder: "dark:border-rose-800/50",
    icon: AlertTriangle,
  },
  IMPORTANT: {
    label: "Important",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    darkBg: "dark:bg-amber-950/40",
    darkText: "dark:text-amber-300",
    darkBorder: "dark:border-amber-800/50",
    icon: Bell,
  },
  ANNOUNCEMENT: {
    label: "Announcement",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    darkBg: "dark:bg-blue-950/40",
    darkText: "dark:text-blue-300",
    darkBorder: "dark:border-blue-800/50",
    icon: Megaphone,
  },
  SUGGESTION: {
    label: "Suggestion",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    darkBg: "dark:bg-purple-950/40",
    darkText: "dark:text-purple-300",
    darkBorder: "dark:border-purple-800/50",
    icon: Sparkles,
  },
  GENERAL: {
    label: "General",
    bg: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-200",
    darkBg: "dark:bg-slate-800/60",
    darkText: "dark:text-slate-300",
    darkBorder: "dark:border-slate-700",
    icon: Info,
  },
};

const TARGET_ROLES: { value: TargetRoleType; label: string; desc: string; icon: any }[] = [
  { value: "ALL", label: "All Roles", desc: "Sent to everyone", icon: Globe },
  { value: "WRITER", label: "Writers Only", desc: "Writers & authors", icon: FileText },
  { value: "LINKER", label: "Linkers Only", desc: "Linkers & affiliates", icon: LinkIcon },
  { value: "TEAM_LEAD", label: "Team Leads Only", desc: "Lead reviewers", icon: Users },
  { value: "ADMIN", label: "Admins Only", desc: "Admins & managers", icon: Shield },
];

const ROLE_BADGE_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
  ALL: { label: "All Roles", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", border: "border-slate-300 dark:border-slate-700", icon: Globe },
  WRITER: { label: "Writers Only", bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800/50", icon: FileText },
  LINKER: { label: "Linkers Only", bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800/50", icon: LinkIcon },
  TEAM_LEAD: { label: "Team Leads Only", bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800/50", icon: Users },
  ADMIN: { label: "Admins Only", bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800/50", icon: Shield },
  SUPER_ADMIN: { label: "Super Admins", bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-800/50", icon: Shield },
};

export default function NoticeBoardPage() {
  const { data: session, status } = useSession();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [viewingAcksNotice, setViewingAcksNotice] = useState<NoticeDetail | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ackLoadingId, setAckLoadingId] = useState<number | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState<NoticeCategoryType>("GENERAL");
  const [formSelectedRoles, setFormSelectedRoles] = useState<string[]>(["ALL"]);

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";

  const fetchNotices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notices");
      if (res.ok) {
        const data = await res.json();
        setNotices(data);
      } else {
        toast.error("Failed to load notices");
      }
    } catch (err) {
      console.error("Error fetching notices:", err);
      toast.error("Error connecting to server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchNotices();
    }
  }, [status, fetchNotices]);

  // Real-time listener for new notices & acknowledgments
  useEffect(() => {
    const handleNoticePublished = () => {
      fetchNotices();
    };
    const handleNoticeAcknowledged = () => {
      fetchNotices();
    };

    window.addEventListener("notice-published", handleNoticePublished);
    window.addEventListener("notice-acknowledged", handleNoticeAcknowledged);
    return () => {
      window.removeEventListener("notice-published", handleNoticePublished);
      window.removeEventListener("notice-acknowledged", handleNoticeAcknowledged);
    };
  }, [fetchNotices]);

  // Multi-select toggle handler
  const handleRoleToggle = (roleValue: string) => {
    if (roleValue === "ALL") {
      setFormSelectedRoles(["ALL"]);
      return;
    }

    setFormSelectedRoles((prev) => {
      const withoutAll = prev.filter((r) => r !== "ALL");
      if (withoutAll.includes(roleValue)) {
        const next = withoutAll.filter((r) => r !== roleValue);
        return next.length > 0 ? next : ["ALL"];
      } else {
        return [...withoutAll, roleValue];
      }
    });
  };

  // Handle Create / Edit Notice
  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) {
      toast.error("Title and content are required");
      return;
    }

    setSubmitting(true);
    try {
      const targetRolesPayload = formSelectedRoles.includes("ALL") ? "ALL" : formSelectedRoles.join(",");

      if (editingNotice) {
        const res = await fetch(`/api/notices/${editingNotice.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle,
            content: formContent,
            category: formCategory,
            targetRoles: targetRolesPayload,
          }),
        });
        if (res.ok) {
          toast.success("Notice updated successfully");
          setIsCreateOpen(false);
          setEditingNotice(null);
          fetchNotices();
        } else {
          const err = await res.json();
          toast.error(err.error || "Failed to update notice");
        }
      } else {
        const res = await fetch("/api/notices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle,
            content: formContent,
            category: formCategory,
            targetRoles: targetRolesPayload,
          }),
        });
        if (res.ok) {
          toast.success("Notice published & broadcasted");
          setIsCreateOpen(false);
          setFormTitle("");
          setFormContent("");
          setFormCategory("GENERAL");
          setFormSelectedRoles(["ALL"]);
          fetchNotices();
        } else {
          const err = await res.json();
          toast.error(err.error || "Failed to create notice");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Notice
  const handleDeleteNotice = async (id: number) => {
    if (!confirm("Are you sure you want to delete this notice?")) return;
    try {
      const res = await fetch(`/api/notices/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Notice deleted");
        setNotices((prev) => prev.filter((n) => n.id !== id));
      } else {
        toast.error("Failed to delete notice");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error deleting notice");
    }
  };

  // Handle Single Acknowledgment
  const handleAcknowledge = async (id: number) => {
    setAckLoadingId(id);
    try {
      const res = await fetch(`/api/notices/${id}/ack`, { method: "POST" });
      if (res.ok) {
        toast.success("Acknowledgment confirmed");
        setNotices((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
        );
      } else {
        toast.error("Failed to confirm acknowledgment");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error acknowledging notice");
    } finally {
      setAckLoadingId(null);
    }
  };

  // Open Acknowledgment detail modal
  const handleViewAcknowledgments = async (notice: Notice) => {
    try {
      const res = await fetch(`/api/notices/${notice.id}`);
      if (res.ok) {
        const data = await res.json();
        setViewingAcksNotice(data);
      } else {
        toast.error("Failed to load notice details");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error loading acknowledgment details");
    }
  };

  const openCreateModal = () => {
    setEditingNotice(null);
    setFormTitle("");
    setFormContent("");
    setFormCategory("GENERAL");
    setFormSelectedRoles(["ALL"]);
    setIsCreateOpen(true);
  };

  const openEditModal = (notice: Notice) => {
    setEditingNotice(notice);
    setFormTitle(notice.title);
    setFormContent(notice.content);
    setFormCategory(notice.category);
    const rawRoles = notice.targetRoles || "ALL";
    const initialRoles = rawRoles === "ALL" ? ["ALL"] : rawRoles.split(",").map((s) => s.trim()).filter(Boolean);
    setFormSelectedRoles(initialRoles.length > 0 ? initialRoles : ["ALL"]);
    setIsCreateOpen(true);
  };

  const filteredNotices = useMemo(() => {
    return notices.filter((n) => {
      if (selectedCategory !== "ALL" && n.category !== selectedCategory) {
        return false;
      }
      if (selectedRole !== "ALL") {
        const raw = n.targetRoles || "ALL";
        if (selectedRole === "GLOBAL_ALL" && raw !== "ALL") return false;
        if (selectedRole !== "GLOBAL_ALL" && raw !== "ALL" && !raw.includes(selectedRole)) return false;
      }
      if (showUnreadOnly && n.isRead) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = n.title.toLowerCase().includes(q);
        const matchesContent = n.content.toLowerCase().includes(q);
        const matchesAuthor = n.createdBy.name.toLowerCase().includes(q);
        if (!matchesTitle && !matchesContent && !matchesAuthor) return false;
      }
      return true;
    });
  }, [notices, selectedCategory, selectedRole, showUnreadOnly, searchQuery]);

  const unreadCount = useMemo(() => notices.filter((n) => !n.isRead).length, [notices]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto min-h-screen bg-[#FAF9F5] dark:bg-slate-950 text-[#4A4A4A] dark:text-slate-100 space-y-6" suppressHydrationWarning>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#CBCBCB]/50 dark:border-slate-800 pb-5" suppressHydrationWarning>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#4A4A4A] dark:text-white flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#6D8196]/15 dark:bg-[#6D8196]/30 text-[#3D4F61] dark:text-slate-200 shadow-xs">
              <Megaphone className="w-6 h-6 text-[#6D8196] dark:text-slate-200" />
            </div>
            Notice Board
          </h1>
          <p className="text-xs sm:text-sm text-[#737373] dark:text-slate-400 mt-1.5 font-medium flex items-center gap-2">
            <span>Role-targeted operational notices and team announcements</span>
            <span>&bull;</span>
            <span className="text-[#6D8196] dark:text-blue-400 font-bold">{unreadCount} unread</span>
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-[#6D8196] hover:bg-[#5b6d80] text-white transition-all shadow-sm hover:shadow-md active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Publish Notice
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs" suppressHydrationWarning>
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#737373] dark:text-slate-400" />
          <input
            type="text"
            placeholder="Search notices by title, content, or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-[#CBCBCB]/80 dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-800/80 text-[#4A4A4A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6D8196]/40 transition-all"
          />
        </div>

        {/* Role Filter (for Admins) */}
        {isAdmin && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-[#737373] dark:text-slate-400 whitespace-nowrap">Target:</span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-[#CBCBCB]/80 dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-800 text-[#4A4A4A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6D8196]/40 cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              <option value="GLOBAL_ALL">Broadcast Only (All)</option>
              <option value="WRITER">Includes Writers</option>
              <option value="LINKER">Includes Linkers</option>
              <option value="TEAM_LEAD">Includes Team Leads</option>
              <option value="ADMIN">Includes Admins</option>
            </select>
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedCategory === "ALL"
                ? "bg-[#6D8196] text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-[#737373] dark:text-slate-300 hover:text-[#4A4A4A] dark:hover:text-white"
            }`}
          >
            All ({notices.length})
          </button>

          {(Object.keys(CATEGORY_CONFIG) as NoticeCategoryType[]).map((cat) => {
            const count = notices.filter((n) => n.category === cat).length;
            const config = CATEGORY_CONFIG[cat];
            const Icon = config.icon;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === cat
                    ? "bg-[#6D8196] text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-[#737373] dark:text-slate-300 hover:text-[#4A4A4A] dark:hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{config.label}</span>
                {count > 0 && <span className="opacity-70 text-[10px]">({count})</span>}
              </button>
            );
          })}

          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              showUnreadOnly
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-[#737373] dark:text-slate-300 hover:text-[#4A4A4A] dark:hover:text-white"
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${showUnreadOnly ? "bg-white text-amber-600 font-bold" : "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200"}`}>
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Notices List */}
      {loading ? (
        <div className="p-16 text-center" suppressHydrationWarning>
          <div className="w-8 h-8 border-4 border-[#CBCBCB] border-t-[#6D8196] rounded-full animate-spin mx-auto mb-4" suppressHydrationWarning></div>
          <p className="text-xs text-[#737373] dark:text-slate-400 font-medium">Loading notice board...</p>
        </div>
      ) : filteredNotices.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs" suppressHydrationWarning>
          <div className="w-12 h-12 rounded-2xl bg-[#6D8196]/15 dark:bg-[#6D8196]/30 text-[#3D4F61] dark:text-slate-200 flex items-center justify-center mx-auto mb-3">
            <Megaphone className="w-6 h-6 text-[#6D8196] dark:text-slate-200" />
          </div>
          <h3 className="text-sm font-bold text-[#4A4A4A] dark:text-white">No Notices Found</h3>
          <p className="text-xs text-[#737373] dark:text-slate-400 mt-1 font-medium">
            {showUnreadOnly
              ? "You have acknowledged all current notices."
              : searchQuery
              ? "No notices matched your search query."
              : "No notices have been published for this filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4" suppressHydrationWarning>
          {filteredNotices.map((notice) => {
            const config = CATEGORY_CONFIG[notice.category] || CATEGORY_CONFIG.GENERAL;
            const Icon = config.icon;
            
            const rawRoles = notice.targetRoles || "ALL";
            const roleKeys = rawRoles === "ALL" ? ["ALL"] : rawRoles.split(",").map((s) => s.trim()).filter(Boolean);

            return (
              <div
                key={notice.id}
                className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all shadow-xs hover:shadow-md ${
                  notice.isRead
                    ? "border-[#CBCBCB]/60 dark:border-slate-800"
                    : "border-l-4 border-l-[#6D8196] border-[#CBCBCB]/70 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40"
                }`}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Category Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${config.bg} ${config.text} ${config.border} ${config.darkBg} ${config.darkText} ${config.darkBorder}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {config.label}
                    </span>

                    {/* Target Roles Multi Badges */}
                    {roleKeys.map((rk) => {
                      const roleBadge = ROLE_BADGE_CONFIG[rk] || ROLE_BADGE_CONFIG.ALL;
                      const RoleIcon = roleBadge.icon;
                      return (
                        <span
                          key={rk}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${roleBadge.bg} ${roleBadge.text} ${roleBadge.border}`}
                          title={`Target: ${roleBadge.label}`}
                        >
                          <RoleIcon className="w-3.5 h-3.5" />
                          {roleBadge.label}
                        </span>
                      );
                    })}

                    {/* Read / Unread Status Badge */}
                    {notice.isRead ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Understood
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 animate-pulse">
                        <Clock className="w-3.5 h-3.5" />
                        Requires Acknowledgment
                      </span>
                    )}

                    <h2 className="text-base sm:text-lg font-bold text-[#4A4A4A] dark:text-white ml-1">
                      {notice.title}
                    </h2>
                  </div>

                  {/* Top Right Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => handleViewAcknowledgments(notice)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#4A4A4A] dark:text-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                          title="View read acknowledgments"
                        >
                          <Users className="w-3.5 h-3.5 text-[#6D8196]" />
                          <span>{notice.totalAcknowledgments} read</span>
                        </button>
                        <button
                          onClick={() => openEditModal(notice)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#6D8196] hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                          title="Edit notice"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteNotice(notice.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                          title="Delete notice"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Notice Body */}
                <div className="text-xs sm:text-sm text-[#4A4A4A] dark:text-slate-200 leading-relaxed whitespace-pre-wrap pl-1 my-3">
                  {notice.content}
                </div>

                {/* Footer details & Action */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 mt-3 border-t border-[#CBCBCB]/40 dark:border-slate-800 text-xs text-[#737373] dark:text-slate-400">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#4A4A4A] dark:text-slate-300">
                      By {notice.createdBy.name} ({notice.createdBy.role})
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#6D8196]" />
                      {new Date(notice.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                    {notice.readAt && (
                      <>
                        <span>&bull;</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          You confirmed on {new Date(notice.readAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </>
                    )}
                  </div>

                  {!notice.isRead && (
                    <button
                      onClick={() => handleAcknowledge(notice.id)}
                      disabled={ackLoadingId === notice.id}
                      className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer self-end sm:self-auto"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {ackLoadingId === notice.id ? "Recording..." : "I have understood"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-[#CBCBCB]/80 dark:border-slate-700 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[#CBCBCB]/40 dark:border-slate-800">
              <h2 className="text-lg font-bold text-[#4A4A4A] dark:text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-[#6D8196]" />
                {editingNotice ? "Edit Notice" : "Publish New Notice"}
              </h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg text-[#737373] hover:text-[#4A4A4A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNotice} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4A4A4A] dark:text-slate-300 mb-1.5">
                  Notice Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Scheduled System Maintenance / New Article Guidelines"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-[#CBCBCB]/80 dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-800 text-[#4A4A4A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6D8196]/40"
                  required
                />
              </div>

              {/* Target Audience / Multi-Select Role Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#4A4A4A] dark:text-slate-300">
                    Target Audience (Multi-Select)
                  </label>
                  <span className="text-[11px] font-semibold text-[#6D8196] dark:text-blue-400">
                    {formSelectedRoles.includes("ALL")
                      ? "Broadcast to Everyone"
                      : `${formSelectedRoles.length} role${formSelectedRoles.length > 1 ? "s" : ""} selected`}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TARGET_ROLES.map((r) => {
                    const isSelected = formSelectedRoles.includes(r.value);
                    const Icon = r.icon;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => handleRoleToggle(r.value)}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer text-left ${
                          isSelected
                            ? "border-[#6D8196] bg-[#6D8196]/15 dark:bg-[#6D8196]/30 text-[#3D4F61] dark:text-white ring-2 ring-[#6D8196]/30"
                            : "border-[#CBCBCB]/60 dark:border-slate-700 bg-white dark:bg-slate-800 text-[#737373] dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{r.label}</span>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                            isSelected
                              ? "bg-[#6D8196] border-[#6D8196] text-white"
                              : "border-slate-300 dark:border-slate-600 bg-transparent"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-[#737373] dark:text-slate-400 mt-1.5 font-medium">
                  {formSelectedRoles.includes("ALL")
                    ? "✨ This notice will appear for all users on login and in real-time."
                    : `🎯 This notice will only be sent to: ${formSelectedRoles
                        .map((r) => TARGET_ROLES.find((t) => t.value === r)?.label || r)
                        .join(", ")}.`}
                </p>
              </div>

              {/* Category Selector */}
              <div>
                <label className="block text-xs font-bold text-[#4A4A4A] dark:text-slate-300 mb-1.5">
                  Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(CATEGORY_CONFIG) as NoticeCategoryType[]).map((cat) => {
                    const config = CATEGORY_CONFIG[cat];
                    const Icon = config.icon;
                    const isSelected = formCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFormCategory(cat)}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? "border-[#6D8196] bg-[#6D8196]/15 dark:bg-[#6D8196]/30 text-[#3D4F61] dark:text-white ring-2 ring-[#6D8196]/30"
                            : "border-[#CBCBCB]/60 dark:border-slate-700 bg-white dark:bg-slate-800 text-[#737373] dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A4A4A] dark:text-slate-300 mb-1.5">
                  Content / Instructions <span className="text-rose-500">*</span>
                </label>
                <textarea
                  placeholder="Provide all essential details. Targeted users will receive a popup modal and be asked to confirm they have read and understood this message."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={5}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-[#CBCBCB]/80 dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-800 text-[#4A4A4A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6D8196]/40 leading-relaxed"
                  required
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#CBCBCB]/40 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-[#737373] dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#6D8196] hover:bg-[#5b6d80] text-white transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  {submitting ? "Publishing..." : editingNotice ? "Update Notice" : "Broadcast & Publish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Acknowledgments Modal */}
      {viewingAcksNotice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-[#CBCBCB]/80 dark:border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[#CBCBCB]/40 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-[#4A4A4A] dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#6D8196]" />
                  Acknowledgments ({viewingAcksNotice.acknowledgments?.length || 0})
                </h2>
                <p className="text-xs text-[#737373] dark:text-slate-400 mt-0.5 truncate max-w-xs sm:max-w-md">
                  {viewingAcksNotice.title}
                </p>
              </div>
              <button
                onClick={() => setViewingAcksNotice(null)}
                className="p-1 rounded-lg text-[#737373] hover:text-[#4A4A4A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {!viewingAcksNotice.acknowledgments || viewingAcksNotice.acknowledgments.length === 0 ? (
                <p className="text-xs text-[#737373] dark:text-slate-400 py-6 text-center">
                  No users have acknowledged this notice yet.
                </p>
              ) : (
                viewingAcksNotice.acknowledgments.map((ack) => (
                  <div
                    key={ack.id}
                    className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[#CBCBCB]/40 dark:border-slate-700 text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#4A4A4A] dark:text-white">
                        {ack.user.name}
                      </span>
                      <span className="text-[10px] text-[#737373] dark:text-slate-400 ml-1.5 font-medium">
                        ({ack.user.role})
                      </span>
                    </div>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      {new Date(ack.readAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#CBCBCB]/40 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setViewingAcksNotice(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#6D8196] text-white hover:bg-[#5b6d80] transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
