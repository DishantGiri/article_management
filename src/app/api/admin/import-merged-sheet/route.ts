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
    let createMissingUsers = true;
    let updateExisting = true;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }

      createMissingUsers = formData.get("createMissingUsers") !== "false";
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
      if (typeof body.createMissingUsers === "boolean") createMissingUsers = body.createMissingUsers;
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
    let createdUsersCount = 0;
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

      // 5. Extract Linker Name
      const rawLinker = (
        r["Linker Name"] ||
        r["linker_name"] ||
        r["Linker"] ||
        r["Researched By"] ||
        r["Researcher"] ||
        ""
      ).trim();

      let linkerUser = allDbUsers.find(
        (u) =>
          u.name.toLowerCase() === rawLinker.toLowerCase() ||
          u.email.toLowerCase() === rawLinker.toLowerCase() ||
          u.email.toLowerCase().split("@")[0] === rawLinker.toLowerCase()
      );

      if (!linkerUser && rawLinker && createMissingUsers) {
        try {
          const cleanLinkerEmail = `${rawLinker.toLowerCase().replace(/[^a-z0-9]/g, "") || "linker"}@fishtailinfosolutions.com`;
          linkerUser = await prisma.user.upsert({
            where: { email: cleanLinkerEmail },
            update: { name: rawLinker },
            create: {
              name: rawLinker,
              email: cleanLinkerEmail,
              role: "LINKER",
              approved: true,
            },
          });
          allDbUsers.push(linkerUser);
          createdUsersCount++;
        } catch (e) {
          linkerUser = undefined;
        }
      }

      const effectiveLinkerId = linkerUser?.id || currentUserId;

      // 6. Extract Writer Name
      const rawWriter = (
        r["Writer Name"] ||
        r["writer_name"] ||
        r["Writer"] ||
        r["Author"] ||
        ""
      ).trim();

      let writerUser: any = null;
      const isWriterProvided =
        rawWriter &&
        !["unassigned", "n/a", "none", "-", "--"].includes(rawWriter.toLowerCase());

      if (isWriterProvided) {
        writerUser = allDbUsers.find(
          (u) =>
            u.name.toLowerCase() === rawWriter.toLowerCase() ||
            u.email.toLowerCase() === rawWriter.toLowerCase() ||
            u.email.toLowerCase().split("@")[0] === rawWriter.toLowerCase()
        );

        if (!writerUser && createMissingUsers) {
          try {
            const cleanWriterEmail = `${rawWriter.toLowerCase().replace(/[^a-z0-9]/g, "") || "writer"}@fishtailinfosolutions.com`;
            writerUser = await prisma.user.upsert({
              where: { email: cleanWriterEmail },
              update: { name: rawWriter },
              create: {
                name: rawWriter,
                email: cleanWriterEmail,
                role: "WRITER",
                approved: true,
              },
            });
            allDbUsers.push(writerUser);
            createdUsersCount++;
          } catch (e) {
            writerUser = null;
          }
        }

        // Grant site access to writer if resolved
        if (writerUser && targetSite) {
          const accessKey = `${writerUser.id}_${targetSite.id}`;
          if (!knownSiteAccessSet.has(accessKey)) {
            await prisma.siteAccess.upsert({
              where: { userId_siteId: { userId: writerUser.id, siteId: targetSite.id } },
              update: { canWrite: true },
              create: {
                userId: writerUser.id,
                siteId: targetSite.id,
                role: "WRITER",
                canWrite: true,
              },
            }).catch(() => {});
            knownSiteAccessSet.add(accessKey);
          }
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
        createdUsers: createdUsersCount,
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

