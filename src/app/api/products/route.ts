import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRealtimeNotification } from "@/lib/notifier";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

function isValidUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    if (!/^https?:\/\//i.test(url)) return false;
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// POST /api/products  - create a new product
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, names, products, categoryIds, excludedSiteIds, trendLink, trendLevel, affiliateName, previewLink, remarks, productCategory } = body;
    const excludedSet = new Set(Array.isArray(excludedSiteIds) ? excludedSiteIds.map(Number) : []);

    interface IncomingProduct {
      name: string;
      slug?: string | null;
      country?: string | null;
      productCategory?: string | null;
      affiliateName?: string | null;
      trendLevel?: string | null;
      trendLink?: string | null;
      previewLink?: string | null;
      remarks?: string | null;
    }

    let productItems: IncomingProduct[] = [];

    if (Array.isArray(products) && products.length > 0) {
      productItems = products
        .map((p) => ({
          name: typeof p.name === "string" ? p.name.trim() : "",
          slug: typeof p.slug === "string" ? p.slug.trim() : (typeof body.slug === "string" ? body.slug.trim() : null),
          country: typeof p.country === "string" && p.country.trim() ? p.country.trim() : (typeof body.country === "string" && body.country.trim() ? body.country.trim() : null),
          productCategory: p.productCategory?.trim() || productCategory?.trim() || null,
          affiliateName: p.affiliateName?.trim() || affiliateName?.trim() || null,
          trendLevel: p.trendLevel || trendLevel || "HIGH",
          trendLink: p.trendLink?.trim() || trendLink?.trim() || null,
          previewLink: p.previewLink?.trim() || previewLink?.trim() || null,
          remarks: p.remarks?.trim() || remarks?.trim() || null,
        }))
        .filter((p) => p.name.length > 0);
    } else {
      const rawNames: string[] = Array.isArray(names) && names.length > 0
        ? names
        : (typeof name === "string" && name.trim() ? [name.trim()] : []);
      productItems = rawNames
        .map((n) => typeof n === "string" ? n.trim() : "")
        .filter(Boolean)
        .map((n) => ({
          name: n,
          slug: typeof body.slug === "string" ? body.slug.trim() : null,
          country: typeof body.country === "string" && body.country.trim() ? body.country.trim() : null,
          productCategory: productCategory?.trim() || null,
          affiliateName: affiliateName?.trim() || null,
          trendLevel: trendLevel || "HIGH",
          trendLink: trendLink?.trim() || null,
          previewLink: previewLink?.trim() || null,
          remarks: remarks?.trim() || null,
        }));
    }

    // Deduplicate within the incoming batch (by name + country)
    const seenBatchItems = new Set<string>();
    productItems = productItems.filter((p) => {
      const countryKey = (p.country || "").trim().toUpperCase();
      const key = `${p.name.toLowerCase()}:::${countryKey}`;
      if (seenBatchItems.has(key)) return false;
      seenBatchItems.add(key);
      return true;
    });

    const trimmedNames = productItems.map((p) => p.name);

    // Basic validation
    if (trimmedNames.length === 0 || !categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return NextResponse.json(
        { error: "Product name(s) and categoryIds array are required." },
        { status: 400 }
      );
    }

    // Compulsory field validation for all products: Name, Category, Affiliate, Trend Level, Trend Link, Preview Link
    for (let i = 0; i < productItems.length; i++) {
      const p = productItems[i];
      if (!p.name || !p.name.trim()) {
        return NextResponse.json({ error: `Product #${i + 1}: Product Name is required.` }, { status: 400 });
      }
      if (p.name.trim().length < 2) {
        const errorMsg = productItems.length === 1
          ? "Product name must be at least 2 characters."
          : `Product #${i + 1} ("${p.name.trim()}"): Product name must be at least 2 characters.`;
        return NextResponse.json({ error: errorMsg }, { status: 400 });
      }
      if (!p.productCategory || !p.productCategory.trim()) {
        return NextResponse.json({ error: `Product "${p.name}": Category is required.` }, { status: 400 });
      }
      if (!p.affiliateName || !p.affiliateName.trim()) {
        return NextResponse.json({ error: `Product "${p.name}": Affiliate Network is required.` }, { status: 400 });
      }
      if (!p.trendLevel || !p.trendLevel.trim()) {
        return NextResponse.json({ error: `Product "${p.name}": Trend Level is required.` }, { status: 400 });
      }
      if (p.trendLink && p.trendLink.trim() && !isValidUrl(p.trendLink)) {
        return NextResponse.json({ error: `Product "${p.name}": Valid Trend Link URL is required (must start with http:// or https://).` }, { status: 400 });
      }
      if (!p.previewLink || !p.previewLink.trim() || !isValidUrl(p.previewLink)) {
        return NextResponse.json({ error: `Product "${p.name}": Valid Preview Link URL is required (must start with http:// or https://).` }, { status: 400 });
      }
    }

    const activeUserId = session.user.id;
    const activeUserRole = session.user.role;

    if (
      activeUserRole !== "LINKER" &&
      activeUserRole !== "ADMIN" &&
      activeUserRole !== "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        { error: "Access Denied: Only Linkers, Admins, and Super Admins can add products." },
        { status: 403 }
      );
    }

    const categoriesWithSites = await prisma.category.findMany({
      where: { id: { in: categoryIds.map(Number) } },
      include: { sites: true },
    });

    if (categoriesWithSites.length === 0) {
      return NextResponse.json({ error: "No valid categories found" }, { status: 404 });
    }

    const targetSiteIds = new Set<number>();
    for (const cat of categoriesWithSites) {
      for (const site of cat.sites) {
        if (!excludedSet.has(site.id)) {
          targetSiteIds.add(site.id);
        }
      }
    }

    if (targetSiteIds.size === 0) {
      return NextResponse.json({ error: "No sites associated with the selected categories" }, { status: 400 });
    }

    // Check if any product with the same name already exists on any of the target sites
    const existingProducts = await prisma.product.findMany({
      where: {
        siteId: { in: Array.from(targetSiteIds) },
        OR: trimmedNames.flatMap((tName) => [
          { name: tName },
          { name: tName.toLowerCase() },
          { name: tName.toUpperCase() },
        ]),
      },
      include: {
        site: { select: { id: true, name: true, allowCountrySpecific: true } },
        addedBy: { select: { name: true } },
        article: {
          select: {
            country: true,
            writer: { select: { name: true } },
          },
        },
      },
      orderBy: { addedAt: "desc" },
    });

    // Check duplicate products:
    // If the site has allowCountrySpecific = true:
    // Only flag as duplicate if an existing product on that site has the SAME country (or both default).
    // If the country differs, it is NOT a duplicate ("same name dosenot matter but if diff country then that is no dublitec product").
    const duplicateConflicts: { item: IncomingProduct; existing: (typeof existingProducts)[0] }[] = [];

    for (const item of productItems) {
      const itemCountry = (item.country || "").trim().toUpperCase();
      for (const ep of existingProducts) {
        if (ep.name.trim().toLowerCase() === item.name.toLowerCase()) {
          const siteAllowsCountry = Boolean(ep.site?.allowCountrySpecific);
          if (siteAllowsCountry) {
            const epCountry = (ep.country || ep.article?.country || "").trim().toUpperCase();
            if (epCountry === itemCountry) {
              duplicateConflicts.push({ item, existing: ep });
            }
          } else {
            duplicateConflicts.push({ item, existing: ep });
          }
        }
      }
    }

    if (duplicateConflicts.length > 0) {
      if (duplicateConflicts.length === 1) {
        const conflict = duplicateConflicts[0];
        const addedByPart = conflict.existing.addedBy?.name || "another linker";
        const siteName = conflict.existing.site?.name;
        const siteSuffix = siteName ? ` on site ${siteName}` : " on this site";
        const countryPart = conflict.item.country ? ` for country ${conflict.item.country}` : "";

        const errorMsg = `Already added by linker ${addedByPart}${siteSuffix}${countryPart}.`;
        return NextResponse.json({ error: errorMsg }, { status: 400 });
      } else {
        const conflictDetails = Array.from(
          new Set(
            duplicateConflicts.map((c) => {
              const siteStr = c.existing.site?.name ? ` on ${c.existing.site.name}` : "";
              const userStr = c.existing.addedBy?.name ? `linker ${c.existing.addedBy.name}` : "another linker";
              const countryStr = c.item.country ? ` (${c.item.country})` : "";
              return `"${c.item.name}"${countryStr} (already added by ${userStr}${siteStr})`;
            })
          )
        );

        return NextResponse.json(
          {
            error: `The following product(s) already exist: ${conflictDetails.join("; ")}. Please remove them from the list.`,
          },
          { status: 400 }
        );
      }
    }

    const productsToCreate = [];
    for (const item of productItems) {
      for (const cat of categoriesWithSites) {
        for (const site of cat.sites) {
          if (excludedSet.has(site.id)) {
            continue;
          }
          const finalSlug = item.slug && item.slug.trim()
            ? item.slug.trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "")
            : item.name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");

          productsToCreate.push({
            name: item.name,
            slug: finalSlug || null,
            country: item.country || null,
            siteId: site.id,
            categoryId: cat.id,
            productCategory: item.productCategory || null,
            trendLink: item.trendLink || null,
            trendLevel: item.trendLevel || "HIGH",
            affiliateName: item.affiliateName || null,
            previewLink: item.previewLink || null,
            remarks: item.remarks || null,
            addedById: activeUserId,
          });
        }
      }
    }

    if (productsToCreate.length === 0) {
      return NextResponse.json({ error: "No sites associated with the selected categories" }, { status: 400 });
    }

    const createdProducts = await prisma.$transaction(
      productsToCreate.map((p) =>
        prisma.product.create({
          data: p,
          include: {
            site: { select: { name: true, url: true, allowCountrySpecific: true } },
            category: { select: { name: true } },
            addedBy: { select: { name: true } },
          },
        })
      )
    );

    // Auto-create a PENDING article for each product with matching country
    await prisma.$transaction(
      createdProducts.map((p) =>
        prisma.article.create({
          data: { productId: p.id, status: "PENDING", country: p.country || null },
        })
      )
    );

    // Do not auto-create LinkLogs - linkers will add real link configurations explicitly

    // Notify writers: collect ALL product names per writer, send one grouped notification
    const writerProductMap = new Map<number, string[]>();

    for (const p of createdProducts) {
      const accesses = await prisma.siteAccess.findMany({
        where: { siteId: p.siteId, user: { role: "WRITER" } },
        select: { userId: true },
      });
      for (const access of accesses) {
        if (access.userId === activeUserId) continue;
        const existing = writerProductMap.get(access.userId) || [];
        // Avoid duplicating the same product name for the same writer
        if (!existing.includes(p.name)) {
          existing.push(p.name);
        }
        writerProductMap.set(access.userId, existing);
      }
    }

    // Send one grouped notification per writer
    for (const [writerId, productNames] of writerProductMap.entries()) {
      const count = productNames.length;
      const nameList = productNames.slice(0, 3).join(", ");
      const suffix = count > 3 ? ` and ${count - 3} more` : "";
      const message =
        count === 1
          ? `New product "${productNames[0]}" has been added - check your product list.`
          : `${count} new products added: ${nameList}${suffix}. Check your product list.`;

      const notif = await prisma.notification.create({
        data: {
          recipientId: writerId,
          senderId: activeUserId,
          type: "PRODUCT_ADDED",
          message,
        },
      });
      await sendRealtimeNotification(writerId, notif);
    }

    return NextResponse.json(createdProducts, { status: 201 });
  } catch (err) {
    console.error("[POST /api/products]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/products?siteId=1  - list products (optionally filtered by site, role site-access rules enforced)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("siteId");
  const categoryId = searchParams.get("categoryId");

  let allowedSiteIds: number[] | undefined = undefined;
  let excludeCompletedForWriter = false;

  const userId = session.user.id;
  const userRole = session.user.role;

  if (userRole === "WRITER") {
    excludeCompletedForWriter = true;
    const accesses = await prisma.siteAccess.findMany({
      where: { userId },
      select: { siteId: true },
    });
    allowedSiteIds = accesses.map((a) => a.siteId);
  }

  const products = await prisma.product.findMany({
    where: {
      ...(siteId ? { siteId: parseInt(siteId) } : {}),
      ...(categoryId ? { categoryId: parseInt(categoryId) } : {}),
      ...(allowedSiteIds !== undefined ? { siteId: { in: allowedSiteIds } } : {}),
      ...(excludeCompletedForWriter
        ? {
          OR: [
            { article: null },
            { article: { status: { in: ["PENDING", "IN_PROGRESS", "REDO"] } } },
            { article: { writerId: null } },
          ],
        }
        : {}),
    },
    include: {
      site: { select: { id: true, name: true, url: true, allowCountrySpecific: true } },
      category: { select: { id: true, name: true } },
      addedBy: { select: { id: true, name: true } },
      article: { select: { id: true, status: true, articleLink: true, country: true, writer: { select: { id: true, name: true } } } },
      linkLogs: { include: { geos: true } },
    },
    orderBy: { addedAt: "desc" },
  });

  return NextResponse.json(products);
}
