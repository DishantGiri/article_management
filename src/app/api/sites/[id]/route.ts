import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { slugifySite } from "@/lib/siteUtils";

// GET /api/sites/[id] — retrieve site details and all articles by ID or slug
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: identifier } = await params;
    const role = session.user.role;
    const userId = Number(session.user.id);

    // 1. Locate the site either by numeric ID or by slug/name
    let site = null;
    const numId = parseInt(identifier);
    if (!isNaN(numId)) {
      site = await prisma.site.findUnique({
        where: { id: numId },
        include: {
          categories: { select: { id: true, name: true } },
        },
      });
    }

    if (!site) {
      // Find all sites and match by slugified name or raw lowercase name
      const allSites = await prisma.site.findMany({
        include: {
          categories: { select: { id: true, name: true } },
        },
      });
      const targetSlug = identifier.trim().toLowerCase();
      site = allSites.find(
        (s) =>
          slugifySite(s.name) === targetSlug ||
          s.name.trim().toLowerCase() === targetSlug
      );
    }

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    // 2. Permission Check:
    // Admin & Super Admin can view all sites.
    // Team Lead and Writer can only view their assigned sites.
    if (role === "WRITER" || role === "TEAM_LEAD") {
      const access = await prisma.siteAccess.findUnique({
        where: {
          userId_siteId: {
            userId,
            siteId: site.id,
          },
        },
      });

      if (!access) {
        return NextResponse.json(
          {
            error: "Access Denied: You are not assigned to this site.",
            siteName: site.name,
            role,
          },
          { status: 403 }
        );
      }
    }

    // 3. Fetch all articles for this site
    const articles = await prisma.article.findMany({
      where: {
        product: {
          siteId: site.id,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            productCategory: true,
            trendLevel: true,
            trendLink: true,
            previewLink: true,
            affiliateName: true,
            addedAt: true,
            category: { select: { id: true, name: true } },
          },
        },
        writer: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            image: true,
          },
        },
      },
      orderBy: [
        { completedAt: "desc" },
        { updatedAt: "desc" },
      ],
    });

    // 4. Format articles and calculate stats
    const formattedArticles = articles.map((art) => ({
      id: art.id,
      articleName: art.product.name,
      articleLink: art.articleLink || null,
      status: art.status,
      writer: art.writer
        ? {
            id: art.writer.id,
            name: art.writer.name,
            email: art.writer.email,
            role: art.writer.role,
            image: art.writer.image,
          }
        : null,
      dateOfPosting: art.completedAt || art.productCreatedAt || null,
      startedAt: art.startedAt,
      completedAt: art.completedAt,
      updatedAt: art.updatedAt,
      addedAt: art.product.addedAt,
      productCategory: art.product.productCategory || art.product.category?.name || "General",
      productId: art.product.id,
    }));

    const stats = {
      total: articles.length,
      completed: articles.filter((a) => a.status === "COMPLETED" || a.status === "APPROVED").length,
      inProgress: articles.filter((a) => a.status === "IN_PROGRESS").length,
      pending: articles.filter((a) => a.status === "PENDING").length,
      redo: articles.filter((a) => a.status === "REDO").length,
    };

    return NextResponse.json({
      site: {
        id: site.id,
        name: site.name,
        slug: slugifySite(site.name),
        url: site.url,
        categories: site.categories,
        createdAt: site.createdAt,
      },
      stats,
      articles: formattedArticles,
    });
  } catch (err: any) {
    console.error("[GET /api/sites/[id]]", err);
    return NextResponse.json(
      { error: err.message || "Failed to load site articles" },
      { status: 500 }
    );
  }
}

// PATCH /api/sites/[id] — update site (Admin / Super Admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Site modification is restricted to Admin role" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, url, categoryIds } = body;

    const updated = await prisma.site.update({
      where: { id: parseInt(id) },
      data: {
        ...(name ? { name } : {}),
        ...(url !== undefined ? { url } : {}),
        ...(Array.isArray(categoryIds) ? { categories: { set: categoryIds.map((cid: number) => ({ id: cid })) } } : {})
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/sites/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/sites/[id] — delete site (Admin / Super Admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Site deletion is restricted to Admin role" }, { status: 403 });
    }

    const { id } = await params;

    await prisma.site.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/sites/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
