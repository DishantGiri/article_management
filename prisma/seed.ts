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
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // ── Users ─────────────────────────────────────────────────────────────
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@articlemgmt.com" },
    update: {},
    create: { name: "Super Admin", email: "superadmin@articlemgmt.com", password: "superadmin123", role: "SUPER_ADMIN" },
  });
  const admin = await prisma.user.upsert({
    where: { email: "admin@articlemgmt.com" },
    update: {},
    create: { name: "Admin User", email: "admin@articlemgmt.com", password: "admin123", role: "ADMIN" },
  });
  const linker = await prisma.user.upsert({
    where: { email: "linker@articlemgmt.com" },
    update: {},
    create: { name: "John Linker", email: "linker@articlemgmt.com", password: "linker123", role: "LINKER" },
  });
  const writer = await prisma.user.upsert({
    where: { email: "writer@articlemgmt.com" },
    update: {},
    create: { name: "Jane Writer", email: "writer@articlemgmt.com", password: "writer123", role: "WRITER" },
  });
  const teamLead = await prisma.user.upsert({
    where: { email: "lead@articlemgmt.com" },
    update: {},
    create: { name: "Team Lead", email: "lead@articlemgmt.com", password: "lead123", role: "TEAM_LEAD" },
  });

  // ── Sites ─────────────────────────────────────────────────────────────
  const nutraSite = await prisma.site.create({
    data: { name: "NutraVital", url: "https://nutravital.com" },
  });

  const ecomSite = await prisma.site.create({
    data: { name: "EcomStore", url: "https://ecomstore.com" },
  });

  // ── Categories ────────────────────────────────────────────────────────
  const nutraCategories = ["Protein", "Vitamins", "Pre-Workout", "Weight Loss", "Recovery", "Omega & Fish Oil"];
  for (const name of nutraCategories) {
    await prisma.category.upsert({
      where: { name },
      update: { sites: { connect: { id: nutraSite.id } } },
      create: { name, sites: { connect: { id: nutraSite.id } } },
    });
  }
  const ecomCategories = ["Electronics", "Clothing", "Home & Garden", "Sports", "Beauty", "Books"];
  for (const name of ecomCategories) {
    await prisma.category.upsert({
      where: { name },
      update: { sites: { connect: { id: ecomSite.id } } },
      create: { name, sites: { connect: { id: ecomSite.id } } },
    });
  }

  // ── Site Access for Writer ─────────────────────────────────────────────
  await prisma.siteAccess.upsert({
    where: { userId_siteId: { userId: writer.id, siteId: nutraSite.id } },
    update: {},
    create: { userId: writer.id, siteId: nutraSite.id },
  });
  await prisma.siteAccess.upsert({
    where: { userId_siteId: { userId: writer.id, siteId: ecomSite.id } },
    update: {},
    create: { userId: writer.id, siteId: ecomSite.id },
  });

  console.log("✅ Seed complete!");
  console.log(`   SuperAdmin (ID ${superAdmin.id}): superadmin@articlemgmt.com`);
  console.log(`   Admin    (ID ${admin.id}): admin@articlemgmt.com`);
  console.log(`   Linker   (ID ${linker.id}): linker@articlemgmt.com`);
  console.log(`   Writer   (ID ${writer.id}): writer@articlemgmt.com`);
  console.log(`   TeamLead (ID ${teamLead.id}): lead@articlemgmt.com`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
