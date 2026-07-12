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
  console.log("🌱 Clean seeding database...");

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

  // 1. Users
  console.log("Creating Users...");
  const superAdmin = await prisma.user.create({
    data: { id: 5, name: "Super Admin", email: "superadmin@articlemgmt.com", password: "superadmin123", role: "SUPER_ADMIN", approved: true },
  });
  const admin = await prisma.user.create({
    data: { id: 1, name: "Admin User", email: "admin@articlemgmt.com", password: "admin123", role: "ADMIN", approved: true },
  });
  const linker = await prisma.user.create({
    data: { id: 2, name: "John Linker", email: "linker@articlemgmt.com", password: "linker123", role: "LINKER", approved: true },
  });
  const teamLead = await prisma.user.create({
    data: { id: 4, name: "Team Lead", email: "lead@articlemgmt.com", password: "lead123", role: "TEAM_LEAD", approved: true },
  });
  const writer = await prisma.user.create({
    data: { id: 3, name: "Jane Writer", email: "writer@articlemgmt.com", password: "writer123", role: "WRITER", teamLeadId: 4, approved: true },
  });

  // 2. Sites
  console.log("Creating Sites...");
  const site1 = await prisma.site.create({
    data: { name: "NutraVital", url: "https://nutravital.com" },
  });
  const site2 = await prisma.site.create({
    data: { name: "EcomStore", url: "https://ecomstore.com" },
  });
  const site3 = await prisma.site.create({
    data: { name: "TechGadgets", url: "https://techgadgets.com" },
  });

  // 3. Site Access
  console.log("Creating Site Access...");
  await prisma.siteAccess.create({ data: { userId: writer.id, siteId: site1.id } });
  await prisma.siteAccess.create({ data: { userId: writer.id, siteId: site2.id } });
  await prisma.siteAccess.create({ data: { userId: writer.id, siteId: site3.id } });

  // 4. Categories
  console.log("Creating Categories...");
  const catProtein = await prisma.category.create({
    data: { name: "Protein", sites: { connect: [{ id: site1.id }] } },
  });
  const catVitamins = await prisma.category.create({
    data: { name: "Vitamins", sites: { connect: [{ id: site1.id }] } },
  });
  const catElectronics = await prisma.category.create({
    data: { name: "Electronics", sites: { connect: [{ id: site2.id }, { id: site3.id }] } },
  });
  const catBeauty = await prisma.category.create({
    data: { name: "Beauty", sites: { connect: [{ id: site2.id }] } },
  });

  // 5. Products
  console.log("Creating Products...");
  const p1 = await prisma.product.create({
    data: {
      name: "Gold Standard Whey",
      siteId: site1.id,
      categoryId: catProtein.id,
      trendLink: "https://trends.google.com",
      previewLink: "https://amazon.com/whey",
      remarks: "High demand product for bodybuilders.",
      addedById: linker.id,
    },
  });

  const p2 = await prisma.product.create({
    data: {
      name: "Organic Vitamin D3",
      siteId: site1.id,
      categoryId: catVitamins.id,
      trendLink: "https://trends.google.com",
      previewLink: "https://amazon.com/vitamins",
      remarks: "Good search volume during winter.",
      addedById: linker.id,
    },
  });

  const p3 = await prisma.product.create({
    data: {
      name: "Wireless Charging Pad",
      siteId: site3.id,
      categoryId: catElectronics.id,
      trendLink: "https://trends.google.com",
      previewLink: "https://amazon.com/charger",
      remarks: "Fast charging, sleek design.",
      addedById: admin.id,
    },
  });

  const p4 = await prisma.product.create({
    data: {
      name: "Hydrating Facial Serum",
      siteId: site2.id,
      categoryId: catBeauty.id,
      trendLink: "https://trends.google.com",
      previewLink: "https://amazon.com/serum",
      remarks: "Top selling skincare item.",
      addedById: linker.id,
    },
  });

  const p5 = await prisma.product.create({
    data: {
      name: "Ergonomic Mechanical Keyboard",
      siteId: site3.id,
      categoryId: catElectronics.id,
      trendLink: "https://trends.google.com",
      previewLink: "https://amazon.com/keyboard",
      remarks: "Popular gaming keyboard with cherry switches.",
      addedById: linker.id,
    },
  });

  // 6. Articles
  console.log("Creating Articles...");
  // P1: Completed Article
  const art1 = await prisma.article.create({
    data: {
      productId: p1.id,
      writerId: writer.id,
      status: "COMPLETED",
      articleLink: "https://docs.google.com/document/d/1",
      startedAt: new Date(Date.now() - 3600 * 1000 * 3), // 3 hours ago
      completedAt: new Date(Date.now() - 3600 * 1000 * 1), // 1 hour ago
      writingTimeMin: 120,
      priority: "HIGH",
    },
  });

  // P2: In Progress Article
  const art2 = await prisma.article.create({
    data: {
      productId: p2.id,
      writerId: writer.id,
      status: "IN_PROGRESS",
      startedAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
      priority: "MEDIUM",
    },
  });

  // P3: Pending Article (not assigned yet)
  const art3 = await prisma.article.create({
    data: {
      productId: p3.id,
      status: "PENDING",
      priority: "LOW",
    },
  });

  // P4: Completed Special Approval Article
  const art4 = await prisma.article.create({
    data: {
      productId: p4.id,
      writerId: writer.id,
      status: "COMPLETED",
      startedAt: new Date(Date.now() - 3600 * 1000 * 5),
      completedAt: new Date(Date.now() - 3600 * 1000 * 4),
      writingTimeMin: 60,
      priority: "MEDIUM",
      specialApprovalRequested: true,
      specialApprovalRequestReason: "No suitable public doc link available for this brand.",
    },
  });

  // P5: Completed Article with revisions suggestion
  const art5 = await prisma.article.create({
    data: {
      productId: p5.id,
      writerId: writer.id,
      status: "IN_PROGRESS",
      startedAt: new Date(Date.now() - 3600 * 1000 * 10),
      priority: "HIGH",
    },
  });

  // 7. Article Reviews
  console.log("Creating Article Reviews...");
  await prisma.articleReview.create({
    data: {
      articleId: art1.id,
      reviewedById: teamLead.id,
      suggestion: "Great article structure, nice keyword density.",
      approved: true,
    },
  });

  await prisma.articleReview.create({
    data: {
      articleId: art5.id,
      reviewedById: teamLead.id,
      suggestion: "Please optimize key terms and add more details to the intro section.",
      approved: false,
    },
  });

  // 8. Special Approvals
  console.log("Creating Special Approvals...");
  await prisma.specialApproval.create({
    data: {
      articleId: art4.id,
      approvedById: teamLead.id,
      writerName: writer.name,
      productName: p4.name,
      reason: "Writer has submitted proof via Slack. Approved.",
    },
  });

  // 9. Link Logs
  console.log("Creating Link Logs...");
  // Link for Product 1 (Whey)
  const l1 = await prisma.linkLog.create({
    data: {
      productId: p1.id,
      addedById: linker.id,
      bridgePageLink: "https://nutravital.com/best-whey-protein",
      buyLink: "https://amazon.com/gp/product/B000GIPJSA",
      affiliateName: "Amazon Associates",
      affiliateLink: "https://amzn.to/bestwhey",
      status: "ACCEPTED",
      linkerRemarks: "Inserted to main whey article.",
    },
  });

  // Link for Product 3 (Charging Pad)
  const l2 = await prisma.linkLog.create({
    data: {
      productId: p3.id,
      addedById: linker.id,
      bridgePageLink: "https://techgadgets.com/top-chargers",
      buyLink: "https://amazon.com/gp/product/B07G222543",
      affiliateName: "ShareASale",
      affiliateLink: "https://shareasale.com/r?u=123&m=456",
      status: "REDIRECTED",
      linkerRemarks: "Setup custom redirect page.",
    },
  });

  // Link for Product 4 (Serum) with dead/issue status
  const l3 = await prisma.linkLog.create({
    data: {
      productId: p4.id,
      addedById: linker.id,
      bridgePageLink: "https://ecomstore.com/best-serums",
      buyLink: "https://broken-seller-link.com/out-of-stock",
      affiliateName: "Admitad",
      affiliateLink: "https://admitad.com/g/123",
      status: "ISSUE",
      linkerRemarks: "Seller link page is down, shows 404.",
    },
  });

  // 10. Link Geos
  console.log("Creating Link Geos...");
  await prisma.linkGeo.create({ data: { linkLogId: l1.id, geo: "US" } });
  await prisma.linkGeo.create({ data: { linkLogId: l1.id, geo: "CA" } });
  await prisma.linkGeo.create({ data: { linkLogId: l1.id, geo: "UK" } });
  await prisma.linkGeo.create({ data: { linkLogId: l2.id, geo: "US" } });
  await prisma.linkGeo.create({ data: { linkLogId: l3.id, geo: "GLOBAL" } });

  // 11. Notifications
  console.log("Creating Notifications...");
  await prisma.notification.create({
    data: {
      recipientId: writer.id,
      senderId: linker.id,
      type: "PRODUCT_ADDED",
      message: `New product "Gold Standard Whey" has been added to site "NutraVital".`,
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      recipientId: writer.id,
      senderId: teamLead.id,
      type: "ARTICLE_SUGGESTION",
      message: `Team Lead suggested improvements on article for "Ergonomic Mechanical Keyboard".`,
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      recipientId: linker.id,
      senderId: admin.id,
      type: "LINK_ISSUE",
      message: `Dead affiliate link detected on "Hydrating Facial Serum". Please verify seller link.`,
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      recipientId: writer.id,
      senderId: teamLead.id,
      type: "APPROVAL_GRANTED",
      message: `Special approval granted for "Hydrating Facial Serum" without documentation link.`,
      isRead: true,
    },
  });

  console.log("✅ Seed complete!");
  console.log(`   SuperAdmin: superadmin@articlemgmt.com`);
  console.log(`   Admin:      admin@articlemgmt.com`);
  console.log(`   Linker:     linker@articlemgmt.com`);
  console.log(`   Writer:     writer@articlemgmt.com`);
  console.log(`   TeamLead:   lead@articlemgmt.com`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
