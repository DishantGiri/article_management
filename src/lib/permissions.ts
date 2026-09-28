import { prisma } from "@/lib/prisma";
export * from "./permissions-utils";
import { isAdmin, parseSiteRoles } from "./permissions-utils";

/**
 * Check if a user can add products on a specific site
 */
export async function canUserAddProductOnSite(
  userId: number,
  userGlobalRole: string | null | undefined,
  siteId: number
): Promise<boolean> {
  if (isAdmin(userGlobalRole)) return true;

  // Check site-specific access
  const access = await prisma.siteAccess.findUnique({
    where: { userId_siteId: { userId, siteId } },
  });

  if (access) {
    if (access.canAddProduct) return true;
    const siteRoles = parseSiteRoles(access.roles, access.role);
    if (siteRoles.includes("LINKER")) return true;
  }

  // If user is globally a LINKER or PRODUCT_RESEARCHER and has NO siteAccess restrictions configured, allow
  if (userGlobalRole === "LINKER" || userGlobalRole === "PRODUCT_RESEARCHER") {
    const totalAccesses = await prisma.siteAccess.count({ where: { userId } });
    if (totalAccesses === 0) return true;
  }

  return false;
}

/**
 * Check if a user can add or edit links for a specific site
 */
export async function canUserAddLinkOnSite(
  userId: number,
  userGlobalRole: string | null | undefined,
  siteId: number
): Promise<boolean> {
  if (isAdmin(userGlobalRole)) return true;

  const access = await prisma.siteAccess.findUnique({
    where: { userId_siteId: { userId, siteId } },
  });

  if (access) {
    if (access.canAddLink) return true;
    const siteRoles = parseSiteRoles(access.roles, access.role);
    if (siteRoles.includes("LINKER")) return true;
  }

  if (userGlobalRole === "LINKER") {
    const totalAccesses = await prisma.siteAccess.count({ where: { userId } });
    if (totalAccesses === 0) return true;
  }

  return false;
}

/**
 * Check if a user can write articles for a specific site
 */
export async function canUserWriteOnSite(
  userId: number,
  userGlobalRole: string | null | undefined,
  siteId: number
): Promise<boolean> {
  if (isAdmin(userGlobalRole)) return true;

  const access = await prisma.siteAccess.findUnique({
    where: { userId_siteId: { userId, siteId } },
  });

  if (access) {
    if (access.canWrite) return true;
    const siteRoles = parseSiteRoles(access.roles, access.role);
    if (siteRoles.includes("WRITER")) return true;
  }

  if (userGlobalRole === "WRITER") {
    const totalAccesses = await prisma.siteAccess.count({ where: { userId } });
    if (totalAccesses === 0) return true;
  }

  return false;
}

/**
 * Check if a user has Team Lead / Review authority on a specific site
 */
export async function canUserReviewOnSite(
  userId: number,
  userGlobalRole: string | null | undefined,
  siteId: number
): Promise<boolean> {
  if (isAdmin(userGlobalRole)) return true;

  const access = await prisma.siteAccess.findUnique({
    where: { userId_siteId: { userId, siteId } },
  });

  if (access) {
    if (access.canReview) return true;
    const siteRoles = parseSiteRoles(access.roles, access.role);
    if (siteRoles.includes("TEAM_LEAD")) return true;
  }

  if (userGlobalRole === "TEAM_LEAD") {
    const totalAccesses = await prisma.siteAccess.count({ where: { userId } });
    if (totalAccesses === 0) return true;
  }

  return false;
}

/**
 * Get all site IDs where user has a specific permission / role
 */
export async function getUserAuthorizedSiteIds(
  userId: number,
  userGlobalRole: string | null | undefined,
  action: "ADD_PRODUCT" | "ADD_LINK" | "WRITE" | "REVIEW"
): Promise<number[] | null> {
  // Returns null if user has unrestricted global access to all sites
  if (isAdmin(userGlobalRole)) return null;

  const accesses = await prisma.siteAccess.findMany({
    where: { userId },
    select: {
      siteId: true,
      role: true,
      roles: true,
      canAddProduct: true,
      canAddLink: true,
      canWrite: true,
      canReview: true,
    },
  });

  if (accesses.length === 0) {
    if (action === "ADD_PRODUCT" || action === "ADD_LINK") {
      if (userGlobalRole === "LINKER" || userGlobalRole === "PRODUCT_RESEARCHER") return null; // all sites
    }
    if (action === "WRITE" && userGlobalRole === "WRITER") return null;
    if (action === "REVIEW" && userGlobalRole === "TEAM_LEAD") return null;
    return [];
  }

  const authorizedSiteIds: number[] = [];

  for (const acc of accesses) {
    const siteRoles = parseSiteRoles(acc.roles, acc.role);
    if (action === "ADD_PRODUCT") {
      if (acc.canAddProduct || siteRoles.includes("LINKER")) authorizedSiteIds.push(acc.siteId);
    } else if (action === "ADD_LINK") {
      if (acc.canAddLink || siteRoles.includes("LINKER")) authorizedSiteIds.push(acc.siteId);
    } else if (action === "WRITE") {
      if (acc.canWrite || siteRoles.includes("WRITER")) authorizedSiteIds.push(acc.siteId);
    } else if (action === "REVIEW") {
      if (acc.canReview || siteRoles.includes("TEAM_LEAD")) authorizedSiteIds.push(acc.siteId);
    }
  }

  return authorizedSiteIds;
}
