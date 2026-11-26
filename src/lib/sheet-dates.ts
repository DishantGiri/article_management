/* eslint-disable @typescript-eslint/no-explicit-any */
import { isNullOrPlaceholder } from "./geo-link-parser";

export const ADDED_DATE_ALIASES = [
  "Added Date",
  "Link Added Date",
  "Link Added",
  "Added",
  "Product Added Date",
  "Date Added",
  "Product Date",
  "Added At",
  "Created Date",
  "Created At",
  "Date",
] as const;

export const WRITE_DATE_ALIASES = [
  "Article Write Date",
  "Write Date",
  "Writing Date",
  "Written Date",
  "Article Writing Date",
  "Article Written Date",
  "Started Date",
  "Start Date",
  "Started At",
  "Article Start Date",
  "Draft Date",
  "Article Date",
] as const;

export const PUBLISH_DATE_ALIASES = [
  "Publish Date",
  "Article Publish Date",
  "Published Date",
  "Article Published Date",
  "Publish",
  "Publishes",
  "Publices",
  "Publices Date",
  "Publishes Date",
  "Publice Date",
  "Posting Date",
  "Post Date",
  "Date of Posting",
  "Live Date",
  "Published At",
  "Completed Date",
  "Completed At",
  "Completion Date",
] as const;

function normalizeDateHeaderKey(key: string): string {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

const KNOWN_DATE_NORM_KEYS = new Set(
  [...ADDED_DATE_ALIASES, ...WRITE_DATE_ALIASES, ...PUBLISH_DATE_ALIASES].map(normalizeDateHeaderKey)
);

export function isDateColumnKey(key: string): boolean {
  const norm = normalizeDateHeaderKey(key);
  if (!norm) return false;
  if (KNOWN_DATE_NORM_KEYS.has(norm)) return true;
  return norm.endsWith("date") || norm === "startedat" || norm === "completedat" || norm === "publishedat" || norm === "addedat";
}

function excelSerialToNoonUtcDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 150000) return null;
  // Adjust for Excel's 1900 leap-year bug (serial >= 60 maps accurately via Unix epoch 25569)
  const dayInt = Math.floor(serial);
  const adjustedDays = dayInt >= 60 ? dayInt - 25569 : dayInt - 25568;
  const utc = new Date(adjustedDays * 86400000);
  const year = utc.getUTCFullYear();
  if (isNaN(year) || year < 1900 || year > 2150) return null;
  return new Date(Date.UTC(year, utc.getUTCMonth(), utc.getUTCDate(), 12, 0, 0));
}

export function formatNoonUtcYmd(date: Date | null | undefined): string | null {
  if (!date || isNaN(date.getTime())) return null;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parses Excel serial dates, ISO/slash dates, DD/MM/YYYY, MM/DD/YYYY, and readable date strings
 * into a noon-UTC Date so calendar dates never shift across timezones.
 */
export function parseSheetDate(val: any): Date | null {
  if (val === undefined || val === null || val === "") return null;

  if (typeof val === "number" && Number.isFinite(val)) {
    return excelSerialToNoonUtcDate(val);
  }

  if (val instanceof Date && !isNaN(val.getTime())) {
    const localAdjusted = new Date(val.getTime() + 60 * 1000);
    return new Date(
      Date.UTC(localAdjusted.getFullYear(), localAdjusted.getMonth(), localAdjusted.getDate(), 12, 0, 0)
    );
  }

  const str = String(val).trim();
  if (!str || isNullOrPlaceholder(str)) return null;

  // Numeric string Excel serial e.g. "46123"
  if (/^\d{4,6}(\.\d+)?$/.test(str)) {
    const num = Number(str);
    if (num >= 10000) {
      return excelSerialToNoonUtcDate(num);
    }
  }

  // YYYY-MM-DD or YYYY/MM/DD (with optional time suffix)
  const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[T\s].*)?$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    }
  }

  // DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, or DD.MM.YYYY
  const dmy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:\s.*)?$/);
  if (dmy) {
    const part1 = Number(dmy[1]);
    const part2 = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    let month: number;
    let day: number;
    if (part2 > 12) {
      month = part1;
      day = part2;
    } else if (part1 > 12) {
      day = part1;
      month = part2;
    } else {
      // Default to day/month when both parts <= 12
      day = part1;
      month = part2;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getUTCFullYear() >= 1900) {
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 12, 0, 0));
  }

  return null;
}

export interface ExtractedSheetDates {
  hasAddedDateCol: boolean;
  addedDate: Date | null;
  hasWriteDateCol: boolean;
  writeDate: Date | null;
  hasPublishDateCol: boolean;
  publishDate: Date | null;
}

function findDateByAliases(
  row: Record<string, any>,
  aliases: readonly string[]
): { hasCol: boolean; date: Date | null } {
  const normToRawVal = new Map<string, any>();
  for (const k of Object.keys(row || {})) {
    const nk = normalizeDateHeaderKey(k);
    if (nk && !normToRawVal.has(nk)) {
      normToRawVal.set(nk, row[k]);
    }
  }

  let hasCol = false;
  for (const alias of aliases) {
    const nk = normalizeDateHeaderKey(alias);
    if (normToRawVal.has(nk)) {
      hasCol = true;
      const parsed = parseSheetDate(normToRawVal.get(nk));
      if (parsed) {
        return { hasCol: true, date: parsed };
      }
    }
  }
  return { hasCol, date: null };
}

export function extractThreeDatesFromRow(row: Record<string, any>): ExtractedSheetDates {
  const added = findDateByAliases(row, ADDED_DATE_ALIASES);
  const write = findDateByAliases(row, WRITE_DATE_ALIASES);
  const publish = findDateByAliases(row, PUBLISH_DATE_ALIASES);

  return {
    hasAddedDateCol: added.hasCol,
    addedDate: added.date,
    hasWriteDateCol: write.hasCol,
    writeDate: write.date,
    hasPublishDateCol: publish.hasCol,
    publishDate: publish.date,
  };
}
