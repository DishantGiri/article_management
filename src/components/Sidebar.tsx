/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { LayoutDashboard, Package, PlusSquare, FileText, Link as LinkIcon, CheckSquare, Users, Globe, Tags, BarChart2, Bell, Settings, Clock } from "lucide-react";
import { useSession, signOut } from "next-auth/react";

type Role = "SUPER_ADMIN" | "ADMIN" | "LINKER" | "WRITER" | "TEAM_LEAD";

const MOCK_USERS = [
  { id: 5, name: "Super Admin", role: "SUPER_ADMIN" as Role, email: "superadmin@articlemgmt.com" },
  { id: 1, name: "Admin User", role: "ADMIN" as Role, email: "admin@articlemgmt.com" },
  { id: 2, name: "John Linker", role: "LINKER" as Role, email: "linker@articlemgmt.com" },
  { id: 3, name: "Jane Writer", role: "WRITER" as Role, email: "writer@articlemgmt.com" },
  { id: 4, name: "Team Lead", role: "TEAM_LEAD" as Role, email: "lead@articlemgmt.com" },
];

const ROLE_COLORS: Record<Role, string> = {
  SUPER_ADMIN: "bg-violet-50 text-violet-700 border border-violet-200/60",
  ADMIN: "bg-rose-50 text-rose-700 border border-rose-200/60",
  LINKER: "bg-blue-50 text-blue-700 border border-blue-200/60",
  WRITER: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
  TEAM_LEAD: "bg-amber-50 text-amber-700 border border-amber-200/60",
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
    roles: ["SUPER_ADMIN", "ADMIN"],
    icon: Globe,
  },
  {
    href: "/categories",
    label: "Categories",
    roles: ["SUPER_ADMIN", "ADMIN"],
    icon: Tags,
  },
  {
    href: "/reports",
    label: "Reports",
    roles: ["SUPER_ADMIN", "ADMIN", "TEAM_LEAD"],
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
    href: "/settings",
    label: "Settings",
    roles: ["SUPER_ADMIN", "ADMIN", "LINKER", "WRITER", "TEAM_LEAD"],
    icon: Settings,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session, update } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const currentUser = session?.user
    ? {
        id: session.user.id,
        name: session.user.name || "User",
        email: session.user.email || "",
        role: session.user.role as Role | null,
        image: session.user.image || null,
      }
    : {
        id: 1,
        name: "Admin User",
        email: "admin@articlemgmt.com",
        role: "ADMIN" as Role,
        image: null,
      };

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

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsHost = window.location.host;
    const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws`);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "register", userId }));
    };
    ws.onmessage = (event) => {
      try {
        const notif = JSON.parse(event.data);
        setToast({ message: notif.message });
        setUnreadCount((prev) => prev + 1);
        audioObj.currentTime = 0;
        audioObj.play().catch((e) => console.log("Failed to play notification sound:", e));
        const customEvent = new CustomEvent("live-notification", { detail: notif });
        window.dispatchEvent(customEvent);
      } catch (err) {
        console.error("Failed to parse live notification", err);
      }
    };
    ws.onerror = () => {
      console.warn("WebSocket notification server is offline.");
    };

    return () => {
      ws.close();
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
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const visibleNavItems = NAV_ITEMS.filter((item) => currentUser.role && item.roles.includes(currentUser.role));

  const activeHref = visibleNavItems.reduce((best, item) => {
    if (pathname.startsWith(item.href) && item.href.length > best.length) {
      if (item.href === "/" && pathname !== "/") return best;
      return item.href;
    }
    return best;
  }, "");

  const isActive = (href: string) => href === activeHref;
  return (
    <aside className="w-64 min-h-screen bg-white flex flex-col fixed left-0 top-0 bottom-0 z-40 border-r border-slate-100 shadow-sm" suppressHydrationWarning>
      {/* Logo */}
      <div className="px-6 py-6 border-b border-slate-100" suppressHydrationWarning>
        <div className="flex items-center gap-3" suppressHydrationWarning>
          <div className="w-8 h-8 rounded-md bg-[#0f172a] flex items-center justify-center shadow-sm" suppressHydrationWarning>
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <div suppressHydrationWarning>
            <p className="text-slate-900 font-bold text-sm leading-tight">Article Flow</p>
            <p className="text-slate-500 text-[10px] mt-0.5 font-medium">Enterprise Manager</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-5 space-y-1 overflow-y-auto pr-4">
        {visibleNavItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 pl-6 pr-4 py-2.5 text-sm transition-all duration-200 group rounded-r-lg ${
                active
                  ? "bg-[#69F0AE] text-slate-900 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium"
              }`}
            >
              <span className={active ? "text-slate-900" : "text-slate-400 group-hover:text-slate-600 transition-colors"}>
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
        })}
      </nav>

      {/* User Switcher (mock auth) */}
      <div className="px-3 py-4 border-t border-slate-100 relative bg-slate-50/50" suppressHydrationWarning>
        {isMounted ? (
          <>
            <button
              onClick={() => setShowSwitcher(!showSwitcher)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white border border-transparent hover:border-slate-200/40 shadow-sm transition-all bg-white/70"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 text-violet-700 flex items-center justify-center text-xs font-bold flex-shrink-0 border border-violet-200/30 overflow-hidden">
                {currentUser.image ? (
                  <img src={currentUser.image} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{currentUser.name.charAt(0)}</span>
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-slate-800 text-xs font-bold truncate">{currentUser.name}</p>
                {currentUser.role ? (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${ROLE_COLORS[currentUser.role]}`}>
                    {currentUser.role.replace("_", " ")}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200/50 px-2 py-0.5 rounded-full inline-block mt-0.5">
                    No Role Assigned
                  </span>
                )}
              </div>
              <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showSwitcher ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showSwitcher && (
              <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-50 p-1.5 space-y-1">
                {/* Dev role switcher */}
                {process.env.NODE_ENV === "development" && (
                  <div className="px-3 py-2 border-b border-slate-100 mb-1 text-left">
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
                                window.location.reload();
                              }
                            } catch (err) {
                              console.error("Failed to switch role:", err);
                            }
                          }}
                          className={`px-2 py-1 text-[9px] font-bold rounded text-center transition cursor-pointer border ${
                            currentUser.role === r
                              ? "bg-slate-900 border-slate-900 text-white"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
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
                              window.location.reload();
                            }
                          } catch (err) {
                            console.error("Failed to switch role:", err);
                          }
                        }}
                        className={`col-span-2 px-2 py-1 text-[9px] font-bold rounded text-center transition cursor-pointer border ${
                          currentUser.role === null
                            ? "bg-slate-900 border-slate-900 text-white"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        No Role (Null)
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-700 font-semibold text-xs transition cursor-pointer"
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

      {/* Real-time notification Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] bg-slate-950/90 backdrop-blur-md text-white px-5 py-4 rounded-2xl shadow-2xl border border-slate-800/80 flex items-start gap-3 animate-slide-in max-w-sm">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400 flex items-center justify-center flex-shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">Live Notification</p>
            <p className="text-xs font-semibold text-slate-200 mt-1 leading-relaxed">{toast.message}</p>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-500 hover:text-slate-300 text-xs font-bold font-mono transition-colors">
            ✕
          </button>
        </div>
      )}
    </aside>
  );
}
