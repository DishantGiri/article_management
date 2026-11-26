import NepaliDate from "nepali-date-converter";

export const BS_MONTH_NAMES_EN = [
  "Baisakh",
  "Jestha",
  "Asar",
  "Shrawan",
  "Bhadra",
  "Aswin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
] as const;

export const AD_MONTH_SHORT_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const AD_MONTH_LONG_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const NPT_OFFSET_MS = 345 * 60 * 1000;

export interface DualDateInfo {
  adYmd: string;
  adYear: number;
  adMonth: number; // 1-12
  adDay: number;
  adMonthShort: string;
  adShortLabel: string; // e.g. "Nov 26"
  bsDateStr: string; // e.g. "2083-08-10"
  bsYear: number;
  bsMonth: number; // 1-12
  bsDay: number;
  bsMonthName: string; // e.g. "Mangsir"
  dayOfWeek: number; // 0-6 (Sun-Sat)
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Returns today's AD YYYY-MM-DD string in Nepal Standard Time (UTC+05:45).
 */
export function getCurrentNptYmd(): string {
  const npt = new Date(Date.now() + NPT_OFFSET_MS);
  return `${npt.getUTCFullYear()}-${pad2(npt.getUTCMonth() + 1)}-${pad2(npt.getUTCDate())}`;
}

/**
 * Returns current AD YYYY-MM string in NPT.
 */
export function getCurrentNptAdMonthKey(): string {
  return getCurrentNptYmd().slice(0, 7);
}

/**
 * Converts an AD "YYYY-MM-DD" string into both AD and BS details in English.
 * Uses local noon to prevent DST/timezone drift across UTC and NPT environments.
 */
export function adYmdToDual(adYmd: string): DualDateInfo {
  const [y, m, d] = adYmd.split("-").map(Number);
  const localNoon = new Date(y, m - 1, d, 12, 0, 0);
  const nd = new NepaliDate(localNoon);
  const bsYear = nd.getYear();
  const bsMonthIdx = nd.getMonth(); // 0-11
  const bsMonth = bsMonthIdx + 1;
  const bsDay = nd.getDate();
  const bsMonthName = BS_MONTH_NAMES_EN[bsMonthIdx] || nd.format("MMMM", "en");
  const adMonthShort = AD_MONTH_SHORT_EN[m - 1] || "";

  return {
    adYmd,
    adYear: y,
    adMonth: m,
    adDay: d,
    adMonthShort,
    adShortLabel: `${adMonthShort} ${d}`,
    bsDateStr: `${bsYear}-${pad2(bsMonth)}-${pad2(bsDay)}`,
    bsYear,
    bsMonth,
    bsDay,
    bsMonthName,
    dayOfWeek: localNoon.getDay(),
  };
}

/**
 * Returns the current BS month key ("YYYY-MM", 1-indexed month) in NPT.
 */
export function getCurrentBsMonthKey(): string {
  const dual = adYmdToDual(getCurrentNptYmd());
  return `${dual.bsYear}-${pad2(dual.bsMonth)}`;
}

/**
 * Shifts a BS "YYYY-MM" key by deltaMonths.
 */
export function shiftBsMonthKey(bsYm: string, deltaMonths: number): string {
  const [yStr, mStr] = bsYm.split("-");
  const y = Number(yStr);
  const m = Number(mStr); // 1-12
  const totalMonths = y * 12 + (m - 1) + deltaMonths;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  // Clamp to nepali-date-converter supported range (2000-01 to 2090-12)
  if (nextYear < 2000) return "2000-01";
  if (nextYear > 2090) return "2090-12";
  return `${nextYear}-${pad2(nextMonth)}`;
}

/**
 * Checks if a "YYYY-MM" BS month key is valid and within nepali-date-converter's supported bounds (2000-2090 BS).
 */
export function isValidBsMonthKey(bsYm?: string | null): bsYm is string {
  if (!bsYm || !/^\d{4}-\d{2}$/.test(bsYm)) return false;
  const [y, m] = bsYm.split("-").map(Number);
  return y >= 2000 && y <= 2090 && m >= 1 && m <= 12;
}

/**
 * Formats an AD date range like "Nov – Dec 2026" or "Dec 2026 – Jan 2027".
 */
export function formatAdSpanLabel(startYmd: string, endYmd: string): string {
  const [sy, sm] = startYmd.split("-").map(Number);
  const [ey, em] = endYmd.split("-").map(Number);
  const sMonth = AD_MONTH_SHORT_EN[sm - 1];
  const eMonth = AD_MONTH_SHORT_EN[em - 1];

  if (sy === ey && sm === em) {
    return `${AD_MONTH_LONG_EN[sm - 1]} ${sy}`;
  }
  if (sy === ey) {
    return `${sMonth} – ${eMonth} ${sy}`;
  }
  return `${sMonth} ${sy} – ${eMonth} ${ey}`;
}

/**
 * Formats a BS span label from two DualDateInfo records (e.g. "Kartik – Mangsir 2083").
 */
export function formatBsSpanLabel(first: DualDateInfo, last: DualDateInfo): string {
  if (first.bsYear === last.bsYear && first.bsMonth === last.bsMonth) {
    return `${first.bsMonthName} ${first.bsYear}`;
  }
  if (first.bsYear === last.bsYear) {
    return `${first.bsMonthName} – ${last.bsMonthName} ${first.bsYear}`;
  }
  return `${first.bsMonthName} ${first.bsYear} – ${last.bsMonthName} ${last.bsYear}`;
}

/**
 * Returns full day list and metadata for a given BS "YYYY-MM" month key (1-indexed month).
 */
export function getBsMonthDetails(bsYm: string): {
  bsMonthKey: string;
  bsYear: number;
  bsMonth: number;
  bsMonthName: string;
  bsLabel: string;
  adRangeLabel: string;
  startAdYmd: string;
  endAdYmd: string;
  days: DualDateInfo[];
} {
  const safeKey = isValidBsMonthKey(bsYm) ? bsYm : getCurrentBsMonthKey();
  const [bsYear, bsMonth] = safeKey.split("-").map(Number);
  const bsMonthIdx = bsMonth - 1;
  const bsMonthName = BS_MONTH_NAMES_EN[bsMonthIdx];

  const startNd = new NepaliDate(bsYear, bsMonthIdx, 1);
  const startJs = startNd.toJsDate();
  const startUtcNoon = Date.UTC(
    startJs.getFullYear(),
    startJs.getMonth(),
    startJs.getDate(),
    12,
    0,
    0
  );

  // Compute day count using next BS month's start date
  let daysCount = 30;
  if (bsYear === 2090 && bsMonth === 12) {
    // Fallback walk for upper boundary 2090-12
    daysCount = 0;
    for (let d = 1; d <= 32; d++) {
      try {
        const probe = new NepaliDate(bsYear, bsMonthIdx, d);
        if (probe.getMonth() === bsMonthIdx) daysCount = d;
        else break;
      } catch {
        break;
      }
    }
  } else {
    const nextYm = shiftBsMonthKey(safeKey, 1);
    const [ny, nm] = nextYm.split("-").map(Number);
    const nextNd = new NepaliDate(ny, nm - 1, 1);
    const nextJs = nextNd.toJsDate();
    const nextUtcNoon = Date.UTC(
      nextJs.getFullYear(),
      nextJs.getMonth(),
      nextJs.getDate(),
      12,
      0,
      0
    );
    daysCount = Math.round((nextUtcNoon - startUtcNoon) / 86400000);
  }

  const days: DualDateInfo[] = [];
  for (let i = 0; i < daysCount; i++) {
    const cur = new Date(startUtcNoon + i * 86400000);
    const adYmd = `${cur.getUTCFullYear()}-${pad2(cur.getUTCMonth() + 1)}-${pad2(cur.getUTCDate())}`;
    days.push(adYmdToDual(adYmd));
  }

  const startAdYmd = days[0].adYmd;
  const endAdYmd = days[days.length - 1].adYmd;

  return {
    bsMonthKey: safeKey,
    bsYear,
    bsMonth,
    bsMonthName,
    bsLabel: `${bsMonthName} ${bsYear}`,
    adRangeLabel: formatAdSpanLabel(startAdYmd, endAdYmd),
    startAdYmd,
    endAdYmd,
    days,
  };
}

/**
 * Formats an AD "YYYY-MM-DD" date into readable English BS + AD strings for modal headers.
 */
export function formatDualLongDate(adYmd: string): {
  bsLong: string;
  adLong: string;
  dual: DualDateInfo;
} {
  const dual = adYmdToDual(adYmd);
  const localNoon = new Date(dual.adYear, dual.adMonth - 1, dual.adDay, 12, 0, 0);
  const adLong = localNoon.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const bsLong = `${dual.bsMonthName} ${dual.bsDay}, ${dual.bsYear} BS`;

  return { bsLong, adLong, dual };
}
