/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";
import { resolveSite } from "@/lib/site-resolver";
import { resolveUsers, splitPersonNames, isPlaceholderName } from "@/lib/user-resolver";
import { cleanOptionalText, cleanUrl, extractGeoLinksFromRow, isNullOrPlaceholder } from "@/lib/geo-link-parser";
import { extractThreeDatesFromRow, parseSheetDate } from "@/lib/sheet-dates";
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
  return parseSheetDate(val);
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

function parseGeoLinksFromRow(
  r: Record<string, any>,
  defaultAffiliateName: string
) {
  return extractGeoLinksFromRow(r, defaultAffiliateName);
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
    const touchedArticleIdsInBatch = new Set<number>();
    const touchedLinkLogIdsInBatch = new Set<number>();
    const errors: string[] = [];
    const uniqueSites = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;
      const lookup = buildRowLookup(r);

      try {
        // 1. Extract Product Name (skip blank/null placeholders)
        const productName = getCellString(lookup, "Product Name", "Product", "Title", "Name");

        if (!productName || isNullOrPlaceholder(productName)) {
          // Skip empty or null-placeholder rows
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

        // 7. Slug, Country, Preview/Trend Links & Remarks
        const hasSlugCol = hasColumn(lookup, "Slug");
        const explicitSlug = cleanOptionalText(getCellString(lookup, "Slug"));
        const generatedSlug = productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const finalSlug = explicitSlug || generatedSlug || null;

        const hasCountryCol = hasColumn(lookup, "Country", "Countries", "GEO", "Geos", "Target GEOs");
        const countryVal = cleanOptionalText(getCellString(lookup, "Country", "Countries", "GEO", "Geos", "Target GEOs"));

        const hasSourceCol = hasColumn(lookup, "Source", "Product Source");
        const sourceVal = cleanOptionalText(getCellString(lookup, "Source", "Product Source"));

        const hasPreviewLinkCol = hasColumn(lookup, "Preview Link", "Preview URL", "Preview");
        const previewLinkVal = cleanUrl(getCell(lookup, "Preview Link", "Preview URL", "Preview"));

        const hasTrendLinkCol = hasColumn(lookup, "Trend Link", "Trend URL");
        const rawTrendCell = getCellString(lookup, "Trend", "Trend Level");
        let trendLinkVal = cleanUrl(getCell(lookup, "Trend Link", "Trend URL"));
        if (!trendLinkVal && rawTrendCell && /^https?:\/\//i.test(rawTrendCell)) {
          trendLinkVal = cleanUrl(rawTrendCell);
        }
        const hasTrendLevelCol = hasColumn(lookup, "Trend Level", "Trend");
        let trendLevelVal: string | null = null;
        if (rawTrendCell && !/^https?:\/\//i.test(rawTrendCell) && !isNullOrPlaceholder(rawTrendCell)) {
          const upperT = rawTrendCell.toUpperCase();
          if (upperT.includes("MOD")) trendLevelVal = "MODERATE";
          else if (upperT.includes("LOW")) trendLevelVal = "LOW";
          else if (upperT.includes("HIGH")) trendLevelVal = "HIGH";
        }

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
        const {
          addedDate: explicitAddedDate,
          hasWriteDateCol,
          writeDate: explicitWriteDate,
          hasPublishDateCol,
          publishDate: explicitPublishDate,
        } = extractThreeDatesFromRow(r);
        const addedDate = explicitAddedDate || explicitWriteDate || explicitPublishDate || new Date();

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
              ...(hasCountryCol && countryVal ? { country: countryVal } : {}),
              ...(hasSourceCol && sourceVal ? { source: sourceVal } : {}),
              ...(hasPreviewLinkCol && previewLinkVal ? { previewLink: previewLinkVal } : {}),
              ...((hasTrendLinkCol || (rawTrendCell && /^https?:\/\//i.test(rawTrendCell))) && trendLinkVal ? { trendLink: trendLinkVal } : {}),
              ...(hasTrendLevelCol && trendLevelVal ? { trendLevel: trendLevelVal } : {}),
              ...((hasTypeCol || hasCategoryCol) && category?.id ? { categoryId: category.id } : {}),
              ...(hasProductCategoryCol || (hasTypeCol && hasCategoryCol)
                ? { productCategory: rawProductCategory }
                : rawProductCategory
                ? { productCategory: rawProductCategory }
                : {}),
              ...(hasAffiliateCol && cleanAffiliate ? { affiliateName: cleanAffiliate } : {}),
              ...(linkerUser ? { addedById: linkerUser.id } : {}),
              ...(explicitAddedDate ? { addedAt: explicitAddedDate } : {}),
              ...(hasRemarksCol && effectiveProductRemarks
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
              country: countryVal,
              source: sourceVal,
              previewLink: previewLinkVal,
              trendLink: trendLinkVal,
              trendLevel: trendLevelVal || "HIGH",
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

        // 11. Update or create Article (exact sheet values + write/publish dates)
        const isCompletedOrApproved = mappedArticleStatus === "APPROVED" || mappedArticleStatus === "COMPLETED";

        if (product.article) {
          const isArticleRepeatedInBatch = touchedArticleIdsInBatch.has(product.article.id);
          const nextWriterId = writerUser
            ? writerUser.id
            : !isArticleRepeatedInBatch && hasWriterCol && isPlaceholderName(rawWriter) && !writerNotFound
            ? null
            : product.article.writerId;

          const effectiveCompletedAt =
            explicitPublishDate ||
            (isCompletedOrApproved ? product.article.completedAt || explicitAddedDate || addedDate : null);

          const articleUpdateData: Record<string, any> = {
            writerId: nextWriterId,
            ...(hasArticleLinkCol && (!isArticleRepeatedInBatch || articleLink) ? { articleLink } : {}),
            ...(hasArticleStatusCol && (!isArticleRepeatedInBatch || (rawArticleStatus && !isPlaceholderName(rawArticleStatus)))
              ? { status: mappedArticleStatus }
              : {}),
          };

          if (explicitWriteDate) {
            articleUpdateData.startedAt = explicitWriteDate;
          } else if (!isArticleRepeatedInBatch && hasWriteDateCol && hasArticleStatusCol && mappedArticleStatus === "PENDING") {
            articleUpdateData.startedAt = null;
          }

          if (isArticleRepeatedInBatch) {
            if (explicitPublishDate) {
              articleUpdateData.completedAt = explicitPublishDate;
              articleUpdateData.productCreatedAt = explicitPublishDate;
            }
          } else if (hasPublishDateCol || hasArticleStatusCol) {
            articleUpdateData.completedAt = effectiveCompletedAt;
            articleUpdateData.productCreatedAt = effectiveCompletedAt;
          }

          const updatedArticle = await prisma.article.update({
            where: { id: product.article.id },
            data: articleUpdateData,
          });
          touchedArticleIdsInBatch.add(updatedArticle.id);
          product.article = updatedArticle;
          productMap.set(pKey, product);
          if (writerUser) assignedWritersCount++;
        } else {
          const effectiveCompletedAt = explicitPublishDate || (isCompletedOrApproved ? addedDate : null);
          const createdArticle = await prisma.article.create({
            data: {
              productId: product.id,
              writerId: writerUser ? writerUser.id : null,
              articleLink,
              status: mappedArticleStatus,
              startedAt: explicitWriteDate || null,
              completedAt: effectiveCompletedAt,
              productCreatedAt: effectiveCompletedAt,
            },
          });
          touchedArticleIdsInBatch.add(createdArticle.id);
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

        const { geoLinks: validGeoLinks, hasGeoColumns } = parseGeoLinksFromRow(
          r,
          cleanAffiliate || "Standard"
        );

        const hasAffLinkCol = hasColumn(lookup, "Affiliate Link", "Affiliate URL", "Offer Link");
        const directAffLink = cleanUrl(getCell(lookup, "Affiliate Link", "Affiliate URL", "Offer Link"));
        const effectiveAffiliateLink =
          directAffLink || (validGeoLinks.length > 0 ? validGeoLinks[0].affiliateLink : "");

        const hasAnyRealLink = Boolean(
          effectiveBuyLink ||
            effectiveBridgeLink ||
            effectiveAffiliateLink ||
            validGeoLinks.length > 0
        );

        if (hasAnyRealLink || (product.linkLogs && product.linkLogs.length > 0 && (hasExplicitLinkStatus || cleanAffiliate || hasGeoColumns))) {
          // Only default to ACCEPTED if the sheet left Link Status completely empty and links were provided
          const effectiveLinkStatus = hasExplicitLinkStatus
            ? mappedLinkStatus
            : hasAnyRealLink
            ? "ACCEPTED"
            : "REQUESTED";

          if (product.linkLogs && product.linkLogs.length > 0) {
            const existingLog = product.linkLogs[0];
            const isRepeatedInBatch = touchedLinkLogIdsInBatch.has(existingLog.id);

            // If a second row in the same import touches the same product+site without any links, preserve row 1's links
            if (!isRepeatedInBatch || hasAnyRealLink || hasExplicitLinkStatus) {
              const updatedLink = await prisma.linkLog.update({
                where: { id: existingLog.id },
                data: {
                  ...(isRepeatedInBatch
                    ? {
                        ...(effectiveBridgeLink ? { bridgePageLink: effectiveBridgeLink } : {}),
                        ...(effectiveBuyLink ? { buyLink: effectiveBuyLink } : {}),
                        ...(effectiveAffiliateLink ? { affiliateLink: effectiveAffiliateLink } : {}),
                        ...(cleanAffiliate ? { affiliateName: cleanAffiliate } : {}),
                        ...(hasExplicitLinkStatus ? { status: effectiveLinkStatus } : {}),
                      }
                    : {
                        ...(hasBridgeCol || hasBuyCol
                          ? {
                              bridgePageLink: effectiveBridgeLink,
                              buyLink: effectiveBuyLink,
                            }
                          : {}),
                        ...(hasAffLinkCol || hasGeoColumns
                          ? {
                              affiliateLink: effectiveAffiliateLink || existingLog.affiliateLink || "",
                            }
                          : {}),
                        ...(hasAffiliateCol
                          ? {
                              affiliateName: cleanAffiliate || "No Affiliate",
                            }
                          : {}),
                        ...(hasLinkStatusCol ? { status: effectiveLinkStatus } : {}),
                      }),
                  ...(explicitAddedDate && !isRepeatedInBatch ? { addedAt: explicitAddedDate } : {}),
                  updatedById: effectiveLinkerId,
                  ...(hasLinkerRemarksCol || hasRemarksCol
                    ? effectiveLinkerRemarks
                      ? { linkerRemarks: effectiveLinkerRemarks }
                      : {}
                    : multiLinkerNote
                    ? { linkerRemarks: multiLinkerNote }
                    : {}),
                },
                include: { geos: true },
              });

              // Sync GEO links strictly to non-null URLs present in sheet
              if (validGeoLinks.length > 0) {
                if (isRepeatedInBatch) {
                  // Merge additional geo/country links from subsequent rows for the same product+site
                  for (const g of validGeoLinks) {
                    const affName = g.affiliateName || cleanAffiliate || updatedLink.affiliateName || "Standard";
                    const existingGeo = (updatedLink.geos || []).find((eg: any) => eg.geo === g.geo);
                    await prisma.linkGeo.upsert({
                      where: { linkLogId_geo: { linkLogId: updatedLink.id, geo: g.geo } },
                      update: {
                        affiliateLink: g.affiliateLink,
                        affiliateName: affName,
                      },
                      create: {
                        linkLogId: updatedLink.id,
                        geo: g.geo,
                        affiliateLink: g.affiliateLink,
                        affiliateName: affName,
                      },
                    });
                    if (!existingGeo) {
                      configuredGeosCount++;
                    }
                  }
                } else {
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
                }
              } else if (hasGeoColumns && !isRepeatedInBatch && hasAnyRealLink) {
                // First row in batch explicitly includes GEO columns and all geo links are null/empty -> clear stale DB geos
                await prisma.linkGeo.deleteMany({
                  where: { linkLogId: updatedLink.id },
                });
              }

              const refreshedLink = await prisma.linkLog.findUnique({
                where: { id: updatedLink.id },
                include: { geos: true },
              });
              touchedLinkLogIdsInBatch.add(updatedLink.id);
              product.linkLogs[0] = refreshedLink || updatedLink;
              productMap.set(pKey, product);
              if (!isRepeatedInBatch) configuredLinksCount++;
            }
          } else if (hasAnyRealLink) {
            // Only create a new LinkLog when at least one non-null link or geo link exists
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

            touchedLinkLogIdsInBatch.add(createdLink.id);
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

