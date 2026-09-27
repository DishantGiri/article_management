export type RoleType = "SUPER_ADMIN" | "ADMIN" | "LINKER" | "WRITER" | "TEAM_LEAD";

export interface UserSitePermission {
  siteId: number;
  siteName?: string;
  role?: string | null;
  roles?: string | null;
  canAddProduct?: boolean;
  canAddLink?: boolean;
  canWrite?: boolean;
  canReview?: boolean;
}

/**
 * Normalizes roles string/array into array of role strings
 */
export function parseSiteRoles(rolesStr?: string | null, primaryRole?: string | null): string[] {
  const result = new Set<string>();
  if (primaryRole) result.add(primaryRole.toUpperCase());
  if (rolesStr) {
    rolesStr
      .split(",")
      .map((r) => r.trim().toUpperCase())
      .filter(Boolean)
      .forEach((r) => result.add(r));
  }
  return Array.from(result);
}

/**
 * Checks if a user has Super Admin authority
 */
export function isSuperAdmin(role?: string | null): boolean {
  return role === "SUPER_ADMIN";
}

/**
 * Checks if a user has Admin or Super Admin authority
 */
export function isAdmin(role?: string | null): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}
