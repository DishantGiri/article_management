/* eslint-disable @typescript-eslint/no-explicit-any */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { delByPattern } from "../src/lib/redis";

async function clean() {
  console.log("🧹 Wiping all records from the database...");

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

  await Promise.all([
    delByPattern("users:*"),
    delByPattern("dashboard:*"),
    delByPattern("commissions:*"),
    delByPattern("articles:*"),
    delByPattern("products:*"),
  ]).catch(() => {});

  console.log("✅ Database has been completely cleaned and emptied!");
}

clean()
  .catch((err) => {
    console.error("❌ Failed to clean database:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
