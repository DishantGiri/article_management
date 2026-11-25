/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";
import { resolveSite } from "@/lib/site-resolver";
import { resolveUsers, splitPersonNames, isPlaceholderName } from "@/lib/user-resolver";
import { delByPattern } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function normalizeHeaderKey(key: string): string {
  return String(key || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function buildRowLookup(r: Record<string, any>): {
  rawMap: Map<string, any>;
  normMap: Map<string, any>;
} {
  const rawMap = new Map<string, any>();
  const normMap = new Map<string, any>();
  for (const k of Object.keys(r || {})) {
    const trimmed = k.trim();
    rawMap.set(trimmed.toLowerCase(), r[k]);
    const norm = normalizeHeaderKey(k);
    if (norm && !normMap.has(norm)) {
      normMap.set(norm, r[k]);
    }
  }
  return { rawMap, normMap };
}

function getCell(lookup: { normMap: Map<string, any> }, ...aliases: string[]): any {
  for (const alias of aliases) {
    const norm = normalizeHeaderKey(alias);
    if (lookup.normMap.has(norm)) {
      const val = lookup.normMap.get(norm);
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return val;
      }
    }
  }
  return "";
}

function getCellString(lookup: { normMap: Map<string, any> }, ...aliases: string[]): string {
  const val = getCell(lookup, ...aliases);
  if (val === undefined || val === null) return "";
  return String(val).trim();
}

function hasColumn(lookup: { normMap: Map<string, any> }, ...aliases: string[]): boolean {
  for (const alias of aliases) {
    if (lookup.normMap.has(normalizeHeaderKey(alias))) {
      return true;
    }
  }
  return false;
}

function parseExcelDate(val: any): Date | null {
  if (val === undefined || val === null || val === "") return null;

  // Handle numeric Excel serial dates safely without timezone drift
  if (typeof val === "number" && Number.isFinite(val)) {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed && parsed.y >= 1900 && parsed.m >= 1 && parsed.m <= 12 && parsed.d >= 1 && parsed.d <= 31) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, 12, 0, 0));
    }
  }

  if (val instanceof Date && !isNaN(val.getTime())) {
    // Use local calendar parts at noon UTC so dates never shift between UTC and local TZ
    const localAdjusted = new Date(val.getTime() + 60 * 1000); // guard against 59s float drift
    return new Date(Date.UTC(localAdjusted.getFullYear(), localAdjusted.getMonth(), localAdjusted.getDate(), 12, 0, 0));
  }

  const str = String(val).trim();
  if (!str || isPlaceholderName(str)) return null;

  // Handle pure numeric string Excel serial
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const num = Number(str);
    const parsed = XLSX.SSF.parse_date_code(num);
    if (parsed && parsed.y >= 1900) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, 12, 0, 0));
    }
  }

  // Handle explicit YYYY-MM-DD
  const ymd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    return new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12, 0, 0));
  }

  // Handle DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
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
      // Default YYYY/M/D won't match here; prefer day/month when <= 12
      day = part1;
      month = part2;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    }
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
  }
  return null;
}

function mapArticleStatus(rawStatus?: string): "PENDING" | "IN_PROGRESS" | "COMPLETED" | "APPROVED" | "REDO" | "REDIRECTED" {
  if (!rawStatus) return "PENDING";
  const s = String(rawStatus).trim().toLowerCase();
  if (s.includes("redirect")) return "REDIRECTED";
  if (s.includes("redo") || s.includes("revis") || s.includes("reject")) return "REDO";
  if (s.includes("not approv") || s.includes("unapprov")) return "PENDING";
  if (s.includes("approv") || s.includes("live") || s.includes("publish")) return "APPROVED";
  if (s.includes("complet") || s.includes("done")) return "COMPLETED";
  if (s.includes("progress") || s.includes("writ") || s.includes("draft")) return "IN_PROGRESS";
  return "PENDING";
}

function mapLinkStatus(rawStatus?: string): "REQUESTED" | "ACCEPTED" | "CANCELED" | "ISSUE" | "NEED_TO_CHECK" | "PRESELL_PAGE" | "REDIRECTED" {
  if (!rawStatus) return "REQUESTED";
  const s = String(rawStatus).trim().toLowerCase();
  if (s.includes("redirect")) return "REDIRECTED";
  if (s.includes("not accept") || s.includes("unaccept") || s.includes("cancel") || s.includes("inactive") || s.includes("reject") || s.includes("declin")) return "CANCELED";
  if (s.includes("accept") || s.includes("active") || s.includes("live") || s.includes("ok")) return "ACCEPTED";
  if (s.includes("issue") || s.includes("broken") || s.includes("error")) return "ISSUE";
  if (s.includes("check") || s.includes("review")) return "NEED_TO_CHECK";
  if (s.includes("presell")) return "PRESELL_PAGE";
  return "REQUESTED";
}

function cleanUrl(raw?: any): string | null {
  if (raw === undefined || raw === null) return null;
  const str = String(raw).trim();
  if (!str) return null;
  const lower = str.toLowerCase();
  if (
    [
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
      "blank",
      "0",
    ].includes(lower)
  ) {
    return null;
  }
  if (/^https?:\/\//i.test(str)) {
    return str;
  }
  if (!/\s/.test(str) && /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+([\/?#].*)?$/.test(str)) {
    return `https://${str}`;
  }
  return null;
}

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  "UNITED STATES": "US",
  "USA": "US",
  "UNITED KINGDOM": "UK",
  "UK": "UK",
  "BRITAIN": "UK",
  "GREAT BRITAIN": "UK",
  "CANADA": "CA",
  "AUSTRALIA": "AU",
  "GERMANY": "DE",
  "FRANCE": "FR",
  "MEXICO": "MX",
  "BRAZIL": "BR",
  "ARGENTINA": "AR",
  "COLOMBIA": "CO",
  "CHILE": "CL",
  "PERU": "PE",
  "ECUADOR": "EC",
  "VENEZUELA": "VE",
  "URUGUAY": "UY",
  "PARAGUAY": "PY",
  "BOLIVIA": "BO",
  "COSTA RICA": "CR",
  "PANAMA": "PA",
  "GUATEMALA": "GT",
  "HONDURAS": "HN",
  "EL SALVADOR": "SV",
  "NICARAGUA": "NI",
  "DOMINICAN REPUBLIC": "DO",
  "CUBA": "CU",
  "HAITI": "HT",
  "JAMAICA": "JM",
  "TRINIDAD AND TOBAGO": "TT",
  "GUYANA": "GY",
  "SURINAME": "SR",
  "BELIZE": "BZ",
  "PUERTO RICO": "PR",
  "FRENCH GUIANA": "GF",
  "NEW ZEALAND": "NZ",
  "IRELAND": "IE",
  "SPAIN": "ES",
  "ITALY": "IT",
  "NETHERLANDS": "NL",
  "INDIA": "IN",
  "SINGAPORE": "SG",
  "PHILIPPINES": "PH",
  "SOUTH AFRICA": "ZA",
  "GLOBAL": "GLOBAL",
  "WORLDWIDE": "GLOBAL",
  "WW": "GLOBAL",
};

const IGNORED_COLUMN_NAMES = new Set([
  "ID",
  "NO",
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
  "NETWORK",
  "AFFILIATE NETWORK",
  "AFFILIATE",
  "AFFILIATE LINK",
  "AFFILIATELINK",
  "LINKER",
  "LINKER NAME",
  "RESEARCHER",
  "RESEARCHED BY",
  "WRITER",
  "WRITER NAME",
  "AUTHOR",
  "ARTICLE LINK",
  "ARTICLE URL",
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
  "LINKER REMARKS",
  "LINK REMARKS",
  "ADDED DATE",
  "PUBLISH DATE",
  "COMPLETED DATE",
  "PRODUCT CATEGORY",
  "PRODUCT CATEGORY NAME",
  "PRODUCT TYPE",
  "PREVIEW LINK",
  "TREND LINK",
  "TREND LEVEL",
  "SOURCE",
  "GEO",
  "GEOS",
  "TARGET GEOS",
  "COUNTRY",
  "COUNTRIES",
  "GEO LINKS",
  "COUNTRY LINKS",
  "MULTIPLE GEOS",
  "COUNTRY SPECIFIC LINKS",
]);

function normalizeGeoCode(rawKey: string): string | null {
  if (!rawKey) return null;
  const cleaned = rawKey.trim().replace(/^["']+|["']+$/g, "").trim();
  const upper = cleaned.toUpperCase();

  if (IGNORED_COLUMN_NAMES.has(upper)) {
    return null;
  }

  // 1. Direct code (e.g. "US", "UK", "CA", "AU", "GLOBAL")
  if (/^[A-Z]{2}$/.test(upper) || upper === "GLOBAL" || upper === "WORLDWIDE" || upper === "WW") {
    return upper === "WW" || upper === "WORLDWIDE" ? "GLOBAL" : upper;
  }

  // 2. Direct country name match
  if (COUNTRY_NAME_TO_CODE[upper]) {
    return COUNTRY_NAME_TO_CODE[upper];
  }

  // 3. Pattern: "[GEO] Link", "[GEO]_Link", "[GEO] Affiliate Link", etc.
  const m1 = cleaned.match(/^([A-Za-z]{2}|GLOBAL|WORLDWIDE|WW)\s*[-_]?\s*(link|affiliate\s*link|affiliate|url)?$/i);
  if (m1 && m1[1]) {
    const code = m1[1].toUpperCase();
    if (/^[A-Z]{2}$/.test(code) || code === "GLOBAL" || code === "WW" || code === "WORLDWIDE") {
      return code === "WW" || code === "WORLDWIDE" ? "GLOBAL" : code;
    }
  }

  const m2 = cleaned.match(/^(?:link|affiliate\s*link|url)\s*[-_]?\s*([A-Za-z]{2}|GLOBAL|WORLDWIDE|WW)$/i);
  if (m2 && m2[1]) {
    const code = m2[1].toUpperCase();
    if (/^[A-Z]{2}$/.test(code) || code === "GLOBAL" || code === "WW" || code === "WORLDWIDE") {
      return code === "WW" || code === "WORLDWIDE" ? "GLOBAL" : code;
    }
  }

  const m3 = cleaned.match(/^(?:affiliate\s*link|link)\s*\(([A-Za-z]{2}|GLOBAL|WORLDWIDE|WW)\)$/i);
  if (m3 && m3[1]) {
    const code = m3[1].toUpperCase();
    return code === "WW" || code === "WORLDWIDE" ? "GLOBAL" : code;
  }

  // 4. Country name + "Link" (e.g. "United States Link", "Canada Link")
  for (const [name, code] of Object.entries(COUNTRY_NAME_TO_CODE)) {
    if (upper.startsWith(name + " ") || upper.startsWith(name + "_") || upper.startsWith(name + "-")) {
      const rest = upper.slice(name.length).replace(/[-_\s]+/g, " ").trim();
      if (rest === "LINK" || rest === "AFFILIATE LINK" || rest === "URL") {
        return code;
      }
    }
  }

  return null;
}

function extractGeoLinksFromRow(
  r: any,
  lookup: { normMap: Map<string, any> },
  defaultAffiliateName: string
): {
  geoLinks: Array<{ geo: string; affiliateLink: string; affiliateName: string }>;
  hasGeoColumns: boolean;
} {
  const geoMap = new Map<string, { geo: string; affiliateLink: string; affiliateName: string }>();
  let hasGeoColumns = false;

  // 1. Scan all row columns for dedicated country columns (e.g. "US", "UK Link", "Canada", etc.)
  for (const key of Object.keys(r || {})) {
    const geoCode = normalizeGeoCode(key);
    if (!geoCode) continue;

    hasGeoColumns = true;
    const validUrl = cleanUrl(r[key]);
    if (validUrl) {
      geoMap.set(geoCode, {
        geo: geoCode,
        affiliateLink: validUrl,
        affiliateName: defaultAffiliateName,
      });
    }
    // If no link on geo: DO NOT ADD!
  }

  // 2. Scan combined geo links columns (e.g. "Geo Links", "Country Links", "Multiple Geos")
  if (hasColumn(lookup, "Geo Links", "Country Links", "Multiple Geos", "Country Specific Links")) {
    hasGeoColumns = true;
  }
  const combinedRaw = getCellString(
    lookup,
    "Geo Links",
    "Country Links",
    "Multiple Geos",
    "Country Specific Links"
  );

  if (combinedRaw) {
    let parsedJsonEntries = 0;
    if (combinedRaw.startsWith("[") || combinedRaw.startsWith("{")) {
      try {
        const parsed = JSON.parse(combinedRaw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const gCode = normalizeGeoCode(item.geo || item.country || "");
            const vUrl = cleanUrl(item.affiliateLink || item.link || item.url);
            if (gCode && vUrl) {
              geoMap.set(gCode, {
                geo: gCode,
                affiliateLink: vUrl,
                affiliateName: item.affiliateName || defaultAffiliateName,
              });
              parsedJsonEntries++;
            }
          }
        }
      } catch {
        // Fall back to text parsing
      }
    }

    if (parsedJsonEntries === 0) {
      const lines = combinedRaw.split(/[\r\n]+|(?<=[^\s])[,;|](?=\s*[A-Za-z]{2,}\s*[:=\-–—])/);
      for (const line of lines) {
        const match = line.match(/^\s*([A-Za-z]{2,}|GLOBAL|WORLDWIDE|WW)\s*[:=\-–—\t]+\s*(.+)$/);
        if (match) {
          const gCode = normalizeGeoCode(match[1]);
          const vUrl = cleanUrl(match[2]);
          if (gCode && vUrl) {
            geoMap.set(gCode, {
              geo: gCode,
              affiliateLink: vUrl,
              affiliateName: defaultAffiliateName,
            });
          }
        }
      }
    }
  }

  // 3. Scan multi-line content inside "Affiliate Link"
  const rawAffCell = getCellString(lookup, "Affiliate Link");
  if (rawAffCell.includes("\n") || /^[A-Za-z]{2,}\s*[:=\-–—]/.test(rawAffCell)) {
    const lines = rawAffCell.split(/[\r\n]+|(?<=[^\s])[,;|](?=\s*[A-Za-z]{2,}\s*[:=\-–—])/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Za-z]{2,}|GLOBAL|WORLDWIDE|WW)\s*[:=\-–—\t]+\s*(.+)$/);
      if (match) {
        const gCode = normalizeGeoCode(match[1]);
        const vUrl = cleanUrl(match[2]);
        if (gCode && vUrl) {
          geoMap.set(gCode, {
            geo: gCode,
            affiliateLink: vUrl,
            affiliateName: defaultAffiliateName,
          });
        }
      }
    }
  }

  // 4. Explicit Target GEOs column (ONLY if GEO/Target GEOs column is explicitly populated in sheet!)
  // Do NOT invent a fake "GLOBAL" geo entry if no GEO column or target geo was specified in the sheet.
  if (geoMap.size === 0) {
    const singleAffLink = cleanUrl(rawAffCell);
    const rawTargetGeos = getCellString(lookup, "GEO", "Geos", "Target GEOs", "Countries", "Country");
    if (singleAffLink && rawTargetGeos && !isPlaceholderName(rawTargetGeos)) {
      hasGeoColumns = true;
      const tokens = rawTargetGeos.split(/[,;\s/]+/).map((t: string) => t.trim()).filter(Boolean);
      for (const token of tokens) {
        const gCode = normalizeGeoCode(token);
        if (gCode) {
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

// POST /api/admin/import-merged-sheet
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = session.user.role;
    if (userRole !== "SUPER_ADMIN" && userRole !== "ADMIN") {
      return NextResponse.json(
        { error: "Access Denied: Only Super Admins and Admins can import merged data sheets." },
        { status: 403 }
      );
    }

    let rows: any[] = [];
    let updateExisting = true;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }

      updateExisting = formData.get("updateExisting") !== "false";

      const buffer = Buffer.from(await file.arrayBuffer());
      // Read with cellDates: false so numeric Excel serial dates can be parsed cleanly without timezone drift
      const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });

      for (const sheetName of workbook.SheetNames) {
        // Skip informational sheets
        const cleanSheet = sheetName.trim().toLowerCase();
        if (cleanSheet === "readme" || cleanSheet === "instructions" || cleanSheet === "guide" || cleanSheet === "summary") {
          continue;
        }

        const sheet = workbook.Sheets[sheetName];
        const sheetRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        for (const r of sheetRows) {
          const rLookup = buildRowLookup(r);
          // If row doesn't have an explicit Site Name, assign the tab name
          if (!getCellString(rLookup, "Site Name", "Site", "Website", "Sitename")) {
            r["Site Name"] = sheetName;
          }
          rows.push(r);
        }
      }
    } else {
      const body = await req.json();
      rows = body.rows || [];
      if (typeof body.updateExisting === "boolean") updateExisting = body.updateExisting;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "No rows found to import. Please check your file." },
        { status: 400 }
      );
    }

    // Load initial reference data
    const allDbSites = await prisma.site.findMany({
      include: { categories: true },
    });
    const allDbUsers = await prisma.user.findMany();
    const allDbCategories = await prisma.category.findMany();
    const allDbAffiliates = await prisma.affiliateName.findMany();
    const allDbSiteAccess = await prisma.siteAccess.findMany();

    // Cache existing relations to prevent redundant write queries on every row
    const connectedSiteCategories = new Set<string>();
    for (const s of allDbSites) {
      if (s.categories) {
        for (const cat of s.categories) {
          connectedSiteCategories.add(`${s.id}_${cat.id}`);
        }
      }
    }

    const knownAffiliateNames = new Set<string>(
      allDbAffiliates.map((a) => a.name.toLowerCase().trim())
    );

    const knownSiteAccessSet = new Set<string>(
      allDbSiteAccess.map((sa) => `${sa.userId}_${sa.siteId}`)
    );

    // Pre-fetch all products that might match names in this batch
    const candidateProductNames = Array.from(
      new Set(
        rows
          .map((r) => {
            const l = buildRowLookup(r);
            return getCellString(l, "Product Name", "Product", "Title", "Name");
          })
          .filter((n) => n.length >= 1)
      )
    );

    const existingProductsInDb =
      candidateProductNames.length > 0
        ? await prisma.product.findMany({
            where: {
              name: { in: candidateProductNames },
            },
            include: { article: true, linkLogs: { include: { geos: true } } },
          })
        : [];

    const productMap = new Map<string, any>();
    for (const p of existingProductsInDb) {
      productMap.set(`${p.siteId}_${p.name.toLowerCase().trim()}`, p);
    }

    const currentUserId = Number(session.user.id) || allDbUsers[0]?.id || 1;

    let processedCount = 0;
    let createdProductsCount = 0;
    let updatedProductsCount = 0;
    let createdSitesCount = 0;
    let assignedWritersCount = 0;
    let configuredLinksCount = 0;
    let configuredGeosCount = 0;
    const errors: string[] = [];
    const uniqueSites = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;
      const lookup = buildRowLookup(r);

      try {
        // 1. Extract Product Name
        const productName = getCellString(lookup, "Product Name", "Product", "Title", "Name");

        if (!productName) {
          // Skip empty rows
          continue;
        }

        // 2. Extract Site Name
        const rawSiteName = getCellString(lookup, "Site Name", "Site", "Website", "Sitename");

        if (!rawSiteName) {
          errors.push(`Row ${rowNum} ("${productName}"): Missing Site Name.`);
          continue;
        }

        // Resolve or create site
        let targetSite = resolveSite(rawSiteName, allDbSites);
        if (!targetSite) {
          try {
            const created = await prisma.site.create({
              data: {
                name: rawSiteName,
              },
              include: {
                categories: true,
              },
            });
            allDbSites.push(created);
            targetSite = created;
            createdSitesCount++;
          } catch (e: any) {
            errors.push(`Row ${rowNum} ("${productName}"): Failed to create site "${rawSiteName}": ${e.message}`);
            continue;
          }
        }
        if (!targetSite) {
          continue;
        }
        uniqueSites.add(targetSite.name);

        // 3. Extract Category / Product Type & Product Category
        const hasTypeCol = hasColumn(lookup, "Product Type", "Type");
        const hasCategoryCol = hasColumn(lookup, "Category", "Category Name");
        const hasProductCategoryCol = hasColumn(lookup, "Product Category", "Product Category Name");

        const rawType = getCellString(lookup, "Product Type", "Type");
        const rawCatCol = getCellString(lookup, "Category", "Category Name");
        const rawProdCatCol = getCellString(lookup, "Product Category", "Product Category Name");

        let rawCategory = rawType || rawCatCol || "Nutra";
        if (isPlaceholderName(rawCategory)) {
          rawCategory = "Nutra";
        }

        const rawProductCategory =
          rawProdCatCol && !isPlaceholderName(rawProdCatCol)
            ? rawProdCatCol
            : rawType && rawCatCol && !isPlaceholderName(rawCatCol)
            ? rawCatCol
            : rawCatCol && !isPlaceholderName(rawCatCol) && !/^(nutra|ecom|multi-?lang)$/i.test(rawCatCol)
            ? rawCatCol
            : null;

        if (rawProductCategory) {
          await prisma.productCategory.upsert({
            where: { name: rawProductCategory },
            update: {},
            create: { name: rawProductCategory },
          }).catch(() => {});
        }

        let category = allDbCategories.find(
          (c) => c.name.toLowerCase() === rawCategory.toLowerCase()
        );
        if (!category) {
          try {
            category = await prisma.category.create({
              data: { name: rawCategory },
            });
            allDbCategories.push(category);
          } catch {
            category = allDbCategories[0];
          }
        }

        // Connect category to site if not already connected
        if (category && targetSite) {
          const siteCatKey = `${targetSite.id}_${category.id}`;
          if (!connectedSiteCategories.has(siteCatKey)) {
            await prisma.site.update({
              where: { id: targetSite.id },
              data: { categories: { connect: { id: category.id } } },
            }).catch(() => {});
            connectedSiteCategories.add(siteCatKey);
          }
        }

        // 4. Extract Affiliate Network
        const hasAffiliateCol = hasColumn(lookup, "Affiliate Network", "Network", "Affiliate");
        const rawAffiliate = getCellString(lookup, "Affiliate Network", "Network", "Affiliate");
        const cleanAffiliate =
          !rawAffiliate || isPlaceholderName(rawAffiliate) || rawAffiliate.toLowerCase() === "no affiliate"
            ? ""
            : rawAffiliate;

        if (cleanAffiliate) {
          const affKey = cleanAffiliate.toLowerCase();
          if (!knownAffiliateNames.has(affKey)) {
            await prisma.affiliateName.upsert({
              where: { name: cleanAffiliate },
              update: {},
              create: { name: cleanAffiliate },
            }).catch(() => {});
            knownAffiliateNames.add(affKey);
          }
        }

        // 5. Extract Linker Name (disambiguated using site access + role preference)
        const rawLinker = getCellString(lookup, "Linker Name", "Linker", "Researched By", "Researcher");
        let linkerUser: any = null;
        let multiLinkerNote: string | null = null;

        if (!isPlaceholderName(rawLinker)) {
          const matchedLinkers = resolveUsers(rawLinker, allDbUsers, {
            rolePreference: "LINKER",
            targetSiteId: targetSite.id,
            siteAccessList: allDbSiteAccess,
          });
          if (matchedLinkers.length > 0) {
            linkerUser = matchedLinkers[0];
            if (matchedLinkers.length > 1 || splitPersonNames(rawLinker).length > 1) {
              multiLinkerNote = `Linkers: ${rawLinker}`;
            }
          } else {
            errors.push(`Row ${rowNum} ("${productName}"): Linker "${rawLinker}" was not found in database.`);
          }
        }

        const effectiveLinkerId = linkerUser?.id || currentUserId;

        // 6. Extract Writer Name (disambiguated using site access + role preference)
        const hasWriterCol = hasColumn(lookup, "Writer Name", "Writer", "Author");
        const rawWriter = getCellString(lookup, "Writer Name", "Writer", "Author");
        let writerUser: any = null;
        let writerNotFound = false;

        if (!isPlaceholderName(rawWriter)) {
          const matchedWriters = resolveUsers(rawWriter, allDbUsers, {
            rolePreference: "WRITER",
            targetSiteId: targetSite.id,
            siteAccessList: allDbSiteAccess,
          });
          if (matchedWriters.length > 0) {
            writerUser = matchedWriters[0];

            // Ensure site access exists for matched writers on this site
            for (const w of matchedWriters) {
              if (targetSite) {
                const accessKey = `${w.id}_${targetSite.id}`;
                if (!knownSiteAccessSet.has(accessKey)) {
                  await prisma.siteAccess.upsert({
                    where: { userId_siteId: { userId: w.id, siteId: targetSite.id } },
                    update: { canWrite: true },
                    create: {
                      userId: w.id,
                      siteId: targetSite.id,
                      role: "WRITER",
                      canWrite: true,
                    },
                  }).catch(() => {});
                  knownSiteAccessSet.add(accessKey);
                }
              }
            }
          } else {
            writerNotFound = true;
            errors.push(`Row ${rowNum} ("${productName}"): Writer "${rawWriter}" was not found in database.`);
          }
        }

        // 7. Slug & Remarks
        const hasSlugCol = hasColumn(lookup, "Slug");
        const explicitSlug = getCellString(lookup, "Slug");
        const generatedSlug = productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const finalSlug = explicitSlug || generatedSlug || null;

        const hasRemarksCol = hasColumn(lookup, "Remarks", "Remark", "Notes", "Note", "Comments");
        const sheetRemarksRaw = getCellString(lookup, "Remarks", "Remark", "Notes", "Note", "Comments");
        const sheetRemarks = isPlaceholderName(sheetRemarksRaw) ? "" : sheetRemarksRaw;
        const effectiveProductRemarks = [sheetRemarks, multiLinkerNote].filter(Boolean).join(" | ") || null;

        const hasLinkerRemarksCol = hasColumn(lookup, "Linker Remarks", "Link Remarks");
        const sheetLinkerRemarksRaw = getCellString(lookup, "Linker Remarks", "Link Remarks");
        const sheetLinkerRemarks = isPlaceholderName(sheetLinkerRemarksRaw) ? "" : sheetLinkerRemarksRaw;
        const effectiveLinkerRemarks =
          [sheetLinkerRemarks || sheetRemarks, multiLinkerNote].filter(Boolean).join(" | ") || null;

        // 8. Dates (preserved from sheet exact calendar date)
        const explicitAddedDate = parseExcelDate(getCell(lookup, "Added Date", "Date"));
        const addedDate = explicitAddedDate || new Date();
        const hasPublishDateCol = hasColumn(lookup, "Publish Date", "Completed Date");
        const explicitPublishDate = parseExcelDate(getCell(lookup, "Publish Date", "Completed Date"));

        // 9. Article Link & Status
        const hasArticleLinkCol = hasColumn(lookup, "Article Link", "Article URL");
        const articleLink = cleanUrl(getCell(lookup, "Article Link", "Article URL"));
        const hasArticleStatusCol = hasColumn(lookup, "Article Status", "Status");
        const rawArticleStatus = getCellString(lookup, "Article Status", "Status");
        const mappedArticleStatus = mapArticleStatus(rawArticleStatus);

        const hasLinkStatusCol = hasColumn(lookup, "Link Status");
        const rawLinkStatus = getCellString(lookup, "Link Status");
        const hasExplicitLinkStatus = hasLinkStatusCol && rawLinkStatus !== "" && !isPlaceholderName(rawLinkStatus);
        const mappedLinkStatus = mapLinkStatus(rawLinkStatus);

        // 10. Find or create Product (instant in-memory lookup via productMap)
        const pKey = `${targetSite.id}_${productName.toLowerCase().trim()}`;
        let product = productMap.get(pKey);

        if (product) {
          if (!updateExisting) {
            continue;
          }

          product = await prisma.product.update({
            where: { id: product.id },
            data: {
              name: productName,
              ...(hasSlugCol ? { slug: finalSlug } : {}),
              ...((hasTypeCol || hasCategoryCol) && category?.id ? { categoryId: category.id } : {}),
              ...(hasProductCategoryCol || (hasTypeCol && hasCategoryCol)
                ? { productCategory: rawProductCategory }
                : rawProductCategory
                ? { productCategory: rawProductCategory }
                : {}),
              ...(hasAffiliateCol ? { affiliateName: cleanAffiliate || null } : {}),
              ...(linkerUser ? { addedById: linkerUser.id } : {}),
              ...(explicitAddedDate ? { addedAt: explicitAddedDate } : {}),
              ...(hasRemarksCol
                ? { remarks: effectiveProductRemarks }
                : multiLinkerNote
                ? { remarks: multiLinkerNote }
                : {}),
            },
            include: { article: true, linkLogs: { include: { geos: true } } },
          });
          productMap.set(pKey, product);
          updatedProductsCount++;
        } else {
          product = await prisma.product.create({
            data: {
              name: productName,
              slug: finalSlug,
              siteId: targetSite.id,
              categoryId: category?.id || 1,
              productCategory: rawProductCategory,
              affiliateName: cleanAffiliate || null,
              addedById: effectiveLinkerId,
              addedAt: addedDate,
              remarks: effectiveProductRemarks,
            },
            include: { article: true, linkLogs: { include: { geos: true } } },
          });
          productMap.set(pKey, product);
          createdProductsCount++;
        }

        // 11. Update or create Article (exact sheet values)
        const isCompletedOrApproved = mappedArticleStatus === "APPROVED" || mappedArticleStatus === "COMPLETED";
        const effectiveCompletedAt =
          explicitPublishDate || (isCompletedOrApproved ? explicitAddedDate || product.article?.completedAt || addedDate : null);

        if (product.article) {
          const nextWriterId = writerUser
            ? writerUser.id
            : hasWriterCol && isPlaceholderName(rawWriter) && !writerNotFound
            ? null
            : product.article.writerId;

          const updatedArticle = await prisma.article.update({
            where: { id: product.article.id },
            data: {
              writerId: nextWriterId,
              ...(hasArticleLinkCol ? { articleLink } : {}),
              ...(hasArticleStatusCol ? { status: mappedArticleStatus } : {}),
              ...(hasPublishDateCol || hasArticleStatusCol
                ? {
                    completedAt: effectiveCompletedAt,
                    productCreatedAt: effectiveCompletedAt,
                  }
                : {}),
            },
          });
          product.article = updatedArticle;
          productMap.set(pKey, product);
          if (writerUser) assignedWritersCount++;
        } else {
          const createdArticle = await prisma.article.create({
            data: {
              productId: product.id,
              writerId: writerUser ? writerUser.id : null,
              articleLink,
              status: mappedArticleStatus,
              completedAt: explicitPublishDate || (isCompletedOrApproved ? addedDate : null),
              productCreatedAt: explicitPublishDate || (isCompletedOrApproved ? addedDate : null),
            },
          });
          product.article = createdArticle;
          productMap.set(pKey, product);
          if (writerUser) assignedWritersCount++;
        }

        // 12. Links and Multi-GEO handling (EXACT sheet data only - never invent links not in sheet)
        // Mapping rule: "here in bulk sheet merger here bridgepage link in sheet that is buynow link in website"
        const hasBuyCol = hasColumn(
          lookup,
          "Buy Link",
          "Buy Now Link",
          "Buy Now",
          "Direct Buy Link",
          "Landing Link",
          "Landing Page Link"
        );
        const hasBridgeCol = hasColumn(
          lookup,
          "Bridge Page Link",
          "Bridge Link",
          "Bridgepage Link",
          "Bridge URL",
          "Bridge"
        );

        const rawSheetBuy = cleanUrl(
          getCell(
            lookup,
            "Buy Link",
            "Buy Now Link",
            "Buy Now",
            "Direct Buy Link",
            "Landing Link",
            "Landing Page Link"
          )
        );
        const rawSheetBridge = cleanUrl(
          getCell(
            lookup,
            "Bridge Page Link",
            "Bridge Link",
            "Bridgepage Link",
            "Bridge URL",
            "Bridge"
          )
        );

        let effectiveBuyLink: string | null = null;
        let effectiveBridgeLink: string | null = null;

        if (rawSheetBuy) {
          effectiveBuyLink = rawSheetBuy;
          effectiveBridgeLink = rawSheetBridge || null;
        } else if (rawSheetBridge) {
          // Bridge Page Link in sheet maps directly to Buy Now Link on website
          effectiveBuyLink = rawSheetBridge;
          effectiveBridgeLink = null;
        }

        const { geoLinks: validGeoLinks, hasGeoColumns } = extractGeoLinksFromRow(
          r,
          lookup,
          cleanAffiliate || "Standard"
        );

        const hasAffLinkCol = hasColumn(lookup, "Affiliate Link");
        const directAffLink = cleanUrl(getCell(lookup, "Affiliate Link"));
        const effectiveAffiliateLink =
          directAffLink || (validGeoLinks.length > 0 ? validGeoLinks[0].affiliateLink : "");

        const hasLinkData = Boolean(
          effectiveBuyLink ||
            effectiveBridgeLink ||
            effectiveAffiliateLink ||
            validGeoLinks.length > 0 ||
            cleanAffiliate ||
            hasExplicitLinkStatus
        );

        if (hasLinkData) {
          // Only default to ACCEPTED if the sheet left Link Status completely empty and links were provided
          const effectiveLinkStatus = hasExplicitLinkStatus
            ? mappedLinkStatus
            : effectiveBuyLink || effectiveBridgeLink || effectiveAffiliateLink || validGeoLinks.length > 0
            ? "ACCEPTED"
            : "REQUESTED";

          if (product.linkLogs && product.linkLogs.length > 0) {
            const updatedLink = await prisma.linkLog.update({
              where: { id: product.linkLogs[0].id },
              data: {
                ...(hasBridgeCol || hasBuyCol
                  ? {
                      bridgePageLink: effectiveBridgeLink,
                      buyLink: effectiveBuyLink,
                    }
                  : {}),
                ...(hasAffLinkCol || hasGeoColumns
                  ? {
                      affiliateLink: effectiveAffiliateLink || "",
                    }
                  : {}),
                ...(hasAffiliateCol
                  ? {
                      affiliateName: cleanAffiliate || "No Affiliate",
                    }
                  : {}),
                ...(hasLinkStatusCol ? { status: effectiveLinkStatus } : {}),
                ...(explicitAddedDate ? { addedAt: explicitAddedDate } : {}),
                updatedById: effectiveLinkerId,
                ...(hasLinkerRemarksCol || hasRemarksCol
                  ? { linkerRemarks: effectiveLinkerRemarks }
                  : multiLinkerNote
                  ? { linkerRemarks: multiLinkerNote }
                  : {}),
              },
            });

            // Sync GEO links strictly to what is present in sheet
            if (validGeoLinks.length > 0) {
              await prisma.linkGeo.deleteMany({
                where: { linkLogId: updatedLink.id },
              });
              await prisma.linkGeo.createMany({
                data: validGeoLinks.map((g) => ({
                  linkLogId: updatedLink.id,
                  geo: g.geo,
                  affiliateLink: g.affiliateLink,
                  affiliateName: g.affiliateName || cleanAffiliate || "Standard",
                })),
                skipDuplicates: true,
              });
              configuredGeosCount += validGeoLinks.length;
            } else if (hasGeoColumns) {
              // Sheet includes GEO columns and all are empty -> remove any stale GEO links
              await prisma.linkGeo.deleteMany({
                where: { linkLogId: updatedLink.id },
              });
            }

            product.linkLogs[0] = updatedLink;
            productMap.set(pKey, product);
            configuredLinksCount++;
          } else {
            const createdLink = await prisma.linkLog.create({
              data: {
                productId: product.id,
                addedById: effectiveLinkerId,
                bridgePageLink: effectiveBridgeLink || null,
                buyLink: effectiveBuyLink || null,
                affiliateLink: effectiveAffiliateLink || "",
                affiliateName: cleanAffiliate || "No Affiliate",
                status: effectiveLinkStatus,
                addedAt: addedDate,
                linkerRemarks: effectiveLinkerRemarks,
                ...(validGeoLinks.length > 0
                  ? {
                      geos: {
                        create: validGeoLinks.map((g) => ({
                          geo: g.geo,
                          affiliateLink: g.affiliateLink,
                          affiliateName: g.affiliateName || cleanAffiliate || "Standard",
                        })),
                      },
                    }
                  : {}),
              },
              include: { geos: true },
            });

            if (validGeoLinks.length > 0) {
              configuredGeosCount += validGeoLinks.length;
            }

            product.linkLogs = [createdLink];
            productMap.set(pKey, product);
            configuredLinksCount++;
          }
        }

        processedCount++;
      } catch (rowErr: any) {
        console.error(`Error processing row ${rowNum}:`, rowErr);
        errors.push(`Row ${rowNum} (${getCellString(lookup, "Product Name", "Name") || "Unknown"}): ${rowErr.message || "Failed to process row"}`);
      }
    }

    // Invalidate Redis caches so dashboard, products, articles & lookups reflect new imports immediately
    await Promise.all([
      delByPattern("dashboard:*"),
      delByPattern("products:*"),
      delByPattern("articles:*"),
      delByPattern("sites:*"),
      delByPattern("lookup:*"),
    ]);

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${processedCount} rows across ${uniqueSites.size} site(s)!`,
      stats: {
        totalRows: rows.length,
        processed: processedCount,
        createdProducts: createdProductsCount,
        updatedProducts: updatedProductsCount,
        createdSites: createdSitesCount,
        assignedWriters: assignedWritersCount,
        configuredLinks: configuredLinksCount,
        configuredGeos: configuredGeosCount,
        uniqueSites: Array.from(uniqueSites),
        errors: errors.slice(0, 50),
      },
    });
  } catch (error: any) {
    console.error("Merged sheet import error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to import merged sheet" },
      { status: 500 }
    );
  }
}

