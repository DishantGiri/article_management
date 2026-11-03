import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
// Trigger dev cache refresh for schema change

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  port: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT) : 3306,
  connectionLimit: 5,
  allowPublicKeyRetrieval: true,
});

// Prevent multiple instances in Next.js dev (hot-reload)
const globalForPrisma = globalThis as unknown as { prisma_v23: PrismaClient };

// Invalidate cached client if systemSetting delegate is missing
if (globalForPrisma.prisma_v23 && !(globalForPrisma.prisma_v23 as any).systemSetting) {
  delete (globalForPrisma as any).prisma_v23;
}

export const prisma =
  globalForPrisma.prisma_v23 ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma_v23 = prisma;


