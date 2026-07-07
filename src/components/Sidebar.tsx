"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { LayoutDashboard, Package, PlusSquare, FileText, Link as LinkIcon, CheckSquare, Users, Globe, Tags, BarChart2, Bell, Settings } from "lucide-react";

type Role = "SUPER_ADMIN" | "ADMIN" | "LINKER" | "WRITER" | "TEAM_LEAD";

const MOCK_USERS = [
  { id: 1, name: "Super Admin", role: "SUPER_ADMIN" as Role, email: "superadmin@articlemgmt.com" },
  { id: 2, name: "Admin User", role: "ADMIN" as Role, email: "admin@articlemgmt.com" },
  { id: 3, name: "John Linker", role: "LINKER" as Role, email: "linker@articlemgmt.com" },
  { id: 4, name: "Jane Writer", role: "WRITER" as Role, email: "writer@articlemgmt.com" },
  { id: 5, name: "Team Lead", role: "TEAM_LEAD" as Role, email: "lead@articlemgmt.com" },
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
  const [currentUser, setCurrentUser] = useState(MOCK_USERS[0]);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [toast, setToast] = useState<{ message: string } | null>(null);

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const stored = localStorage.getItem("mockUserId");
    const user = MOCK_USERS.find((u) => u.id === parseInt(stored || "1")) || MOCK_USERS[0];
    setCurrentUser(user);

    const ws = new WebSocket("ws://localhost:3001");
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "register", userId: user.id }));
    };
    ws.onmessage = (event) => {
      try {
        const notif = JSON.parse(event.data);
        setToast({ message: notif.message });
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
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const switchUser = (user: typeof MOCK_USERS[0]) => {
    localStorage.setItem("mockUserId", String(user.id));
    setCurrentUser(user);
    setShowSwitcher(false);
    window.location.reload();
  };

  const visibleNavItems = NAV_ITEMS.filter((item) => item.roles.includes(currentUser.role));

  const activeHref = visibleNavItems.reduce((best, item) => {
    if (pathname.startsWith(item.href) && item.href.length > best.length) {
      if (item.href === "/" && pathname !== "/") return best;
      return item.href;
    }
    return best;
  }, "");

  const isActive = (href: string) => href === activeHref;
  return (
    <aside className="w-64 min-h-screen bg-white flex flex-col fixed left-0 top-0 bottom-0 z-40 border-r border-slate-100 shadow-sm">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[#0f172a] flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-sm">I</span>
          </div>
          <div>
            <p className="text-slate-900 font-bold text-sm leading-tight">InventoryPro</p>
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
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Switcher (mock auth) */}
      <div className="px-3 py-4 border-t border-slate-100 relative bg-slate-50/50">
        {isMounted ? (
          <>
            <button
              onClick={() => setShowSwitcher(!showSwitcher)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white border border-transparent hover:border-slate-200/40 shadow-sm transition-all bg-white/70"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 text-violet-700 flex items-center justify-center text-xs font-bold flex-shrink-0 border border-violet-200/30">
                <span>{currentUser.name.charAt(0)}</span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-slate-800 text-xs font-bold truncate">{currentUser.name}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${ROLE_COLORS[currentUser.role]}`}>
                  {currentUser.role.replace("_", " ")}
                </span>
              </div>
              <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showSwitcher ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showSwitcher && (
              <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-50">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider px-3 pt-3 pb-1">Switch Role (Dev)</p>
                <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {MOCK_USERS.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => switchUser(u)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors ${
                        currentUser.id === u.id ? "bg-violet-50/50" : ""
                      }`}
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 text-violet-700 flex items-center justify-center text-[10px] font-bold">
                        <span>{u.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-slate-700 text-xs font-bold">{u.name}</p>
                        <p className="text-slate-400 text-[10px]">{u.role.replace("_", " ")}</p>
                      </div>
                      {currentUser.id === u.id && (
                        <svg className="w-4 h-4 text-violet-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-[62px] p-2.5 rounded-xl bg-slate-100/50 animate-pulse border border-slate-200/50" />
        )}
      </div>

      {/* Real-time notification Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] bg-slate-900 text-white px-5 py-4 rounded-2xl shadow-2xl border border-slate-800 flex items-start gap-3 animate-slide-in max-w-sm">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
            🔔
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-400">Live Notification</p>
            <p className="text-sm font-semibold text-white mt-0.5 leading-relaxed">{toast.message}</p>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white text-xs font-bold font-mono">
            ✕
          </button>
        </div>
      )}
    </aside>
  );
}
