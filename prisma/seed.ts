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

const generateSlug = (productName: string) => {
  return productName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
};

async function main() {
  console.log("🌱 Clean seeding database with custom values and programmatically generated products...");

  // Clear existing data in reverse order of dependencies to avoid foreign key violations
  await prisma.notification.deleteMany({});
  await prisma.specialApproval.deleteMany({});
  await prisma.articleReview.deleteMany({});
  await prisma.linkGeo.deleteMany({});
  await prisma.linkLog.deleteMany({});
  await prisma.article.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.siteAccess.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.site.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.geo.deleteMany({});
  await prisma.affiliateName.deleteMany({});

  // 0. Seed basic Affiliates and GEOs
  console.log("Creating Affiliates and GEOs...");
  const geoUS = await prisma.geo.create({ data: { code: "US" } });
  const geoUK = await prisma.geo.create({ data: { code: "UK" } });
  const geoCA = await prisma.geo.create({ data: { code: "CA" } });
  const geoDE = await prisma.geo.create({ data: { code: "DE" } });
  const geoFR = await prisma.geo.create({ data: { code: "FR" } });
  const geoGlobal = await prisma.geo.create({ data: { code: "GLOBAL" } });

  await prisma.affiliateName.create({ data: { name: "Amazon Associates" } });
  await prisma.affiliateName.create({ data: { name: "ShareASale" } });
  await prisma.affiliateName.create({ data: { name: "Admitad" } });
  await prisma.affiliateName.create({ data: { name: "ClickBank" } });
  await prisma.affiliateName.create({ data: { name: "CJ Affiliate" } });

  // 1. Core Users (Super Admin & Admin)
  console.log("Creating Admin Users...");
  const superAdmin = await prisma.user.create({
    data: { name: "Super Admin", email: "superadmin@articlemgmt.com", role: "SUPER_ADMIN", approved: true },
  });
  const admin = await prisma.user.create({
    data: { name: "Admin User", email: "admin@articlemgmt.com", role: "ADMIN", approved: true },
  });
  const extraAdmin = await prisma.user.create({
    data: { name: "Shiridhar", email: "shiridhar@fishtailinfosolutions.com", role: "ADMIN", approved: true },
  });

  // 2. Team Leads
  console.log("Creating Team Leads...");
  const leadSujata = await prisma.user.create({
    data: { name: "Sujata", email: "sujata@fishtailinfosolutions.com", role: "TEAM_LEAD", approved: true },
  });
  const leadSabina = await prisma.user.create({
    data: { name: "Sabina", email: "sabina@fishtailinfosolutions.com", role: "TEAM_LEAD", approved: true },
  });

  // 3. Linkers
  console.log("Creating Linkers...");
  const linkerAnjali = await prisma.user.create({
    data: { name: "Anjali", email: "anjali@fishtailinfosolutions.com", role: "LINKER", approved: true },
  });
  const linkerMuna = await prisma.user.create({
    data: { name: "Muna", email: "muna@fishtailinfosolutions.com", role: "LINKER", approved: true },
  });
  const linkerSamiksya = await prisma.user.create({
    data: { name: "Samiksya", email: "samikshya@fishtailinfosolutions.com", role: "LINKER", approved: true },
  });

  const linkers = [linkerAnjali, linkerMuna, linkerSamiksya];

  // 4. Writers (Associated with their respective Team Leads)
  console.log("Creating Writers...");
  const writerNirajan = await prisma.user.create({
    data: { name: "Nirajan", email: "nirajan@fishtailinfosolutions.com", role: "WRITER", teamLeadId: leadSujata.id, approved: true },
  });
  const writerIshika = await prisma.user.create({
    data: { name: "Ishika", email: "ishika@fishtailinfosolutions.com", role: "WRITER", teamLeadId: leadSujata.id, approved: true },
  });
  const writerParash = await prisma.user.create({
    data: { name: "Parash", email: "parash@fishtailinfosolutions.com", role: "WRITER", teamLeadId: leadSujata.id, approved: true },
  });
  const writerDipesh = await prisma.user.create({
    data: { name: "Dipesh", email: "dipesh@fishtailinfosolutions.com", role: "WRITER", teamLeadId: leadSujata.id, approved: true },
  });

  const writerSamir = await prisma.user.create({
    data: { name: "Samir", email: "samir@fishtailinfosolutions.com", role: "WRITER", teamLeadId: leadSabina.id, approved: true },
  });
  const writerSayal = await prisma.user.create({
    data: { name: "Sayal", email: "sayal@fishtailinfosolutions.com", role: "WRITER", teamLeadId: leadSabina.id, approved: true },
  });
  const writerSagar = await prisma.user.create({
    data: { name: "Sagar", email: "sagar@fishtailinfosolutions.com", role: "WRITER", teamLeadId: leadSabina.id, approved: true },
  });
  const writerManish = await prisma.user.create({
    data: { name: "Manish", email: "manish@fishtailinfosolutions.com", role: "WRITER", teamLeadId: leadSabina.id, approved: true },
  });
  const writerPrashant = await prisma.user.create({
    data: { name: "Prashant", email: "prashant@fishtailinfosolutions.com", role: "WRITER", teamLeadId: leadSabina.id, approved: true },
  });
  const writerPosa = await prisma.user.create({
    data: { name: "Posa", email: "posa@fishtailinfosolutions.com", role: "WRITER", teamLeadId: leadSabina.id, approved: true },
  });
  const writerShrisha = await prisma.user.create({
    data: { name: "Shrisha", email: "shrisha@fishtailinfosolutions.com", role: "WRITER", teamLeadId: leadSabina.id, approved: true },
  });
  const writerNirjala = await prisma.user.create({
    data: { name: "Nirjala", email: "nirjala@fishtailinfosolutions.com", role: "WRITER", teamLeadId: leadSabina.id, approved: true },
  });

  // 5. Sites
  console.log("Creating Sites...");
  const siteTBR = await prisma.site.create({
    data: { name: "TBR", url: "https://www.thebuyersreviews.com/" },
  });
  const siteST = await prisma.site.create({
    data: { name: "ST", url: "https://supplementtiger.com/" },
  });
  const siteSP = await prisma.site.create({
    data: { name: "SP", url: "https://supplementsandpowders.com/" },
  });
  const siteSD = await prisma.site.create({
    data: { name: "SD", url: "https://www.supplementdolphin.com/" },
  });
  const siteDHS = await prisma.site.create({
    data: { name: "DHS", url: "https://www.dailyhealthsupplement.com/" },
  });
  const siteMag = await prisma.site.create({
    data: { name: "Mag", url: "https://www.supplementmag.com/" },
  });
  const siteSV = await prisma.site.create({
    data: { name: "SV", url: "https://supplementvibes.com/" },
  });
  const siteBHFR = await prisma.site.create({
    data: { name: "BHFR", url: "https://www.beautyhealthfitnessremedies.com/" },
  });
  const siteGRC = await prisma.site.create({
    data: { name: "GRC", url: "https://www.gurureviewclub.com/" },
  });

  const allSites = [siteTBR, siteST, siteSP, siteSD, siteDHS, siteMag, siteSV, siteBHFR, siteGRC];

  // 6. Site Access Setup
  console.log("Setting up Site Access...");
  // Linkers and Team Leads have access to all sites
  const allUsersWithAccessToAll = [superAdmin, admin, extraAdmin, leadSujata, leadSabina, linkerAnjali, linkerMuna, linkerSamiksya];
  for (const u of allUsersWithAccessToAll) {
    for (const s of allSites) {
      await prisma.siteAccess.create({ data: { userId: u.id, siteId: s.id } });
    }
  }

  // Writers have specific site access:
  const writerAccessSpecs = [
    { writer: writerNirajan, site: siteTBR },
    { writer: writerIshika, site: siteTBR },
    { writer: writerParash, site: siteST },
    { writer: writerDipesh, site: siteSP },
    { writer: writerSamir, site: siteSD },
    { writer: writerSayal, site: siteDHS },
    { writer: writerSagar, site: siteDHS },
    { writer: writerManish, site: siteMag },
    { writer: writerPrashant, site: siteSP },
    { writer: writerPosa, site: siteSV },
    { writer: writerShrisha, site: siteBHFR },
    { writer: writerNirjala, site: siteGRC },
  ];

  for (const spec of writerAccessSpecs) {
    await prisma.siteAccess.create({ data: { userId: spec.writer.id, siteId: spec.site.id } });
  }

  // 7. Categories
  console.log("Creating Categories...");
  const catSupplements = await prisma.category.create({
    data: { name: "Supplements", sites: { connect: allSites.map(s => ({ id: s.id })) } },
  });
  const catSkincare = await prisma.category.create({
    data: { name: "Skincare", sites: { connect: [siteBHFR, siteGRC].map(s => ({ id: s.id })) } },
  });

  // 8. Programmatic Product & Article Generation (10 per writer)
  console.log("Creating Programmatic Products and Articles (10 per writer)...");
  const writerSiteSpecs = [
    { writer: writerNirajan, site: siteTBR, prefix: "TBR Supplement" },
    { writer: writerIshika, site: siteTBR, prefix: "TBR Skincare" },
    { writer: writerParash, site: siteST, prefix: "ST Tiger Whey" },
    { writer: writerDipesh, site: siteSP, prefix: "SP Powder Amino" },
    { writer: writerSamir, site: siteSD, prefix: "SD Dolphin Fit" },
    { writer: writerSayal, site: siteDHS, prefix: "DHS Daily Vit" },
    { writer: writerSagar, site: siteDHS, prefix: "DHS Health Herb" },
    { writer: writerManish, site: siteMag, prefix: "Mag Supplement" },
    { writer: writerPrashant, site: siteSP, prefix: "SP Mass Gainer" },
    { writer: writerPosa, site: siteSV, prefix: "SV Vibes Boost" },
    { writer: writerShrisha, site: siteBHFR, prefix: "BHFR Remedies" },
    { writer: writerNirjala, site: siteGRC, prefix: "GRC Review Item" },
  ];

  for (const spec of writerSiteSpecs) {
    for (let i = 1; i <= 10; i++) {
      const linker = linkers[(spec.writer.id + i) % linkers.length];
      const prodName = `${spec.prefix} ${i}`;

      const p = await prisma.product.create({
        data: {
          name: prodName,
          siteId: spec.site.id,
          categoryId: catSupplements.id,
          trendLink: "https://trends.google.com",
          previewLink: "https://amazon.com",
          remarks: `Seeded product ${prodName} for ${spec.writer.name}`,
          addedById: linker.id,
        }
      });

      // Distribute statuses:
      // i = 1, 2, 3 -> APPROVED
      // i = 4, 5, 6 -> COMPLETED
      // i = 7, 8 -> REDO
      // i = 9, 10 -> IN_PROGRESS
      let status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "APPROVED" | "REDO" = "IN_PROGRESS";
      let articleLink: string | null = null;
      let completedAt: Date | null = null;
      let writingTimeMin: number | null = null;

      if (i <= 3) {
        status = "APPROVED";
        articleLink = `https://docs.google.com/document/d/mock-${spec.writer.name.toLowerCase()}-${i}`;
        completedAt = new Date(Date.now() - 3600 * 1000 * 24 * i); // i days ago
        writingTimeMin = 90 + i * 10;
      } else if (i <= 6) {
        status = "COMPLETED";
        articleLink = `https://docs.google.com/document/d/mock-${spec.writer.name.toLowerCase()}-${i}`;
        completedAt = new Date(Date.now() - 3600 * 1000 * i); // i hours ago
        writingTimeMin = 80 + i * 10;
      } else if (i <= 8) {
        status = "REDO";
      }

      const startedAt = new Date(Date.now() - 3600 * 1000 * 48); // 2 days ago

      const art = await prisma.article.create({
        data: {
          productId: p.id,
          writerId: spec.writer.id,
          status: status as any,
          articleLink,
          startedAt: status === "REDO" ? null : startedAt,
          completedAt,
          writingTimeMin,
          priority: i % 3 === 0 ? "HIGH" : i % 3 === 1 ? "MEDIUM" : "LOW",
        }
      });

      // For REDO status, add a review
      if (status === "REDO") {
        await prisma.articleReview.create({
          data: {
            articleId: art.id,
            reviewedById: spec.writer.teamLeadId || leadSujata.id,
            suggestion: `Please improve formatting and readability for product ${prodName}.`,
            approved: false,
          }
        });
      }

      // Add a link log for completed/approved articles to make them realistic
      if (status === "COMPLETED" || status === "APPROVED") {
        const lLog = await prisma.linkLog.create({
          data: {
            productId: p.id,
            addedById: linker.id,
            bridgePageLink: `${spec.site.url}best-guides/${generateSlug(prodName)}`,
            buyLink: "https://amazon.com/dp/B07G222543",
            affiliateName: "Amazon Associates",
            affiliateLink: "https://amzn.to/mockaff",
            status: "ACCEPTED",
            linkerRemarks: `Link log for ${prodName} configured.`,
          }
        });

        // Add Geos
        await prisma.linkGeo.create({ data: { linkLogId: lLog.id, geo: "US" } });
        if (i % 2 === 0) {
          await prisma.linkGeo.create({ data: { linkLogId: lLog.id, geo: "CA" } });
        }
      }
    }
  }

  // 9. Notifications
  console.log("Creating Notifications...");
  // Writer Nirajan
  await prisma.notification.create({
    data: {
      recipientId: writerNirajan.id,
      senderId: linkerAnjali.id,
      type: "PRODUCT_ADDED",
      message: `New product "TBR Supplement 1" has been added to site "TBR".`,
      isRead: false,
    },
  });
  await prisma.notification.create({
    data: {
      recipientId: writerNirajan.id,
      senderId: leadSujata.id,
      type: "ARTICLE_SUGGESTION",
      message: `Team Lead suggested improvements on article for "TBR Supplement 7".`,
      isRead: false,
    },
  });

  // Writer Ishika
  await prisma.notification.create({
    data: {
      recipientId: writerIshika.id,
      senderId: linkerAnjali.id,
      type: "PRODUCT_ADDED",
      message: `New product "TBR Skincare 1" has been added to site "TBR".`,
      isRead: false,
    },
  });

  // Team Lead Sujata
  await prisma.notification.create({
    data: {
      recipientId: leadSujata.id,
      senderId: writerNirajan.id,
      type: "APPROVAL_GRANTED",
      message: `Writer Nirajan submitted completed article for "TBR Supplement 4".`,
      isRead: false,
    },
  });

  // Linker Anjali
  await prisma.notification.create({
    data: {
      recipientId: linkerAnjali.id,
      senderId: leadSujata.id,
      type: "LINK_ISSUE",
      message: `Dead affiliate link detected on "TBR Supplement 4". Please verify seller link.`,
      isRead: false,
    },
  });

  console.log("✅ Custom Seed complete!");
  console.log(`   Shiridhar:   shiridhar@fishtailinfosolutions.com`);
  console.log(`   SuperAdmin:  superadmin@articlemgmt.com`);
  console.log(`   Admin:       admin@articlemgmt.com`);
  console.log(`   Team Lead Sujata: sujata@fishtailinfosolutions.com`);
  console.log(`   Team Lead Sabina: sabina@fishtailinfosolutions.com`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
