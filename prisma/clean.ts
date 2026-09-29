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

async function clean() {
  console.log("🧹 Wiping all records from the database...");

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

  console.log("✅ Database has been completely cleaned and emptied!");
}

clean()
  .catch((err) => {
    console.error("❌ Failed to clean database:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
