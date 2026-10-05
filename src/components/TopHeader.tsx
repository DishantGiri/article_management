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
  Sun,
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
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
  searchPlaceholder?: string;
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
  searchQuery: externalSearchQuery,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder,
}: TopHeaderProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { resolvedTheme, setTheme } = useTheme();

  const isControlled = externalSearchQuery !== undefined;
  const [internalQuery, setInternalQuery] = useState("");
  const activeQuery = isControlled ? (externalSearchQuery || "") : internalQuery;

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showBellMenu, setShowBellMenu] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const bellMenuRef = useRef<HTMLDivElement>(null);
  const quickCreateRef = useRef<HTMLDivElement>(null);

  const [profileOverride, setProfileOverride] = useState<{ name?: string; image?: string | null }>({});

  useEffect(() => {
    const handleProfileUpdate = (e: any) => {
      if (e.detail) {
        setProfileOverride((prev) => ({
          ...prev,
          ...(e.detail.name !== undefined ? { name: e.detail.name } : {}),
          ...(e.detail.image !== undefined ? { image: e.detail.image } : {}),
        }));
      }
    };
    window.addEventListener("user-profile-updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("user-profile-updated", handleProfileUpdate);
    };
  }, []);

  const rawUser = session?.user;
  const currentUser = rawUser
    ? {
        ...rawUser,
        name: profileOverride.name ?? rawUser.name,
        image: profileOverride.image !== undefined ? profileOverride.image : rawUser.image,
      }
    : undefined;
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
      case "PRODUCT_RESEARCHER":
        return "Research Hub — Browse and analyze products across all sites.";
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

  const handleQueryChange = (val: string) => {
    if (!isControlled) {
      setInternalQuery(val);
    }
    if (onSearchChange) {
      onSearchChange(val);
    }
  };

  const handleClear = () => {
    if (!isControlled) {
      setInternalQuery("");
    }
    if (onSearchChange) {
      onSearchChange("");
    }
  };

  // Search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = activeQuery.trim();
    if (onSearchSubmit) {
      onSearchSubmit(query);
      return;
    }
    if (!query) return;

    if (typeof window !== "undefined") {
      const pathname = window.location.pathname;
      if (pathname.startsWith("/products")) {
        router.push(`/products?search=${encodeURIComponent(query)}`);
        return;
      }
      if (pathname.startsWith("/links")) {
        router.push(`/links?search=${encodeURIComponent(query)}`);
        return;
      }
      if (pathname.startsWith("/articles")) {
        router.push(`/articles?search=${encodeURIComponent(query)}`);
        return;
      }
    }

    if (
      userRole === "PRODUCT_RESEARCHER" ||
      userRole === "LINKER" ||
      userRole === "ADMIN" ||
      userRole === "SUPER_ADMIN"
    ) {
      router.push(`/products?search=${encodeURIComponent(query)}`);
    } else {
      router.push(`/articles?search=${encodeURIComponent(query)}`);
    }
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

        {/* Right Side: Search, Theme Toggle, Bell, Plus, Profile Avatar */}
        <div className="flex items-center gap-2.5 self-start md:self-center flex-wrap sm:flex-nowrap">
          {extraActions}

          {/* Search Pill Input */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={activeQuery}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={searchPlaceholder || "Search anything..."}
              className="w-44 sm:w-60 pl-9.5 pr-8 py-2 text-xs font-medium bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white focus:border-zinc-900 dark:focus:border-white transition shadow-2xs"
            />
            {activeQuery && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Direct 1-Click Theme Toggle Button (Dark <-> Light) */}
          <button
            type="button"
            onClick={() => setTheme(isDarkMode ? "light" : "dark")}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-100 transition shadow-2xs cursor-pointer group"
            aria-label={isDarkMode ? "Switch to Light theme" : "Switch to Dark theme"}
            title={isDarkMode ? "Switch to Light theme" : "Switch to Dark theme"}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-zinc-100 group-hover:rotate-45 transition-transform duration-200" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-900 group-hover:-rotate-12 transition-transform duration-200" />
            )}
          </button>

          {/* Notification Bell Button */}
          <div className="relative" ref={bellMenuRef}>
            <button
              onClick={() => {
                setShowBellMenu(!showBellMenu);
                setShowProfileMenu(false);
                setShowQuickCreate(false);
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200 transition shadow-2xs cursor-pointer relative"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-black dark:bg-white ring-2 ring-white dark:ring-zinc-900" />
              )}
            </button>

            {/* Notifications Dropdown */}
            {showBellMenu && (
              <div className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-4 space-y-3 animate-scaleIn">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold px-2 py-0.5 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && onMarkAllAsRead && (
                    <button
                      onClick={onMarkAllAsRead}
                      className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 hover:underline transition flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Mark read
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic text-center py-6">
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
                              ? "bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 font-semibold"
                              : "bg-white dark:bg-zinc-950 border-zinc-100 dark:border-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">
                              {n.title || "Notification"}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {new Date(n.createdAt).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-600 dark:text-zinc-300 line-clamp-2">
                            {n.message}
                          </p>
                        </Link>
                      );
                    })
                  )}
                </div>

                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 text-center">
                  <Link
                    href="/notifications"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowBellMenu(false);
                      router.push("/notifications");
                    }}
                    className="text-xs font-bold text-zinc-900 dark:text-zinc-100 hover:underline transition cursor-pointer"
                  >
                    View All Notification Center &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Monochromatic Black/White Plus Button */}
          <div className="relative" ref={quickCreateRef}>
            <button
              onClick={() => {
                setShowQuickCreate(!showQuickCreate);
                setShowProfileMenu(false);
                setShowBellMenu(false);
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-95 flex items-center justify-center font-extrabold shadow-sm transition-all cursor-pointer"
              aria-label="Quick Action"
              title="Quick Action"
            >
              <Plus className="w-5 h-5 font-bold" />
            </button>

            {/* Quick Create Menu */}
            {showQuickCreate && (
              <div className="absolute right-0 mt-2.5 w-56 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-2 space-y-1 animate-scaleIn">
                <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Quick Actions
                </div>
                {(userRole === "SUPER_ADMIN" || userRole === "ADMIN") && (
                  <Link
                    href="/products/add"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowQuickCreate(false);
                      router.push("/products/add");
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition cursor-pointer"
                  >
                    <Package className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                    <span>Add New Product</span>
                  </Link>
                )}
                <Link
                  href="/articles"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowQuickCreate(false);
                    router.push("/articles");
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                  <span>Article Pipeline</span>
                </Link>
                {(userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "LINKER") && (
                  <Link
                    href="/links"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowQuickCreate(false);
                      router.push("/links");
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition cursor-pointer"
                  >
                    <Link2 className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                    <span>Link Logs</span>
                  </Link>
                )}
                {(userRole === "SUPER_ADMIN" || userRole === "ADMIN") && (
                  <Link
                    href="/users"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowQuickCreate(false);
                      router.push("/users");
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition cursor-pointer"
                  >
                    <User className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                    <span>Users</span>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* User Profile Avatar */}
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
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold text-xs sm:text-sm border-2 border-white dark:border-zinc-800 ring-2 ring-zinc-200 dark:ring-zinc-800 shadow-2xs group-hover:ring-zinc-400 transition-all">
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
              {/* Online Dot */}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-zinc-900 dark:bg-white ring-2 ring-white dark:ring-zinc-900" />
            </button>

            {/* ─── USER PROFILE DROPDOWN ─── */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2.5 w-72 sm:w-80 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-4 space-y-3 animate-scaleIn text-left">
                {/* Header: Avatar, Name, Email */}
                <div className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold text-sm border-2 border-white dark:border-zinc-800 shadow-2xs">
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
                    {/* Online badge */}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-zinc-900 dark:bg-white ring-2 ring-white dark:ring-zinc-950" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {currentUser?.name || "User"}
                    </h3>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium truncate mt-0.5">
                      {currentUser?.email || "No email"}
                    </p>
                  </div>
                </div>

                {/* Section 1: View Profile, Settings, Dark Mode */}
                <div className="space-y-1">
                  {/* View Profile */}
                  <Link
                    href="/settings"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowProfileMenu(false);
                      router.push("/settings");
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-zinc-500 dark:text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
                      <span>View Profile</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium font-mono">
                      Ctrl + Shift + P
                    </span>
                  </Link>

                  {/* Settings */}
                  <Link
                    href="/settings"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowProfileMenu(false);
                      router.push("/settings");
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <Settings className="w-4 h-4 text-zinc-500 dark:text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
                      <span>Settings</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium font-mono">
                      Ctrl + P
                    </span>
                  </Link>

                  {/* Dark Mode Toggle */}
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition">
                    <div className="flex items-center gap-3">
                      {isDarkMode ? (
                        <Moon className="w-4 h-4 text-zinc-100" />
                      ) : (
                        <Moon className="w-4 h-4 text-zinc-600" />
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
                        isDarkMode ? "bg-white" : "bg-zinc-300 dark:bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full ${
                          isDarkMode ? "translate-x-4 bg-black" : "translate-x-0 bg-white"
                        } shadow-xs ring-0 transition duration-200 ease-in-out`}
                      />
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-zinc-100 dark:border-zinc-800" />

                {/* Section 2: Changelog, Support */}
                <div className="space-y-1">
                  {/* Changelog */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangelogModal(true);
                      setShowProfileMenu(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <Layers className="w-4 h-4 text-zinc-500 dark:text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
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
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <HelpCircle className="w-4 h-4 text-zinc-500 dark:text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
                      <span>Support</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>

                {/* Divider */}
                <div className="border-t border-zinc-100 dark:border-zinc-800" />

                {/* Section 3: Sign Out Button Card */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
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
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 flex items-center justify-center font-bold">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Platform Support & Help
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Article Flow Enterprise Assistance
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSupportModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-300">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl space-y-1 border border-zinc-200/60 dark:border-zinc-800">
                <p className="font-bold text-zinc-900 dark:text-zinc-100">
                  Technical Assistance:
                </p>
                <p className="text-zinc-500 dark:text-zinc-400">
                  For bug reports, site permission requests, or account inquiries, contact platform administration:
                </p>
                <a
                  href="mailto:support@fishtailinfosolutions.com"
                  className="inline-flex items-center gap-1 text-zinc-900 dark:text-zinc-100 font-bold hover:underline mt-1"
                >
                  support@fishtailinfosolutions.com &rarr;
                </a>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl space-y-1 border border-zinc-200/60 dark:border-zinc-800">
                <p className="font-bold text-zinc-900 dark:text-zinc-100">
                  Keyboard Shortcuts:
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <span className="font-medium">Profile:</span>
                    <kbd className="font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-700 dark:text-zinc-300">
                      Ctrl + Shift + P
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <span className="font-medium">Settings:</span>
                    <kbd className="font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-700 dark:text-zinc-300">
                      Ctrl + P
                    </kbd>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowSupportModal(false)}
                className="px-4 py-2 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CHANGELOG MODAL ─── */}
      {showChangelogModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Platform Changelog
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Recent system updates and features
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowChangelogModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-zinc-900 dark:text-zinc-100">
                    v1.3 — Modern Navigation & Monochrome Theme
                  </span>
                  <span className="text-[10px] text-zinc-900 dark:text-zinc-100 font-bold bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-300 dark:border-zinc-700">
                    Latest
                  </span>
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Introduced unified high-contrast Black and White design system, 1-click Dark/Light mode changer, Plus Jakarta Sans typography, and clean iconography.
                </p>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <span className="font-extrabold text-zinc-900 dark:text-zinc-100">
                  v1.2 — Team Analytics & Dark Mode Optimization
                </span>
                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Enhanced contrast on Team Members performance cards, refined borders, and optimized save validation in settings.
                </p>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <span className="font-extrabold text-zinc-900 dark:text-zinc-100">
                  v1.1 — Notification Architecture & Permissions
                </span>
                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Fixed article notification navigation and cross-site assignment completion authorization for specialized writing workflows.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => setShowChangelogModal(false)}
                className="px-4 py-2 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl text-xs font-bold transition cursor-pointer"
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
