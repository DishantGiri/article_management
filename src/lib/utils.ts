import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateSlug(text: string): string {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // remove non-alphanumeric except spaces and dashes
    .replace(/[\s_-]+/g, "-") // replace spaces, underscores and multiple dashes with single dash
    .replace(/^-+|-+$/g, ""); // trim leading and trailing dashes
}

export function consolidateLinkLogs<T extends { id?: number; affiliateName?: string | null; bridgePageLink?: string | null; buyLink?: string | null; affiliateLink?: string | null; status?: string; linkerRemarks?: string | null; geos?: any[] }>(logs: T[] | null | undefined): T[] {
  if (!logs || !Array.isArray(logs) || logs.length <= 1) return (logs as T[]) || [];
  const map = new Map<string, T>();
  for (const log of logs) {
    const key = (log.affiliateName || "standard").trim().toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        ...log,
        geos: [...(log.geos || [])],
      });
    } else {
      const existing = map.get(key)!;
      if (!existing.bridgePageLink && log.bridgePageLink) existing.bridgePageLink = log.bridgePageLink;
      if (!existing.buyLink && log.buyLink) existing.buyLink = log.buyLink;
      if (!existing.affiliateLink && log.affiliateLink) existing.affiliateLink = log.affiliateLink;
      if (log.status && existing.status === "REQUESTED" && log.status !== "REQUESTED") existing.status = log.status;
      for (const g of log.geos || []) {
        const gCode = (g.geo || "").trim().toUpperCase();
        if (!existing.geos?.some((eg: any) => (eg.geo || "").trim().toUpperCase() === gCode)) {
          existing.geos?.push(g);
        }
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Priority order for affiliates requested to be listed at the top:
 * 1. SmashLoud / Smashload
 * 2. MediaScalers
 * 3. SmartADV
 */
export function getTopAffiliatePriority(name: string): number {
  const norm = (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (norm === "smashloud" || norm === "smashload" || norm.startsWith("smashloud") || norm.startsWith("smashload")) {
    return 1;
  }
  if (norm === "mediascalers" || norm === "mediascaler" || norm.startsWith("mediascaler")) {
    return 2;
  }
  if (norm === "smartadv" || (norm.startsWith("smartadv") && !norm.includes("rajan"))) {
    return 3;
  }
  return 999;
}

export function sortAffiliatesWithTopPriority<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const pA = getTopAffiliatePriority(a.name);
    const pB = getTopAffiliatePriority(b.name);
    if (pA !== pB) {
      return pA - pB;
    }
    return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
  });
}

