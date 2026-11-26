import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { delByPattern } from "../src/lib/redis";
import { CANONICAL_AFFILIATES } from "../src/lib/canonical-affiliates";

async function seedAffiliates() {
  console.log("==========================================================");
  console.log("🌱 SEEDING CANONICAL AFFILIATE NETWORKS");
  console.log("==========================================================");

  // Deduplicate case-insensitively while preserving canonical order
  const canonicalList: string[] = [];
  const seenLower = new Set<string>();
  for (const name of CANONICAL_AFFILIATES) {
    const trimmed = name.trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seenLower.has(key)) {
      seenLower.add(key);
      canonicalList.push(trimmed);
    }
  }

  const existing = await prisma.affiliateName.findMany({
    orderBy: { id: "asc" },
  });
  console.log(`📋 Existing AffiliateName rows in DB: ${existing.length}`);

  // Remove rows not in canonical list (case-insensitive)
  const staleIds = existing
    .filter((row) => !seenLower.has(row.name.trim().toLowerCase()))
    .map((row) => row.id);

  if (staleIds.length > 0) {
    await prisma.affiliateName.deleteMany({
      where: { id: { in: staleIds } },
    });
    console.log(`🧹 Removed ${staleIds.length} stale/non-canonical affiliate row(s).`);
  }

  const remaining = await prisma.affiliateName.findMany({
    orderBy: { id: "asc" },
  });
  const byLower = new Map(
    remaining.map((row) => [row.name.trim().toLowerCase(), row])
  );

  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  for (const canonical of canonicalList) {
    const match = byLower.get(canonical.toLowerCase());
    if (match) {
      if (match.name !== canonical) {
        await prisma.affiliateName.update({
          where: { id: match.id },
          data: { name: canonical },
        });
        updatedCount++;
      } else {
        unchangedCount++;
      }
    } else {
      await prisma.affiliateName.create({
        data: { name: canonical },
      });
      createdCount++;
    }
  }

  await Promise.all([
    delByPattern("dashboard:*"),
    delByPattern("affiliates:*"),
  ]).catch(() => {});

  const finalCount = await prisma.affiliateName.count();
  console.log("==========================================================");
  console.log(`✅ AFFILIATE SEED COMPLETE (${finalCount} total canonical affiliates)`);
  console.log(`   - Created:   ${createdCount}`);
  console.log(`   - Updated:   ${updatedCount}`);
  console.log(`   - Unchanged: ${unchangedCount}`);
  console.log("==========================================================");
}

seedAffiliates()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("❌ Affiliate seed failed:", err);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
