import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/prisma";
import { sendRealtimeNotification } from "@/lib/notifier";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getUserAuthorizedSiteIds, isAdmin } from "@/lib/permissions";
import { getOrCreateResearchSite } from "@/lib/researchSite";
import { cached, delByPattern } from "@/lib/redis";

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
    const {
      name,
      names,
      products,
      categoryIds,
      excludedSiteIds,
      targetSiteIds: bodyTargetSiteIds,
      targetSiteNames: bodyTargetSiteNames,
      singleSiteId,
      targetSiteId,
      distributeToAllSites,
      createArticle,
      assignWriters,
      trendLink,
      trendLevel,
      affiliateName,
      previewLink,
      remarks,
      productCategory,
      isNative,
      source,
    } = body;
    const excludedSet = new Set(Array.isArray(excludedSiteIds) ? excludedSiteIds.map(Number) : []);
    const explicitSiteId = singleSiteId || targetSiteId ? Number(singleSiteId || targetSiteId) : null;

    interface IncomingProduct {
      name: string;
      slug?: string | null;
      country?: string | null;
      categoryId?: number | null;
      isNative?: boolean;
      productCategory?: string | null;
      source?: string | null;
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
          categoryId: Number.isInteger(Number(p.categoryId)) && Number(p.categoryId) > 0 ? Number(p.categoryId) : null,
          isNative: typeof p.isNative === "boolean" ? p.isNative : (typeof isNative === "boolean" ? isNative : false),
          productCategory: p.productCategory?.trim() || productCategory?.trim() || null,
          source: p.source?.trim() || source?.trim() || null,
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
          categoryId: null,
          isNative: typeof isNative === "boolean" ? isNative : false,
          productCategory: productCategory?.trim() || null,
          source: typeof body.source === "string" && body.source.trim() ? body.source.trim() : null,
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
    const itemCategoryIds = productItems.map((p) => p.categoryId).filter(Boolean) as number[];
    const allCategoryIds = Array.from(
      new Set([
        ...(Array.isArray(categoryIds) ? categoryIds.map(Number).filter((id) => !isNaN(id) && id > 0) : []),
        ...itemCategoryIds,
      ])
    );

    // Basic validation
    if (trimmedNames.length === 0 || allCategoryIds.length === 0) {
      return NextResponse.json(
        { error: "Product name(s) and category / product type are required." },
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
        return NextResponse.json({ error: `Product "${p.name}": Affiliate Network is required (select at least one or 'No Affiliate').` }, { status: 400 });
      }
      if (!p.trendLevel || !p.trendLevel.trim()) {
        return NextResponse.json({ error: `Product "${p.name}": Trend Level is required.` }, { status: 400 });
      }
      if (p.trendLink && p.trendLink.trim() && !isValidUrl(p.trendLink)) {
        return NextResponse.json({ error: `Product "${p.name}": Valid Trend Link URL is required (must start with http:// or https://).` }, { status: 400 });
      }
      if (p.previewLink && p.previewLink.trim() && !isValidUrl(p.previewLink)) {
        return NextResponse.json({ error: `Product "${p.name}": Preview Link must start with http:// or https:// and be a valid URL.` }, { status: 400 });
      }
    }

    let activeUserId = Number(session.user.id);
    let existingUser = Number.isInteger(activeUserId) && activeUserId > 0
      ? await prisma.user.findUnique({
          where: { id: activeUserId },
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
      activeUserId = existingUser.id;
    } else {
      const fallbackUser = await prisma.user.findFirst({ select: { id: true } });
      if (fallbackUser) activeUserId = fallbackUser.id;
    }

    const activeUserRole = session.user.role;
    const activeUserRoles: string[] = (session.user as any)?.roles || (activeUserRole ? [activeUserRole] : []);
    const isProductResearcherUser =
      activeUserRole === "PRODUCT_RESEARCHER" ||
      (activeUserRoles && activeUserRoles.includes("PRODUCT_RESEARCHER")) ||
      Boolean(body.isProductResearch);

    // Check if user has permission to add products (either globally or site-specific)
    const authorizedSites = await getUserAuthorizedSiteIds(activeUserId, activeUserRole, "ADD_PRODUCT", activeUserRoles);
    if (authorizedSites !== null && authorizedSites.length === 0 && !isProductResearcherUser) {
      return NextResponse.json(
        { error: "Access Denied: You do not have Linker or Product Researcher permissions to add products on any site." },
        { status: 403 }
      );
    }

    const categoriesWithSites = await prisma.category.findMany({
      where: { id: { in: allCategoryIds } },
      include: { sites: true },
    });

    if (categoriesWithSites.length === 0) {
      return NextResponse.json({ error: "No valid categories found" }, { status: 404 });
    }

    const targetSiteIds = new Set<number>();

    if (isProductResearcherUser) {
      // Product Researcher recording target websites
      if (Array.isArray(bodyTargetSiteIds) && bodyTargetSiteIds.length > 0) {
        bodyTargetSiteIds
          .map(Number)
          .filter((id) => !isNaN(id) && id > 0)
          .forEach((id) => targetSiteIds.add(id));
      } else {
        for (const cat of categoriesWithSites) {
          for (const site of cat.sites) {
            if (!excludedSet.has(site.id)) {
              targetSiteIds.add(site.id);
            }
          }
        }
      }
    } else {
      // Linkers / Admins: publishing directly to live sites
      if (explicitSiteId) {
        if (authorizedSites === null || authorizedSites.includes(explicitSiteId)) {
          targetSiteIds.add(explicitSiteId);
        }
      } else {
        for (const cat of categoriesWithSites) {
          for (const site of cat.sites) {
            if (!excludedSet.has(site.id)) {
              if (authorizedSites === null || authorizedSites.includes(site.id)) {
                targetSiteIds.add(site.id);
              }
            }
          }
        }
      }

      if (targetSiteIds.size === 0) {
        return NextResponse.json(
          { error: "Access Denied: You do not have Linker or Product Researcher permissions to add products to the selected site(s)." },
          { status: 403 }
        );
      }
    }

    const checkSiteIds = Array.from(targetSiteIds);
    if (isProductResearcherUser) {
      const rSite = await getOrCreateResearchSite();
      checkSiteIds.push(rSite.id);
    }

    // Check if any product with the same name already exists on any of the target sites or research pool
    const existingProducts = await prisma.product.findMany({
      where: {
        siteId: { in: checkSiteIds },
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

    const shouldSkipDuplicates = Boolean(body.skipDuplicates);

    if (duplicateConflicts.length > 0) {
      if (shouldSkipDuplicates) {
        const conflictItemsSet = new Set(duplicateConflicts.map((c) => c.item));
        const nonConflicting = productItems.filter((p) => !conflictItemsSet.has(p));

        if (nonConflicting.length === 0) {
          const first = duplicateConflicts[0];
          const addedByPart = first.existing.addedBy?.name || "another user";
          const siteName = first.existing.site?.name;
          const siteSuffix = siteName ? ` on site ${siteName}` : " on this site";
          const countryPart = first.item.country ? ` for country ${first.item.country}` : "";
          const errorMsg = duplicateConflicts.length === 1
            ? `Already added by ${addedByPart}${siteSuffix}${countryPart}.`
            : `All ${duplicateConflicts.length} product(s) already exist in database and were skipped.`;
          return NextResponse.json({ error: errorMsg }, { status: 400 });
        }

        // Proceed with only the non-duplicate products
        productItems = nonConflicting;
      } else {
        if (duplicateConflicts.length === 1) {
          const conflict = duplicateConflicts[0];
          const addedByPart = conflict.existing.addedBy?.name || "another user";
          const siteName = conflict.existing.site?.name;
          const siteSuffix = siteName ? ` on site ${siteName}` : " on this site";
          const countryPart = conflict.item.country ? ` for country ${conflict.item.country}` : "";

          const errorMsg = `Already added by ${addedByPart}${siteSuffix}${countryPart}.`;
          return NextResponse.json({ error: errorMsg }, { status: 400 });
        } else {
          const conflictDetails = Array.from(
            new Set(
              duplicateConflicts.map((c) => {
                const siteStr = c.existing.site?.name ? ` on ${c.existing.site.name}` : "";
                const userStr = c.existing.addedBy?.name ? c.existing.addedBy.name : "another user";
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
    }

    const productsToCreate = [];
    if (isProductResearcherUser) {
      const researchSite = await getOrCreateResearchSite();

      // Connect category to research site if needed
      const rSiteWithCats = await prisma.site.findUnique({
        where: { id: researchSite.id },
        include: { categories: { select: { id: true } } },
      });
      for (const cat of categoriesWithSites) {
        if (!rSiteWithCats?.categories.some((c) => c.id === cat.id)) {
          await prisma.site.update({
            where: { id: researchSite.id },
            data: { categories: { connect: { id: cat.id } } },
          });
        }
      }

      // In Product Research: collect researched target sites, create 1 product in the research catalog
      let resolvedTargetNames: string[] = [];
      if (Array.isArray(bodyTargetSiteNames) && bodyTargetSiteNames.length > 0) {
        resolvedTargetNames = bodyTargetSiteNames
          .map((n: any) => String(n).trim())
          .filter(Boolean);
      }
      if (targetSiteIds.size > 0) {
        const dbTargetSites = await prisma.site.findMany({
          where: { id: { in: Array.from(targetSiteIds) } },
          select: { id: true, name: true },
        });
        for (const s of dbTargetSites) {
          if (!resolvedTargetNames.includes(s.name)) {
            resolvedTargetNames.push(s.name);
          }
        }
      }
      const targetSitesStr =
        resolvedTargetNames.length > 0
          ? Array.from(new Set(resolvedTargetNames)).join(", ")
          : null;

      for (const item of productItems) {
        const finalSlug = item.slug && item.slug.trim()
          ? item.slug.trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "")
          : item.name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");

        productsToCreate.push({
          name: item.name,
          slug: finalSlug || null,
          country: item.country || null,
          isNative: Boolean(item.isNative),
          siteId: researchSite.id, // In product research, do NOT directly add to live site!
          targetSites: targetSitesStr,
          categoryId: item.categoryId || categoriesWithSites[0]?.id || 1,
          productCategory: item.productCategory || null,
          source: item.source || null,
          trendLink: item.trendLink || null,
          trendLevel: item.trendLevel || "HIGH",
          affiliateName: item.affiliateName || null,
          previewLink: item.previewLink || null,
          remarks: item.remarks || null,
          addedById: activeUserId,
        });
      }
    } else {
      // Linkers / Admins: direct site assignment
      for (const item of productItems) {
        const applicableCategories = item.categoryId
          ? categoriesWithSites.filter((c) => c.id === item.categoryId)
          : categoriesWithSites;

        for (const cat of applicableCategories) {
          for (const site of cat.sites) {
            if (!targetSiteIds.has(site.id)) {
              continue;
            }
            const finalSlug = item.slug && item.slug.trim()
              ? item.slug.trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "")
              : item.name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");

            productsToCreate.push({
              name: item.name,
              slug: finalSlug || null,
              country: item.country || null,
              isNative: Boolean(item.isNative),
              siteId: site.id,
              categoryId: cat.id,
              productCategory: item.productCategory || null,
              source: item.source || null,
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
    }

    if (productsToCreate.length === 0) {
      return NextResponse.json({ error: "No sites associated with the selected categories" }, { status: 400 });
    }

    const createdProducts = await prisma.$transaction(
      productsToCreate.map((p) =>
        prisma.product.create({
          data: p,
          include: {
            site: { select: { name: true, url: true, bridgeUrl: true, allowCountrySpecific: true } },
            category: { select: { name: true } },
            addedBy: { select: { id: true, name: true, role: true } },
            updatedBy: { select: { id: true, name: true, role: true } },
          },
        })
      )
    );

    // Determine whether to auto-create articles and assign to writers
    const shouldCreateArticles = createArticle !== false && (!isProductResearcherUser || assignWriters === true);

    if (shouldCreateArticles) {
      // Auto-create a PENDING article for each product with matching country
      await prisma.$transaction(
        createdProducts.map((p) =>
          prisma.article.create({
            data: { productId: p.id, status: "PENDING", country: p.country || null },
          })
        )
      );

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
    }

    await Promise.all([
      delByPattern("products:*"),
      delByPattern("articles:*"),
      delByPattern("dashboard:*"),
    ]);

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
  const site = searchParams.get("site");
  const categoryId = searchParams.get("categoryId");
  const search = searchParams.get("search");
  const exact = searchParams.get("exact") === "true" || searchParams.get("exact") === "1";
  const status = searchParams.get("status");
  const user = searchParams.get("user");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const native = searchParams.get("native");
  const unlinked = searchParams.get("unlinked") === "true" || searchParams.get("unlinked") === "1";
  const slim = searchParams.get("slim") === "true" || searchParams.get("slim") === "1";
  const all = searchParams.get("all") === "true" || searchParams.get("all") === "1";

  // Pagination parameters
  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");
  const isPaginated = !all && (pageParam !== null || limitParam !== null);
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitParam || "10", 10) || 10));

  let allowedSiteIds: number[] | undefined = undefined;
  let excludeCompletedForWriter = false;

  const userId = session.user.id;
  const userRole = session.user.role;

  const rawRoles: string[] = (session.user as any)?.roles || [];
  const candidateRoles: string[] = [...rawRoles, userRole || ""].filter(Boolean);
  const normalizedUserRoles = Array.from(new Set(candidateRoles.map((r) => r.toUpperCase())));
  const requestedRole =
    searchParams.get("role") ||
    searchParams.get("viewRole") ||
    req.cookies.get("active_workspace_role")?.value;
  const effectiveRole =
    requestedRole &&
    (normalizedUserRoles.includes(requestedRole.toUpperCase()) ||
      userRole === "SUPER_ADMIN" ||
      userRole === "ADMIN")
      ? requestedRole.toUpperCase()
      : (userRole || "");

  if (!isAdmin(effectiveRole)) {
    if (effectiveRole === "WRITER" || effectiveRole === "TEAM_LEAD") {
      const accesses = await prisma.siteAccess.findMany({
        where: { userId },
        select: { siteId: true },
      });
      allowedSiteIds = accesses.map((a) => a.siteId);
      if (effectiveRole === "WRITER") {
        excludeCompletedForWriter = true;
      }
    } else if (effectiveRole === "GUEST") {
      // GUEST users have read-only access to view published products
      allowedSiteIds = undefined;
    } else {
      const accesses = await prisma.siteAccess.findMany({
        where: { userId },
        select: { siteId: true },
      });
      if (accesses.length > 0) {
        allowedSiteIds = accesses.map((a) => a.siteId);
      }
    }
  }

  const parsedSiteId = siteId ? parseInt(siteId) : undefined;
  let siteFilterCondition: any = undefined;

  if (allowedSiteIds !== undefined) {
    if (parsedSiteId !== undefined) {
      if (allowedSiteIds.includes(parsedSiteId)) {
        siteFilterCondition = parsedSiteId;
      } else {
        siteFilterCondition = { in: [] }; // Not authorized for requested site
      }
    } else {
      siteFilterCondition = { in: allowedSiteIds };
    }
  } else if (parsedSiteId !== undefined) {
    siteFilterCondition = parsedSiteId;
  }

  const cacheKey = `products:v2:${effectiveRole}:${userId || 0}:${parsedSiteId ?? site ?? "all"}:${categoryId ?? "all"}:${isPaginated ? `p${page}_l${limit}` : (all ? "all" : "full")}:${slim ? "slim" : "rich"}:${unlinked ? "unlinked" : "any"}:${search || "none"}:${exact ? "1" : "0"}:${status || "none"}:${user || "none"}:${startDate || "none"}:${endDate || "none"}:${native || "none"}`;

  const result = await cached(cacheKey, 60, async () => {
    const andConditions: any[] = [];

    if (siteFilterCondition !== undefined) {
      andConditions.push({ siteId: siteFilterCondition });
    }
    if (site && site.trim()) {
      const sTrim = site.trim();
      if (!isNaN(Number(sTrim))) {
        andConditions.push({ siteId: parseInt(sTrim, 10) });
      } else {
        andConditions.push({
          OR: [
            { site: { name: sTrim } },
            { targetSites: { contains: sTrim } },
          ],
        });
      }
    }
    if (categoryId && categoryId.trim()) {
      const cTrim = categoryId.trim();
      if (!isNaN(Number(cTrim))) {
        andConditions.push({ categoryId: parseInt(cTrim, 10) });
      } else {
        andConditions.push({
          OR: [
            { category: { name: cTrim } },
            { productCategory: cTrim },
          ],
        });
      }
    }
    if (unlinked) {
      andConditions.push({
        linkLogs: { none: {} },
        site: { name: { notIn: ["Product Research", "Product Research Hub"] } },
      });
    }
    if (native === "native") {
      andConditions.push({ isNative: true });
    } else if (native === "non_native") {
      andConditions.push({ isNative: false });
    }
    if (user && user.trim()) {
      const uTrim = user.trim();
      andConditions.push({
        OR: [
          { addedBy: { name: uTrim } },
          { article: { writer: { name: uTrim } } },
        ],
      });
    }
    if (startDate) {
      const sDate = new Date(startDate);
      if (!isNaN(sDate.getTime())) {
        sDate.setHours(0, 0, 0, 0);
        andConditions.push({ addedAt: { gte: sDate } });
      }
    }
    if (endDate) {
      const eDate = new Date(endDate);
      if (!isNaN(eDate.getTime())) {
        eDate.setHours(23, 59, 59, 999);
        andConditions.push({ addedAt: { lte: eDate } });
      }
    }
    if (status && status.trim()) {
      const cleanStatus = status.trim().toUpperCase();
      if (cleanStatus === "NO_LINKS") {
        andConditions.push({
          article: {
            OR: [
              { articleLink: { not: null } },
              { status: { in: ["APPROVED", "COMPLETED"] } },
            ],
          },
          linkLogs: {
            none: {
              OR: [
                { affiliateLink: { not: "" } },
                { geos: { some: {} } },
              ],
            },
          },
        });
      } else if (cleanStatus === "REDIRECTED") {
        andConditions.push({
          OR: [
            { article: { status: "REDIRECTED" as any } },
            { linkLogs: { some: { status: "REDIRECTED" } } },
          ],
        });
      } else if (cleanStatus === "PENDING") {
        andConditions.push({
          OR: [
            { article: null },
            { article: { status: "PENDING" } },
            { article: { writerId: null } },
          ],
        });
      } else if (["IN_PROGRESS", "COMPLETED", "APPROVED"].includes(cleanStatus)) {
        andConditions.push({
          article: {
            status: cleanStatus as any,
            writerId: { not: null },
          },
        });
      } else if (cleanStatus === "REDO") {
        andConditions.push({
          article: { status: "REDO" },
        });
      }
    } else if (excludeCompletedForWriter) {
      andConditions.push({
        OR: [
          { article: null },
          { article: { status: { in: ["PENDING", "IN_PROGRESS", "REDO"] } } },
          { article: { writerId: null } },
        ],
      });
    }
    if (search && search.trim()) {
      const q = search.trim();
      if (exact) {
        andConditions.push({
          OR: [
            { name: { equals: q } },
            { slug: { equals: q } },
          ],
        });
      } else {
        andConditions.push({
          OR: [
            { name: { contains: q } },
            { slug: { contains: q } },
            { site: { name: { contains: q } } },
            { category: { name: { contains: q } } },
            { productCategory: { contains: q } },
            { source: { contains: q } },
            { affiliateName: { contains: q } },
            { addedBy: { name: { contains: q } } },
          ],
        });
      }
    }

    const productWhere: any = andConditions.length > 0 ? { AND: andConditions } : {};

    // Fast slim mode for dropdowns / unlinked-products checks (skips heavy linkLogs, geos, and availability SQL)
    if (slim) {
      const [totalSlim, slimProducts] = await Promise.all([
        isPaginated ? prisma.product.count({ where: productWhere }) : Promise.resolve(0),
        prisma.product.findMany({
          where: productWhere,
          ...(isPaginated ? { skip: (page - 1) * limit, take: limit } : {}),
          select: {
            id: true,
            name: true,
            slug: true,
            siteId: true,
            categoryId: true,
            country: true,
            addedAt: true,
            site: { select: { id: true, name: true, url: true, bridgeUrl: true, allowCountrySpecific: true } },
            category: { select: { id: true, name: true } },
            article: { select: { id: true, status: true, articleLink: true, country: true, startedAt: true, completedAt: true, productCreatedAt: true } },
          },
          orderBy: { addedAt: "desc" },
        }),
      ]);

      if (isPaginated) {
        return {
          products: slimProducts,
          pagination: {
            total: totalSlim,
            page,
            limit,
            totalPages: Math.ceil(totalSlim / limit),
          },
        };
      }
      return slimProducts;
    }

    // Paginate by UNIQUE product name in non-slim mode so every page returns `limit` distinct
    // products (with all their site rows included for collapsing on the client).
    let totalProductsCount = 0;
    let pendingUniqueCount = 0;
    let products: any[] = [];
    let totalPublishingSites = 0;

    if (isPaginated) {
      const [allGroups, pendingGroups, pubSitesCount] = await Promise.all([
        prisma.product.groupBy({
          by: ["name"],
          where: productWhere,
          _max: { addedAt: true },
          orderBy: [{ _max: { addedAt: "desc" } }, { name: "asc" }],
        }),
        prisma.product.groupBy({
          by: ["name"],
          where: {
            AND: [
              productWhere,
              {
                OR: [
                  { article: null },
                  { article: { status: "PENDING" } },
                  { article: { writerId: null } },
                ],
              },
            ],
          },
        }),
        prisma.site.count({
          where: {
            name: { not: "Product Research" },
            ...(allowedSiteIds !== undefined ? { id: { in: allowedSiteIds } } : {}),
          },
        }),
      ]);

      totalPublishingSites = pubSitesCount;

      const normToRawNames = new Map<string, string[]>();
      const orderedNormKeys: string[] = [];
      for (const g of allGroups) {
        const norm = (g.name || "").trim().toLowerCase();
        if (!norm) continue;
        if (!normToRawNames.has(norm)) {
          normToRawNames.set(norm, []);
          orderedNormKeys.push(norm);
        }
        normToRawNames.get(norm)!.push(g.name);
      }

      if (search && search.trim() && !exact) {
        const q = search.trim().toLowerCase();
        orderedNormKeys.sort((a, b) => {
          const aScore = a === q ? 3 : a.startsWith(q) ? 2 : 0;
          const bScore = b === q ? 3 : b.startsWith(q) ? 2 : 0;
          return bScore - aScore;
        });
      }

      totalProductsCount = orderedNormKeys.length;

      const pendingNormSet = new Set<string>();
      for (const pg of pendingGroups) {
        const norm = (pg.name || "").trim().toLowerCase();
        if (norm) pendingNormSet.add(norm);
      }
      pendingUniqueCount = pendingNormSet.size;

      const pageNormKeys = orderedNormKeys.slice((page - 1) * limit, page * limit);
      const pageRawNames = pageNormKeys.flatMap((k) => normToRawNames.get(k) || []);

      if (pageRawNames.length > 0) {
        products = await prisma.product.findMany({
          where: {
            AND: [productWhere, { name: { in: pageRawNames } }],
          },
          include: {
            site: { select: { id: true, name: true, url: true, bridgeUrl: true, allowCountrySpecific: true } },
            category: { select: { id: true, name: true } },
            addedBy: { select: { id: true, name: true, role: true } },
            updatedBy: { select: { id: true, name: true, role: true } },
            article: { select: { id: true, status: true, articleLink: true, country: true, startedAt: true, completedAt: true, productCreatedAt: true, writer: { select: { id: true, name: true } } } },
            linkLogs: { include: { geos: true } },
          },
          orderBy: { addedAt: "desc" },
        });

        const normRank = new Map(pageNormKeys.map((k, idx) => [k, idx]));
        products.sort((a, b) => {
          const ra = normRank.get((a.name || "").trim().toLowerCase()) ?? 999999;
          const rb = normRank.get((b.name || "").trim().toLowerCase()) ?? 999999;
          if (ra !== rb) return ra - rb;
          return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
        });
      }
    } else {
      const [allProds, pubSitesCount] = await Promise.all([
        prisma.product.findMany({
          where: productWhere,
          include: {
            site: { select: { id: true, name: true, url: true, bridgeUrl: true, allowCountrySpecific: true } },
            category: { select: { id: true, name: true } },
            addedBy: { select: { id: true, name: true, role: true } },
            updatedBy: { select: { id: true, name: true, role: true } },
            article: { select: { id: true, status: true, articleLink: true, country: true, startedAt: true, completedAt: true, productCreatedAt: true, writer: { select: { id: true, name: true } } } },
            linkLogs: { include: { geos: true } },
          },
          orderBy: { addedAt: "desc" },
        }),
        prisma.site.count({
          where: {
            name: { not: "Product Research" },
            ...(allowedSiteIds !== undefined ? { id: { in: allowedSiteIds } } : {}),
          },
        }),
      ]);
      products = allProds;
      totalPublishingSites = pubSitesCount;
    }

    let productSiteOccurrences: { name: string; siteId: number }[] = [];
    if (products.length > 0) {
      const siteFilterSql = allowedSiteIds !== undefined
        ? (allowedSiteIds.length > 0 ? Prisma.sql`AND p.siteId IN (${Prisma.join(allowedSiteIds)})` : Prisma.sql`AND 1=0`)
        : Prisma.empty;

      const pageProductNames = isPaginated
        ? Array.from(new Set(products.map((p) => p.name).filter(Boolean)))
        : [];
      const nameFilterSql =
        isPaginated && pageProductNames.length > 0
          ? Prisma.sql`AND p.name IN (${Prisma.join(pageProductNames)})`
          : Prisma.empty;

      productSiteOccurrences = await prisma.$queryRaw<Array<{ name: string; siteId: number }>>`
        SELECT LOWER(TRIM(p.name)) as name, p.siteId 
        FROM Product p
        JOIN Site s ON p.siteId = s.id
        WHERE s.name != "Product Research"
        ${siteFilterSql}
        ${nameFilterSql}
        GROUP BY LOWER(TRIM(p.name)), p.siteId
      `;
    }

    const availabilityMap = new Map<string, Set<number>>();
    for (const item of productSiteOccurrences) {
      const key = item.name.trim().toLowerCase();
      if (!availabilityMap.has(key)) {
        availabilityMap.set(key, new Set());
      }
      availabilityMap.get(key)!.add(item.siteId);
    }

    const enrichedProducts = products.map((p) => {
      const key = p.name.trim().toLowerCase();
      const liveSiteIds = availabilityMap.get(key) || new Set<number>();
      const isResearchSite = p.site?.name === "Product Research";
      const availableCount = liveSiteIds.size;
      const missingCount = Math.max(0, totalPublishingSites - availableCount);

      return {
        ...p,
        isResearchSite,
        availableCount,
        missingCount,
        totalSitesCount: totalPublishingSites,
      };
    });

    if (isPaginated) {
      return {
        products: enrichedProducts,
        pagination: {
          total: totalProductsCount,
          page,
          limit,
          totalPages: Math.ceil(totalProductsCount / limit),
        },
        summary: {
          totalUniqueCount: totalProductsCount,
          pendingUniqueCount,
        },
      };
    }

    return enrichedProducts;
  });

  return NextResponse.json(result);
}
