import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRealtimeNotification } from "@/lib/notifier";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateResearchSite } from "@/lib/researchSite";

// POST /api/products/import - Import products from parsed CSV
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

function isPositiveMark(val: any): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === "boolean") return val;
  const str = String(val).trim().toLowerCase();
  if (!str) return false;
  const negative = ["0", "false", "no", "n", "-", "--", "none", "nil", "null", "na", "n/a", "missing", "x_no"];
  return !negative.includes(str);
}

function resolveSite(key: string, sites: any[]) {
  const cleanKey = key.trim().toLowerCase();
  const strippedKey = cleanKey.replace(/[^a-z0-9]/g, "");

  // 1. Direct alias check (e.g. "dhs" -> "Daily Health Supplement")
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

    const importedProducts = [];
    const errors: string[] = [];

    const standardKeys = new Set([
      "name", "productname", "product_name", "title",
      "categoryname", "category", "producttype", "type",
      "productcategory", "source", "trend", "trendlevel",
      "trendlink", "previewlink", "remarks", "date",
      "researchedby", "productavailability", "affiliatenetwork",
      "affiliate", "selectedsites", "sitename", "site", "website",
      "isnative", "native"
    ]);

    for (let i = 0; i < products.length; i++) {
      const row = products[i];
      const rowNum = i + 1;

      const name = (row.name || row["Product Name"] || row["product_name"] || row.title || "").trim();
      if (!name) {
        errors.push(`Row ${rowNum}: Product Name is required.`);
        continue;
      }
      if (name.length < 2) {
        errors.push(`Row ${rowNum} ("${name}"): Product name must be at least 2 characters.`);
        continue;
      }

      // Category / Product Type
      const categoryName = (
        row.categoryName ||
        row.category ||
        row["Category Name"] ||
        row.categoryname ||
        row["Product Type"] ||
        row.type ||
        row["Type"] ||
        "Supplements"
      ).trim();

      const productCategory = (
        row.productCategory ||
        row["Product Category"] ||
        row["Product Category Name"] ||
        categoryName
      ).trim();

      // Source
      const source = (row.source || row["Source"] || "").trim() || null;

      // Trend Level & Link
      let trendLevel = "HIGH";
      const rawTrend = (row.trendLevel || row.trend || row["Trend"] || "").trim().toUpperCase();
      if (rawTrend.includes("MOD")) trendLevel = "MODERATE";
      else if (rawTrend.includes("LOW")) trendLevel = "LOW";
      else if (rawTrend.includes("HIGH")) trendLevel = "HIGH";

      let trendLink = (row.trendLink || row["Trend Link"] || "").trim() || null;
      if (!trendLink && (row.trend || "").startsWith("http")) {
        trendLink = String(row.trend).trim();
      }

      // Affiliate Network
      const affiliateName = (row.affiliateName || row["Affiliate Network"] || row.affiliate || "").trim() || null;

      // Preview Link
      const previewLink = (row.previewLink || row["Preview Link"] || "").trim() || null;

      // Remarks, Availability, Researched By
      let remarks = (row.remarks || row["Remarks"] || "").trim();
      const availability = (row.productAvailability || row["Product Availability"] || "").trim();
      const researchedBy = (row.researchedBy || row["Researched By"] || "").trim();
      const extraNotes: string[] = [];
      if (availability && !["available", "yes", "true", "1", "ok"].includes(availability.toLowerCase())) {
        extraNotes.push(`Availability: ${availability}`);
      }
      if (researchedBy) {
        extraNotes.push(`Researched by: ${researchedBy}`);
      }
      if (extraNotes.length > 0) {
        remarks = remarks ? `${remarks} | ${extraNotes.join(" | ")}` : extraNotes.join(" | ");
      }

      // Date
      let addedAt = new Date();
      if (row.date || row["Date"]) {
        const parsedDate = new Date(row.date || row["Date"]);
        if (!isNaN(parsedDate.getTime())) {
          addedAt = parsedDate;
        }
      }

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
      const singleSite = (row.siteName || row.site || row["Site Name"] || row.sitename || row.website || "").trim();
      if (singleSite) {
        const s = resolveSite(singleSite, allDbSites);
        if (s && !targetSites.some((t) => t.id === s.id)) targetSites.push(s);
      }

      // C. Scan all row columns for site markers (DHS, SMG, TBR, GRC, SC, SV, SD, ST, SP, JiR, RBR, HSB, etc.)
      for (const [key, val] of Object.entries(row)) {
        const strippedKey = key.trim().toLowerCase().replace(/[\s_-]+/g, "");
        if (standardKeys.has(strippedKey)) continue;

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

      // Collect all detected site names for targetSites string
      const detectedSiteNames = targetSites.map((s) => s.name);
      const targetSitesStr = detectedSiteNames.length > 0 ? detectedSiteNames.join(", ") : null;

      // Find or create Category
      let category = await prisma.category.findFirst({
        where: { name: { equals: categoryName } },
      });
      if (!category) {
        category = await prisma.category.create({
          data: { name: categoryName },
        });
      }

      // Ensure ProductCategory exists
      if (productCategory) {
        await prisma.productCategory.upsert({
          where: { name: productCategory },
          update: {},
          create: { name: productCategory },
        }).catch(() => {});
      }

      // Ensure AffiliateName exists
      if (affiliateName) {
        await prisma.affiliateName.upsert({
          where: { name: affiliateName },
          update: {},
          create: { name: affiliateName },
        }).catch(() => {});
      }

      // ─── IF PRODUCT RESEARCHER: DO NOT ADD DIRECTLY TO ANY SITE ───
      // Simply list in the research pool with detected target sites. Linkers will publish to sites later.
      if (isProductResearcherUser) {
        try {
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
            const loc = existingInResearch.site?.name ? `on site "${existingInResearch.site.name}"` : "in research catalog";
            errors.push(`Row ${rowNum} ("${name}"): Product already exists ${loc} (added by ${existingInResearch.addedBy?.name || "researcher"}).`);
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
              addedById: Number(addedById),
              addedAt,
            },
            include: {
              site: { select: { id: true, name: true, url: true } },
              category: { select: { id: true, name: true } },
              addedBy: { select: { id: true, name: true } },
            },
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
            const conflictMsg = `Already exists on site ${site.name} (added by ${addedByName || "linker"}).`;
            errors.push(`Row ${rowNum} ("${name}"): ${conflictMsg}`);
            continue;
          }

          // Create the product
          const newProduct = await prisma.product.create({
            data: {
              name,
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
              addedById: Number(addedById),
              addedAt,
            },
            include: {
              site: { select: { id: true, name: true, url: true } },
              category: { select: { id: true, name: true } },
              addedBy: { select: { id: true, name: true } },
            },
          });

          // Auto-create article only if explicitly requested or linker adding to site
          await prisma.article.create({
            data: { productId: newProduct.id, status: "PENDING" },
          });

          // Notify writers who have access to this site
          const accesses = await prisma.siteAccess.findMany({
            where: { siteId: site.id, user: { role: "WRITER" } },
            select: { userId: true },
          });

          for (const access of accesses) {
            if (access.userId === Number(addedById)) continue;
            const notif = await prisma.notification.create({
              data: {
                recipientId: access.userId,
                senderId: Number(addedById),
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

    return NextResponse.json({
      success: importedProducts.length > 0 || errors.length === 0,
      importedCount: importedProducts.length,
      errors,
    });
  } catch (err: any) {
    console.error("[POST /api/products/import]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
