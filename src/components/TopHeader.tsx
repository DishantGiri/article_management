/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Bell,
  Plus,
  User,
  Settings,
  Moon,
  Layers,
  HelpCircle,
  ChevronRight,
  LogOut,
  Check,
  X,
  FileText,
  Package,
  Link2,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { getNotificationTargetUrl } from "@/lib/notificationRouting";

interface TopHeaderProps {
  notifications?: any[];
  onMarkAllAsRead?: () => void;
  onNotificationClick?: (notif: any) => void;
  extraActions?: React.ReactNode;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function TopHeader({
  notifications = [],
  onMarkAllAsRead,
  onNotificationClick,
  extraActions,
}: TopHeaderProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { resolvedTheme, setTheme } = useTheme();

  const [searchQuery, setSearchQuery] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showBellMenu, setShowBellMenu] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const bellMenuRef = useRef<HTMLDivElement>(null);
  const quickCreateRef = useRef<HTMLDivElement>(null);

  const currentUser = session?.user;
  const userRole = (currentUser?.role || "").toUpperCase();
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Subtitle matching user role
  const getRoleSubtitle = () => {
    switch (userRole) {
      case "SUPER_ADMIN":
        return "Platform Command Hub - Full visibility across all sites, writers, and networks.";
      case "ADMIN":
        return "System Administration & Operations Control Center.";
      case "TEAM_LEAD":
        return "Editorial Review Queue & Team Velocity Dispatch.";
      case "LINKER":
        return "Affiliate Gateway & Link Log Operations.";
      case "WRITER":
        return "Focused Writing Station & Assignment Delivery.";
      default:
        return "Affiliate Gateway & Link Log Operations.";
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setShowProfileMenu(false);
      }
      if (bellMenuRef.current && !bellMenuRef.current.contains(target)) {
        setShowBellMenu(false);
      }
      if (quickCreateRef.current && !quickCreateRef.current.contains(target)) {
        setShowQuickCreate(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut handlers (Ctrl + Shift + P for Profile, Ctrl + P for Settings)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.shiftKey && (e.key === "P" || e.key === "p")) {
          e.preventDefault();
          router.push("/settings");
          setShowProfileMenu(false);
        } else if (!e.shiftKey && (e.key === "P" || e.key === "p")) {
          e.preventDefault();
          router.push("/settings");
          setShowProfileMenu(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  // Search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/articles?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  const isDarkMode = resolvedTheme === "dark";

  return (
    <div className="relative w-full">
      {/* ─── TOP BAR PANEL (Seamless matching reference) ─── */}
      <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 py-1 transition-all">
        {/* Left Side: Greeting & Subtitle */}
        <div className="space-y-0.5 min-w-0">
          <h1
            className="text-2xl sm:text-[26px] font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate"
            suppressHydrationWarning
          >
            {getGreeting()}, {currentUser?.name || "Anjali"}
          </h1>
          <p className="text-xs text-slate-400 dark:text-slate-400 font-normal truncate">
            {getRoleSubtitle()}
          </p>
        </div>

        {/* Right Side: Search, Bell, Plus, Profile Avatar */}
        <div className="flex items-center gap-3 self-start md:self-center flex-wrap sm:flex-nowrap">
          {extraActions}

          {/* Search Pill Input */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for something"
              className="w-44 sm:w-60 pl-9.5 pr-8 py-2 text-xs font-semibold bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/70 dark:border-slate-700/80 rounded-full text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Notification Bell Button with Red Dot */}
          <div className="relative" ref={bellMenuRef}>
            <button
              onClick={() => {
                setShowBellMenu(!showBellMenu);
                setShowProfileMenu(false);
                setShowQuickCreate(false);
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 dark:bg-slate-900 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/80 flex items-center justify-center text-slate-600 dark:text-slate-300 transition shadow-2xs cursor-pointer relative"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell className="w-4 h-4 text-slate-700 dark:text-slate-200" />
              {/* Red dot badge (matching design) */}
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            </button>

            {/* Notifications Dropdown */}
            {showBellMenu && (
              <div className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-2xl z-50 p-4 space-y-3 animate-scaleIn">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold px-2 py-0.5 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && onMarkAllAsRead && (
                    <button
                      onClick={onMarkAllAsRead}
                      className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Mark read
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-6">
                      No notifications
                    </p>
                  ) : (
                    notifications.slice(0, 10).map((n) => {
                      const linkUrl = getNotificationTargetUrl(n, userRole);
                      return (
                        <Link
                          key={n.id}
                          href={linkUrl}
                          onClick={() => {
                            if (onNotificationClick) onNotificationClick(n);
                            setShowBellMenu(false);
                          }}
                          className={`p-3 rounded-xl border text-xs flex flex-col gap-1.5 transition-all block cursor-pointer ${
                            !n.isRead
                              ? "bg-teal-50/50 dark:bg-teal-950/30 border-teal-200/70 dark:border-teal-800/60 font-semibold"
                              : "bg-slate-50/60 dark:bg-slate-900/60 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100/70"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {n.title || "Notification"}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(n.createdAt).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                            {n.message}
                          </p>
                        </Link>
                      );
                    })
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 text-center">
                  <Link
                    href="/notifications"
                    onClick={() => setShowBellMenu(false)}
                    className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 transition"
                  >
                    View All Notification Center &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Circular Green Plus Button */}
          <div className="relative" ref={quickCreateRef}>
            <button
              onClick={() => {
                setShowQuickCreate(!showQuickCreate);
                setShowProfileMenu(false);
                setShowBellMenu(false);
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#0d9488] hover:bg-[#0f766e] active:scale-95 text-white flex items-center justify-center font-extrabold shadow-sm transition-all cursor-pointer"
              aria-label="Quick Action"
              title="Quick Action"
            >
              <Plus className="w-5 h-5 font-bold" />
            </button>

            {/* Quick Create Menu */}
            {showQuickCreate && (
              <div className="absolute right-0 mt-2.5 w-56 bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-2xl z-50 p-2 space-y-1 animate-scaleIn">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Quick Actions
                </div>
                {(userRole === "SUPER_ADMIN" || userRole === "ADMIN") && (
                  <Link
                    href="/products/add"
                    onClick={() => setShowQuickCreate(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <Package className="w-4 h-4 text-teal-500" />
                    <span>Add New Product</span>
                  </Link>
                )}
                <Link
                  href="/articles"
                  onClick={() => setShowQuickCreate(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span>Article Pipeline</span>
                </Link>
                {(userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "LINKER") && (
                  <Link
                    href="/links"
                    onClick={() => setShowQuickCreate(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <Link2 className="w-4 h-4 text-emerald-500" />
                    <span>Link Operations</span>
                  </Link>
                )}
                {(userRole === "SUPER_ADMIN" || userRole === "ADMIN") && (
                  <Link
                    href="/users"
                    onClick={() => setShowQuickCreate(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <User className="w-4 h-4 text-purple-500" />
                    <span>Manage Users</span>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* User Profile Avatar with Online Dot */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowBellMenu(false);
                setShowQuickCreate(false);
              }}
              className="relative rounded-full transition cursor-pointer group focus:outline-none"
              aria-label="User profile menu"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-gradient-to-br from-teal-100 to-emerald-100 dark:from-teal-950 dark:to-emerald-950 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs sm:text-sm border-2 border-white dark:border-slate-800 ring-2 ring-slate-200/80 dark:ring-slate-700 shadow-2xs group-hover:ring-teal-400 transition-all">
                {currentUser?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentUser.image}
                    alt={currentUser.name || "User"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{(currentUser?.name || "U").charAt(0).toUpperCase()}</span>
                )}
              </div>
              {/* Online Green Badge Dot (Matching Design) */}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-850" />
            </button>

            {/* ─── USER PROFILE DROPDOWN (EXACT MATCH TO DESIGN) ─── */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2.5 w-72 sm:w-80 bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-2xl z-50 p-4 space-y-3 animate-scaleIn text-left">
                {/* Header: Avatar, Name, Email */}
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-teal-100 to-emerald-100 dark:from-teal-950 dark:to-emerald-950 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-sm border-2 border-white dark:border-slate-800 shadow-2xs">
                      {currentUser?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={currentUser.image}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{(currentUser?.name || "U").charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    {/* Green online badge */}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-850" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                      {currentUser?.name || "User"}
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-400 font-medium truncate mt-0.5">
                      {currentUser?.email || "No email"}
                    </p>
                  </div>
                </div>

                {/* Section 1: View Profile, Settings, Dark Mode */}
                <div className="space-y-1">
                  {/* View Profile */}
                  <Link
                    href="/settings"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
                      <span>View Profile</span>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium font-mono">
                      Ctrl + Shift + P
                    </span>
                  </Link>

                  {/* Settings */}
                  <Link
                    href="/settings"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
                      <span>Settings</span>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium font-mono">
                      Ctrl + P
                    </span>
                  </Link>

                  {/* Dark Mode Toggle */}
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition">
                    <div className="flex items-center gap-3">
                      {isDarkMode ? (
                        <Moon className="w-4 h-4 text-teal-500" />
                      ) : (
                        <Moon className="w-4 h-4 text-slate-500" />
                      )}
                      <span>Dark mode</span>
                    </div>
                    {/* Toggle Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isDarkMode}
                      onClick={() => setTheme(isDarkMode ? "light" : "dark")}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isDarkMode ? "bg-teal-500" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          isDarkMode ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-100 dark:border-slate-700/60" />

                {/* Section 2: Changelog, Support */}
                <div className="space-y-1">
                  {/* Changelog */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangelogModal(true);
                      setShowProfileMenu(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <Layers className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
                      <span>Changelog</span>
                    </div>
                  </button>

                  {/* Support */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowSupportModal(true);
                      setShowProfileMenu(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <HelpCircle className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
                      <span>Support</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-100 dark:border-slate-700/60" />

                {/* Section 3: Sign Out Button Card */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-300 hover:border-rose-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── SUPPORT MODAL ─── */}
      {showSupportModal && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Platform Support & Help
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Article Flow Enterprise Assistance
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSupportModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  Technical Assistance:
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  For bug reports, site permission requests, or account inquiries, contact the platform administration:
                </p>
                <a
                  href="mailto:support@fishtailinfosolutions.com"
                  className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 font-bold hover:underline mt-1"
                >
                  support@fishtailinfosolutions.com &rarr;
                </a>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  Keyboard Shortcuts:
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-700">
                    <span className="font-medium">Profile:</span>
                    <kbd className="font-mono text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                      Ctrl + Shift + P
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-700">
                    <span className="font-medium">Settings:</span>
                    <kbd className="font-mono text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                      Ctrl + P
                    </kbd>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowSupportModal(false)}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-600 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CHANGELOG MODAL ─── */}
      {showChangelogModal && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Platform Changelog
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Recent system updates and features
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowChangelogModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-800 dark:text-slate-100">
                    v1.3 — Modern Navigation & Top Bar
                  </span>
                  <span className="text-[10px] text-teal-600 font-bold bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
                    Latest
                  </span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  Introduced the unified top bar with real-time search, quick create actions, and an interactive profile menu with instant dark mode toggle and shortcuts.
                </p>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="font-extrabold text-slate-800 dark:text-slate-100">
                  v1.2 — Team Analytics & Dark Mode Fixes
                </span>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  Enhanced contrast on Team Members performance cards, resolved gradient bleeding in dark theme, and optimized save validation in settings.
                </p>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="font-extrabold text-slate-800 dark:text-slate-100">
                  v1.1 — Notification Architecture & Permissions
                </span>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  Fixed article notification navigation and cross-site assignment completion authorization for specialized writing workflows.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowChangelogModal(false)}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-600 transition cursor-pointer"
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
