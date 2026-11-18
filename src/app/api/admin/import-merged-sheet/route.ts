import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";
import { resolveSite } from "@/lib/site-resolver";

export const dynamic = "force-dynamic";
export const maxDuration = 300;


function parseExcelDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (typeof val === "number") {
    // Excel serial number (days since 1899-12-30)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const ms = excelEpoch.getTime() + val * 86400000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d;
  }
  const str = String(val).trim();
  if (!str) return null;
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function mapArticleStatus(rawStatus?: string): "PENDING" | "IN_PROGRESS" | "COMPLETED" | "APPROVED" | "REDO" | "REDIRECTED" {
  if (!rawStatus) return "PENDING";
  const s = rawStatus.trim().toLowerCase();
  if (s.includes("redirect")) return "REDIRECTED";
  if (s.includes("approv") || s.includes("live") || s.includes("publish")) return "APPROVED";
  if (s.includes("complet") || s.includes("done")) return "COMPLETED";
  if (s.includes("progress") || s.includes("writ") || s.includes("draft")) return "IN_PROGRESS";
  if (s.includes("redo") || s.includes("revis")) return "REDO";
  return "PENDING";
}

function mapLinkStatus(rawStatus?: string): "REQUESTED" | "ACCEPTED" | "CANCELED" | "ISSUE" | "NEED_TO_CHECK" | "PRESELL_PAGE" | "REDIRECTED" {
  if (!rawStatus) return "REQUESTED";
  const s = rawStatus.trim().toLowerCase();
  if (s.includes("redirect")) return "REDIRECTED";
  if (s.includes("accept") || s.includes("active") || s.includes("live") || s.includes("ok")) return "ACCEPTED";
  if (s.includes("cancel") || s.includes("inactive") || s.includes("reject")) return "CANCELED";
  if (s.includes("issue") || s.includes("broken") || s.includes("error")) return "ISSUE";
  if (s.includes("check") || s.includes("review")) return "NEED_TO_CHECK";
  if (s.includes("presell")) return "PRESELL_PAGE";
  return "REQUESTED";
}

function isPlaceholderName(val?: string | null): boolean {
  if (!val) return true;
  const lower = val.trim().toLowerCase().replace(/^["']+|["']+$/g, "").trim();
  return (
    !lower ||
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
      "no linker",
      "no writer",
      "anonymous",
      "blank",
    ].includes(lower)
  );
}

function cleanUrl(raw?: any): string | null {
  if (!raw) return null;
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
  if (str.startsWith("http://") || str.startsWith("https://")) {
    return str;
  }
  if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(str)) {
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
  "REMARKS",
  "NOTE",
  "NOTES",
  "ADDED DATE",
  "PUBLISH DATE",
  "COMPLETED DATE",
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
  defaultAffiliateName: string
): Array<{ geo: string; affiliateLink: string; affiliateName: string }> {
  const geoMap = new Map<string, { geo: string; affiliateLink: string; affiliateName: string }>();

  // 1. Scan all row columns for dedicated country columns (e.g. "US", "UK Link", "Canada", etc.)
  for (const key of Object.keys(r)) {
    const geoCode = normalizeGeoCode(key);
    if (!geoCode) continue;

    // Check if cell has a valid link
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
  const combinedRaw = (
    r["Geo Links"] ||
    r["GEO Links"] ||
    r["geo_links"] ||
    r["Country Links"] ||
    r["country_links"] ||
    r["Multiple Geos"] ||
    r["multiple_geos"] ||
    r["Country Specific Links"] ||
    ""
  ).trim();

  if (combinedRaw) {
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
            }
          }
        }
      } catch {
        // Fall back to text parsing
      }
    }

    if (geoMap.size === 0) {
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
  const rawAffCell = String(r["Affiliate Link"] || r["affiliate_link"] || "").trim();
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

  // 4. Fallback: single Affiliate Link + specified target GEOs
  if (geoMap.size === 0) {
    const singleAffLink = cleanUrl(r["Affiliate Link"] || r["affiliate_link"]);
    if (singleAffLink) {
      const rawTargetGeos = (
        r["GEO"] ||
        r["Geo"] ||
        r["Geos"] ||
        r["Target GEOs"] ||
        r["Target Geos"] ||
        r["Countries"] ||
        ""
      ).trim();
      if (rawTargetGeos) {
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
      if (geoMap.size === 0) {
        geoMap.set("GLOBAL", {
          geo: "GLOBAL",
          affiliateLink: singleAffLink,
          affiliateName: defaultAffiliateName,
        });
      }
    }
  }

  return Array.from(geoMap.values());
}

function splitPersonNames(raw: string): string[] {
  if (!raw || isPlaceholderName(raw)) return [];
  const cleaned = raw.replace(/^["'\s]+|["'\s]+$/g, "").trim();
  // Split on commas, &, +, word "and", or slash
  const parts = cleaned.split(/,|\s+and\s+|\s*&\s*|\s*\+\s*|\s*\/\s*/i);
  return parts
    .map((p) => p.trim().replace(/^["']+|["']+$/g, ""))
    .filter((p) => p.length > 0 && !isPlaceholderName(p));
}

function resolveUsers(raw: string, allDbUsers: any[], rolePreference?: string): any[] {
  if (isPlaceholderName(raw)) return [];

  const parts = splitPersonNames(raw);
  if (parts.length === 0) return [];

  const matched: any[] = [];
  const matchedIds = new Set<number>();

  // Filter out any placeholder accounts
  const validUsers = allDbUsers.filter((u) => !isPlaceholderName(u.name));

  const candidates = rolePreference
    ? validUsers
        .filter((u) => u.role === rolePreference)
        .concat(validUsers.filter((u) => u.role !== rolePreference))
    : validUsers;

  for (const part of parts) {
    const clean = part.trim().toLowerCase();
    if (!clean) continue;

    const cleanFirstName = clean.split(/\s+/)[0];
    const stripped = clean.replace(/[^a-z0-9]/g, "");

    // 1. Exact match on full name
    let found = candidates.find((u) => u.name.toLowerCase() === clean);

    // 2. Exact match on email or email prefix
    if (!found) {
      found = candidates.find(
        (u) =>
          u.email.toLowerCase() === clean ||
          u.email.toLowerCase().split("@")[0] === stripped
      );
    }

    // 3. User name starts with piece (e.g. DB: "Rahul Gupta", sheet: "Rahul")
    if (!found) {
      found = candidates.find((u) => u.name.toLowerCase().startsWith(clean + " "));
    }

    // 4. Piece starts with user name (e.g. DB: "Rahil", sheet: "Rahil Kunwar")
    if (!found) {
      found = candidates.find((u) => clean.startsWith(u.name.toLowerCase() + " "));
    }

    // 5. First name match (e.g. DB: "Prity Sewa", sheet: "Prity")
    if (!found) {
      found = candidates.find((u) => u.name.toLowerCase().split(/\s+/)[0] === cleanFirstName);
    }

    // 6. Common nickname aliases
    if (!found && (clean === "sami" || clean === "samikshya k")) {
      found = candidates.find((u) => u.name.toLowerCase().includes("samikshya"));
    }

    if (found && !matchedIds.has(found.id)) {
      matched.push(found);
      matchedIds.add(found.id);
    }
  }

  return matched;
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
      const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

      for (const sheetName of workbook.SheetNames) {
        // Skip informational sheets
        const cleanSheet = sheetName.trim().toLowerCase();
        if (cleanSheet === "readme" || cleanSheet === "instructions" || cleanSheet === "guide" || cleanSheet === "summary") {
          continue;
        }

        const sheet = workbook.Sheets[sheetName];
        const sheetRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        for (const r of sheetRows) {
          // If row doesn't have an explicit Site Name, assign the tab name
          if (!r["Site Name"] && !r["site_name"] && !r["Site"] && !r["Website"]) {
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
    let allDbSites = await prisma.site.findMany({
      include: { categories: true },
    });
    let allDbUsers = await prisma.user.findMany();
    let allDbCategories = await prisma.category.findMany();
    let allDbAffiliates = await prisma.affiliateName.findMany();
    let allDbSiteAccess = await prisma.siteAccess.findMany();

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
          .map((r) =>
            (
              r["Product Name"] ||
              r["product_name"] ||
              r["ProductName"] ||
              r["product"] ||
              r["Title"] ||
              r["name"] ||
              ""
            ).trim()
          )
          .filter((n) => n.length >= 2)
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

      try {
        // 1. Extract Product Name
        const productName = (
          r["Product Name"] ||
          r["product_name"] ||
          r["ProductName"] ||
          r["product"] ||
          r["Title"] ||
          r["name"] ||
          ""
        ).trim();

        if (!productName || productName.length < 2) {
          // Skip empty or invalid rows
          continue;
        }

      // 2. Extract Site Name
      const rawSiteName = (
        r["Site Name"] ||
        r["site_name"] ||
        r["Site"] ||
        r["Website"] ||
        r["sitename"] ||
        ""
      ).trim();

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

      // 3. Extract Category
      let rawCategory = (
        r["Category"] ||
        r["category"] ||
        r["Product Type"] ||
        r["Type"] ||
        "Nutra"
      ).trim() || "Nutra";

      if (/^(n\/?a|none|null|na)$/i.test(rawCategory)) {
        rawCategory = "Nutra";
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
        } catch (e: any) {
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
      const rawAffiliate = (
        r["Affiliate Network"] ||
        r["affiliate_network"] ||
        r["Network"] ||
        r["Affiliate"] ||
        ""
      ).trim();

      if (rawAffiliate && rawAffiliate.toLowerCase() !== "none" && rawAffiliate.toLowerCase() !== "no affiliate") {
        const affKey = rawAffiliate.toLowerCase();
        if (!knownAffiliateNames.has(affKey)) {
          await prisma.affiliateName.upsert({
            where: { name: rawAffiliate },
            update: {},
            create: { name: rawAffiliate },
          }).catch(() => {});
          knownAffiliateNames.add(affKey);
        }
      }

      // 5. Extract Linker Name (Placeholder e.g. "n/a" means null; unrecognized names report an error)
      const rawLinker = (
        r["Linker Name"] ||
        r["linker_name"] ||
        r["Linker"] ||
        r["Researched By"] ||
        r["Researcher"] ||
        ""
      ).trim();

      let linkerUser: any = null;
      let multiLinkerNote: string | null = null;

      if (!isPlaceholderName(rawLinker)) {
        const matchedLinkers = resolveUsers(rawLinker, allDbUsers, "LINKER");
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

      // 6. Extract Writer Name (Placeholder e.g. "n/a" means null; unrecognized names report an error)
      const rawWriter = (
        r["Writer Name"] ||
        r["writer_name"] ||
        r["Writer"] ||
        r["Author"] ||
        ""
      ).trim();

      let writerUser: any = null;

      if (!isPlaceholderName(rawWriter)) {
        const matchedWriters = resolveUsers(rawWriter, allDbUsers, "WRITER");
        if (matchedWriters.length > 0) {
          writerUser = matchedWriters[0];

          // Grant site access to all matched writers on this site
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
          errors.push(`Row ${rowNum} ("${productName}"): Writer "${rawWriter}" was not found in database.`);
        }
      }

      // 7. Dates
      const addedDate = parseExcelDate(r["Added Date"] || r["added_date"] || r["Date"] || r["date"]) || new Date();
      const publishDate = parseExcelDate(r["Publish Date"] || r["publish_date"] || r["Completed Date"]) || addedDate;

      // 8. Article and Link Statuses
      const articleLink = cleanUrl(r["Article Link"] || r["article_link"] || r["Article URL"]);
      const rawArticleStatus = r["Article Status"] || r["article_status"] || r["Status"] || "";
      const mappedArticleStatus = mapArticleStatus(rawArticleStatus);
      const rawLinkStatus = r["Link Status"] || r["link_status"] || "";
      const mappedLinkStatus = mapLinkStatus(rawLinkStatus);

      // 9. Find or create Product (instant in-memory lookup via productMap)
      const pKey = `${targetSite.id}_${productName.toLowerCase().trim()}`;
      let product = productMap.get(pKey);

      if (product) {
        if (!updateExisting) {
          continue;
        }

        // Update product details
        product = await prisma.product.update({
          where: { id: product.id },
          data: {
            categoryId: category?.id || product.categoryId,
            affiliateName: rawAffiliate || product.affiliateName,
            addedById: linkerUser ? linkerUser.id : product.addedById,
            addedAt: addedDate,
            remarks: multiLinkerNote || product.remarks,
          },
          include: { article: true, linkLogs: { include: { geos: true } } },
        });
        productMap.set(pKey, product);
        updatedProductsCount++;
      } else {
        // Create new product
        const slug = productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        product = await prisma.product.create({
          data: {
            name: productName,
            slug,
            siteId: targetSite.id,
            categoryId: category?.id || 1,
            affiliateName: rawAffiliate || null,
            addedById: effectiveLinkerId,
            addedAt: addedDate,
            remarks: multiLinkerNote || null,
          },
          include: { article: true, linkLogs: { include: { geos: true } } },
        });
        productMap.set(pKey, product);
        createdProductsCount++;
      }

      // 10. Update or create Article
      const isCompletedOrApproved = mappedArticleStatus === "APPROVED" || mappedArticleStatus === "COMPLETED";

      if (product.article) {
        const updatedArticle = await prisma.article.update({
          where: { id: product.article.id },
          data: {
            writerId: writerUser ? writerUser.id : product.article.writerId,
            articleLink: articleLink || product.article.articleLink,
            status: mappedArticleStatus,
            completedAt: isCompletedOrApproved ? (publishDate || product.article.completedAt || new Date()) : null,
            productCreatedAt: isCompletedOrApproved ? (publishDate || product.article.productCreatedAt || new Date()) : null,
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
            completedAt: isCompletedOrApproved ? publishDate : null,
            productCreatedAt: isCompletedOrApproved ? publishDate : null,
          },
        });
        product.article = createdArticle;
        productMap.set(pKey, product);
        if (writerUser) assignedWritersCount++;
      }

      // 11. Links and Multi-GEO handling
      // User requirement: "here in bulk sheet merger here bridgepage link in sheet that is buynow link in website"
      const rawSheetBuy = cleanUrl(
        r["Buy Link"] ||
        r["buy_link"] ||
        r["Buy Now Link"] ||
        r["buynow_link"] ||
        r["Buy Now"] ||
        r["buynow"] ||
        r["Direct Buy Link"] ||
        r["Landing Link"] ||
        r["Landing Page Link"]
      );

      const rawSheetBridge = cleanUrl(
        r["Bridge Page Link"] ||
        r["bridge_page_link"] ||
        r["Bridge Link"] ||
        r["bridge_link"] ||
        r["Bridgepage Link"] ||
        r["bridgepage_link"] ||
        r["Bridge URL"] ||
        r["Bridge"]
      );

      let effectiveBuyLink: string | null = null;
      let effectiveBridgeLink: string | null = null;

      if (rawSheetBuy) {
        effectiveBuyLink = rawSheetBuy;
        effectiveBridgeLink = rawSheetBridge || null;
      } else if (rawSheetBridge) {
        // "here bridgepage link in sheet that is buynow link in website"
        effectiveBuyLink = rawSheetBridge;
        effectiveBridgeLink = null;
      }

      const pSlug =
        product.slug ||
        productName
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

      // Auto-derive site Bridge Page Link if site.bridgeUrl is configured
      if (!effectiveBridgeLink && targetSite?.bridgeUrl && pSlug) {
        const targetBridgeBase = targetSite.bridgeUrl
          .split(/[\n,]+/)[0]
          ?.trim()
          .replace(/\/+$/, "");
        if (targetBridgeBase) {
          effectiveBridgeLink = `${targetBridgeBase}/${pSlug}`;
        }
      }

      // Auto-derive Buy Link from targetSite.url if still missing
      if (!effectiveBuyLink && targetSite?.url && pSlug) {
        const targetSiteBase = targetSite.url.trim().replace(/\/+$/, "");
        if (targetSiteBase) {
          effectiveBuyLink = `${targetSiteBase}/${pSlug}`;
        }
      }

      // User requirement: "and there is multipal geo links aslo if there is no link on geo then do not add geo link fix that"
      const validGeoLinks = extractGeoLinksFromRow(r, rawAffiliate || "Standard");

      const directAffLink = cleanUrl(r["Affiliate Link"] || r["affiliate_link"]);
      const effectiveAffiliateLink =
        directAffLink ||
        (validGeoLinks.length > 0 ? validGeoLinks[0].affiliateLink : "");

      const hasLinkData = Boolean(
        effectiveBuyLink ||
        effectiveBridgeLink ||
        effectiveAffiliateLink ||
        validGeoLinks.length > 0 ||
        (rawAffiliate && rawAffiliate.toLowerCase() !== "none" && rawAffiliate.toLowerCase() !== "no affiliate")
      );

      if (hasLinkData) {
        const effectiveLinkStatus =
          mappedLinkStatus === "REQUESTED" &&
          (effectiveBuyLink || effectiveBridgeLink || effectiveAffiliateLink || validGeoLinks.length > 0)
            ? "ACCEPTED"
            : mappedLinkStatus;

        if (product.linkLogs && product.linkLogs.length > 0) {
          const updatedLink = await prisma.linkLog.update({
            where: { id: product.linkLogs[0].id },
            data: {
              bridgePageLink: effectiveBridgeLink || product.linkLogs[0].bridgePageLink || null,
              buyLink: effectiveBuyLink || product.linkLogs[0].buyLink || null,
              affiliateLink: effectiveAffiliateLink || product.linkLogs[0].affiliateLink || "",
              affiliateName: rawAffiliate || product.linkLogs[0].affiliateName || "No Affiliate",
              status: effectiveLinkStatus,
              updatedById: effectiveLinkerId,
              linkerRemarks: multiLinkerNote || product.linkLogs[0].linkerRemarks,
            },
          });

          // Sync GEO links
          if (validGeoLinks.length > 0) {
            await prisma.linkGeo.deleteMany({
              where: { linkLogId: updatedLink.id },
            });
            await prisma.linkGeo.createMany({
              data: validGeoLinks.map((g) => ({
                linkLogId: updatedLink.id,
                geo: g.geo,
                affiliateLink: g.affiliateLink,
                affiliateName: g.affiliateName || rawAffiliate || "Standard",
              })),
              skipDuplicates: true,
            });
            configuredGeosCount += validGeoLinks.length;
          } else {
            // Clean up any empty geo links with no link
            await prisma.linkGeo.deleteMany({
              where: {
                linkLogId: updatedLink.id,
                OR: [{ affiliateLink: "" }, { affiliateLink: null }],
              },
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
              affiliateName: rawAffiliate || "No Affiliate",
              status: effectiveLinkStatus,
              addedAt: addedDate,
              linkerRemarks: multiLinkerNote || null,
              ...(validGeoLinks.length > 0
                ? {
                    geos: {
                      create: validGeoLinks.map((g) => ({
                        geo: g.geo,
                        affiliateLink: g.affiliateLink,
                        affiliateName: g.affiliateName || rawAffiliate || "Standard",
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
        errors.push(`Row ${rowNum} (${r["Product Name"] || "Unknown"}): ${rowErr.message || "Failed to process row"}`);
      }
    }

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

