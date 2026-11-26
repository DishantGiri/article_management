/* eslint-disable @typescript-eslint/no-explicit-any */
import "dotenv/config";
import path from "path";
import fs from "fs";
import * as xlsx from "xlsx";
import { prisma } from "../src/lib/prisma";
import { delByPattern } from "../src/lib/redis";
import { CANONICAL_AFFILIATES } from "../src/lib/canonical-affiliates";

function normalizeKey(str: string): string {
  return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

const DEFAULT_COMMISSION_TIERS = [
  {
    category: "NUTRA",
    saleType: "FIRST_SALE",
    rateType: "FIXED",
    currency: "NPR",
    linker: 200,
    writer: 280,
    tl: 140,
    seo: 80,
    bonusPool: 120,
    partyFund: 0,
    total: 820,
    notes: "Commission distribution for new customer acquisitions & initial conversions",
  },
  {
    category: "NUTRA",
    saleType: "RESALE",
    rateType: "FIXED",
    currency: "NPR",
    linker: 100,
    writer: 140,
    tl: 70,
    seo: 40,
    bonusPool: 80,
    partyFund: 0,
    total: 430,
    notes: "Commission distribution for repeat purchases & recurring customer renewals",
  },
  {
    category: "ECOM",
    saleType: "FIRST_SALE",
    rateType: "FIXED",
    currency: "NPR",
    linker: 80,
    writer: 150,
    tl: 70,
    seo: 60,
    bonusPool: 80,
    partyFund: 0,
    total: 440,
    notes: "Commission distribution for new customer acquisitions & initial conversions",
  },
  {
    category: "ECOM",
    saleType: "RESALE",
    rateType: "FIXED",
    currency: "NPR",
    linker: 60,
    writer: 120,
    tl: 60,
    seo: 30,
    bonusPool: 50,
    partyFund: 0,
    total: 320,
    notes: "Commission distribution for repeat purchases & recurring customer renewals",
  },
];

async function main() {
  console.log("==========================================================");
  console.log("🌱 STARTING FULL DATABASE WIPE & SEED");
  console.log("==========================================================");

  // 1. Wipe all existing records in reverse foreign-key order
  console.log("🧹 Clearing all existing database records...");
  await prisma.noticeAcknowledgment.deleteMany({}).catch(() => {});
  await prisma.notice.deleteMany({}).catch(() => {});
  await prisma.notification.deleteMany({}).catch(() => {});
  await prisma.specialApproval.deleteMany({}).catch(() => {});
  await prisma.articleReview.deleteMany({}).catch(() => {});
  await prisma.linkGeo.deleteMany({}).catch(() => {});
  await prisma.linkHistory.deleteMany({}).catch(() => {});
  await prisma.linkLog.deleteMany({}).catch(() => {});
  await prisma.articleHistory.deleteMany({}).catch(() => {});
  await prisma.article.deleteMany({}).catch(() => {});
  await prisma.trendmapProduct.deleteMany({}).catch(() => {});
  await prisma.commissionSale.deleteMany({}).catch(() => {});
  await prisma.product.deleteMany({}).catch(() => {});
  await prisma.siteAccess.deleteMany({}).catch(() => {});
  await prisma.commissionSetting.deleteMany({}).catch(() => {});
  await prisma.category.deleteMany({}).catch(() => {});
  await prisma.site.deleteMany({}).catch(() => {});
  await prisma.user.deleteMany({}).catch(() => {});
  await prisma.geo.deleteMany({}).catch(() => {});
  await prisma.affiliateName.deleteMany({}).catch(() => {});
  await prisma.productCategory.deleteMany({}).catch(() => {});
  await prisma.systemSetting.deleteMany({}).catch(() => {});
  console.log("✅ Database emptied.");

  // 2. Seed GEOs
  console.log("🌍 Creating GEOs...");
  const geoCodes = ["US", "UK", "CA", "DE", "FR", "GLOBAL", "AU"];
  for (const code of geoCodes) {
    await prisma.geo.create({ data: { code } });
  }
  console.log(`Created ${geoCodes.length} GEOs.`);

  // 3. Seed Affiliates
  console.log("🤝 Creating Affiliates...");
  const affiliateNames = Array.from(new Set(CANONICAL_AFFILIATES));
  for (const name of affiliateNames) {
    await prisma.affiliateName.create({ data: { name: name.trim() } });
  }
  console.log(`Created ${affiliateNames.length} Affiliates.`);

  // 4. Seed all 17 Sites
  console.log("🌐 Creating Sites...");
  const siteDefinitions = [
    { name: "The Buyers Reviews", url: "https://thebuyersreviews.com", bridgeUrl: "https://bestproductpicks.com" },
    { name: "Supplement Mag", url: "https://supplementmag.com", bridgeUrl: "https://supplementexpose.com" },
    { name: "Guru Review Club", url: "https://gurureviewclub.com", bridgeUrl: "https://productcomparelab.com" },
    { name: "Daily Health Supplement", url: "https://dailyhealthsupplement.com", bridgeUrl: "https://getbestsupplement.com" },
    { name: "Supplement Tiger", url: "https://supplementtiger.com", bridgeUrl: "https://supplementdealshub.com" },
    { name: "Supplement Coach", url: "https://supplementcoach.de", bridgeUrl: "https://bestsupplementscoach.com" },
    { name: "Supplement Vibes", url: "https://supplementvibes.com", bridgeUrl: "https://trackyoursupplement.com" },
    { name: "Supplement Dolphin", url: "https://supplementdolphin.com", bridgeUrl: "https://supplementanlayst.com" },
    { name: "Ryans Best Reviews", url: "https://ryansbestreviews.com", bridgeUrl: null },
    { name: "Justin Reviews", url: "https://justinreviews.org", bridgeUrl: "https://theunbiasedreviews.org" },
    { name: "Health Supplement Bucket", url: "https://healthsupplementbucket.com", bridgeUrl: null },
    { name: "Supplements and Powders", url: "https://supplementsandpowders.com", bridgeUrl: null },
    { name: "Health Supplements Expert", url: "https://healthsupplementsexpert.com", bridgeUrl: "https://healthysupplementstalk.com" },
    { name: "Product Research", url: "https://product-research.internal", bridgeUrl: null },
    { name: "BeautyHealthFitnessRemedies", url: null, bridgeUrl: null },
    { name: "HealthSolutions Blog", url: null, bridgeUrl: null },
    { name: "HonestProductReview", url: null, bridgeUrl: null },
  ];

  const createdSites = [];
  const siteMap = new Map<string, any>();
  for (const s of siteDefinitions) {
    const site = await prisma.site.create({
      data: {
        name: s.name,
        url: s.url,
        bridgeUrl: s.bridgeUrl,
      },
    });
    createdSites.push(site);
    siteMap.set(normalizeKey(site.name), site);
  }
  // Common aliases
  const guruSite = siteMap.get("gurureviewclub");
  if (guruSite) {
    siteMap.set("gurureviewsclub", guruSite);
  }
  console.log(`Created ${createdSites.length} Sites.`);

  // 5. Seed Product Types (Categories) connected to all sites (only Ecom and Nutra)
  console.log("📂 Creating Product Types (Categories)...");
  const productTypes = ["Nutra", "Ecom"];
  for (const typeName of productTypes) {
    await prisma.category.create({
      data: {
        name: typeName,
        sites: { connect: createdSites.map((s) => ({ id: s.id })) },
      },
    });
  }
  console.log(`Created ${productTypes.length} Product Types.`);

  // 6. Seed Product Categories
  console.log("🏷️ Creating Product Categories...");
  const productCategoryNames = [
    "Anti Aging Products",
    "Anti Fungal Products",
    "Anxiety & Stress Relief",
    "Bladder Control",
    "Blood Health",
    "Blood Pressure",
    "Blood Sugar",
    "Bodybuilding",
    "Bone Health",
    "Brain Enhancement",
    "Breast Enhancement",
    "Cellular Health",
    "Colon Cleanser",
    "Dental Health",
    "Dietary Supplements",
    "Ear Health",
    "ED Support",
    "Eye Health",
    "Female Enhancement",
    "Female Health",
    "Focus & Alertness",
    "Foot Care",
    "General Health",
    "General Wellness",
    "Gut Health",
    "Gut Health Supplement",
    "Hair Growth",
    "Health",
    "Hearing Support",
    "Heart Health",
    "Hemorrhoid Pain Relief",
    "Immune Health",
    "Joint Pain Pills",
    "Joint Pain Relief",
    "Leg Health & Circulation",
    "Liver Health",
    "Lung & Respiratory Support",
    "Lung Health",
    "Lymphatic Health",
    "Male Enhancement",
    "Memory Enhancement",
    "Men's Health",
    "Menopause",
    "Miscellaneous",
    "Multivitamin Supplement",
    "Muscle Support",
    "Nail Care",
    "Nerve Health",
    "Oral Health",
    "Pain Relief",
    "Parasite & Gut Health",
    "Parasites Cleanse",
    "Probiotics",
    "Prostate",
    "Skin Brighteners",
    "Skin Care",
    "Sleep Aids",
    "Teeth Health Supplement",
    "Testosterone Booster",
    "Thyroid",
    "Thyroid Support",
    "Tinnitus",
    "Topical Joint",
    "Topical Male Enhancement",
    "Vision & Eye Care",
    "Weight Loss",
    "Weight Loss Shake",
    "Weight Loss Supplement",
  ];
  for (const catName of productCategoryNames) {
    await prisma.productCategory.create({ data: { name: catName } });
  }
  console.log(`Created ${productCategoryNames.length} Product Categories.`);

  // 7. Seed Commission Settings
  console.log("💰 Creating Commission Settings...");
  for (const tier of DEFAULT_COMMISSION_TIERS) {
    await prisma.commissionSetting.create({
      data: { ...tier },
    });
  }
  console.log(`Created ${DEFAULT_COMMISSION_TIERS.length} default commission settings.`);

  // 8. Seed Users from Excel file Merged_User_List_2026-11-24.xlsx
  console.log("👥 Seeding Users from Merged_User_List_2026-11-24.xlsx...");
  const excelPath = path.resolve(process.cwd(), "Merged_User_List_2026-11-24.xlsx");
  if (!fs.existsSync(excelPath)) {
    throw new Error(`Excel file not found at ${excelPath}`);
  }

  const workbook = xlsx.readFile(excelPath);
  const worksheet = workbook.Sheets["Merged User List"];
  if (!worksheet) {
    throw new Error("Worksheet 'Merged User List' not found in Excel workbook");
  }

  const rows: any[] = xlsx.utils.sheet_to_json(worksheet);
  console.log(`Read ${rows.length} rows from Excel sheet.`);

  let createdUsersCount = 0;
  let leftUsersCount = 0;
  let activeUsersCount = 0;
  let siteAccessCount = 0;
  let superAdminUser: any = null;

  for (const row of rows) {
    const rawName = (row.Name || "").toString().trim();
    const email = (row.Email || "").toString().trim().toLowerCase();
    const isLeft = (row["Already left the company"] || "").toString().trim().toLowerCase() === "yes";
    const dept = (row.Department || "").toString().trim();
    const sitesStr = (row.Sites || "").toString().trim();

    if (!email) {
      console.warn(`Skipping user without email: ${rawName}`);
      continue;
    }

    if (isLeft) leftUsersCount++;
    else activeUsersCount++;

    // Role assignment: Abishek Khadka is SUPER_ADMIN
    let role: "SUPER_ADMIN" | "ADMIN" | "LINKER" | "WRITER" | "TEAM_LEAD" | "PRODUCT_RESEARCHER" | "GUEST" = "GUEST";

    if (email === "abishekkhadka@fishtailinfosolutions.com") {
      role = "SUPER_ADMIN";
    } else if (dept === "Management") {
      role = "ADMIN";
    } else if (sitesStr || dept === "SEO") {
      role = "WRITER";
    } else {
      role = "GUEST";
    }

    const hasLeftCompany = isLeft;
    const approved = !isLeft;
    const commissionToPartyFund = isLeft;

    const user = await prisma.user.create({
      data: {
        name: rawName,
        email: email,
        role,
        approved,
        hasLeftCompany,
        commissionToPartyFund,
        allowLinkLogAccess: role === "SUPER_ADMIN" || role === "ADMIN",
      },
    });

    createdUsersCount++;
    if (role === "SUPER_ADMIN" && email === "abishekkhadka@fishtailinfosolutions.com") {
      superAdminUser = user;
    }

    // SiteAccess for users with sites assigned
    if (sitesStr) {
      const siteNames = sitesStr.split(",").map((s: string) => s.trim()).filter(Boolean);
      for (const sName of siteNames) {
        const matchedSite = siteMap.get(normalizeKey(sName));
        if (matchedSite) {
          const userSiteRole = role === "ADMIN" ? "ADMIN" : "WRITER";
          await prisma.siteAccess.create({
            data: {
              userId: user.id,
              siteId: matchedSite.id,
              role: userSiteRole,
              roles: userSiteRole,
              canWrite: true,
              canReview: false,
              canAddLink: false,
              canAddProduct: false,
            },
          });
          siteAccessCount++;
        }
      }
    }
  }

  // Also create secondary alias for Super Admin (articlemgmt domain)
  const superAdminAlias = await prisma.user.create({
    data: {
      name: "Super Admin (articlemgmt)",
      email: "abishekkhadka@articlemgmt.com",
      role: "SUPER_ADMIN",
      approved: true,
      hasLeftCompany: false,
      commissionToPartyFund: false,
      allowLinkLogAccess: true,
    },
  });

  // Assign Super Admin all 17 sites with full permissions
  const superAdmins = [superAdminUser, superAdminAlias].filter(Boolean);
  for (const sa of superAdmins) {
    for (const site of createdSites) {
      await prisma.siteAccess.upsert({
        where: {
          userId_siteId: {
            userId: sa.id,
            siteId: site.id,
          },
        },
        create: {
          userId: sa.id,
          siteId: site.id,
          role: "SUPER_ADMIN",
          roles: "SUPER_ADMIN,ADMIN,LINKER,WRITER,TEAM_LEAD,PRODUCT_RESEARCHER",
          canAddProduct: true,
          canAddLink: true,
          canWrite: true,
          canReview: true,
        },
        update: {
          role: "SUPER_ADMIN",
          roles: "SUPER_ADMIN,ADMIN,LINKER,WRITER,TEAM_LEAD,PRODUCT_RESEARCHER",
          canAddProduct: true,
          canAddLink: true,
          canWrite: true,
          canReview: true,
        },
      });
      siteAccessCount++;
    }
  }

  // 9. Flush redis caches
  await Promise.all([
    delByPattern("users:*"),
    delByPattern("dashboard:*"),
    delByPattern("commissions:*"),
    delByPattern("articles:*"),
    delByPattern("products:*"),
    delByPattern("sites:*"),
  ]).catch(() => {});

  console.log("==========================================================");
  console.log("✅ FULL SEED COMPLETED SUCCESSFULLY!");
  console.log("📊 Summary:");
  console.log(`   - Sites Created:           ${createdSites.length}`);
  console.log(`   - Affiliates Created:      ${affiliateNames.length}`);
  console.log(`   - Product Types Created:   ${productTypes.length}`);
  console.log(`   - Product Categories:      ${productCategoryNames.length}`);
  console.log(`   - Commission Tiers:        ${DEFAULT_COMMISSION_TIERS.length}`);
  console.log(`   - Total Users Seeded:      ${createdUsersCount + 1} (93 from Excel + 1 superadmin alias)`);
  console.log(`   - Super Admin:             abishekkhadka@fishtailinfosolutions.com (role: SUPER_ADMIN)`);
  console.log(`   - Active Users:            ${activeUsersCount + 1} (Approved: true, Left: false)`);
  console.log(`   - Departed Users:          ${leftUsersCount} (Approved: false, Left: true, PartyFund: true)`);
  console.log(`   - Site Access Records:     ${siteAccessCount}`);
  console.log("==========================================================");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("❌ Full seed failed:", err);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
