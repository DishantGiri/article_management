/* eslint-disable @typescript-eslint/no-explicit-any */
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST || "localhost",
  user: process.env.DATABASE_USER || "root",
  password: process.env.DATABASE_PASSWORD || "",
  database: process.env.DATABASE_NAME || "article_mg",
  port: parseInt(process.env.DATABASE_PORT || "3306"),
  connectionLimit: 5,
  allowPublicKeyRetrieval: true,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Cleaning database and running fresh seed...");

  // 1. Clear existing data in reverse dependency order
  await prisma.noticeAcknowledgment.deleteMany({}).catch(() => {});
  await prisma.notice.deleteMany({}).catch(() => {});
  await prisma.notification.deleteMany({}).catch(() => {});
  await prisma.specialApproval.deleteMany({}).catch(() => {});
  await prisma.articleReview.deleteMany({}).catch(() => {});
  await prisma.linkGeo.deleteMany({}).catch(() => {});
  await prisma.linkLog.deleteMany({}).catch(() => {});
  await prisma.article.deleteMany({}).catch(() => {});
  await prisma.product.deleteMany({}).catch(() => {});
  await prisma.siteAccess.deleteMany({}).catch(() => {});
  await prisma.commissionSale.deleteMany({}).catch(() => {});
  await prisma.commissionSetting.deleteMany({}).catch(() => {});
  await prisma.category.deleteMany({}).catch(() => {});
  await prisma.site.deleteMany({}).catch(() => {});
  await prisma.user.deleteMany({}).catch(() => {});
  await prisma.geo.deleteMany({}).catch(() => {});
  await prisma.affiliateName.deleteMany({}).catch(() => {});
  await prisma.productCategory.deleteMany({}).catch(() => {});

  console.log("Cleared existing database records.");

  // 2. Seed GEOs
  console.log("Creating Affiliates and GEOs...");
  const geoUS = await prisma.geo.create({ data: { code: "US" } });
  const geoUK = await prisma.geo.create({ data: { code: "UK" } });
  const geoCA = await prisma.geo.create({ data: { code: "CA" } });
  const geoDE = await prisma.geo.create({ data: { code: "DE" } });
  const geoFR = await prisma.geo.create({ data: { code: "FR" } });
  const geoGlobal = await prisma.geo.create({ data: { code: "GLOBAL" } });

  // 3. Seed Affiliates
  console.log("Creating Affiliates...");
  const affiliateNames = [
    "BuyGoods",
    "SmashLoud",
    "SmartADV",
    "ClicksHunt",
    "MediaScalers",
    "Amazon Associates",
    "SpyRevenue",
    "ClickBank",
    "ClicksADV",
    "DynuinMedia",
    "Terraleads",
    "TrafficLight",
    "Adcombo",
    "Giddy Up",
    "inb",
    "kissmyads",
    "Leadbit",
    "Maxweb",
    "mylead",
    "Sell Health",
    "smart adv rajan",
    "BlitzAds",
    "Meta Cpa",
  ];

  for (const name of affiliateNames) {
    await prisma.affiliateName.create({
      data: { name: name.trim() },
    });
  }
  console.log(`Created ${affiliateNames.length} affiliates.`);

  // 4. Seed Sites
  console.log("Creating Sites...");
  const siteDefinitions = [
    { name: "Health Supplement Bucket", url: "https://healthsupplementbucket.com" },
    { name: "Supplements and Powders", url: "https://supplementsandpowders.com" },
    { name: "Justin Reviews", url: "https://justinreviews.org" },
    { name: "Guru Review Club", url: "https://gurureviewclub.com" },
    { name: "Ryans Best Reviews", url: "https://ryansbestreviews.com" },
    { name: "The Buyers Reviews", url: "https://thebuyersreviews.com" },
    { name: "Supplement Vibes", url: "https://supplementvibes.com" },
    { name: "Supplement Dolphin", url: "https://supplementdolphin.com" },
    { name: "Supplement Tiger", url: "https://supplementtiger.com" },
    { name: "Supplement Mag", url: "https://supplementmag.com" },
    { name: "Supplement Coach", url: "https://supplementcoach.de" },
    { name: "Daily Health Supplement", url: "https://dailyhealthsupplement.com" },
  ];

  const createdSites = [];
  for (const s of siteDefinitions) {
    const site = await prisma.site.create({
      data: {
        name: s.name,
        url: s.url,
      },
    });
    createdSites.push(site);
  }
  console.log(`Created ${createdSites.length} sites.`);

  // 5. Seed Core Categories connected to all sites
  console.log("Creating Categories & Product Categories...");
  const categoryNames = ["Supplements", "Skincare", "Ecom", "Health & Wellness"];
  for (const catName of categoryNames) {
    await prisma.category.create({
      data: {
        name: catName,
        sites: { connect: createdSites.map((s) => ({ id: s.id })) },
      },
    });
    await prisma.productCategory.create({
      data: { name: catName },
    });
  }

  // 6. Seed Users (Super Admin and 1 User)
  console.log("Creating Super Admin and User...");
  const superAdmin = await prisma.user.create({
    data: {
      name: "Super Admin",
      email: "superadmin@fishtailinfosolutions.com",
      role: "SUPER_ADMIN",
      approved: true,
      allowLinkLogAccess: true,
    },
  });

  // Secondary alias for Super Admin in case domain articlemgmt.com is used
  const superAdminAlias = await prisma.user.create({
    data: {
      name: "Super Admin (articlemgmt)",
      email: "superadmin@articlemgmt.com",
      role: "SUPER_ADMIN",
      approved: true,
      allowLinkLogAccess: true,
    },
  });

  const user = await prisma.user.create({
    data: {
      name: "User",
      email: "user@fishtailinfosolutions.com",
      role: "ADMIN",
      approved: true,
      allowLinkLogAccess: true,
    },
  });

  const allUsers = [superAdmin, superAdminAlias, user];

  // 7. Site Access: Assign all 12 sites with all permissions to the users
  console.log("Assigning Site Access to Super Admin and User...");
  for (const u of allUsers) {
    for (const s of createdSites) {
      await prisma.siteAccess.create({
        data: {
          userId: u.id,
          siteId: s.id,
          role: u.role || "ADMIN",
          roles: "SUPER_ADMIN,ADMIN,LINKER,WRITER,TEAM_LEAD,PRODUCT_RESEARCHER",
          canAddProduct: true,
          canAddLink: true,
          canWrite: true,
          canReview: true,
        },
      });
    }
  }

  console.log("✅ Seed completed successfully!");
  console.log("-----------------------------------------");
  console.log(`Created ${createdSites.length} Sites:`);
  siteDefinitions.forEach((s) => console.log(`   - ${s.name} (${s.url})`));
  console.log(`Created ${affiliateNames.length} Affiliates:`);
  affiliateNames.forEach((a) => console.log(`   - ${a}`));
  console.log("Created Users:");
  console.log(`   - Super Admin: superadmin@fishtailinfosolutions.com (or superadmin@articlemgmt.com)`);
  console.log(`   - User:        user@fishtailinfosolutions.com`);
  console.log("-----------------------------------------");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
