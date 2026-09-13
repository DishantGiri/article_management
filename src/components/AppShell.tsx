"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import type { Session } from "next-auth";

interface AppShellProps {
  children: React.ReactNode;
  initialSession?: Session | null;
}

export default function AppShell({ children, initialSession }: AppShellProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Active session preferring client state, falling back to initial SSR session
  const currentSession = session || initialSession;

  // Never display the sidebar on authentication pages
  const isAuthRoute =
    pathname?.startsWith("/auth/") ||
    pathname === "/auth/signin" ||
    pathname === "/auth/pending";

  // Display sidebar on all application pages when authenticated or loading with existing session
  const isApprovedUser = currentSession?.user?.approved !== false;
  const showSidebar =
    !isAuthRoute &&
    (status === "authenticated" ||
      (status === "loading" && isApprovedUser) ||
      Boolean(currentSession?.user));

  return (
    <div className="flex h-full min-h-screen" suppressHydrationWarning>
      {showSidebar && <Sidebar />}
      <main
        className={`flex-1 min-h-screen overflow-y-auto transition-all duration-200 ${
          showSidebar ? "pt-[57px] lg:pt-0 ml-0 lg:ml-64" : ""
        }`}
        suppressHydrationWarning
      >
        {children}
      </main>
    </div>
  );
}
