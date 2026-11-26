/* eslint-disable @typescript-eslint/no-explicit-any */
import { LATAM_COUNTRIES } from "./geo-constants";

export interface ExtractedGeoLink {
  geo: string;
  affiliateLink: string;
  affiliateName: string;
}

export interface ExtractedGeoLinksResult {
  geoLinks: ExtractedGeoLink[];
  hasGeoColumns: boolean;
}

const NULL_OR_PLACEHOLDER_VALUES = new Set([
  "",
  "n/a",
  "na",
  "n / a",
  "nil",
  "none",
  "unassigned",
  "-",
  "--",
  "---",
  "null",
  "undefined",
  "no",
  "no link",
  "no affiliate",
  "blank",
  "empty",
  "missing",
  "not available",
  "anonymous",
  "#n/a",
  "#value!",
  "#ref!",
  "#name?",
  "#div/0!",
  "#null!",
]);

export function isNullOrPlaceholder(val?: any): boolean {
  if (val === undefined || val === null) return true;
  const cleaned = String(val)
    .trim()
    .toLowerCase()
    .replace(/^["']+|["']+$/g, "")
    .trim();
  return !cleaned || NULL_OR_PLACEHOLDER_VALUES.has(cleaned);
}

export function cleanOptionalText(val?: any): string | null {
  if (isNullOrPlaceholder(val)) return null;
  const trimmed = String(val).trim();
  return trimmed || null;
}

export function cleanUrl(raw?: any): string | null {
  if (raw === undefined || raw === null) return null;
  const str = String(raw).trim();
  if (!str) return null;
  const lower = str.toLowerCase().replace(/^["']+|["']+$/g, "").trim();
  if (!lower || lower === "0" || NULL_OR_PLACEHOLDER_VALUES.has(lower)) {
    return null;
  }
  const unquoted = str.replace(/^["']+|["']+$/g, "").trim();
  if (/^https?:\/\//i.test(unquoted)) {
    return unquoted;
  }
  if (!/\s/.test(unquoted) && /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+([\/?#].*)?$/.test(unquoted)) {
    return `https://${unquoted}`;
  }
  return null;
}

export const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  "UNITED STATES": "US",
  "UNITED STATES OF AMERICA": "US",
  "USA": "US",
  "U.S.": "US",
  "U.S.A.": "US",
  "US": "US",
  "UNITED KINGDOM": "UK",
  "UK": "UK",
  "U.K.": "UK",
  "BRITAIN": "UK",
  "GREAT BRITAIN": "UK",
  "ENGLAND": "UK",
  "GB": "GB",
  "CANADA": "CA",
  "CAN": "CA",
  "CA": "CA",
  "AUSTRALIA": "AU",
  "AUS": "AU",
  "AU": "AU",
  "GERMANY": "DE",
  "DE": "DE",
  "FRANCE": "FR",
  "FR": "FR",
  "NEW ZEALAND": "NZ",
  "NZ": "NZ",
  "IRELAND": "IE",
  "IE": "IE",
  "SPAIN": "ES",
  "ES": "ES",
  "ITALY": "IT",
  "IT": "IT",
  "NETHERLANDS": "NL",
  "HOLLAND": "NL",
  "NL": "NL",
  "SWITZERLAND": "CH",
  "CH": "CH",
  "AUSTRIA": "AT",
  "AT": "AT",
  "BELGIUM": "BE",
  "BE": "BE",
  "SWEDEN": "SE",
  "SE": "SE",
  "NORWAY": "NO",
  "NO": "NO",
  "DENMARK": "DK",
  "DK": "DK",
  "FINLAND": "FI",
  "FI": "FI",
  "POLAND": "PL",
  "PL": "PL",
  "PORTUGAL": "PT",
  "PT": "PT",
  "GREECE": "GR",
  "GR": "GR",
  "ROMANIA": "RO",
  "RO": "RO",
  "CZECH REPUBLIC": "CZ",
  "CZECHIA": "CZ",
  "CZ": "CZ",
  "HUNGARY": "HU",
  "HU": "HU",
  "TURKEY": "TR",
  "TURKIYE": "TR",
  "TR": "TR",
  "UNITED ARAB EMIRATES": "AE",
  "UAE": "AE",
  "AE": "AE",
  "SAUDI ARABIA": "SA",
  "KSA": "SA",
  "SA": "SA",
  "QATAR": "QA",
  "QA": "QA",
  "KUWAIT": "KW",
  "KW": "KW",
  "ISRAEL": "IL",
  "IL": "IL",
  "INDIA": "IN",
  "IND": "IN",
  "IN": "IN",
  "SINGAPORE": "SG",
  "SG": "SG",
  "MALAYSIA": "MY",
  "MY": "MY",
  "INDONESIA": "ID",
  "THAILAND": "TH",
  "TH": "TH",
  "VIETNAM": "VN",
  "VN": "VN",
  "PHILIPPINES": "PH",
  "PH": "PH",
  "JAPAN": "JP",
  "JP": "JP",
  "SOUTH KOREA": "KR",
  "KOREA": "KR",
  "KR": "KR",
  "HONG KONG": "HK",
  "HK": "HK",
  "TAIWAN": "TW",
  "TW": "TW",
  "SOUTH AFRICA": "ZA",
  "ZA": "ZA",
  "EGYPT": "EG",
  "EG": "EG",
  "NIGERIA": "NG",
  "NG": "NG",
  "KENYA": "KE",
  "KE": "KE",
  "PAKISTAN": "PK",
  "PK": "PK",
  "BANGLADESH": "BD",
  "BD": "BD",
  "NEPAL": "NP",
  "NP": "NP",
  "SRI LANKA": "LK",
  "LK": "LK",
  "GLOBAL": "GLOBAL",
  "WORLDWIDE": "GLOBAL",
  "WW": "GLOBAL",
  "INTERNATIONAL": "GLOBAL",
  "INTL": "GLOBAL",
  "ALL COUNTRIES": "GLOBAL",
  "REST OF WORLD": "GLOBAL",
  ...Object.fromEntries(LATAM_COUNTRIES.map((c) => [c.name.toUpperCase(), c.code])),
};

const SITE_CODE_COLLISIONS = new Set([
  "DHS",
  "SMG",
  "TBR",
  "GRC",
  "SC",
  "SV",
  "SD",
  "ST",
  "SP",
  "JIR",
  "JR",
  "RBR",
  "HSB",
  "HSE",
  "BHFR",
  "HSBLOG",
  "HPR",
]);

const AMBIGUOUS_BARE_CODES = new Set([
  "ID",
  "NO",
  "AT",
  "BY",
  "IN",
  "ON",
  "OR",
  "OF",
  "TO",
  "SO",
  "AS",
  "IS",
  "IT",
  "AM",
  "PM",
  "DO",
  "SN",
  "SR",
  "AD",
  "AN",
  "BE",
  "GO",
  "HE",
  "HI",
  "IF",
  "ME",
  "MY",
  "OK",
  "UP",
  "WE",
]);

export const IGNORED_GEO_COLUMN_NAMES = new Set([
  "ID",
  "NO",
  "SN",
  "SR",
  "URL",
  "URI",
  "STATUS",
  "TYPE",
  "DATE",
  "SITE",
  "SITE NAME",
  "SITENAME",
  "WEBSITE",
  "NAME",
  "TITLE",
  "SLUG",
  "PRODUCT",
  "PRODUCT NAME",
  "PRODUCTNAME",
  "CATEGORY",
  "CATEGORY NAME",
  "NETWORK",
  "AFFILIATE NETWORK",
  "AFFILIATE",
  "AFFILIATE LINK",
  "AFFILIATELINK",
  "AFFILIATE URL",
  "LINKER",
  "LINKER NAME",
  "RESEARCHER",
  "RESEARCHED BY",
  "ADDED BY",
  "ADDED BY NAME",
  "ADDED_BY",
  "MODIFIED BY",
  "UPDATED BY",
  "USER",
  "CREATOR",
  "WRITER",
  "WRITER NAME",
  "AUTHOR",
  "ARTICLE LINK",
  "ARTICLE URL",
  "ARTICLE LINK EN",
  "ARTICLE LINK DE",
  "ARTICLE LINK FR",
  "ARTICLE LINK ES",
  "ARTICLE LINK IT",
  "ARTICLE LINK NL",
  "ARTICLE LINK SV",
  "ARTICLE LINK FI",
  "AFFILIATE LINK 2",
  "AFFILIATE LINK 3",
  "LINK 3",
  "LINK 4",
  "ARTICLE STATUS",
  "LINK STATUS",
  "BUY LINK",
  "BUY NOW LINK",
  "BUY NOW",
  "BRIDGE PAGE LINK",
  "BRIDGE LINK",
  "BRIDGEPAGE LINK",
  "BRIDGE URL",
  "BRIDGE",
  "DIRECT BUY LINK",
  "LANDING LINK",
  "LANDING PAGE LINK",
  "REMARKS",
  "REMARK",
  "NOTE",
  "NOTES",
  "COMMENTS",
  "DESCRIPTION",
  "LINKER NOTES",
  "LINKER NOTE",
  "LINKER REMARKS",
  "LINK REMARKS",
  "ADDED",
  "LINK ADDED",
  "LINK ADDED DATE",
  "ADDED DATE",
  "PRODUCT ADDED DATE",
  "PRODUCT DATE",
  "DATE ADDED",
  "CREATED DATE",
  "CREATED AT",
  "ADDED AT",
  "WRITE DATE",
  "ARTICLE WRITE DATE",
  "WRITING DATE",
  "WRITTEN DATE",
  "STARTED DATE",
  "START DATE",
  "STARTED AT",
  "DRAFT DATE",
  "ARTICLE DATE",
  "PUBLISH",
  "PUBLISHES",
  "PUBLICES",
  "PUBLISH DATE",
  "ARTICLE PUBLISH DATE",
  "ARTICLE PUBLISHED DATE",
  "PUBLISHED DATE",
  "PUBLICES DATE",
  "PUBLISHES DATE",
  "PUBLICE DATE",
  "POSTING DATE",
  "POST DATE",
  "DATE OF POSTING",
  "LIVE DATE",
  "PUBLISHED AT",
  "COMPLETED DATE",
  "COMPLETED AT",
  "COMPLETION DATE",
  "PRODUCT CATEGORY",
  "PRODUCT CATEGORY NAME",
  "PRODUCT TYPE",
  "PREVIEW LINK",
  "PREVIEW",
  "TRENDS",
  "TREND LINK",
  "TREND LEVEL",
  "TREND",
  "SOURCE",
  "PRODUCT SOURCE",
  "PRODUCT AVAILABILITY",
  "AVAILABILITY",
  "IS NATIVE",
  "NATIVE",
  "SELECTED SITES",
  "TARGET SITES",
  "GEO",
  "GEOS",
  "TARGET GEOS",
  "COUNTRY",
  "COUNTRIES",
  "GEO LINKS",
  "GEO LINK",
  "COUNTRY LINKS",
  "COUNTRY LINK",
  "MULTIPLE GEOS",
  "MULTI GEO LINKS",
  "COUNTRY SPECIFIC LINKS",
  "COUNTRY WISE LINKS",
  "__SHEETNAME",
  "__ROWID",
]);

function normalizeGeoToken(token: string, allowAnyTwoLetters: boolean): string | null {
  const cleaned = token
    .trim()
    .replace(/^["'\[(\s]+|["'\])\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || isNullOrPlaceholder(cleaned)) return null;

  const upper = cleaned.toUpperCase();
  if (IGNORED_GEO_COLUMN_NAMES.has(upper) || upper.startsWith("__EMPTY")) {
    return null;
  }

  if (COUNTRY_NAME_TO_CODE[upper]) {
    return COUNTRY_NAME_TO_CODE[upper];
  }

  if (/^[A-Z]{2}$/.test(upper)) {
    if (!allowAnyTwoLetters && (SITE_CODE_COLLISIONS.has(upper) || AMBIGUOUS_BARE_CODES.has(upper))) {
      return null;
    }
    return upper;
  }

  return null;
}

export interface NormalizeGeoOptions {
  allowAmbiguousBareCode?: boolean;
  hasValidUrlValue?: boolean;
}

export function normalizeGeoCode(rawKey: string, options: NormalizeGeoOptions = {}): string | null {
  if (!rawKey) return null;
  const cleaned = rawKey
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const upper = cleaned.toUpperCase();

  if (!upper || IGNORED_GEO_COLUMN_NAMES.has(upper) || upper.startsWith("__EMPTY")) {
    return null;
  }

  const allowAmbiguous = Boolean(options.allowAmbiguousBareCode);

  // Explicit bare site column codes (SC, SV, SD, ST, SP) are site checkboxes, not geo link columns,
  // unless an explicit link/url suffix/prefix is attached (handled below).
  if (!allowAmbiguous && SITE_CODE_COLLISIONS.has(upper)) {
    return null;
  }

  if (AMBIGUOUS_BARE_CODES.has(upper) && !allowAmbiguous && !options.hasValidUrlValue) {
    return null;
  }

  // 1. Direct code or full country name match (e.g. "US", "UK", "USA", "UAE", "United States", "GLOBAL")
  const direct = normalizeGeoToken(cleaned, allowAmbiguous || Boolean(options.hasValidUrlValue));
  if (direct) {
    return direct;
  }

  const LINK_SUFFIX_RE =
    "(?:aff(?:iliate)?\\s*(?:links?|urls?)|buy(?:\\s*now)?\\s*(?:links?|urls?)|offer\\s*(?:links?|urls?)|tracking\\s*(?:links?|urls?)|links?|urls?|affiliate)";

  // 2. Pattern: "[GEO/Country] Link(s)/URL", e.g. "US Link", "UK Affiliate Link", "USA Buy Link", "United States Link"
  const m1 = cleaned.match(new RegExp(`^(.+?)\\s*[-_:]?\\s*${LINK_SUFFIX_RE}$`, "i"));
  if (m1 && m1[1]) {
    const resolved = normalizeGeoToken(m1[1], true);
    if (resolved) return resolved;
  }

  // 3. Pattern: "Link(s)/Affiliate Link/URL [-_:] [GEO/Country]", e.g. "Link US", "Affiliate Link - UK"
  const m2 = cleaned.match(new RegExp(`^${LINK_SUFFIX_RE}\\s*[-_:]?\\s*(.+)$`, "i"));
  if (m2 && m2[1]) {
    const resolved = normalizeGeoToken(m2[1], true);
    if (resolved) return resolved;
  }

  // 4. Pattern: "Affiliate Link (US)" / "Link [United States]" / "Buy Link (UK)"
  const m3 = cleaned.match(new RegExp(`^${LINK_SUFFIX_RE}\\s*[\\(\\[]\\s*(.+?)\\s*[\\)\\]]$`, "i"));
  if (m3 && m3[1]) {
    const resolved = normalizeGeoToken(m3[1], true);
    if (resolved) return resolved;
  }

  // 5. Pattern: "US (Link)" / "US (ClickBank)" / "United Kingdom [Affiliate Link]"
  const m4 = cleaned.match(/^([A-Za-z.\s]{2,30})\s*[\(\[]\s*(?:links?|aff(?:iliate)?(?:\s*link)?|buy(?:\s*link)?|url|[^)\]]{2,30})\s*[\)\]]$/i);
  if (m4 && m4[1]) {
    const resolved = normalizeGeoToken(m4[1], true);
    if (resolved) return resolved;
  }

  return null;
}

export function isGeoColumnKey(rawKey: string): boolean {
  return normalizeGeoCode(rawKey, { allowAmbiguousBareCode: false }) !== null;
}

function normalizeHeaderKey(key: string): string {
  return String(key || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function getRowString(row: Record<string, any>, ...aliases: string[]): string {
  const normSet = new Set(aliases.map(normalizeHeaderKey));
  for (const k of Object.keys(row || {})) {
    if (normSet.has(normalizeHeaderKey(k))) {
      const val = row[k];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return String(val).trim();
      }
    }
  }
  return "";
}

function hasAnyColumn(row: Record<string, any>, ...aliases: string[]): boolean {
  const normSet = new Set(aliases.map(normalizeHeaderKey));
  for (const k of Object.keys(row || {})) {
    if (normSet.has(normalizeHeaderKey(k))) {
      return true;
    }
  }
  return false;
}

function parseMultiGeoTextEntries(
  rawText: string,
  defaultAffiliateName: string,
  geoMap: Map<string, ExtractedGeoLink>
): number {
  if (!rawText || isNullOrPlaceholder(rawText)) return 0;

  let added = 0;
  const trimmed = rawText.trim();

  // 1. JSON array/object format
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const items = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object"
        ? Object.entries(parsed).map(([k, v]) =>
            typeof v === "object" && v !== null ? { geo: k, ...(v as any) } : { geo: k, affiliateLink: v }
          )
        : [];
      for (const item of items) {
        const gCode = normalizeGeoCode(String(item.geo || item.country || ""), {
          allowAmbiguousBareCode: true,
        });
        const vUrl = cleanUrl(item.affiliateLink || item.link || item.url);
        if (gCode && vUrl) {
          geoMap.set(gCode, {
            geo: gCode,
            affiliateLink: vUrl,
            affiliateName: cleanOptionalText(item.affiliateName) || defaultAffiliateName,
          });
          added++;
        }
      }
      if (added > 0) return added;
    } catch {
      // Fallback to text line parsing
    }
  }

  // 2. Text / delimited lines e.g.:
  //    "US: https://... | UK: https://..."
  //    "United States - https://...\nUnited Kingdom - https://..."
  //    "[US] https://... ; [CA] https://..."
  const normalizedNewlines = trimmed.replace(/[\r\n]+/g, "\n");
  const segments = normalizedNewlines
    .split(/\n+|\s*[|;]+\s*|,(?=\s*(?:\[|\()?[A-Za-z. ]{2,30}(?:\]|\))?\s*[:=\-–—\t(])|\s+(?=(?:\[|\()[A-Za-z. ]{2,25}(?:\]|\))?\s*(?:[:=\-–—\s]|https?:\/\/))/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const segment of segments) {
    // Pattern A: "US: https://..." | "United States - https://..." | "[US] https://..." | "(UK): https://..."
    let rawGeo: string | null = null;
    let rawLink: string | null = null;

    const mDelim = segment.match(/^\s*[\[(]?\s*([A-Za-z. ]{2,35}?)\s*[\])]?\s*(?:[:=\-–—\t]+)\s*(.+)$/);
    if (mDelim) {
      rawGeo = mDelim[1];
      rawLink = mDelim[2];
    } else {
      // Pattern B: "US https://..." or "[US] https://..."
      const mSpaceUrl = segment.match(/^\s*[\[(]?\s*([A-Za-z. ]{2,35}?)\s*[\])]?\s+(https?:\/\/\S+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/\S*)?)\s*$/i);
      if (mSpaceUrl) {
        rawGeo = mSpaceUrl[1];
        rawLink = mSpaceUrl[2];
      } else {
        // Pattern C: "https://example.com (US)" or "https://example.com [UK]"
        const mUrlTrailingGeo = segment.match(/^\s*(https?:\/\/\S+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/\S*)?)\s*[\(\[]\s*([A-Za-z. ]{2,35}?)\s*[\)\]]\s*$/i);
        if (mUrlTrailingGeo) {
          rawLink = mUrlTrailingGeo[1];
          rawGeo = mUrlTrailingGeo[2];
        }
      }
    }

    if (rawGeo && rawLink) {
      const gCode = normalizeGeoCode(rawGeo, { allowAmbiguousBareCode: true });
      const vUrl = cleanUrl(rawLink);
      if (gCode && vUrl) {
        geoMap.set(gCode, {
          geo: gCode,
          affiliateLink: vUrl,
          affiliateName: defaultAffiliateName,
        });
        added++;
      }
    }
  }

  return added;
}

const GEO_MULTI_COLUMN_ALIASES = [
  "Geo Links",
  "GEO Links",
  "Geo Link",
  "Country Links",
  "Country Link",
  "Country Wise Links",
  "Multiple Geos",
  "Multi Geo Links",
  "Country Specific Links",
];

export function extractGeoLinksFromRow(
  row: Record<string, any>,
  defaultAffiliateName = "Standard"
): ExtractedGeoLinksResult {
  const geoMap = new Map<string, ExtractedGeoLink>();
  let hasGeoColumns = false;

  // 1. Scan dedicated country columns (e.g. "US", "UK Link", "United States Link", "Canada")
  for (const key of Object.keys(row || {})) {
    const val = row[key];
    const validUrl = cleanUrl(val);
    const geoCode = normalizeGeoCode(key, {
      allowAmbiguousBareCode: false,
      hasValidUrlValue: validUrl !== null,
    });
    if (!geoCode) continue;

    hasGeoColumns = true;
    if (validUrl) {
      geoMap.set(geoCode, {
        geo: geoCode,
        affiliateLink: validUrl,
        affiliateName: defaultAffiliateName,
      });
    }
    // Null / empty / placeholder link cell for this geo -> DO NOT IMPORT
  }

  // 2. Scan combined multi-geo columns ("Geo Links", "Country Links", "Multiple Geos", etc.)
  if (hasAnyColumn(row, ...GEO_MULTI_COLUMN_ALIASES)) {
    hasGeoColumns = true;
  }
  const combinedRaw = getRowString(row, ...GEO_MULTI_COLUMN_ALIASES);
  if (combinedRaw) {
    parseMultiGeoTextEntries(combinedRaw, defaultAffiliateName, geoMap);
  }

  // 3. Scan multi-line / country-prefixed content inside "Affiliate Link" or "Affiliate URL"
  const rawAffCell = getRowString(row, "Affiliate Link", "Affiliate URL", "Offer Link");
  if (rawAffCell && !cleanUrl(rawAffCell)) {
    const parsedFromAff = parseMultiGeoTextEntries(rawAffCell, defaultAffiliateName, geoMap);
    if (parsedFromAff > 0) {
      hasGeoColumns = true;
    }
  }

  // 4. Explicit Target GEOs / Country column paired with a single valid Affiliate Link
  // Strictly skip null/placeholder geos and null/empty links (never invent fake GLOBAL geo).
  if (geoMap.size === 0) {
    const singleAffLink = cleanUrl(rawAffCell);
    const rawTargetGeos = getRowString(row, "GEO", "Geos", "Target GEOs", "Countries", "Country");
    if (singleAffLink && rawTargetGeos && !isNullOrPlaceholder(rawTargetGeos)) {
      const tokens = rawTargetGeos
        .split(/[,;|/\r\n]+/)
        .map((t) => t.trim())
        .filter((t) => t && !isNullOrPlaceholder(t));
      for (const token of tokens) {
        const gCode = normalizeGeoCode(token, { allowAmbiguousBareCode: true });
        if (gCode) {
          hasGeoColumns = true;
          geoMap.set(gCode, {
            geo: gCode,
            affiliateLink: singleAffLink,
            affiliateName: defaultAffiliateName,
          });
        }
      }
    }
  }

  return {
    geoLinks: Array.from(geoMap.values()),
    hasGeoColumns,
  };
}

export function getValidLogGeos<
  T extends { geo?: string | null; affiliateLink?: string | null; affiliateName?: string | null }
>(log: { affiliateLink?: string | null; geos?: T[] | null } | null | undefined): T[] {
  if (!log || !Array.isArray(log.geos)) return [];
  const fallbackAff = cleanUrl(log.affiliateLink);
  return log.geos.filter((g) => {
    if (!g || isNullOrPlaceholder(g.geo)) return false;
    return Boolean(cleanUrl(g.affiliateLink) || fallbackAff);
  });
}

export function isValidLinkLog(
  log:
    | {
        bridgePageLink?: string | null;
        buyLink?: string | null;
        affiliateLink?: string | null;
        geos?: Array<{ geo?: string | null; affiliateLink?: string | null }> | null;
      }
    | null
    | undefined
): boolean {
  if (!log) return false;
  if (cleanUrl(log.bridgePageLink)) return true;
  if (cleanUrl(log.buyLink)) return true;
  if (cleanUrl(log.affiliateLink)) return true;
  return getValidLogGeos(log).length > 0;
}
