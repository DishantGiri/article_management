"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

type Role = "ADMIN" | "LINKER" | "WRITER" | "TEAM_LEAD";

const MOCK_USERS = [
  { id: 1, name: "Admin User", role: "ADMIN" as Role, email: "admin@articlemgmt.com" },
  { id: 2, name: "John Linker", role: "LINKER" as Role, email: "linker@articlemgmt.com" },
  { id: 3, name: "Jane Writer", role: "WRITER" as Role, email: "writer@articlemgmt.com" },
  { id: 4, name: "Team Lead", role: "TEAM_LEAD" as Role, email: "lead@articlemgmt.com" },
];

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: "bg-red-500/20 text-red-300",
  LINKER: "bg-blue-500/20 text-blue-300",
  WRITER: "bg-emerald-500/20 text-emerald-300",
  TEAM_LEAD: "bg-amber-500/20 text-amber-300",
};

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    roles: ["ADMIN", "LINKER", "WRITER", "TEAM_LEAD"],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/products",
    label: "Products",
    roles: ["ADMIN", "LINKER", "WRITER", "TEAM_LEAD"],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    href: "/products/add",
    label: "Add Product",
    roles: ["ADMIN", "LINKER"],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    href: "/articles",
    label: "Articles",
    roles: ["ADMIN", "WRITER", "TEAM_LEAD"],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: "/links",
    label: "Links",
    roles: ["ADMIN", "LINKER", "TEAM_LEAD"],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    href: "/reviews",
    label: "Reviews",
    roles: ["ADMIN", "TEAM_LEAD"],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState(MOCK_USERS[0]);
  const [showSwitcher, setShowSwitcher] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("mockUserId");
    const user = MOCK_USERS.find((u) => u.id === parseInt(stored || "1")) || MOCK_USERS[0];
    setCurrentUser(user);
  }, []);

  const switchUser = (user: typeof MOCK_USERS[0]) => {
    localStorage.setItem("mockUserId", String(user.id));
    setCurrentUser(user);
    setShowSwitcher(false);
  };

  const visibleNavItems = NAV_ITEMS.filter((item) => item.roles.includes(currentUser.role));

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="w-64 min-h-screen bg-[#0f172a] flex flex-col fixed left-0 top-0 bottom-0 z-40 border-r border-white/5">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">ArticleMgmt</p>
            <p className="text-white/40 text-xs">Workflow System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                active
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className={active ? "text-white" : "text-white/40 group-hover:text-white/70 transition-colors"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Switcher (mock auth) */}
      <div className="px-3 py-4 border-t border-white/5 relative">
        <button
          onClick={() => setShowSwitcher(!showSwitcher)}
          className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-all"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {currentUser.name.charAt(0)}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-white text-xs font-medium truncate">{currentUser.name}</p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_COLORS[currentUser.role]}`}>
              {currentUser.role.replace("_", " ")}
            </span>
          </div>
          <svg className={`w-4 h-4 text-white/30 transition-transform ${showSwitcher ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showSwitcher && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-[#1e293b] rounded-xl border border-white/10 shadow-xl overflow-hidden">
            <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider px-3 pt-2.5 pb-1">Switch Role (Dev)</p>
            {MOCK_USERS.map((u) => (
              <button
                key={u.id}
                onClick={() => switchUser(u)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition-colors ${
                  currentUser.id === u.id ? "bg-violet-600/20" : ""
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold">
                  {u.name.charAt(0)}
                </div>
                <div>
                  <p className="text-white text-xs font-medium">{u.name}</p>
                  <p className="text-white/40 text-[10px]">{u.role.replace("_", " ")}</p>
                </div>
                {currentUser.id === u.id && (
                  <svg className="w-3.5 h-3.5 text-violet-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
