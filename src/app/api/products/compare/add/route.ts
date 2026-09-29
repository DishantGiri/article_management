import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRealtimeNotification } from "@/lib/notifier";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getUserAuthorizedSiteIds } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeUserId = Number(session.user.id);
    const activeUserRole = session.user.role;
    const activeUserRoles: string[] = (session.user as any)?.roles || (activeUserRole ? [activeUserRole] : []);

    // Check permission to add products on target site(s)
    const authorizedSites = await getUserAuthorizedSiteIds(activeUserId, activeUserRole, "ADD_PRODUCT", activeUserRoles);
    if (authorizedSites !== null && authorizedSites.length === 0) {
      return NextResponse.json(
        { error: "Access Denied: You do not have Linker or Product Researcher permissions to add products on any site." },
        { status: 403 }
      );
    }

    const body = await req.json();

    // Check if it's a batch add or single add
    interface AddItem {
      targetSiteId: number;
      sourceProductId?: number;
      name?: string;
      slug?: string | null;
      country?: string | null;
      isNative?: boolean;
      productCategory?: string | null;
      affiliateName?: string | null;
      trendLevel?: string | null;
      trendLink?: string | null;
      previewLink?: string | null;
      remarks?: string | null;
      categoryId?: number;
    }

    const items: AddItem[] = Array.isArray(body.items)
      ? body.items
      : [
          {
            targetSiteId: Number(body.targetSiteId),
            sourceProductId: body.sourceProductId ? Number(body.sourceProductId) : undefined,
            name: body.name,
            slug: body.slug,
            country: body.country,
            isNative: body.isNative !== undefined ? Boolean(body.isNative) : undefined,
            productCategory: body.productCategory,
            affiliateName: body.affiliateName,
            trendLevel: body.trendLevel,
            trendLink: body.trendLink,
            previewLink: body.previewLink,
            remarks: body.remarks,
            categoryId: body.categoryId ? Number(body.categoryId) : undefined,
          },
        ];

    if (items.length === 0 || !items[0].targetSiteId) {
      return NextResponse.json(
        { error: "Target site ID and product information are required." },
        { status: 400 }
      );
    }

    if (authorizedSites !== null) {
      const unauthorized = items.some((it) => !authorizedSites.includes(Number(it.targetSiteId)));
      if (unauthorized) {
        return NextResponse.json(
          { error: "Access Denied: You do not have Linker permissions to add products to one or more selected sites." },
          { status: 403 }
        );
      }
    }

    const createdResults: any[] = [];
    const skippedResults: { name: string; reason: string }[] = [];

    // Pre-fetch source products if sourceProductIds provided
    const sourceIds = items.map((i) => i.sourceProductId).filter(Boolean) as number[];
    const sourceProducts =
      sourceIds.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: sourceIds } },
            include: { category: true, site: true },
          })
        : [];
    const sourceMap = new Map(sourceProducts.map((p) => [p.id, p]));

    for (const item of items) {
      const source = item.sourceProductId ? sourceMap.get(item.sourceProductId) : undefined;
      const targetSiteId = Number(item.targetSiteId);

      // Verify target site exists
      const targetSite = await prisma.site.findUnique({
        where: { id: targetSiteId },
        include: { categories: true },
      });

      if (!targetSite) {
        skippedResults.push({
          name: item.name || source?.name || "Unknown",
          reason: `Target site with ID ${targetSiteId} not found`,
        });
        continue;
      }

      const prodName = (item.name || source?.name || "").trim();
      if (!prodName) {
        skippedResults.push({
          name: "Empty product name",
          reason: "Product name is missing",
        });
        continue;
      }

      const prodCountry = (item.country ?? source?.country ?? null)?.trim() || null;
      const normCountry = prodCountry ? prodCountry.toUpperCase() : "";

      // Check if product already exists on target site
      const existing = await prisma.product.findFirst({
        where: {
          siteId: targetSiteId,
          name: {
            equals: prodName,
          },
        },
        include: {
          article: true,
        },
      });

      if (existing) {
        if (targetSite.allowCountrySpecific) {
          const exCountry = (existing.country || existing.article?.country || "").trim().toUpperCase();
          if (exCountry === normCountry) {
            skippedResults.push({
              name: prodName,
              reason: `Already exists on ${targetSite.name} for country ${prodCountry || "Default"}`,
            });
            continue;
          }
        } else {
          skippedResults.push({
            name: prodName,
            reason: `Already exists on ${targetSite.name}`,
          });
          continue;
        }
      }

      // Determine category
      let categoryId = item.categoryId;
      if (!categoryId) {
        // Try to match source product category name on target site
        const sourceCatName = source?.category?.name;
        if (sourceCatName) {
          const matchCat = targetSite.categories.find(
            (c) => c.name.toLowerCase() === sourceCatName.toLowerCase()
          );
          if (matchCat) {
            categoryId = matchCat.id;
          }
        }

        // If still no categoryId, use first category of target site
        if (!categoryId && targetSite.categories.length > 0) {
          categoryId = targetSite.categories[0].id;
        }

        // If target site has no categories connected, connect one or find/create Ecom
        if (!categoryId) {
          let fallbackCat = await prisma.category.findFirst({
            where: { name: sourceCatName || "Ecom" },
          });
          if (!fallbackCat) {
            fallbackCat = await prisma.category.findFirst();
          }
          if (fallbackCat) {
            categoryId = fallbackCat.id;
            // Connect category to target site
            await prisma.site.update({
              where: { id: targetSiteId },
              data: { categories: { connect: { id: fallbackCat.id } } },
            });
          }
        }
      }

      if (!categoryId) {
        skippedResults.push({
          name: prodName,
          reason: `No category available for site ${targetSite.name}`,
        });
        continue;
      }

      const slugVal = item.slug || source?.slug || prodName;
      const finalSlug = slugVal
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const created = await prisma.product.create({
        data: {
          name: prodName,
          slug: finalSlug || null,
          country: prodCountry,
          isNative: item.isNative !== undefined ? Boolean(item.isNative) : (source?.isNative ?? false),
          siteId: targetSiteId,
          categoryId: categoryId,
          productCategory: item.productCategory || source?.productCategory || null,
          affiliateName: item.affiliateName || source?.affiliateName || null,
          trendLevel: item.trendLevel || source?.trendLevel || "HIGH",
          trendLink: item.trendLink || source?.trendLink || null,
          previewLink: item.previewLink || source?.previewLink || "https://google.com",
          remarks: item.remarks || (source?.remarks ? `Synced from ${source.site.name}: ${source.remarks}` : `Added via site product compare tool`),
          addedById: activeUserId,
        },
        include: {
          site: { select: { id: true, name: true, allowCountrySpecific: true } },
          category: { select: { id: true, name: true } },
          addedBy: { select: { id: true, name: true } },
        },
      });

      createdResults.push(created);

      // Dispatch notifications to writers on this site
      const accesses = await prisma.siteAccess.findMany({
        where: { siteId: targetSiteId, user: { role: "WRITER" } },
        select: { userId: true },
      });

      for (const acc of accesses) {
        if (acc.userId === activeUserId) continue;
        const notif = await prisma.notification.create({
          data: {
            recipientId: acc.userId,
            senderId: activeUserId,
            type: "PRODUCT_ADDED",
            message: `New product "${created.name}" added to ${targetSite.name} - check your product list.`,
          },
        });
        await sendRealtimeNotification(acc.userId, notif);
      }
    }

    if (createdResults.length === 0 && skippedResults.length > 0) {
      return NextResponse.json(
        {
          error: skippedResults[0].reason,
          skipped: skippedResults,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        count: createdResults.length,
        created: createdResults,
        skipped: skippedResults,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[POST /api/products/compare/add]", err);
    return NextResponse.json(
      { error: err.message || "Failed to add product to site" },
      { status: 500 }
    );
  }
}
