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

