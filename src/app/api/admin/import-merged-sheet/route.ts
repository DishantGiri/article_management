import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Known site abbreviation aliases
const SITE_ALIASES: Record<string, string> = {
  dhs: "Daily Health Supplement",
  smg: "Supplement Mag",
  mag: "Supplement Mag",
  tbr: "The Buyers Reviews",
  grc: "Guru Review Club",
  sc: "Supplement Coach",
  sv: "Supplement Vibes",
  sd: "Supplement Dolphin",
  st: "Supplement Tiger",
  sp: "Supplements and Powders",
  jir: "Justin Reviews",
  jr: "Justin Reviews",
  rbr: "Ryans Best Reviews",
  hsb: "Health Supplement Bucket",
};

function resolveSite(key: string, sites: any[]) {
  if (!key) return null;
  const cleanKey = key.trim().toLowerCase();
  const strippedKey = cleanKey.replace(/[^a-z0-9]/g, "");

  // 1. Direct alias check
  const aliasName = SITE_ALIASES[strippedKey] || SITE_ALIASES[cleanKey];
  if (aliasName) {
    const s = sites.find((x) => x.name.toLowerCase() === aliasName.toLowerCase());
    if (s) return s;
  }

  // 2. Exact name match
  let site = sites.find((s) => s.name.toLowerCase() === cleanKey);
  if (site) return site;

  // 3. Stripped name match
  site = sites.find((s) => s.name.toLowerCase().replace(/[^a-z0-9]/g, "") === strippedKey);
  if (site) return site;

  // 4. URL match
  site = sites.find((s) => s.url && s.url.toLowerCase().includes(strippedKey));
  if (site) return site;

  // 5. Acronym match (e.g. "Daily Health Supplement" -> "dhs")
  site = sites.find((s) => {
    const words = s.name.split(/\s+/);
    const acronym = words.map((w: string) => w[0]).join("").toLowerCase();
    return acronym === strippedKey || acronym === cleanKey;
  });
  if (site) return site;

  return null;
}

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
            include: { article: true, linkLogs: true },
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
          targetSite = await prisma.site.create({
            data: {
              name: rawSiteName,
            },
          });
          allDbSites.push(targetSite);
          createdSitesCount++;
        } catch (e: any) {
          errors.push(`Row ${rowNum} ("${productName}"): Failed to create site "${rawSiteName}": ${e.message}`);
          continue;
        }
      }
      uniqueSites.add(targetSite.name);

      // 3. Extract Category
      const rawCategory = (
        r["Category"] ||
        r["category"] ||
        r["Product Type"] ||
        r["Type"] ||
        "Nutra"
      ).trim() || "Nutra";

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

      // 8. Links and Statuses
      const articleLink = (r["Article Link"] || r["article_link"] || r["Article URL"] || "").trim() || null;
      const bridgePageLink = (r["Bridge Page Link"] || r["bridge_page_link"] || r["Bridge Link"] || "").trim() || null;
      const affiliateLink = (r["Affiliate Link"] || r["affiliate_link"] || "").trim() || "";

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
          include: { article: true, linkLogs: true },
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
          include: { article: true, linkLogs: true },
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

      // 11. Update or create Link Log
      const hasLinkData = Boolean(bridgePageLink || affiliateLink || rawAffiliate);
      if (hasLinkData) {
        const effectiveLinkStatus =
          mappedLinkStatus === "REQUESTED" && (bridgePageLink || affiliateLink)
            ? "ACCEPTED"
            : mappedLinkStatus;

        if (product.linkLogs && product.linkLogs.length > 0) {
          const updatedLink = await prisma.linkLog.update({
            where: { id: product.linkLogs[0].id },
            data: {
              bridgePageLink: bridgePageLink || product.linkLogs[0].bridgePageLink,
              affiliateLink: affiliateLink || product.linkLogs[0].affiliateLink,
              affiliateName: rawAffiliate || product.linkLogs[0].affiliateName,
              status: effectiveLinkStatus,
              updatedById: effectiveLinkerId,
              linkerRemarks: multiLinkerNote || product.linkLogs[0].linkerRemarks,
            },
          });
          product.linkLogs[0] = updatedLink;
          productMap.set(pKey, product);
          configuredLinksCount++;
        } else {
          const createdLink = await prisma.linkLog.create({
            data: {
              productId: product.id,
              addedById: effectiveLinkerId,
              bridgePageLink,
              affiliateLink,
              affiliateName: rawAffiliate || "No Affiliate",
              status: effectiveLinkStatus,
              addedAt: addedDate,
              linkerRemarks: multiLinkerNote || null,
            },
          });
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

