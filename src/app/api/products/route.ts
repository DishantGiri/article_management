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

// POST /api/products  — create a new product
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
          productCategory: productCategory?.trim() || null,
          affiliateName: affiliateName?.trim() || null,
          trendLevel: trendLevel || "HIGH",
          trendLink: trendLink?.trim() || null,
          previewLink: previewLink?.trim() || null,
          remarks: remarks?.trim() || null,
        }));
    }

    // Deduplicate by name (case-insensitive)
    const seenNames = new Set<string>();
    productItems = productItems.filter((p) => {
      const lower = p.name.toLowerCase();
      if (seenNames.has(lower)) return false;
      seenNames.add(lower);
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

    // Check if any product with the same name already exists in the system
    const existingProducts = await prisma.product.findMany({
      where: {
        OR: trimmedNames.flatMap((tName) => [
          { name: tName },
          { name: tName.toLowerCase() },
          { name: tName.toUpperCase() },
        ]),
      },
      include: {
        addedBy: { select: { name: true } },
        article: {
          select: {
            writer: { select: { name: true } },
          },
        },
      },
      orderBy: { addedAt: "desc" },
    });

    if (existingProducts.length > 0) {
      const duplicateNames = trimmedNames.filter((tName) =>
        existingProducts.some((p) => p.name.trim().toLowerCase() === tName.toLowerCase())
      );

      if (duplicateNames.length > 0) {
        if (trimmedNames.length === 1) {
          const singleName = trimmedNames[0];
          const matching = existingProducts.filter((p) => p.name.trim().toLowerCase() === singleName.toLowerCase());
          const writers = Array.from(new Set(matching.map((p) => p.article?.writer?.name).filter(Boolean)));
          const addedBys = Array.from(new Set(matching.map((p) => p.addedBy?.name).filter(Boolean)));

          const writerPart = writers.join(", ");
          const addedByPart = addedBys.join(", ");

          let errorMsg = "";
          if (addedByPart && writerPart && addedByPart !== writerPart) {
            errorMsg = `This product has been already added by ${addedByPart} or writer ${writerPart}.`;
          } else if (writerPart && (!addedByPart || addedByPart === writerPart)) {
            errorMsg = `This product has been already added by writer ${writerPart}.`;
          } else {
            errorMsg = `This product has been already added by ${addedByPart || "another user"}.`;
          }

          return NextResponse.json({ error: errorMsg }, { status: 400 });
        } else {
          const details = duplicateNames.map((dName) => {
            const matching = existingProducts.filter((p) => p.name.trim().toLowerCase() === dName.toLowerCase());
            const writers = Array.from(new Set(matching.map((p) => p.article?.writer?.name).filter(Boolean)));
            const addedBys = Array.from(new Set(matching.map((p) => p.addedBy?.name).filter(Boolean)));
            const userStr = addedBys.length > 0 ? addedBys.join(", ") : (writers.length > 0 ? writers.join(", ") : "another user");
            return `"${dName}" (added by ${userStr})`;
          });

          return NextResponse.json({
            error: `The following ${duplicateNames.length} product(s) already exist: ${details.join("; ")}. Please remove them from the list.`,
          }, { status: 400 });
        }
      }
    }

    const categoriesWithSites = await prisma.category.findMany({
      where: { id: { in: categoryIds.map(Number) } },
      include: { sites: true },
    });

    if (categoriesWithSites.length === 0) {
      return NextResponse.json({ error: "No valid categories found" }, { status: 404 });
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
            site: { select: { name: true, url: true } },
            category: { select: { name: true } },
            addedBy: { select: { name: true } },
          },
        })
      )
    );

    // Auto-create a PENDING article for each product
    await prisma.$transaction(
      createdProducts.map((p) =>
        prisma.article.create({
          data: { productId: p.id, status: "PENDING" },
        })
      )
    );

    // Auto-create LinkLog for each product with affiliateName
    for (const p of createdProducts) {
      if (p.affiliateName && p.affiliateName.trim()) {
        const slug = p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const buyUrl = p.site.url ? `${p.site.url.replace(/\/+$/, "")}/${slug}` : null;

        await prisma.linkLog.create({
          data: {
            productId: p.id,
            addedById: activeUserId,
            affiliateName: p.affiliateName.trim(),
            affiliateLink: p.previewLink || p.trendLink || "",
            bridgePageLink: null,
            buyLink: buyUrl,
            status: "REQUESTED",
            linkerRemarks: p.remarks || null,
          },
        });
      }
    }

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
          ? `New product "${productNames[0]}" has been added — check your product list.`
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

// GET /api/products?siteId=1  — list products (optionally filtered by site, role site-access rules enforced)
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
            ],
          }
        : {}),
    },
    include: {
      site: { select: { id: true, name: true, url: true } },
      category: { select: { id: true, name: true } },
      addedBy: { select: { id: true, name: true } },
      article: { select: { id: true, status: true, articleLink: true, writer: { select: { id: true, name: true } } } },
      linkLogs: { include: { geos: true } },
    },
    orderBy: { addedAt: "desc" },
  });

  return NextResponse.json(products);
}
