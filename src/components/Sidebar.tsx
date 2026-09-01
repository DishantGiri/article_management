/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { LayoutDashboard, Package, PlusSquare, FileText, Link as LinkIcon, CheckSquare, Users, Globe, Tags, Layers, Tag, BarChart2, Bell, Settings, Clock, Menu, X, Calendar as CalendarIcon, Sun, Moon, Monitor, Megaphone } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "@/context/ThemeContext";
import { ArchedNotificationCard } from "./ArchedNotificationCard";

type Role = "SUPER_ADMIN" | "ADMIN" | "LINKER" | "WRITER" | "TEAM_LEAD";

const MOCK_USERS = [
  { id: 5, name: "Super Admin", role: "SUPER_ADMIN" as Role, email: "superadmin@articlemgmt.com" },
  { id: 1, name: "Admin User", role: "ADMIN" as Role, email: "admin@articlemgmt.com" },
  { id: 2, name: "John Linker", role: "LINKER" as Role, email: "linker@articlemgmt.com" },
  { id: 3, name: "Jane Writer", role: "WRITER" as Role, email: "writer@articlemgmt.com" },
  { id: 4, name: "Team Lead", role: "TEAM_LEAD" as Role, email: "lead@articlemgmt.com" },
];

const ROLE_COLORS: Record<Role, string> = {
  SUPER_ADMIN: "bg-[#6D8196]/15 text-[#3D4F61] dark:bg-[#6D8196]/30 dark:text-slate-200 border border-[#6D8196]/30 dark:border-[#6D8196]/50",
  ADMIN: "bg-[#4A4A4A]/10 text-[#4A4A4A] dark:bg-slate-700/60 dark:text-slate-200 border border-[#4A4A4A]/25 dark:border-slate-600",
  LINKER: "bg-[#6D8196]/10 text-[#4A4A4A] dark:bg-emerald-950/40 dark:text-emerald-300 border border-[#6D8196]/20 dark:border-emerald-700/40",
  WRITER: "bg-[#EAEAEA] text-[#4A4A4A] dark:bg-slate-700/80 dark:text-slate-200 border border-[#CBCBCB] dark:border-slate-600",
  TEAM_LEAD: "bg-[#FFFFE3] text-[#4A4A4A] dark:bg-amber-950/40 dark:text-amber-300 border border-[#CBCBCB] dark:border-amber-700/40",
};

interface NavItem {
  href: string;
  label: string;
  icon: any;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    roles: ["SUPER_ADMIN", "ADMIN", "LINKER", "WRITER", "TEAM_LEAD"],
    icon: LayoutDashboard,
  },
  {
    href: "/calendar",
    label: "Work Calendar",
    roles: ["SUPER_ADMIN", "ADMIN", "LINKER", "WRITER", "TEAM_LEAD"],
    icon: CalendarIcon,
  },
  {
    href: "/products",
    label: "Products",
    roles: ["SUPER_ADMIN", "ADMIN", "LINKER", "WRITER", "TEAM_LEAD"],
    icon: Package,
  },

  {
    href: "/articles",
    label: "Articles",
    roles: ["SUPER_ADMIN", "ADMIN", "WRITER", "TEAM_LEAD"],
    icon: FileText,
  },
  {
    href: "/links",
    label: "Link Logs",
    roles: ["SUPER_ADMIN", "ADMIN", "LINKER", "TEAM_LEAD"],
    icon: LinkIcon,
  },
  {
    href: "/sites",
    label: "Sites",
    roles: ["SUPER_ADMIN", "ADMIN", "LINKER"],
    icon: Globe,
  },
  {
    href: "/categories",
    label: "Product Types",
    roles: ["SUPER_ADMIN", "ADMIN", "LINKER"],
    icon: Layers,
  },
  {
    href: "/product-categories",
    label: "Product Categories",
    roles: ["SUPER_ADMIN", "ADMIN", "LINKER"],
    icon: Tag,
  },
  {
    href: "/reports",
    label: "Work Reports",
    roles: ["SUPER_ADMIN", "ADMIN", "TEAM_LEAD", "WRITER", "LINKER"],
    icon: BarChart2,
  },
  {
    href: "/history",
    label: "History",
    roles: ["SUPER_ADMIN", "ADMIN"],
    icon: Clock,
  },
  {
    href: "/team-members",
    label: "Team Members",
    roles: ["TEAM_LEAD"],
    icon: Users,
  },
  {
    href: "/users",
    label: "Users",
    roles: ["SUPER_ADMIN", "ADMIN"],
    icon: Users,
  },
  {
    href: "/notifications",
    label: "Notifications",
    roles: ["SUPER_ADMIN", "ADMIN", "LINKER", "WRITER", "TEAM_LEAD"],
    icon: Bell,
  },
  {
    href: "/notices",
    label: "Notice Board",
    roles: ["SUPER_ADMIN", "ADMIN", "LINKER", "WRITER", "TEAM_LEAD"],
    icon: Megaphone,
  },
  {
    href: "/settings",
    label: "Settings",
    roles: ["SUPER_ADMIN", "ADMIN", "LINKER", "WRITER", "TEAM_LEAD"],
    icon: Settings,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [toast, setToast] = useState<{
    id?: number;
    message: string;
    type?: string;
    category?: string;
    createdAt?: string | Date;
  } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Close mobile drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  const currentUser = session?.user
    ? {
        id: session.user.id,
        name: session.user.name || "User",
        email: session.user.email || "",
        role: session.user.role as Role | null,
        image: session.user.image || null,
      }
    : null;

  useEffect(() => {
    setIsMounted(true);
    if (!session?.user?.id) return;

    const userId = session.user.id;
    const audioObj = new Audio("/mixkit-software-interface-back-2575.wav");
    audioObj.load();

    // Fetch initial unread count
    fetch(`/api/notifications?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setUnreadCount(data.filter((n: any) => !n.isRead).length);
        }
      })
      .catch((err) => console.error("Failed to fetch initial notification count:", err));

    const unlockAudio = () => {
      audioObj.play()
        .then(() => {
          audioObj.pause();
          audioObj.currentTime = 0;
          window.removeEventListener("click", unlockAudio);
          window.removeEventListener("keydown", unlockAudio);
        })
        .catch(() => {});
    };
    window.addEventListener("click", unlockAudio);
    window.addEventListener("keydown", unlockAudio);

    let isSubscribed = true;
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectWs = () => {
      if (!isSubscribed) return;
      try {
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsHost = window.location.host;
        ws = new WebSocket(`${wsProtocol}//${wsHost}/ws`);

        ws.onopen = () => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "register", userId }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const notif = JSON.parse(event.data);
            if (notif.senderId && userId && Number(notif.senderId) === Number(userId)) {
              return;
            }

            // Notification preferences
            const soundEnabled = typeof window !== "undefined" ? localStorage.getItem("notif_sound_enabled") !== "false" : true;
            const toastEnabled = typeof window !== "undefined" ? localStorage.getItem("notif_toast_enabled") !== "false" : true;
            const soundVolStr = typeof window !== "undefined" ? localStorage.getItem("notif_sound_volume") : null;
            const soundVolume = soundVolStr !== null ? parseFloat(soundVolStr) : 0.8;
            const desktopEnabled = typeof window !== "undefined" ? localStorage.getItem("notif_desktop_enabled") === "true" : false;

            // Only alert if notification is not silent and has an active message
            if (!notif.silent && notif.message) {
              if (toastEnabled && notif.type !== "NOTICE_PUBLISHED") {
                setToast({
                  id: notif.id,
                  message: notif.message,
                  type: notif.type,
                  category: notif.category || notif.data?.category,
                  createdAt: notif.createdAt,
                });
              }
              setUnreadCount((prev) => prev + 1);

              if (soundEnabled) {
                audioObj.volume = Math.max(0, Math.min(1, isNaN(soundVolume) ? 0.8 : soundVolume));
                audioObj.currentTime = 0;
                audioObj.play().catch(() => {});
              }

              if (desktopEnabled && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                try {
                  new Notification("Daily Work Report", {
                    body: notif.message,
                    icon: "/favicon.ico",
                  });
                } catch (e) {
                  // Ignore notification construct errors on restricted environments
                }
              }
            }

            const customEvent = new CustomEvent("live-notification", { detail: notif });
            window.dispatchEvent(customEvent);

            // Dispatch notice-published event for the NoticePopupModal
            if (notif.type === "NOTICE_PUBLISHED") {
              window.dispatchEvent(new CustomEvent("notice-published", { detail: notif }));
            }
          } catch (err) {
            console.error("Failed to parse live notification", err);
          }
        };

        ws.onclose = () => {
          if (isSubscribed) {
            reconnectTimeout = setTimeout(connectWs, 5000);
          }
        };

        ws.onerror = () => {
          // Handled gracefully by onclose
        };
      } catch (e) {
        if (isSubscribed) {
          reconnectTimeout = setTimeout(connectWs, 5000);
        }
      }
    };

    connectWs();

    return () => {
      isSubscribed = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    const refreshCount = () => {
      fetch(`/api/notifications?userId=${userId}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setUnreadCount(data.filter((n: any) => !n.isRead).length);
          }
        })
        .catch((err) => console.error("Failed to fetch notification count:", err));
    };

    window.addEventListener("notifications-marked-read", refreshCount);
    window.addEventListener("notifications-updated", refreshCount);
    
    return () => {
      window.removeEventListener("notifications-marked-read", refreshCount);
      window.removeEventListener("notifications-updated", refreshCount);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleToastAction = async () => {
    if (!toast) return;

    if (toast.id) {
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: toast.id }),
        });
        setUnreadCount((prev) => Math.max(0, prev - 1));
        window.dispatchEvent(new CustomEvent("notifications-updated"));
      } catch (e) {
        console.error("Failed to mark notification as read", e);
      }
    }

    const msg = toast.message;
    const match = msg.match(/"([^"]+)"/);
    const productName = match ? match[1] : null;

    setToast(null);

    if (msg.toLowerCase().includes("changes requested") || msg.toLowerCase().includes("redo") || msg.toLowerCase().includes("wrong")) {
      router.push("/?tab=write");
      return;
    }

    const userRole = session?.user?.role || "WRITER";

    if (productName) {
      const searchParam = encodeURIComponent(productName);
      if (toast.type === "LINK_ISSUE" || msg.toLowerCase().includes("link")) {
        router.push(`/links?search=${searchParam}`);
      } else {
        router.push(`/articles?search=${searchParam}`);
      }
    } else {
      if (toast.type === "LINK_ISSUE" || userRole === "LINKER") {
        router.push("/links");
      } else if (toast.type === "PRODUCT_ADDED") {
        router.push("/products");
      } else {
        router.push("/notifications");
      }
    }
  };

  const visibleNavItems = currentUser?.role
    ? NAV_ITEMS.filter((item) => currentUser.role && item.roles.includes(currentUser.role))
    : [];

  const activeHref = visibleNavItems.reduce((best, item) => {
    if (pathname.startsWith(item.href) && item.href.length > best.length) {
      if (item.href === "/" && pathname !== "/") return best;
      return item.href;
    }
    return best;
  }, "");

  const isActive = (href: string) => href === activeHref;
  return (
    <>
      {/* Mobile Top Header */}
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-[#CBCBCB]/40 px-4 py-3 flex items-center justify-between shadow-xs w-full" suppressHydrationWarning>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 -ml-2 rounded-lg text-[#4A4A4A] hover:text-slate-900 hover:bg-[#FAF9F5] transition-colors cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white dark:bg-slate-800 flex items-center justify-center shadow-xs border border-slate-200/60 dark:border-slate-700 p-0.5 shrink-0">
              <Image
                src="/logo.png"
                alt="Article Flow Logo"
                width={32}
                height={32}
                className="w-full h-full object-contain rounded-md"
                priority
              />
            </div>
            <div>
              <p className="text-[#4A4A4A] font-bold text-xs leading-tight">Article Flow</p>
              <p className="text-[#737373] text-[9px] font-medium">Enterprise Manager</p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="p-2 rounded-lg text-[#4A4A4A] hover:bg-[#FAF9F5] transition-colors cursor-pointer"
            title={`Switch to ${resolvedTheme === "dark" ? "Light" : "Dark"} mode`}
          >
            {resolvedTheme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
          <Link href="/notifications" className="relative p-2 rounded-lg text-[#4A4A4A] hover:bg-[#FAF9F5] transition-colors">
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-rose-500 text-white font-bold text-[9px] min-w-[14px] h-[14px] px-1 rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </Link>
          {currentUser && (
            <div className="w-7 h-7 rounded-full bg-[#6D8196]/15 text-[#3D4F61] flex items-center justify-center text-xs font-bold border border-[#6D8196]/30">
              {currentUser.name.charAt(0)}
            </div>
          )}
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden animate-fadeIn"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white flex flex-col border-r border-[#CBCBCB]/50 shadow-xs transition-transform duration-300 ease-in-out lg:z-40 lg:translate-x-0 ${
          isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        }`}
        suppressHydrationWarning
      >
        {/* Logo Header */}
        <div className="px-6 py-6 border-b border-[#CBCBCB]/40 flex items-center justify-between" suppressHydrationWarning>
          <Link href="/" className="flex items-center gap-3 group cursor-pointer" suppressHydrationWarning>
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-white dark:bg-slate-800 flex items-center justify-center shadow-xs border border-slate-200/60 dark:border-slate-700 p-1 shrink-0 group-hover:scale-105 transition-transform" suppressHydrationWarning>
              <Image
                src="/logo.png"
                alt="Article Flow Logo"
                width={36}
                height={36}
                className="w-full h-full object-contain rounded-lg"
                priority
              />
            </div>
            <div suppressHydrationWarning>
              <p className="text-[#4A4A4A] dark:text-slate-100 font-bold text-sm leading-tight group-hover:text-[#6D8196] transition-colors">Article Flow</p>
              <p className="text-[#737373] dark:text-slate-400 text-[10px] mt-0.5 font-medium">Enterprise Manager</p>
            </div>
          </Link>
          {/* Mobile close button */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-[#737373] hover:text-[#4A4A4A] hover:bg-[#FAF9F5] transition-colors cursor-pointer"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-5 space-y-1 overflow-y-auto pr-4">
          {status === "loading" || !isMounted ? (
            <div className="space-y-2 px-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-9 bg-[#FAF9F5] rounded-r-lg animate-pulse" />
              ))}
            </div>
          ) : (
            visibleNavItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center gap-3 pl-6 pr-4 py-2.5 text-sm transition-all duration-200 group rounded-r-xl ${
                    active
                      ? "bg-[#6D8196] text-white font-semibold shadow-xs"
                      : "text-[#4A4A4A] hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium"
                  }`}
                >
                  <span className={active ? "text-white" : "text-[#6D8196]/70 group-hover:text-[#6D8196] dark:text-slate-400 dark:group-hover:text-white transition-colors"}>
                    <item.icon className="w-4 h-4" strokeWidth={active ? 2.5 : 2} />
                  </span>
                  <div className="flex-1 flex items-center justify-between">
                    <span>{item.label}</span>
                    {item.label === "Notifications" && unreadCount > 0 && (
                      <span className="bg-rose-500 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[16px] h-[16px] shadow-sm animate-pulse mr-2">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </nav>

        {/* Quick Theme Switcher */}
        <div className="px-3.5 py-2.5 border-t border-slate-100 flex items-center justify-between text-xs" suppressHydrationWarning>
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
            {resolvedTheme === "dark" ? <Moon className="w-3.5 h-3.5 text-sky-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
            <span>Theme</span>
          </span>
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700">
            <button
              onClick={() => setTheme("light")}
              className={`p-1.5 rounded-md transition cursor-pointer ${
                theme === "light"
                  ? "bg-white text-amber-500 shadow-xs"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
              title="Light theme"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`p-1.5 rounded-md transition cursor-pointer ${
                theme === "dark"
                  ? "bg-slate-900 text-sky-400 shadow-xs"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
              title="Dark theme"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTheme("system")}
              className={`p-1.5 rounded-md transition cursor-pointer ${
                theme === "system"
                  ? "bg-white dark:bg-slate-900 text-indigo-500 shadow-xs"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
              title="System theme"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* User Switcher (mock auth) */}
        <div className="px-3 py-4 border-t border-slate-100 dark:border-slate-800 relative bg-slate-50/50 dark:bg-slate-900/50" suppressHydrationWarning>
          {isMounted && status !== "loading" && currentUser ? (
            <>
              <button
                onClick={() => setShowSwitcher(!showSwitcher)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/70 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/40 dark:border-slate-700 shadow-sm transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-950 dark:to-indigo-950 text-violet-700 dark:text-violet-300 flex items-center justify-center text-xs font-bold flex-shrink-0 border border-violet-200/30 dark:border-violet-700/50 overflow-hidden">
                  {currentUser.image ? (
                    <img src={currentUser.image} alt={currentUser.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{currentUser.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-slate-800 dark:text-slate-100 text-xs font-bold truncate">{currentUser.name}</p>
                  {currentUser.role ? (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${ROLE_COLORS[currentUser.role]}`}>
                      {currentUser.role.replace("_", " ")}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700 px-2 py-0.5 rounded-full inline-block mt-0.5">
                      No Role Assigned
                    </span>
                  )}
                </div>
                <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showSwitcher ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showSwitcher && (
                <div className="absolute bottom-full left-3 right-3 mb-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden z-50 p-1.5 space-y-1">
                  {/* Dev role switcher */}
                  {process.env.NODE_ENV === "development" && (
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 mb-1 text-left">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Dev: Switch Role</p>
                      <div className="grid grid-cols-2 gap-1">
                        {(["SUPER_ADMIN", "ADMIN", "TEAM_LEAD", "LINKER", "WRITER"] as const).map((r) => (
                          <button
                            key={r}
                            onClick={async () => {
                              try {
                                const res = await fetch("/api/dev/switch-role", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ userId: currentUser.id, role: r }),
                                });
                                if (res.ok) {
                                  await update({ role: r });
                                  router.refresh();
                                }
                              } catch (err) {
                                console.error("Failed to switch role:", err);
                              }
                            }}
                            className={`px-2 py-1 text-[9px] font-bold rounded text-center transition cursor-pointer border ${
                              currentUser.role === r
                                ? "bg-slate-900 dark:bg-[#6D8196] border-slate-900 dark:border-[#6D8196] text-white"
                                : "bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            }`}
                          >
                            {r.replace("_", " ")}
                          </button>
                        ))}
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch("/api/dev/switch-role", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ userId: currentUser.id, role: null }),
                              });
                              if (res.ok) {
                                await update({ role: null });
                                router.refresh();
                              }
                            } catch (err) {
                              console.error("Failed to switch role:", err);
                            }
                          }}
                          className={`col-span-2 px-2 py-1 text-[9px] font-bold rounded text-center transition cursor-pointer border ${
                            currentUser.role === null
                              ? "bg-slate-900 dark:bg-[#6D8196] border-slate-900 dark:border-[#6D8196] text-white"
                              : "bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                          }`}
                        >
                          No Role (Null)
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-[62px] p-2.5 rounded-xl bg-slate-100/50 animate-pulse border border-slate-200/50" suppressHydrationWarning />
          )}
        </div>
      </aside>

      {/* Real-time category-styled 3D Horn notification popup */}
      {toast && (
        <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-[99999] animate-bouncePop max-w-[360px] sm:max-w-[400px] w-[calc(100vw-3rem)]">
          <ArchedNotificationCard
            category={toast.category}
            type={toast.type}
            count={unreadCount || 1}
            message={toast.message}
            createdAt={toast.createdAt}
            actionLabel="View Details"
            onAction={handleToastAction}
            onClose={() => setToast(null)}
          />
        </div>
      )}
    </>
  );
}
