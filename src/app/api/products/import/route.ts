import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRealtimeNotification } from "@/lib/notifier";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateResearchSite } from "@/lib/researchSite";
import { resolveSite } from "@/lib/site-resolver";
import { resolveUsers, isPlaceholderName } from "@/lib/user-resolver";
import {
  cleanOptionalText,
  cleanUrl,
  extractGeoLinksFromRow,
  isGeoColumnKey,
  isNullOrPlaceholder,
} from "@/lib/geo-link-parser";
import { extractThreeDatesFromRow, isDateColumnKey } from "@/lib/sheet-dates";
import { resolveImportedTypeAndCategory } from "@/lib/product-types";
import {
  resolveAffiliateName,
  resolveProductCategoryName,
  resolveProductSource,
} from "@/lib/import-resolvers";
import { delByPattern } from "@/lib/redis";

// POST /api/products/import - Import products from parsed CSV
function isPositiveMark(val: any): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === "boolean") return val;
  if (cleanUrl(val)) return false;
  const str = String(val).trim().toLowerCase();
  if (!str) return false;
  const negative = ["0", "false", "no", "n", "-", "--", "none", "nil", "null", "na", "n/a", "missing", "x_no"];
  return !negative.includes(str);
}

function mapImportedLinkStatus(rawStatus?: string): "REQUESTED" | "ACCEPTED" | "CANCELED" | "ISSUE" | "NEED_TO_CHECK" | "PRESELL_PAGE" | "REDIRECTED" | null {
  if (!rawStatus || isNullOrPlaceholder(rawStatus)) return null;
  const s = String(rawStatus).trim().toLowerCase();
  if (s.includes("redirect")) return "REDIRECTED";
  if (s.includes("not accept") || s.includes("unaccept") || s.includes("cancel") || s.includes("inactive") || s.includes("reject") || s.includes("declin")) return "CANCELED";
  if (s.includes("accept") || s.includes("active") || s.includes("live") || s.includes("ok")) return "ACCEPTED";
  if (s.includes("issue") || s.includes("broken") || s.includes("error")) return "ISSUE";
  if (s.includes("check") || s.includes("review")) return "NEED_TO_CHECK";
  if (s.includes("presell")) return "PRESELL_PAGE";
  if (s.includes("request") || s.includes("pend")) return "REQUESTED";
  return null;
}

function mapImportedArticleStatus(rawStatus?: string): "PENDING" | "IN_PROGRESS" | "COMPLETED" | "APPROVED" | "REDO" | "REDIRECTED" {
  if (!rawStatus || isNullOrPlaceholder(rawStatus)) return "PENDING";
  const s = String(rawStatus).trim().toLowerCase();
  if (s.includes("redirect")) return "REDIRECTED";
  if (s.includes("redo") || s.includes("revis") || s.includes("reject")) return "REDO";
  if (s.includes("approv") || s.includes("done") || s.includes("publish")) return "APPROVED";
  if (s.includes("complet")) return "COMPLETED";
  if (s.includes("progress") || s.includes("writ") || s.includes("start") || s.includes("draft")) return "IN_PROGRESS";
  return "PENDING";
}

function getRowFieldValue(row: Record<string, any>, ...aliases: string[]): any {
  const norm = (k: string) => String(k || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  const targets = new Set(aliases.map(norm));
  for (const k of Object.keys(row || {})) {
    if (targets.has(norm(k))) {
      const v = row[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        return v;
      }
    }
  }
  return "";
}


async function attachOrMergeImportedLink(params: {
  productId: number;
  existingLinkLog?: any | null;
  addedById: number;
  bridgePageLink: string | null;
  buyLink: string | null;
  affiliateLink: string;
  affiliateName: string;
  status: "REQUESTED" | "ACCEPTED" | "CANCELED" | "ISSUE" | "NEED_TO_CHECK" | "PRESELL_PAGE" | "REDIRECTED";
  linkerRemarks: string | null;
  addedAt: Date;
  validGeoLinks: Array<{ geo: string; affiliateLink: string; affiliateName: string }>;
}): Promise<{ linkLog: any | null; linkCreated: boolean; geosAdded: number }> {
  const {
    productId,
    existingLinkLog,
    addedById,
    bridgePageLink,
    buyLink,
    affiliateLink,
    affiliateName,
    status,
    linkerRemarks,
    addedAt,
    validGeoLinks,
  } = params;

  const hasAnyRealLink = Boolean(bridgePageLink || buyLink || affiliateLink || validGeoLinks.length > 0);
  if (!hasAnyRealLink) {
    return { linkLog: existingLinkLog || null, linkCreated: false, geosAdded: 0 };
  }

  if (existingLinkLog) {
    const updated = await prisma.linkLog.update({
      where: { id: existingLinkLog.id },
      data: {
        ...(bridgePageLink && !existingLinkLog.bridgePageLink ? { bridgePageLink } : {}),
        ...(buyLink && !existingLinkLog.buyLink ? { buyLink } : {}),
        ...(affiliateLink && !existingLinkLog.affiliateLink ? { affiliateLink } : {}),
        updatedById: addedById,
      },
      include: { geos: true },
    });

    let geosAdded = 0;
    for (const g of validGeoLinks) {
      const existed = (updated.geos || []).some((eg: any) => eg.geo === g.geo);
      await prisma.linkGeo.upsert({
        where: { linkLogId_geo: { linkLogId: updated.id, geo: g.geo } },
        update: {
          affiliateLink: g.affiliateLink,
          affiliateName: g.affiliateName || affiliateName || "Standard",
        },
        create: {
          linkLogId: updated.id,
          geo: g.geo,
          affiliateLink: g.affiliateLink,
          affiliateName: g.affiliateName || affiliateName || "Standard",
        },
      });
      if (!existed) geosAdded++;
    }

    const refreshed = await prisma.linkLog.findUnique({
      where: { id: updated.id },
      include: { geos: true },
    });
    return { linkLog: refreshed || updated, linkCreated: false, geosAdded };
  }

  const created = await prisma.linkLog.create({
    data: {
      productId,
      addedById,
      bridgePageLink,
      buyLink,
      affiliateLink: affiliateLink || "",
      affiliateName: affiliateName || "No Affiliate",
      status,
      addedAt,
      linkerRemarks,
      ...(validGeoLinks.length > 0
        ? {
            geos: {
              create: validGeoLinks.map((g) => ({
                geo: g.geo,
                affiliateLink: g.affiliateLink,
                affiliateName: g.affiliateName || affiliateName || "Standard",
              })),
            },
          }
        : {}),
    },
    include: { geos: true },
  });

  return { linkLog: created, linkCreated: true, geosAdded: validGeoLinks.length };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = session.user.role;
    const userRoles: string[] = (session.user as any)?.roles || (userRole ? [userRole] : []);
    const canImport =
      userRole === "LINKER" ||
      userRole === "ADMIN" ||
      userRole === "SUPER_ADMIN" ||
      userRole === "PRODUCT_RESEARCHER" ||
      userRoles.includes("LINKER") ||
      userRoles.includes("ADMIN") ||
      userRoles.includes("SUPER_ADMIN") ||
      userRoles.includes("PRODUCT_RESEARCHER");

    if (!canImport) {
      return NextResponse.json(
        { error: "Access Denied: Only Linkers, Product Researchers, Admins, and Super Admins can import products." },
        { status: 403 }
      );
    }

    const body = await req.json();
    let addedById = Number(body.addedById || session.user.id);
    let existingUser = Number.isInteger(addedById) && addedById > 0
      ? await prisma.user.findUnique({
          where: { id: addedById },
          select: { id: true, name: true, role: true },
        })
      : null;

    if (!existingUser && session.user.email) {
      existingUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, name: true, role: true },
      });
    }

    if (!existingUser && session.user.name) {
      existingUser = await prisma.user.findFirst({
        where: { name: session.user.name },
        select: { id: true, name: true, role: true },
      });
    }

    if (!existingUser && (session.user.name || session.user.email)) {
      const email = session.user.email || `${(session.user.name || "user").toLowerCase().replace(/[^a-z0-9]/g, "")}@fishtailinfosolutions.com`;
      existingUser = await prisma.user.upsert({
        where: { email },
        update: {
          name: session.user.name || undefined,
          role: (session.user.role as any) || undefined,
        },
        create: {
          name: session.user.name || "User",
          email,
          role: (session.user.role as any) || "PRODUCT_RESEARCHER",
          approved: true,
        },
        select: { id: true, name: true, role: true },
      });
    }

    if (existingUser) {
      addedById = existingUser.id;
    } else {
      const fallbackUser = await prisma.user.findFirst({ select: { id: true } });
      if (fallbackUser) addedById = fallbackUser.id;
    }
    const { products, defaultSiteId, distributeToAllSites, assignWriters } = body;

    const isProductResearcherUser = userRole === "PRODUCT_RESEARCHER" || userRoles.includes("PRODUCT_RESEARCHER");

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: "products array is required and cannot be empty" },
        { status: 400 }
      );
    }

    const allDbSites = await prisma.site.findMany();
    if (allDbSites.length === 0) {
      return NextResponse.json(
        { error: "No sites configured in the database. Please add sites first." },
        { status: 400 }
      );
    }

    const [allDbUsers, allDbSiteAccess, allDbAffiliates, allDbProductCategories] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, hasLeftCompany: true },
      }),
      prisma.siteAccess.findMany({
        select: { userId: true, siteId: true, role: true },
      }),
      prisma.affiliateName.findMany(),
      prisma.productCategory.findMany(),
    ]);

    const knownAffiliateNames = new Set<string>(
      allDbAffiliates.map((a) => a.name.toLowerCase().trim())
    );
    const knownProductCategoryNames = new Set<string>(
      allDbProductCategories.map((c) => c.name.toLowerCase().trim())
    );

    const importedProducts: any[] = [];
    const skippedDuplicates: string[] = [];
    const errors: string[] = [];
    let importedLinksCount = 0;
    let importedGeosCount = 0;
    const batchCreatedResearchMap = new Map<string, any>();
    const batchCreatedSiteMap = new Map<string, any>();

    const standardKeys = new Set([
      "name", "productname", "product_name", "title", "slug", "country", "geo", "countries", "geos", "targetgeos",
      "categoryname", "category", "producttype", "type",
      "productcategory", "productcategoryname", "source", "productsource", "trend", "trendlevel",
      "trendlink", "previewlink", "preview", "previewurl", "remarks", "remark", "notes", "note", "comments", "date", "addeddate", "addedat",
      "researchedby", "researcher", "addedby", "addedbyname", "added_by", "user", "author", "creator",
      "productavailability", "availability", "affiliatenetwork",
      "affiliate", "network", "selectedsites", "sitename", "site", "website",
      "isnative", "native",
      "affiliatelink", "affiliateurl", "offerlink", "buylink", "buynowlink", "buynow", "directbuylink",
      "landinglink", "landingpagelink", "bridgepagelink", "bridgelink", "bridgepagelink", "bridgeurl", "bridge",
      "linkstatus", "linkerremarks", "linkremarks", "articlelink", "articleurl", "articlestatus", "writer", "writername", "writtenby", "articlewriter",
      "geolinks", "geolink", "countrylinks", "countrylink", "countrywiselinks", "multiplegeos", "multigeolinks", "countryspecificlinks"
    ]);

    for (let i = 0; i < products.length; i++) {
      const row = products[i];
      const rowNum = i + 1;

      const rawName = String(row.name || row["Product Name"] || row["product_name"] || row.title || "").trim();
      if (!rawName || isNullOrPlaceholder(rawName)) {
        // Skip blank or null-placeholder rows without importing null products
        continue;
      }
      const name = rawName;
      if (name.length < 2) {
        errors.push(`Row ${rowNum} ("${name}"): Product name must be at least 2 characters.`);
        continue;
      }

      // Added By / Researched By user matching from the sheet
      const rawAddedBy = String(
        row.researchedBy ||
        row["Researched By"] ||
        row["researched_by"] ||
        row.addedBy ||
        row["Added By"] ||
        row["added_by"] ||
        row.researcher ||
        row["Researcher"] ||
        row.user ||
        row["User"] ||
        row.author ||
        row["Author"] ||
        row.creator ||
        row["Creator"] ||
        ""
      ).trim();

      // Product Type (strictly Ecom or Nutra) & Product Category
      const rawType = cleanOptionalText(
        row.productType || row["Product Type"] || row.type || row["Type"]
      );
      const rawCatCol = cleanOptionalText(
        row.categoryName || row.category || row["Category Name"] || row.categoryname
      );
      const rawProdCatCol = cleanOptionalText(
        row.productCategory || row["Product Category"] || row["Product Category Name"]
      );

      const { productType: categoryName, productCategory: rawProductCategory } = resolveImportedTypeAndCategory({
        rawType,
        rawCategoryCol: rawCatCol,
        rawProductCategoryCol: rawProdCatCol,
      });
      const productCategory = resolveProductCategoryName(rawProductCategory, allDbProductCategories);

      const explicitSlug = cleanOptionalText(row.slug || row["Slug"]);
      const generatedSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const productSlug = explicitSlug || generatedSlug || null;

      const country = cleanOptionalText(row.country || row["Country"] || row["GEO"]);

      // Source (fuzzy-normalized e.g. "competitors product" -> "Competitor")
      const source = resolveProductSource(
        cleanOptionalText(row.source || row["Source"] || row["Product Source"])
      );

      // Trend Level & Link
      let trendLevel = "HIGH";
      const rawTrend = String(row.trendLevel || row.trend || row["Trend"] || "").trim().toUpperCase();
      if (!isNullOrPlaceholder(rawTrend)) {
        if (rawTrend.includes("MOD")) trendLevel = "MODERATE";
        else if (rawTrend.includes("LOW")) trendLevel = "LOW";
        else if (rawTrend.includes("HIGH")) trendLevel = "HIGH";
      }

      let trendLink = cleanUrl(row.trendLink || row["Trend Link"] || row["Trend URL"]);
      if (!trendLink && /^https?:\/\//i.test(String(row.trend || "").trim())) {
        trendLink = cleanUrl(row.trend);
      }

      // Affiliate Network (fuzzy-resolved e.g. "Smart ADV" -> "SmartADV")
      const rawAffiliate = String(
        row.affiliateName ||
        row["Affiliate Network"] ||
        row["affiliate_network"] ||
        row.affiliate ||
        row["Affiliate"] ||
        row.network ||
        row["Network"] ||
        ""
      ).trim();

      const resolvedAffiliate = resolveAffiliateName(rawAffiliate, allDbAffiliates);
      const isNoAffiliate = !resolvedAffiliate;
      const affiliateName = resolvedAffiliate || "No Affiliate";

      // Preview Link
      const previewLink = cleanUrl(row.previewLink || row["Preview Link"] || row["Preview URL"] || row["Preview"]);

      // Remarks & Availability (preserve exact sheet remarks cleanly, ignore null placeholders)
      let remarks = cleanOptionalText(row.remarks || row["Remarks"] || row["Remark"] || row["Notes"] || row["Note"] || row["Comments"]) || "";
      const availability = cleanOptionalText(row.productAvailability || row["Product Availability"]) || "";
      if (
        availability &&
        !["available", "yes", "true", "1", "ok"].includes(availability.toLowerCase())
      ) {
        const availNote = `Availability: ${availability}`;
        remarks = remarks ? `${remarks} | ${availNote}` : availNote;
      }

      // Link & Multi-GEO extraction (only non-null valid URLs and non-null geo links are imported)
      const defaultLinkAffName = isNoAffiliate ? "Standard" : affiliateName;
      const { geoLinks: rawGeoLinks } = extractGeoLinksFromRow(row, defaultLinkAffName);
      const validGeoLinks = rawGeoLinks.map((g) => ({
        ...g,
        affiliateName: resolveAffiliateName(g.affiliateName, allDbAffiliates) || defaultLinkAffName,
      }));
      const rawBuyLink = cleanUrl(
        getRowFieldValue(row, "Buy Link", "Buy Now Link", "Buy Now", "Direct Buy Link", "Landing Link", "Landing Page Link")
      );
      const rawBridgeLink = cleanUrl(
        getRowFieldValue(row, "Bridge Page Link", "Bridge Link", "Bridgepage Link", "Bridge URL", "Bridge")
      );
      const directAffLink = cleanUrl(getRowFieldValue(row, "Affiliate Link", "Affiliate URL", "Offer Link"));
      const effectiveAffiliateLink =
        directAffLink || (validGeoLinks.length > 0 ? validGeoLinks[0].affiliateLink : "");
      const parsedLinkStatus = mapImportedLinkStatus(getRowFieldValue(row, "Link Status"));
      const effectiveLinkStatus = parsedLinkStatus || (rawBuyLink || rawBridgeLink || effectiveAffiliateLink || validGeoLinks.length > 0 ? "ACCEPTED" : "REQUESTED");
      const linkerRemarks = cleanOptionalText(getRowFieldValue(row, "Linker Remarks", "Link Remarks")) || (remarks || null);
      const articleLink = cleanUrl(getRowFieldValue(row, "Article Link", "Article URL"));
      const rawArticleStatus = cleanOptionalText(getRowFieldValue(row, "Article Status"));
      const rawWriterName = cleanOptionalText(
        getRowFieldValue(row, "Writer Name", "Writer", "Written By", "Article Writer")
      );

      // Dates (noon UTC avoids calendar day shift across timezones)
      const {
        addedDate: explicitAddedDate,
        writeDate: explicitWriteDate,
        publishDate: explicitPublishDate,
      } = extractThreeDatesFromRow(row);
      const addedAt = explicitAddedDate || explicitWriteDate || explicitPublishDate || new Date();
      const effectiveArticleStatus = rawArticleStatus
        ? mapImportedArticleStatus(rawArticleStatus)
        : explicitPublishDate
        ? "COMPLETED"
        : "PENDING";

      // Determine Target Sites for this product
      const targetSites: typeof allDbSites = [];

      // A. Check if selectedSites array is passed
      if (Array.isArray(row.selectedSites) && row.selectedSites.length > 0) {
        for (const sName of row.selectedSites) {
          const s = resolveSite(sName, allDbSites);
          if (s && !targetSites.some((t) => t.id === s.id)) targetSites.push(s);
        }
      }

      // B. Check if single siteName column is present
      const singleSite = cleanOptionalText(row.siteName || row.site || row["Site Name"] || row.sitename || row.website) || "";
      if (singleSite) {
        const s = resolveSite(singleSite, allDbSites);
        if (s && !targetSites.some((t) => t.id === s.id)) targetSites.push(s);
      }

      // C. Scan all row columns for site markers (DHS, SMG, TBR, GRC, SC, SV, SD, ST, SP, JiR, RBR, HSB, etc.)
      for (const [key, val] of Object.entries(row)) {
        const strippedKey = key.trim().toLowerCase().replace(/[\s_-]+/g, "");
        if (standardKeys.has(strippedKey) || isGeoColumnKey(key) || isDateColumnKey(key)) continue;

        const matchingSite = resolveSite(key, allDbSites);
        if (matchingSite) {
          if (isPositiveMark(val)) {
            if (!targetSites.some((t) => t.id === matchingSite.id)) {
              targetSites.push(matchingSite);
            }
          }
        }
      }

      // D. Fallback if no specific site was checked:
      if (targetSites.length === 0) {
        if (defaultSiteId) {
          const s = allDbSites.find((d) => d.id === Number(defaultSiteId));
          if (s) targetSites.push(s);
        }
        if (targetSites.length === 0) {
          if (isProductResearcherUser && distributeToAllSites !== true) {
            // In product research, do NOT clone to all sites: only add to 1 site
            targetSites.push(allDbSites[0]);
          } else if (distributeToAllSites === true) {
            targetSites.push(...allDbSites);
          } else {
            targetSites.push(allDbSites[0]);
          }
        }
      }

      // Match Added By / Researched By user using site-aware smart resolver
      let rowAddedById = Number(addedById);
      if (rawAddedBy && !isPlaceholderName(rawAddedBy)) {
        const matchedUsers = resolveUsers(rawAddedBy, allDbUsers, {
          rolePreference: isProductResearcherUser ? "PRODUCT_RESEARCHER" : "LINKER",
          targetSiteId: targetSites[0]?.id ?? null,
          siteAccessList: allDbSiteAccess,
        });

        if (matchedUsers.length === 0) {
          errors.push(`Row ${rowNum} ("${name}"): User "${rawAddedBy}" specified in sheet not found in system.`);
          continue;
        }
        rowAddedById = matchedUsers[0].id;
      }

      // Collect all detected site names for targetSites string
      const detectedSiteNames = targetSites.map((s) => s.name);
      const targetSitesStr = detectedSiteNames.length > 0 ? detectedSiteNames.join(", ") : null;

      // Find or create core Product Type (Ecom or Nutra)
      let category = await prisma.category.findFirst({
        where: { name: { equals: categoryName } },
      });
      if (!category) {
        category = await prisma.category.upsert({
          where: { name: categoryName },
          update: {},
          create: { name: categoryName },
        });
      }

      // Ensure ProductCategory exists
      if (productCategory) {
        const prodCatKey = productCategory.toLowerCase().trim();
        if (!knownProductCategoryNames.has(prodCatKey)) {
          await prisma.productCategory.upsert({
            where: { name: productCategory },
            update: {},
            create: { name: productCategory },
          }).catch(() => {});
          knownProductCategoryNames.add(prodCatKey);
          allDbProductCategories.push({ name: productCategory } as any);
        }
      }

      // Ensure AffiliateName exists (never create an entry for "No Affiliate")
      if (resolvedAffiliate) {
        const affKey = resolvedAffiliate.toLowerCase().trim();
        if (!knownAffiliateNames.has(affKey)) {
          await prisma.affiliateName.upsert({
            where: { name: resolvedAffiliate },
            update: {},
            create: { name: resolvedAffiliate },
          }).catch(() => {});
          knownAffiliateNames.add(affKey);
          allDbAffiliates.push({ name: resolvedAffiliate } as any);
        }
      }

      // ─── IF PRODUCT RESEARCHER: DO NOT ADD DIRECTLY TO ANY SITE ───
      // Simply list in the research pool with detected target sites. Linkers will publish to sites later.
      if (isProductResearcherUser) {
        try {
          const researchBatchKey = name.toLowerCase();
          const batchCreatedProd = batchCreatedResearchMap.get(researchBatchKey);

          if (batchCreatedProd) {
            // Same product in multiple rows of this batch (e.g. one row per geo/country link) -> merge non-null links
            const mergeRes = await attachOrMergeImportedLink({
              productId: batchCreatedProd.id,
              existingLinkLog: batchCreatedProd._importedLinkLog || null,
              addedById: Number(rowAddedById),
              bridgePageLink: rawBridgeLink,
              buyLink: rawBuyLink,
              affiliateLink: effectiveAffiliateLink,
              affiliateName,
              status: effectiveLinkStatus,
              linkerRemarks,
              addedAt,
              validGeoLinks,
            });
            batchCreatedProd._importedLinkLog = mergeRes.linkLog;
            if (mergeRes.linkCreated) importedLinksCount++;
            importedGeosCount += mergeRes.geosAdded;
            continue;
          }

          const existingInResearch = await prisma.product.findFirst({
            where: {
              OR: [
                { name: { equals: name } },
                { name: { equals: name.toLowerCase() } },
                { name: { equals: name.toUpperCase() } },
              ],
            },
            include: {
              addedBy: { select: { name: true } },
              site: { select: { name: true } },
            },
          });

          if (existingInResearch) {
            const loc = existingInResearch.site?.name && existingInResearch.site.name !== "Product Research"
              ? `on site "${existingInResearch.site.name}"`
              : "in research catalog";
            skippedDuplicates.push(`Row ${rowNum} ("${name}"): Already exists ${loc} (added by ${existingInResearch.addedBy?.name || "researcher"}).`);
            continue;
          }

          const researchSite = await getOrCreateResearchSite();

          // Connect category to research site if needed
          const rSiteWithCats = await prisma.site.findUnique({
            where: { id: researchSite.id },
            include: { categories: { select: { id: true } } },
          });
          if (!rSiteWithCats?.categories.some((c) => c.id === category.id)) {
            await prisma.site.update({
              where: { id: researchSite.id },
              data: { categories: { connect: { id: category.id } } },
            });
          }

          const newProduct = await prisma.product.create({
            data: {
              name,
              slug: productSlug,
              country,
              siteId: researchSite.id, // Assigned to Product Research catalog, not live publishing sites!
              targetSites: targetSitesStr,
              categoryId: category.id,
              isNative:
                row.isNative === true ||
                row.isNative === "true" ||
                row.isNative === "yes" ||
                row.native === true ||
                row.native === "true" ||
                row.native === "yes",
              source,
              trendLevel,
              trendLink,
              affiliateName,
              productCategory,
              previewLink,
              remarks: remarks || null,
              addedById: Number(rowAddedById),
              addedAt,
            },
            include: {
              site: { select: { id: true, name: true, url: true } },
              category: { select: { id: true, name: true } },
              addedBy: { select: { id: true, name: true } },
            },
          });

          const linkRes = await attachOrMergeImportedLink({
            productId: newProduct.id,
            existingLinkLog: null,
            addedById: Number(rowAddedById),
            bridgePageLink: rawBridgeLink,
            buyLink: rawBuyLink,
            affiliateLink: effectiveAffiliateLink,
            affiliateName,
            status: effectiveLinkStatus,
            linkerRemarks,
            addedAt,
            validGeoLinks,
          });
          if (linkRes.linkCreated) importedLinksCount++;
          importedGeosCount += linkRes.geosAdded;

          batchCreatedResearchMap.set(researchBatchKey, {
            ...newProduct,
            _importedLinkLog: linkRes.linkLog,
          });
          importedProducts.push(newProduct);
        } catch (rowErr: any) {
          errors.push(`Row ${rowNum} ("${name}"): Failed to import due to: ${rowErr.message}`);
        }
        continue;
      }

      // ─── NON-PRODUCT-RESEARCHER (Linker/Admin): ADD DIRECTLY TO TARGET SITES ───
      for (const site of targetSites) {
        try {
          const siteBatchKey = `${site.id}_${name.toLowerCase()}`;
          const batchCreatedOnSite = batchCreatedSiteMap.get(siteBatchKey);

          if (batchCreatedOnSite) {
            // Merge additional non-null geo/country links from another row for the same product+site in this batch
            const mergeRes = await attachOrMergeImportedLink({
              productId: batchCreatedOnSite.id,
              existingLinkLog: batchCreatedOnSite._importedLinkLog || null,
              addedById: Number(rowAddedById),
              bridgePageLink: rawBridgeLink,
              buyLink: rawBuyLink,
              affiliateLink: effectiveAffiliateLink,
              affiliateName,
              status: effectiveLinkStatus,
              linkerRemarks,
              addedAt,
              validGeoLinks,
            });
            batchCreatedOnSite._importedLinkLog = mergeRes.linkLog;
            if (mergeRes.linkCreated) importedLinksCount++;
            importedGeosCount += mergeRes.geosAdded;
            continue;
          }

          // Ensure Site and Category are connected
          const siteWithCategories = await prisma.site.findUnique({
            where: { id: site.id },
            include: { categories: { select: { id: true } } },
          });
          const hasCategory = siteWithCategories?.categories.some((c) => c.id === category.id);
          if (!hasCategory) {
            await prisma.site.update({
              where: { id: site.id },
              data: {
                categories: {
                  connect: { id: category.id },
                },
              },
            });
          }

          // Check for existing product with this name on this site
          const existingWithSameName = await prisma.product.findFirst({
            where: {
              siteId: site.id,
              OR: [
                { name: { equals: name } },
                { name: { equals: name.toLowerCase() } },
                { name: { equals: name.toUpperCase() } },
              ],
            },
            include: {
              addedBy: { select: { name: true } },
            },
          });

          if (existingWithSameName) {
            const addedByName = existingWithSameName.addedBy?.name;
            const conflictMsg = `Already exists on site ${site.name} (added by ${addedByName || "user"}).`;
            skippedDuplicates.push(`Row ${rowNum} ("${name}"): ${conflictMsg}`);
            continue;
          }

          // Create the product
          const newProduct = await prisma.product.create({
            data: {
              name,
              slug: productSlug,
              country,
              siteId: site.id,
              targetSites: targetSitesStr,
              categoryId: category.id,
              isNative:
                row.isNative === true ||
                row.isNative === "true" ||
                row.isNative === "yes" ||
                row.native === true ||
                row.native === "true" ||
                row.native === "yes",
              source,
              trendLevel,
              trendLink,
              affiliateName,
              productCategory,
              previewLink,
              remarks: remarks || null,
              addedById: Number(rowAddedById),
              addedAt,
            },
            include: {
              site: { select: { id: true, name: true, url: true } },
              category: { select: { id: true, name: true } },
              addedBy: { select: { id: true, name: true } },
            },
          });

          // Create LinkLog + valid multi-geo links if available (null values excluded)
          const linkRes = await attachOrMergeImportedLink({
            productId: newProduct.id,
            existingLinkLog: null,
            addedById: Number(rowAddedById),
            bridgePageLink: rawBridgeLink,
            buyLink: rawBuyLink,
            affiliateLink: effectiveAffiliateLink,
            affiliateName,
            status: effectiveLinkStatus,
            linkerRemarks,
            addedAt,
            validGeoLinks,
          });
          if (linkRes.linkCreated) importedLinksCount++;
          importedGeosCount += linkRes.geosAdded;

          batchCreatedSiteMap.set(siteBatchKey, {
            ...newProduct,
            _importedLinkLog: linkRes.linkLog,
          });

          // Resolve optional Writer for this site's article
          let resolvedWriterId: number | null = null;
          if (rawWriterName && !isPlaceholderName(rawWriterName)) {
            const matchedWriters = resolveUsers(rawWriterName, allDbUsers, {
              rolePreference: "WRITER",
              targetSiteId: site.id,
              siteAccessList: allDbSiteAccess,
            });
            resolvedWriterId = matchedWriters[0]?.id ?? null;
          }

          // Create article with exact sheet link, status, writer, write date & publish date
          const isCompletedOrApproved = effectiveArticleStatus === "COMPLETED" || effectiveArticleStatus === "APPROVED";
          const effectiveCompletedAt = explicitPublishDate || (isCompletedOrApproved ? addedAt : null);
          await prisma.article.create({
            data: {
              productId: newProduct.id,
              writerId: resolvedWriterId,
              status: effectiveArticleStatus,
              ...(articleLink ? { articleLink } : {}),
              startedAt: explicitWriteDate || null,
              completedAt: effectiveCompletedAt,
              productCreatedAt: effectiveCompletedAt,
            },
          });

          // Notify writers who have access to this site
          const accesses = await prisma.siteAccess.findMany({
            where: { siteId: site.id, user: { role: "WRITER" } },
            select: { userId: true },
          });

          for (const access of accesses) {
            if (access.userId === Number(rowAddedById)) continue;
            const notif = await prisma.notification.create({
              data: {
                recipientId: access.userId,
                senderId: Number(rowAddedById),
                type: "PRODUCT_ADDED",
                message: `New product "${newProduct.name}" has been added to site "${site.name}".`,
              },
            });
            await sendRealtimeNotification(access.userId, notif);
          }

          importedProducts.push(newProduct);
        } catch (rowErr: any) {
          errors.push(`Row ${rowNum} ("${name}" for site ${site.name}): Failed to import due to: ${rowErr.message}`);
        }
      }
    }

    // Invalidate Redis caches so dashboard, products, links, and articles reflect newly imported products immediately
    await Promise.all([
      delByPattern("dashboard:*"),
      delByPattern("products:*"),
      delByPattern("articles:*"),
      delByPattern("sites:*"),
      delByPattern("links:*"),
      delByPattern("lookup:*"),
    ]);

    return NextResponse.json({
      success: importedProducts.length > 0 || (errors.length === 0 && skippedDuplicates.length > 0),
      importedCount: importedProducts.length,
      importedLinksCount,
      importedGeosCount,
      skippedCount: skippedDuplicates.length,
      skipped: skippedDuplicates,
      errors,
    });
  } catch (err: any) {
    console.error("[POST /api/products/import]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
