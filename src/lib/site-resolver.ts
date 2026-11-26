import { fuzzyScore, levenshteinDistance } from "./fuzzy";
import { normalizedLevenshteinSimilarity } from "./import-resolvers";

// Known abbreviations and common aliases
export const SITE_ALIASES: Record<string, string> = {
  dhs: "Daily Health Supplement",
  dailyhealthsupplement: "Daily Health Supplement",
  dailyhealthsupplements: "Daily Health Supplement",
  smg: "Supplement Mag",
  mag: "Supplement Mag",
  supplementmag: "Supplement Mag",
  supplementmags: "Supplement Mag",
  tbr: "The Buyers Reviews",
  thebuyersreviews: "The Buyers Reviews",
  thebuyersreview: "The Buyers Reviews",
  buyersreviews: "The Buyers Reviews",
  buyersreview: "The Buyers Reviews",
  grc: "Guru Review Club",
  gurureviewclub: "Guru Review Club",
  gurureviewsclub: "Guru Review Club",
  "guru review club": "Guru Review Club",
  "guru reviews club": "Guru Review Club",
  sc: "Supplement Coach",
  supplementcoach: "Supplement Coach",
  supplementcoaches: "Supplement Coach",
  sv: "Supplement Vibes",
  supplementvibes: "Supplement Vibes",
  supplementvibe: "Supplement Vibes",
  sd: "Supplement Dolphin",
  supplementdolphin: "Supplement Dolphin",
  st: "Supplement Tiger",
  supplementtiger: "Supplement Tiger",
  sp: "Supplements and Powders",
  supplementandpowders: "Supplements and Powders",
  supplementsandpowders: "Supplements and Powders",
  supplementspowders: "Supplements and Powders",
  "supplement and powders": "Supplements and Powders",
  "supplements and powders": "Supplements and Powders",
  jir: "Justin Reviews",
  jr: "Justin Reviews",
  justinreviews: "Justin Reviews",
  justinreview: "Justin Reviews",
  rbr: "Ryans Best Reviews",
  ryansbestreviews: "Ryans Best Reviews",
  ryansbestreview: "Ryans Best Reviews",
  ryanbestreviews: "Ryans Best Reviews",
  hsb: "Health Supplement Bucket",
  healthsupplementbucket: "Health Supplement Bucket",
  healthsupplementsbucket: "Health Supplement Bucket",
  hse: "Health Supplements Expert",
  healthsupplementsexpert: "Health Supplements Expert",
  healthsupplementexpert: "Health Supplements Expert",
  bhfr: "BeautyHealthFitnessRemedies",
  beautyhealthfitnessremedies: "BeautyHealthFitnessRemedies",
  beautyhealthfitnessremedy: "BeautyHealthFitnessRemedies",
  hsb_blog: "HealthSolutions Blog",
  hsblog: "HealthSolutions Blog",
  healthsolutionsblog: "HealthSolutions Blog",
  healthsolutionblog: "HealthSolutions Blog",
  hpr: "HonestProductReview",
  honestproductreview: "HonestProductReview",
  honestproductreviews: "HonestProductReview",
};

/**
 * Normalizes text for site comparison:
 * - strips accents
 * - converts '&' to 'and'
 * - normalizes common plural variations (reviews -> review, supplements -> supplement, powders -> powder, buyers -> buyer)
 * - removes all punctuation, spaces, dashes
 */
export function normalizeSiteKey(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’]s\b/g, "") // remove apostrophe-s (e.g. Ryan's -> Ryan)
    .replace(/reviews\b/g, "review")
    .replace(/supplements\b/g, "supplement")
    .replace(/powders\b/g, "powder")
    .replace(/buyers\b/g, "buyer")
    .replace(/remedies\b/g, "remedy")
    .replace(/solutions\b/g, "solution")
    .replace(/experts\b/g, "expert")
    .replace(/buckets\b/g, "bucket")
    .replace(/vibes\b/g, "vibe")
    .replace(/dolphins\b/g, "dolphin")
    .replace(/tigers\b/g, "tiger")
    .replace(/coaches\b/g, "coach")
    .replace(/clubs\b/g, "club")
    .replace(/blogs\b/g, "blog")
    .replace(/products\b/g, "product")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Robust fuzzy site resolver.
 * Evaluates candidate site against all DB sites using multi-stage matching:
 * 1. Alias lookup
 * 2. Exact match
 * 3. Stripped alphanumeric match
 * 4. Stem/plural normalized match (e.g. "GuruReviewsClub" vs "Guru Review Club")
 * 5. URL / Domain match
 * 6. Acronym match (e.g. "grc" -> "Guru Review Club")
 * 7. Token subset / inclusion match
 * 8. Levenshtein / Fuzzy score match (best score >= 70)
 */
export function resolveSite<T extends { id: string; name: string; url?: string | null; bridgeUrl?: string | null }>(
  key: string,
  sites: T[]
): T | null {
  if (!key || typeof key !== "string" || !sites || sites.length === 0) return null;

  const cleanKey = key.trim().toLowerCase();
  const strippedKey = cleanKey.replace(/[^a-z0-9]/g, "");
  if (!strippedKey) return null;

  // 1. Direct alias check
  const aliasName = SITE_ALIASES[strippedKey] || SITE_ALIASES[cleanKey];
  if (aliasName) {
    const s = sites.find((x) => x.name.toLowerCase() === aliasName.toLowerCase());
    if (s) return s;
  }

  // 2. Exact name match (case-insensitive)
  let found = sites.find((s) => s.name.trim().toLowerCase() === cleanKey);
  if (found) return found;

  // 3. Stripped alphanumeric match (ignoring spaces, punctuation, dashes)
  found = sites.find((s) => s.name.toLowerCase().replace(/[^a-z0-9]/g, "") === strippedKey);
  if (found) return found;

  // 4. Normalized stem / singular-plural match
  const normKey = normalizeSiteKey(cleanKey);
  if (normKey) {
    found = sites.find((s) => normalizeSiteKey(s.name) === normKey);
    if (found) return found;
  }

  // 5. URL and Domain match
  const cleanDomain = cleanKey.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const strippedDomain = cleanDomain.replace(/[^a-z0-9]/g, "");

  found = sites.find((s) => {
    if (!s.url) return false;
    const sDomain = s.url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const sStrippedDomain = sDomain.replace(/[^a-z0-9]/g, "");
    return (
      sDomain === cleanDomain ||
      sStrippedDomain === strippedKey ||
      sStrippedDomain === strippedDomain ||
      normalizeSiteKey(sDomain) === normKey ||
      (strippedDomain.length >= 4 && sStrippedDomain.includes(strippedDomain)) ||
      (strippedKey.length >= 4 && sStrippedDomain.includes(strippedKey))
    );
  });
  if (found) return found;

  // 6. Acronym match (e.g. "grc" -> "Guru Review Club", "dhs" -> "Daily Health Supplement")
  found = sites.find((s) => {
    const words = s.name.split(/\s+/).filter(Boolean);
    const acronym = words.map((w) => w[0]).join("").toLowerCase();
    return acronym === strippedKey || acronym === cleanKey;
  });
  if (found) return found;

  // 7. Token subset / inclusion match (e.g. "Guru Review" inside "Guru Review Club")
  const keyWords = cleanKey.replace(/[_\-\\/.,+&()|[\]{}:;!?'"`~*^%$#@]/g, " ").split(/\s+/).filter((w) => w.length >= 2);
  if (keyWords.length >= 2) {
    found = sites.find((s) => {
      const siteWords = s.name.toLowerCase().replace(/[_\-\\/.,+&()|[\]{}:;!?'"`~*^%$#@]/g, " ").split(/\s+/).filter((w) => w.length >= 2);
      const allKeyInSite = keyWords.every((kw) => siteWords.some((sw) => sw.startsWith(kw) || kw.startsWith(sw)));
      const allSiteInKey = siteWords.every((sw) => keyWords.some((kw) => kw.startsWith(sw) || sw.startsWith(kw)));
      return allKeyInSite || allSiteInKey;
    });
    if (found) return found;
  }

  // 8. High-precision Fuzzy Score & Levenshtein Match
  let bestSite: T | null = null;
  let bestScore = 0;

  for (const s of sites) {
    const sNorm = normalizeSiteKey(s.name);
    const nameScore = fuzzyScore(s.name, cleanKey);
    const normScore = fuzzyScore(sNorm, normKey);
    let levScore = 0;
    if (normKey.length >= 6 && sNorm.length >= 6) {
      const dist = levenshteinDistance(sNorm, normKey);
      const sim = normalizedLevenshteinSimilarity(sNorm, normKey);
      const maxDist = Math.max(2, Math.floor(Math.max(sNorm.length, normKey.length) * 0.18));
      if (dist <= maxDist && sim >= 0.82) {
        levScore = sim * 100;
      }
    }
    const score = Math.max(nameScore, normScore, levScore);

    if (score > bestScore) {
      bestScore = score;
      bestSite = s;
    }
  }

  if (bestScore >= 70 && bestSite) {
    return bestSite;
  }

  return null;
}
