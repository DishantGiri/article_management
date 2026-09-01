export function isUserTargeted(
  targetRolesRaw: string | null | undefined,
  userRole: string | null | undefined
): boolean {
  if (!userRole) return false;
  if (!targetRolesRaw || targetRolesRaw === "ALL" || targetRolesRaw.trim() === "") return true;

  const roles = targetRolesRaw
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean);

  if (roles.includes("ALL")) return true;

  const normalizedUserRole = userRole.trim().toUpperCase();

  // Super Admin and Admin role compatibility
  if (normalizedUserRole === "SUPER_ADMIN" && roles.includes("ADMIN")) return true;
  if (normalizedUserRole === "ADMIN" && roles.includes("SUPER_ADMIN")) return true;

  return roles.includes(normalizedUserRole);
}
