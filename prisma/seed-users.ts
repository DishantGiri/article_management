/* eslint-disable @typescript-eslint/no-explicit-any */
import "dotenv/config";
import path from "path";
import fs from "fs";
import * as xlsx from "xlsx";
import { prisma } from "../src/lib/prisma";
import { delByPattern } from "../src/lib/redis";

function normalizeKey(str: string): string {
  return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function seedUsers() {
  console.log("==========================================================");
  console.log("🌱 STARTING USER SEED FROM Merged_User_List_2026-11-24.xlsx");
  console.log("==========================================================");

  const excelPath = path.resolve(process.cwd(), "Merged_User_List_2026-11-24.xlsx");
  if (!fs.existsSync(excelPath)) {
    throw new Error(`Excel file not found at ${excelPath}`);
  }

  const workbook = xlsx.readFile(excelPath);
  const sheetName = "Merged User List";
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`Worksheet '${sheetName}' not found in Excel workbook`);
  }

  const rows: any[] = xlsx.utils.sheet_to_json(worksheet);
  console.log(`📄 Found ${rows.length} user rows in '${sheetName}'`);

  // 1. Fetch all DB sites and construct normalized lookup map
  const dbSites = await prisma.site.findMany();
  console.log(`🌐 Loaded ${dbSites.length} existing sites from DB`);

  const siteMap = new Map<string, typeof dbSites[0]>();
  for (const site of dbSites) {
    siteMap.set(normalizeKey(site.name), site);
  }
  // Common aliases
  const guruSite = dbSites.find((s) => normalizeKey(s.name).includes("gurureview"));
  if (guruSite) {
    siteMap.set("gurureviewsclub", guruSite);
    siteMap.set("gurureviewclub", guruSite);
  }

  // 2. Fetch all existing DB users
  const dbUsers = await prisma.user.findMany({
    include: {
      siteAccess: true,
    },
  });
  console.log(`👥 Loaded ${dbUsers.length} existing users from DB`);

  const matchedDbUserIds = new Set<number>();
  let updatedUsersCount = 0;
  let createdUsersCount = 0;
  let leftUsersCount = 0;
  let activeUsersCount = 0;
  let totalSiteAccessUpserted = 0;

  for (const row of rows) {
    const rawName = (row.Name || "").toString().trim();
    const email = (row.Email || "").toString().trim().toLowerCase();
    const isLeft = (row["Already left the company"] || "").toString().trim().toLowerCase() === "yes";
    const dept = (row.Department || "").toString().trim();
    const sitesStr = (row.Sites || "").toString().trim();
    const firstName = rawName.split(" ")[0].toLowerCase();

    if (!email) {
      console.warn(`⚠️ Skipping row with missing email: ${rawName}`);
      continue;
    }

    if (isLeft) leftUsersCount++;
    else activeUsersCount++;

    // 3. Match against existing DB user
    let existingUser = dbUsers.find((u) => u.email.toLowerCase() === email);

    if (!existingUser) {
      // Known specific alias mappings
      if (email === "magarsabina@fishtailinfosolutions.com") {
        existingUser = dbUsers.find((u) => u.id === 112);
      } else if (email === "sabinapahari@fishtailinfosolutions.com") {
        existingUser = dbUsers.find((u) => u.id === 123);
      } else if (email === "guptarahul@fishtailinfosolutions.com") {
        existingUser = dbUsers.find((u) => u.id === 101);
      } else if (email === "samikshyakhand@fishtailinfosolutions.com") {
        existingUser = dbUsers.find((u) => u.id === 91 || u.id === 110);
      } else if (email === "jayashadhikari@fishtailinfosolutions.com") {
        existingUser = dbUsers.find((u) => u.id === 130);
      }
    }

    if (!existingUser) {
      // Match by prefix or first name if not yet claimed
      existingUser = dbUsers.find(
        (u) =>
          !matchedDbUserIds.has(u.id) &&
          (u.email.toLowerCase().startsWith(firstName + "@") ||
            u.name.toLowerCase() === rawName.toLowerCase() ||
            u.name.toLowerCase() === firstName)
      );
    }

    // 4. Determine role
    let computedRole: "SUPER_ADMIN" | "ADMIN" | "LINKER" | "WRITER" | "TEAM_LEAD" | "PRODUCT_RESEARCHER" | "GUEST" = "GUEST";

    if (email === "abishekkhadka@fishtailinfosolutions.com" || email === "abishekkhadka@articlemgmt.com") {
      computedRole = "SUPER_ADMIN";
    } else if (existingUser?.role === "SUPER_ADMIN") {
      computedRole = "SUPER_ADMIN";
    } else if (existingUser?.role === "ADMIN") {
      computedRole = "ADMIN";
    } else if (dept === "Management") {
      computedRole = "ADMIN";
    } else if (existingUser?.role === "LINKER") {
      computedRole = "LINKER";
    } else if (existingUser?.role === "TEAM_LEAD") {
      computedRole = "TEAM_LEAD";
    } else if (sitesStr || dept === "SEO") {
      computedRole = "WRITER";
    } else if (existingUser?.role) {
      computedRole = existingUser.role;
    } else {
      computedRole = "GUEST";
    }

    // 5. Left company status and flags
    const hasLeftCompany = isLeft;
    const approved = !isLeft;
    const commissionToPartyFund = isLeft;

    let targetUserId: number;

    if (existingUser) {
      matchedDbUserIds.add(existingUser.id);
      targetUserId = existingUser.id;

      // Update existing user without losing relations
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: rawName,
          email: email, // update to official corporate email
          role: computedRole,
          approved,
          hasLeftCompany,
          commissionToPartyFund,
        },
      });
      updatedUsersCount++;
    } else {
      // Create new user record
      const newUser = await prisma.user.create({
        data: {
          name: rawName,
          email: email,
          role: computedRole,
          approved,
          hasLeftCompany,
          commissionToPartyFund,
        },
      });
      targetUserId = newUser.id;
      createdUsersCount++;
    }

    // 6. Connect SiteAccess if sites are assigned
    if (sitesStr) {
      const siteNames = sitesStr.split(",").map((s: string) => s.trim()).filter(Boolean);
      for (const siteName of siteNames) {
        const matchedSite = siteMap.get(normalizeKey(siteName));
        if (!matchedSite) {
          console.warn(`  ⚠️ Site not matched in DB for '${siteName}' (User: ${rawName})`);
          continue;
        }

        const primaryRole = computedRole === "LINKER" ? "LINKER" : computedRole === "TEAM_LEAD" ? "TEAM_LEAD" : "WRITER";
        const canWrite = true;
        const canReview = computedRole === "TEAM_LEAD";
        const canAddLink = computedRole === "LINKER";
        const canAddProduct = computedRole === "LINKER" || computedRole === "PRODUCT_RESEARCHER";

        await prisma.siteAccess.upsert({
          where: {
            userId_siteId: {
              userId: targetUserId,
              siteId: matchedSite.id,
            },
          },
          create: {
            userId: targetUserId,
            siteId: matchedSite.id,
            role: primaryRole,
            roles: primaryRole,
            canWrite,
            canReview,
            canAddLink,
            canAddProduct,
          },
          update: {
            role: primaryRole,
            roles: primaryRole,
            canWrite,
            canReview,
            canAddLink,
            canAddProduct,
          },
        });
        totalSiteAccessUpserted++;
      }
    }
  }

  // 7. Clear redis cache
  await Promise.all([
    delByPattern("users:*"),
    delByPattern("dashboard:*"),
    delByPattern("commissions:*"),
  ]).catch(() => {});

  console.log("==========================================================");
  console.log("✅ USER SEED COMPLETED SUCCESSFULLY!");
  console.log(`📊 Summary:`);
  console.log(`   - Total Excel Rows:       ${rows.length}`);
  console.log(`   - Existing Users Updated: ${updatedUsersCount}`);
  console.log(`   - New Users Created:      ${createdUsersCount}`);
  console.log(`   - Active Users:           ${activeUsersCount} (Approved: true, Left: false, PartyFund: false)`);
  console.log(`   - Departed Users:         ${leftUsersCount} (Approved: false, Left: true, PartyFund: true)`);
  console.log(`   - Site Access Upserted:   ${totalSiteAccessUpserted}`);
  console.log("==========================================================");
}

seedUsers()
  .catch((err) => {
    console.error("❌ Seed users failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
