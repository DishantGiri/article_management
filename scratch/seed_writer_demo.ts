import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST || "localhost",
  user: process.env.DATABASE_USER || "article_user",
  password: process.env.DATABASE_PASSWORD || "secure_password",
  database: process.env.DATABASE_NAME || "article_mg",
  port: parseInt(process.env.DATABASE_PORT || "3306"),
  connectionLimit: 5,
  allowPublicKeyRetrieval: true,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const dailyHealthSite = await prisma.site.findFirst({ where: { name: "Daily Health Supplement" } });
  const ryansSite = await prisma.site.findFirst({ where: { name: "Ryans Best Reviews" } });
  
  if (!dailyHealthSite || !ryansSite) {
    console.error("Sites not found");
    return;
  }

  const germanNutra = await prisma.category.findFirst({ where: { name: "German Nutra" } });
  const englishNutra = await prisma.category.findFirst({ where: { name: "English Nutra" } });
  const ecom = await prisma.category.findFirst({ where: { name: "Ecom" } });
  const supplements = await prisma.category.findFirst({ where: { name: "Supplements" } });

  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  const addedById = adminUser?.id || 80;

  const items = [
    { name: "Cenforce-D", siteId: dailyHealthSite.id, categoryId: germanNutra?.id, country: "DE", priority: "HIGH" },
    { name: "Cenforce-D", siteId: ryansSite.id, categoryId: germanNutra?.id, country: "DE", priority: "MEDIUM" },
    { name: "Neo Force", siteId: dailyHealthSite.id, categoryId: germanNutra?.id, country: "US", priority: "MEDIUM" },
    { name: "Neo Force", siteId: ryansSite.id, categoryId: germanNutra?.id, country: "US", priority: "MEDIUM" },
    { name: "Arteritenn", siteId: dailyHealthSite.id, categoryId: germanNutra?.id, country: "DE", priority: "MEDIUM" },
    { name: "Arteritenn", siteId: ryansSite.id, categoryId: germanNutra?.id, country: "DE", priority: "MEDIUM" },
    { name: "new", siteId: dailyHealthSite.id, categoryId: ecom?.id, country: "US", priority: "MEDIUM" },
    { name: "new", siteId: ryansSite.id, categoryId: ecom?.id, country: "US", priority: "MEDIUM" },
    { name: "Reaslim", siteId: dailyHealthSite.id, categoryId: germanNutra?.id, country: "DE", priority: "HIGH" },
    { name: "Leanglp", siteId: dailyHealthSite.id, categoryId: germanNutra?.id, country: "DE", priority: "MEDIUM" },
    { name: "Purelia Liver Restore", siteId: dailyHealthSite.id, categoryId: englishNutra?.id, country: "UK", priority: "MEDIUM" },
    { name: "NI", siteId: dailyHealthSite.id, categoryId: supplements?.id, country: "US", priority: "MEDIUM" },
  ];

  for (const item of items) {
    const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    let product = await prisma.product.findFirst({
      where: { name: item.name, siteId: item.siteId },
    });

    if (!product) {
      product = await prisma.product.create({
        data: {
          name: item.name,
          slug,
          siteId: item.siteId,
          categoryId: item.categoryId || germanNutra?.id || 27,
          country: item.country,
          addedById,
          previewLink: "https://example.com/preview/" + slug,
          trendLink: "https://trends.google.com/trends/explore?q=" + encodeURIComponent(item.name),
          remarks: "Target primary keyword in intro and comparison table.",
        },
      });
    }

    // Ensure pending article exists
    const existingArticle = await prisma.article.findFirst({
      where: { productId: product.id },
    });

    if (!existingArticle) {
      await prisma.article.create({
        data: {
          productId: product.id,
          status: "PENDING",
          priority: item.priority || "NORMAL",
          country: item.country,
        },
      });
    }

    // Add sample link logs if none exist for some products
    const existingLogs = await prisma.linkLog.findMany({
      where: { productId: product.id },
    });

    if (existingLogs.length === 0 && (item.name === "Cenforce-D" || item.name === "Neo Force" || item.name === "Reaslim")) {
      const linkLog = await prisma.linkLog.create({
        data: {
          productId: product.id,
          addedById,
          affiliateName: "BuyGoods",
          affiliateLink: "https://buygoods.com/aff?p=" + slug,
          buyLink: "https://buygoods.com/buy?p=" + slug,
          status: "ACCEPTED",
        },
      });

      await prisma.linkGeo.create({
        data: {
          linkLogId: linkLog.id,
          geo: item.country || "US",
        },
      });
    }
  }

  console.log("Successfully prepared available products and pending articles!");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
