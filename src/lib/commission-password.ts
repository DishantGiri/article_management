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
    const setting = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY },
    });
    if (!setting || !setting.value) return null;
    return JSON.parse(setting.value) as CommissionPasswordConfig;
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

  return await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY },
    update: {
      value: JSON.stringify(config),
    },
    create: {
      key: SETTING_KEY,
      value: JSON.stringify(config),
    },
  });
}

export async function toggleCommissionPassword(enabled: boolean, updatedBy?: string | null) {
  const current = await getCommissionPasswordConfig();
  if (!current) throw new Error("No commission password is set");

  current.enabled = enabled;
  current.updatedAt = new Date().toISOString();
  if (updatedBy) current.updatedBy = updatedBy;

  return await prisma.systemSetting.update({
    where: { key: SETTING_KEY },
    data: {
      value: JSON.stringify(current),
    },
  });
}

export async function removeCommissionPassword() {
  try {
    await prisma.systemSetting.deleteMany({
      where: { key: SETTING_KEY },
    });
    return true;
  } catch (err) {
    console.error("Error deleting commission password setting:", err);
    return false;
  }
}
