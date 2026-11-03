import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const SETTING_KEY = "COMMISSION_PASSWORD_CONFIG";

export interface CommissionPasswordConfig {
  hash: string;
  salt: string;
  enabled: boolean;
  updatedAt: string;
  updatedBy?: string | null;
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return { hash, salt };
}

export function verifyPasswordHash(password: string, hash: string, salt: string): boolean {
  try {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    const bufA = Buffer.from(hash, "hex");
    const bufB = Buffer.from(verifyHash, "hex");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function getCommissionPasswordConfig(): Promise<CommissionPasswordConfig | null> {
  try {
    if ((prisma as any).systemSetting?.findUnique) {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: SETTING_KEY },
      });
      if (!setting || !setting.value) return null;
      return JSON.parse(setting.value) as CommissionPasswordConfig;
    }

    // Direct SQL fallback if Prisma client delegate is not yet initialized in hot-reload
    const rows: any = await prisma.$queryRawUnsafe(
      "SELECT value FROM SystemSetting WHERE `key` = ? LIMIT 1",
      SETTING_KEY
    );
    if (rows && rows.length > 0 && rows[0].value) {
      return JSON.parse(rows[0].value) as CommissionPasswordConfig;
    }
    return null;
  } catch (err) {
    console.error("Error reading commission password config:", err);
    return null;
  }
}

export async function setCommissionPassword(password: string, enabled = true, updatedBy?: string | null) {
  const { hash, salt } = hashPassword(password);
  const config: CommissionPasswordConfig = {
    hash,
    salt,
    enabled,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || null,
  };
  const jsonValue = JSON.stringify(config);

  if ((prisma as any).systemSetting?.upsert) {
    return await prisma.systemSetting.upsert({
      where: { key: SETTING_KEY },
      update: {
        value: jsonValue,
      },
      create: {
        key: SETTING_KEY,
        value: jsonValue,
      },
    });
  }

  // Direct SQL fallback if Prisma client delegate is not yet initialized in hot-reload
  const now = new Date();
  await prisma.$executeRawUnsafe(
    "INSERT INTO SystemSetting (`key`, `value`, `updatedAt`, `createdAt`) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updatedAt` = VALUES(`updatedAt`)",
    SETTING_KEY,
    jsonValue,
    now,
    now
  );
  return config;
}

export async function toggleCommissionPassword(enabled: boolean, updatedBy?: string | null) {
  const current = await getCommissionPasswordConfig();
  if (!current) throw new Error("No commission password is set");

  current.enabled = enabled;
  current.updatedAt = new Date().toISOString();
  if (updatedBy) current.updatedBy = updatedBy;
  const jsonValue = JSON.stringify(current);

  if ((prisma as any).systemSetting?.update) {
    return await prisma.systemSetting.update({
      where: { key: SETTING_KEY },
      data: {
        value: jsonValue,
      },
    });
  }

  const now = new Date();
  await prisma.$executeRawUnsafe(
    "UPDATE SystemSetting SET `value` = ?, `updatedAt` = ? WHERE `key` = ?",
    jsonValue,
    now,
    SETTING_KEY
  );
  return current;
}

export async function removeCommissionPassword() {
  try {
    if ((prisma as any).systemSetting?.deleteMany) {
      await prisma.systemSetting.deleteMany({
        where: { key: SETTING_KEY },
      });
      return true;
    }

    await prisma.$executeRawUnsafe(
      "DELETE FROM SystemSetting WHERE `key` = ?",
      SETTING_KEY
    );
    return true;
  } catch (err) {
    console.error("Error deleting commission password setting:", err);
    return false;
  }
}
