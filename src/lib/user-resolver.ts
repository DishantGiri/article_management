import { fuzzyScore } from "./fuzzy";

export function isPlaceholderName(val?: string | null): boolean {
  if (!val) return true;
  const lower = String(val).trim().toLowerCase().replace(/^["']+|["']+$/g, "").trim();
  return (
    !lower ||
    [
      "n/a",
      "na",
      "n / a",
      "nil",
      "none",
      "unassigned",
      "-",
      "--",
      "---",
      "null",
      "undefined",
      "no",
      "no linker",
      "no writer",
      "anonymous",
      "blank",
    ].includes(lower)
  );
}

export function splitPersonNames(raw: string): string[] {
  if (!raw || isPlaceholderName(raw)) return [];
  const cleaned = String(raw).replace(/^["'\s]+|["'\s]+$/g, "").trim();
  const parts = cleaned.split(/,|\s+and\s+|\s*&\s*|\s*\+\s*|\s*\/\s*/i);
  return parts
    .map((p) => p.trim().replace(/^["']+|["']+$/g, ""))
    .filter((p) => p.length > 0 && !isPlaceholderName(p));
}

// Known historical spelling variations / nicknames mapped to canonical lowercase names
const USER_NAME_ALIASES: Record<string, string> = {
  sabinam: "sabina magar",
  "sabina m": "sabina magar",
  jayas: "jayash adhikari",
  "jayas adhikari": "jayash adhikari",
  sami: "samikshya khand",
  "samikshya k": "samikshya khand",
  bhashkar: "bhaskar dahal",
  "bhashkar dahal": "bhaskar dahal",
  abishekh: "abishek khadka",
  "abishekh khadka": "abishek khadka",
};

export interface ResolveUsersOptions {
  rolePreference?: string;
  targetSiteId?: number | null;
  siteAccessList?: Array<{ userId: number; siteId: number; role?: string | null }>;
}

/**
 * Resolves comma/ampersand-separated person names from import sheets against DB users.
 * Disambiguates duplicate first names (e.g. Prity Sewa vs Prity Thapa, Aakriti Nepali vs Aakriti Rauniyar,
 * Sabina Magar vs Sabina Pahari, Bibek Karki vs Bibek Poudel) using targetSiteId access and role context.
 */
export function resolveUsers<T extends { id: number; name: string; email: string; role?: string | null; hasLeftCompany?: boolean }>(
  raw: string,
  allDbUsers: T[],
  options: ResolveUsersOptions = {}
): T[] {
  if (isPlaceholderName(raw)) return [];

  const parts = splitPersonNames(raw);
  if (parts.length === 0) return [];

  const { rolePreference, targetSiteId, siteAccessList = [] } = options;

  const userSiteIdsMap = new Map<number, Set<number>>();
  for (const sa of siteAccessList) {
    if (!userSiteIdsMap.has(sa.userId)) {
      userSiteIdsMap.set(sa.userId, new Set());
    }
    userSiteIdsMap.get(sa.userId)!.add(sa.siteId);
  }

  const validUsers = allDbUsers.filter((u) => !isPlaceholderName(u.name));

  // Rank candidates for disambiguation when multiple users match at the same tier
  const scoreCandidate = (u: T): number => {
    let score = 0;
    const siteSet = userSiteIdsMap.get(u.id);
    if (targetSiteId && siteSet?.has(targetSiteId)) score += 1000;
    if (siteSet && siteSet.size > 0) score += 200;
    if (u.role && u.role !== "GUEST") score += 100;
    if (rolePreference && u.role === rolePreference) score += 50;
    if (!u.hasLeftCompany) score += 10;
    return score;
  };

  const candidates = [...validUsers].sort((a, b) => scoreCandidate(b) - scoreCandidate(a));

  const matched: T[] = [];
  const matchedIds = new Set<number>();

  for (const part of parts) {
    const clean = part.trim().toLowerCase().replace(/\s+/g, " ");
    if (!clean) continue;

    const cleanFirstName = clean.split(/\s+/)[0];
    const stripped = clean.replace(/[^a-z0-9]/g, "");

    // 1. Exact full name match
    let found = candidates.find((u) => u.name.trim().toLowerCase() === clean);

    // 2. Exact email or email local-part match
    if (!found) {
      found = candidates.find(
        (u) =>
          u.email.trim().toLowerCase() === clean ||
          u.email.trim().toLowerCase().split("@")[0] === stripped
      );
    }

    // 3. Explicit alias match (e.g. "SabinaM" -> "Sabina Magar", "Jayas" -> "Jayash Adhikari")
    if (!found) {
      const aliasTarget = USER_NAME_ALIASES[clean] || USER_NAME_ALIASES[stripped];
      if (aliasTarget) {
        found = candidates.find((u) => u.name.trim().toLowerCase() === aliasTarget);
      }
    }

    // 4. Full name starts with piece (e.g. DB: "Rahul Gupta", sheet: "Rahul")
    if (!found) {
      found = candidates.find((u) => u.name.trim().toLowerCase().startsWith(clean + " "));
    }

    // 5. Piece starts with DB user's name (e.g. DB: "Rahil", sheet: "Rahil Kunwar")
    if (!found) {
      found = candidates.find((u) => clean.startsWith(u.name.trim().toLowerCase() + " "));
    }

    // 6. Exact first name match (e.g. DB: "Prity Thapa", sheet: "Prity" on The Buyers Reviews)
    if (!found) {
      found = candidates.find((u) => u.name.trim().toLowerCase().split(/\s+/)[0] === cleanFirstName);
    }

    // 7. Samikshya wildcard fallback
    if (!found && (clean === "sami" || clean.startsWith("samikshya"))) {
      found = candidates.find((u) => u.name.trim().toLowerCase().includes("samikshya"));
    }

    // 8. High-confidence fuzzy match (handles minor spelling differences like Jayas/Jayash, Bhashkar/Bhaskar)
    if (!found && cleanFirstName.length >= 4) {
      let bestFuzzy: T | null = null;
      let bestScore = 0;
      for (const u of candidates) {
        const uName = u.name.trim().toLowerCase();
        const uFirst = uName.split(/\s+/)[0];
        const s = Math.max(fuzzyScore(uName, clean), fuzzyScore(uFirst, cleanFirstName));
        if (s > bestScore) {
          bestScore = s;
          bestFuzzy = u;
        }
      }
      if (bestScore >= 82 && bestFuzzy) {
        found = bestFuzzy;
      }
    }

    if (found && !matchedIds.has(found.id)) {
      matched.push(found);
      matchedIds.add(found.id);
    }
  }

  return matched;
}
