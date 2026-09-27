"use client";

export const WORKSPACE_STORAGE_KEY = "active_workspace_role";

export const WORKSPACE_LABELS: Record<string, { label: string; iconName: string; badgeColor: string }> = {
  TEAM_LEAD: {
    label: "Team Lead Hub",
    iconName: "ClipboardList",
    badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
  },
  WRITER: {
    label: "Writer Studio",
    iconName: "FileText",
    badgeColor: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800",
  },
  LINKER: {
    label: "Linker Operations",
    iconName: "Link2",
    badgeColor: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800",
  },
  ADMIN: {
    label: "Admin Console",
    iconName: "Shield",
    badgeColor: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800",
  },
  SUPER_ADMIN: {
    label: "Super Admin",
    iconName: "ShieldCheck",
    badgeColor: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-800",
  },
};

/**
 * Retrieves the currently active workspace role, validating against user's permitted roles.
 */
export function getActiveWorkspace(userRole?: string | null, userRoles?: string[]): string {
  const available = (userRoles && userRoles.length > 0)
    ? userRoles.map((r) => r.toUpperCase())
    : userRole
    ? [userRole.toUpperCase()]
    : ["WRITER"];

  if (typeof window === "undefined") {
    return available[0] || "WRITER";
  }

  // If user is Admin or Super Admin, their workspace is global
  if (available.includes("SUPER_ADMIN")) return "SUPER_ADMIN";
  if (available.includes("ADMIN")) return "ADMIN";

  const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY)?.toUpperCase();
  if (stored && available.includes(stored)) {
    return stored;
  }

  // Priority fallback: TEAM_LEAD -> LINKER -> WRITER
  if (available.includes("TEAM_LEAD")) return "TEAM_LEAD";
  if (available.includes("LINKER")) return "LINKER";
  if (available.includes("WRITER")) return "WRITER";

  return available[0] || "WRITER";
}

/**
 * Updates the active workspace role across localStorage, cookies (for middleware/proxy), and broadcasts window event.
 */
export function setActiveWorkspace(role: string, allRoles?: string[]) {
  if (typeof window === "undefined") return;
  const upper = role.toUpperCase();
  localStorage.setItem(WORKSPACE_STORAGE_KEY, upper);
  document.cookie = `${WORKSPACE_STORAGE_KEY}=${upper}; path=/; max-age=31536000; SameSite=Lax`;

  if (allRoles && allRoles.length > 0) {
    document.cookie = `user_roles=${allRoles.join(",")}; path=/; max-age=31536000; SameSite=Lax`;
  }

  window.dispatchEvent(new CustomEvent("workspace-changed", { detail: { role: upper } }));
}
