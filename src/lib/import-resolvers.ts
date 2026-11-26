import { fuzzyScore, levenshteinDistance } from "@/lib/fuzzy";
import { isPlaceholderName } from "@/lib/user-resolver";
import { CANONICAL_AFFILIATES } from "@/lib/canonical-affiliates";

/**
 * Compute normalized Levenshtein similarity in [0, 1] between two pre-normalized strings.
 */
export function normalizedLevenshteinSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  const dist = levenshteinDistance(a, b);
  return 1 - dist / maxLen;
}

function singularizeWord(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies") && word.length > 4) {
    return `${word.slice(0, -3)}y`;
  }
  if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us") && !word.endsWith("is")) {
    return word.slice(0, -1);
  }
  return word;
}

function stripAlnumLower(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function stripSingularAlnumLower(raw: string): string {
  const tokens = raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(singularizeWord);

  return tokens.join("");
}

function collapseWhitespace(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function toSmartTitleCase(raw: string): string {
  const cleaned = collapseWhitespace(raw);
  // Preserve already mixed-case / branded casing
  if (/[A-Z]/.test(cleaned) && /[a-z]/.test(cleaned)) {
    return cleaned;
  }
  return cleaned
    .toLowerCase()
    .replace(/(^|[\s\-\/&])\S/g, (ch) => ch.toUpperCase());
}

// ============================================================================
// 1. AFFILIATE NETWORK RESOLVER
// ============================================================================

const AFFILIATE_ALIASES: Record<string, string> = {
  buygoods: "Buy Goods",
  buygood: "Buy Goods",
  smashloud: "Smash Loud",
  smashload: "Smash Loud",
  gurumedia: "Guru Media",
  mediascalers: "Media Scalers",
  mediascaler: "Media Scalers",
  smartadv: "Smart Adv",
  smartadvrajan: "smart adv rajan",
  maxweb: "Maxweb",
  clickhunts: "Click Hunts",
  clickhunt: "Click Hunts",
  clickshunt: "Click Hunts",
  clickshunts: "Click Hunts",
  sellhealth: "Sell Health",
  clickadv: "ClickADV",
  clicksadv: "ClickADV",
  terraleads: "Terraleads",
  terralead: "Terraleads",
  clickbank: "Clickbank",
  leadbit: "Leadbit",
  dynu: "Dynu",
  dynuinmedia: "Dynu",
  dynuin: "Dynu",
  impact: "Impact",
  impactradius: "Impact",
  trafficlight: "Traffic Light",
  kissmyads: "kissmyads",
  kissmyad: "kissmyads",
  mylead: "mylead",
  myleads: "mylead",
  inb: "inb",
  inbbio: "inb",
  adcombo: "Adcombo",
  spyrevenue: "Spyrevenue",
  drcash: "Dr Cash",
  doctorcash: "Dr Cash",
  admedius: "Admedius",
  syncmedia: "SyncMedia",
  maxbounty: "Max Bounty",
  pointclicktrack: "Point Click Track",
  pointclick: "Point Click Track",
  pct: "Point Click Track",
  amazon: "Amazon",
  amazonassociates: "Amazon",
  amazonassociate: "Amazon",
  amzn: "Amazon",
  awin: "Awin",
  giddyup: "Giddy Up",
  digistore: "Digistore",
  digistore24: "Digistore",
  goodaff: "GoodAff",
  goodaffs: "GoodAff",
  metacpa: "meta cpa",
  metaads: "meta cpa",
  cloudtraffic: "Cloud Traffic",
  verdeads: "VerdeAds",
  verdead: "VerdeAds",
  apex: "Apex",
  apexads: "Apex",
  apexnetwork: "Apex",
  blitzads: "Blitz Ads",
  blitzad: "Blitz Ads",
  somicreative: "somi creative",
  somi: "somi creative",
  clickdealer: "clickdealer",
  clicksdealer: "clickdealer",
  affena: "Affena",
  shakespro: "Shakespro",
  shakes: "Shakespro",
  competitor: "competitor",
  competitors: "competitor",
  competitorproduct: "competitor",
  competitorsproduct: "competitor",
};

const NO_AFFILIATE_VALUES = new Set([
  "no affiliate",
  "noaffiliate",
  "none",
  "no",
  "na",
  "n/a",
  "direct",
  "standard",
  "null",
]);

function pickCanonicalAffiliate(
  matches: Array<{ name: string }>,
  preferredName?: string | null
): string | null {
  if (matches.length === 0) return null;
  if (preferredName) {
    const exactPref = matches.find(
      (m) => m.name.trim().toLowerCase() === preferredName.toLowerCase()
    );
    if (exactPref) return exactPref.name;
  }
  return [...matches].sort((a, b) => a.name.length - b.name.length)[0].name;
}

/**
 * Resolve raw affiliate network name (e.g. "Smart ADV", "BuyGoods", "Clicks Hunt",
 * "MediaScaler", "Dynu in Media", "Digistore24") to an existing/seeded AffiliateName
 * using exact, alias, and fuzzy matching.
 * Never invents unseeded affiliates: returns null if no seeded affiliate matches.
 */
export function resolveAffiliateName(
  raw: string | null | undefined,
  existingAffiliates: Array<{ name: string }> = []
): string | null {
  if (!raw) return null;
  const cleaned = collapseWhitespace(raw);
  if (!cleaned || isPlaceholderName(cleaned)) return null;

  const lower = cleaned.toLowerCase();
  const stripped = stripAlnumLower(cleaned);
  if (!stripped || NO_AFFILIATE_VALUES.has(lower) || NO_AFFILIATE_VALUES.has(stripped)) {
    return null;
  }

  const pool: Array<{ name: string }> =
    existingAffiliates.length > 0
      ? existingAffiliates
      : CANONICAL_AFFILIATES.map((name) => ({ name }));

  const hasRajan = lower.includes("rajan");
  const singularStripped = stripSingularAlnumLower(cleaned);
  const aliasTarget = AFFILIATE_ALIASES[stripped] ?? AFFILIATE_ALIASES[singularStripped] ?? null;

  // 1. Exact stripped key match against DB/canonical pool
  const strippedMatches = pool.filter(
    (a) => stripAlnumLower(a.name) === stripped
  );
  if (strippedMatches.length > 0) {
    return pickCanonicalAffiliate(strippedMatches, aliasTarget);
  }

  // 2. Alias match -> resolve strictly to matching record in pool
  if (aliasTarget) {
    const aliasKey = stripAlnumLower(aliasTarget);
    const aliasSingular = stripSingularAlnumLower(aliasTarget);
    const dbMatch = pool.filter(
      (a) => stripAlnumLower(a.name) === aliasKey || stripSingularAlnumLower(a.name) === aliasSingular
    );
    if (dbMatch.length > 0) {
      return pickCanonicalAffiliate(dbMatch, aliasTarget);
    }
  }

  // 3. Singularized stripped match against pool (e.g. MediaScaler -> Media Scalers)
  const singularMatches = pool.filter(
    (a) => stripSingularAlnumLower(a.name) === singularStripped
  );
  if (singularMatches.length > 0) {
    return pickCanonicalAffiliate(singularMatches);
  }

  // 4. Token-prefix match for extended variants (e.g. "Dynu In Media" -> "Dynu", "Digistore24" -> "Digistore", "Amazon Associates" -> "Amazon")
  const rawTokens = lower.replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (rawTokens.length > 0) {
    // Sort longest candidate first so multi-word names win before shorter prefixes
    const sortedCandidates = [...pool].sort(
      (a, b) => stripAlnumLower(b.name).length - stripAlnumLower(a.name).length
    );
    for (const candidate of sortedCandidates) {
      const candLower = candidate.name.toLowerCase();
      const candHasRajan = candLower.includes("rajan");
      if (hasRajan !== candHasRajan) continue;

      const candStrip = stripAlnumLower(candidate.name);
      if (candStrip.length >= 4 && stripped.startsWith(candStrip)) {
        const lenDiff = stripped.length - candStrip.length;
        // Exact trailing numeric/suffix ("Digistore24") or exact first word ("Dynu In Media", "Amazon Associates")
        if (rawTokens[0] === candStrip || (lenDiff <= 3 && /^\d+$/.test(stripped.slice(candStrip.length)))) {
          return candidate.name;
        }
      }
    }
  }

  // 5. High-precision fuzzy match against pool affiliates (e.g. typos like "SmarADV", "Adcomobo", "GiddyUp")
  if (stripped.length >= 5) {
    let bestName: string | null = null;
    let bestScore = 0;

    for (const candidate of pool) {
      const candHasRajan = candidate.name.toLowerCase().includes("rajan");
      if (hasRajan !== candHasRajan) continue;

      const candStrip = stripAlnumLower(candidate.name);
      if (candStrip.length < 4) continue;
      if (Math.abs(candStrip.length - stripped.length) > 3) continue;

      const dist = levenshteinDistance(stripped, candStrip);
      const sim = normalizedLevenshteinSimilarity(stripped, candStrip);
      if (dist <= 2 && sim >= 0.78 && sim > bestScore) {
        bestScore = sim;
        bestName = candidate.name;
      }
    }
    if (bestName) return bestName;

    // Also check fuzzy typos against known aliases, resolving back into pool
    let bestAliasCanonical: string | null = null;
    let bestAliasScore = 0;
    for (const [key, canonical] of Object.entries(AFFILIATE_ALIASES)) {
      const candHasRajan = canonical.toLowerCase().includes("rajan");
      if (hasRajan !== candHasRajan) continue;
      if (key.length < 5 || Math.abs(key.length - stripped.length) > 2) continue;

      const dist = levenshteinDistance(stripped, key);
      const sim = normalizedLevenshteinSimilarity(stripped, key);
      if (dist <= 2 && sim >= 0.78 && sim > bestAliasScore) {
        bestAliasScore = sim;
        bestAliasCanonical = canonical;
      }
    }
    if (bestAliasCanonical) {
      const dbMatch = pool.find(
        (a) => stripAlnumLower(a.name) === stripAlnumLower(bestAliasCanonical!)
      );
      if (dbMatch) return dbMatch.name;
    }
  }

  // 6. Do not invent or return unseeded affiliate names
  return null;
}

// ============================================================================
// 2. PRODUCT SOURCE RESOLVER
// ============================================================================

const SOURCE_FILLER_TOKENS = new Set([
  "product",
  "products",
  "prod",
  "offer",
  "offers",
  "link",
  "links",
  "list",
  "site",
  "sites",
  "campaign",
  "campaigns",
  "research",
  "item",
  "items",
  "page",
  "pages",
]);

const SOURCE_RULES: Array<{ canonical: string; exactTokens: string[]; fuzzyTarget?: string }> = [
  {
    canonical: "Competitor",
    exactTokens: ["competitor", "competiter", "comptitor", "comp", "competetior"],
    fuzzyTarget: "competitor",
  },
  {
    canonical: "Affiliate",
    exactTokens: ["affiliate", "affilate", "aff", "affliate", "afiliate"],
    fuzzyTarget: "affiliate",
  },
  {
    canonical: "Social Media/Native",
    exactTokens: [
      "social",
      "native",
      "socialmedianative",
      "socialmedia",
      "fb",
      "facebook",
      "tiktok",
      "meta",
      "instagram",
      "youtube",
      "taboola",
      "outbrain",
      "mgid",
    ],
    fuzzyTarget: "socialmedianative",
  },
  {
    canonical: "Source",
    exactTokens: ["source", "manual", "direct", "organic", "inhouse"],
    fuzzyTarget: "source",
  },
];

/**
 * Resolve raw product source labels ("competitor", "competitor product", "competitors",
 * "competitors product", "affiliate product", "social", "native ads", etc.)
 * into canonical PRODUCT_SOURCE_OPTIONS ("Competitor", "Affiliate", "Social Media/Native", "Source").
 */
export function resolveProductSource(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = collapseWhitespace(raw);
  if (!cleaned || isPlaceholderName(cleaned)) return null;

  const fullStripped = stripAlnumLower(cleaned);
  if (!fullStripped) return null;

  if (fullStripped === "socialmedianative" || fullStripped === "socialmedia" || fullStripped === "nativeads") {
    return "Social Media/Native";
  }

  const rawTokens = cleaned
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]s\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(singularizeWord);

  const coreTokens = rawTokens.filter((t) => !SOURCE_FILLER_TOKENS.has(t));
  const checkTokens = coreTokens.length > 0 ? coreTokens : rawTokens;
  const joinedCore = checkTokens.join("");

  // 1. Direct token / joined core match
  for (const rule of SOURCE_RULES) {
    if (
      rule.exactTokens.includes(joinedCore) ||
      checkTokens.some((tok) => rule.exactTokens.includes(tok))
    ) {
      return rule.canonical;
    }
  }

  // 2. Fuzzy typo tolerance against core tokens (e.g. "competitors prodcut", "compititor")
  let bestCanonical: string | null = null;
  let bestSim = 0;
  for (const rule of SOURCE_RULES) {
    if (!rule.fuzzyTarget) continue;
    for (const tok of [joinedCore, ...checkTokens]) {
      if (tok.length < 5) continue;
      const dist = levenshteinDistance(tok, rule.fuzzyTarget);
      const sim = normalizedLevenshteinSimilarity(tok, rule.fuzzyTarget);
      if (dist <= 2 && sim >= 0.75 && sim > bestSim) {
        bestSim = sim;
        bestCanonical = rule.canonical;
      }
    }
  }
  if (bestCanonical) return bestCanonical;

  return toSmartTitleCase(cleaned);
}

// ============================================================================
// 3. PRODUCT CATEGORY RESOLVER
// ============================================================================

const GEO_BRACKET_RE = /^\[[a-z]{2}(?:\s*[,;/|]\s*[a-z]{2})+\]$/i;
const URL_RE = /^https?:\/\//i;

const CATEGORY_NOISE_SUFFIXES = new Set([
  "product",
  "products",
]);

const CATEGORY_TOKEN_SYNONYMS: Record<string, string> = {
  age: "aging",
  antiage: "antiaging",
  weightloss: "weightloss",
  skincare: "skincare",
  fungus: "fungal",
};

function tokenizeCategory(raw: string): string[] {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’]s\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => {
      const sing = singularizeWord(tok);
      return CATEGORY_TOKEN_SYNONYMS[sing] ?? sing;
    });
}

function exactCategoryKey(raw: string): string {
  return tokenizeCategory(raw).join("");
}

function coreCategoryKey(raw: string): string {
  const tokens = tokenizeCategory(raw);
  const filtered = tokens.filter((t) => !CATEGORY_NOISE_SUFFIXES.has(t));
  const joined = filtered.join("");
  if (joined.length >= 4) {
    return CATEGORY_TOKEN_SYNONYMS[joined] ?? joined;
  }
  return tokens.join("");
}

function scoreCanonicalCategoryCandidate(name: string): number {
  const trimmed = name.trim();
  const tokens = tokenizeCategory(trimmed);
  const hasNoiseSuffix = tokens.length > 1 && CATEGORY_NOISE_SUFFIXES.has(tokens[tokens.length - 1]);
  const hasUpper = /[A-Z]/.test(trimmed);
  const isTruncatedAge = /\banti[-\s]?age\b/i.test(trimmed);

  let score = 0;
  if (!hasNoiseSuffix) score += 100;
  if (!isTruncatedAge) score += 50;
  if (hasUpper) score += 20;
  // Slight preference for spaced/hyphenated standard formatting without excess bloat
  score -= trimmed.length * 0.1;
  return score;
}

function pickBestCategoryCandidate(candidates: Array<{ name: string }>): string | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort(
    (a, b) => scoreCanonicalCategoryCandidate(b.name) - scoreCanonicalCategoryCandidate(a.name)
  )[0].name;
}

/**
 * Resolve raw product category string (e.g. "Skin Care" vs "Skincare",
 * "Anti Aging Products" / "Anti-age" -> "Anti-Aging", "Male enhancement" -> "Male Enhancement")
 * against existing DB ProductCategory entries, filtering out obvious geo/URL junk.
 */
export function resolveProductCategoryName(
  raw: string | null | undefined,
  existingCategories: Array<{ name: string }> = []
): string | null {
  if (!raw) return null;
  const cleaned = collapseWhitespace(raw).replace(/^[,;|]+|[,;|]+$/g, "").trim();
  if (!cleaned || isPlaceholderName(cleaned)) return null;
  if (GEO_BRACKET_RE.test(cleaned) || URL_RE.test(cleaned)) return null;

  const validExisting = existingCategories.filter(
    (c) => !GEO_BRACKET_RE.test(c.name.trim()) && !URL_RE.test(c.name.trim())
  );

  const qNorm = exactCategoryKey(cleaned);
  const qCore = coreCategoryKey(cleaned);
  if (!qNorm) return null;

  // 1. Exact normalized key match (ignores case, spaces, hyphens, plurals: "Skin Care" == "Skincare")
  const normMatches = validExisting.filter((c) => exactCategoryKey(c.name) === qNorm);
  if (normMatches.length > 0) {
    return pickBestCategoryCandidate(normMatches);
  }

  // 2. Core niche key match ("Anti Aging Products" / "Anti-age" -> "Anti-Aging")
  const coreMatches = validExisting.filter((c) => coreCategoryKey(c.name) === qCore);
  if (coreMatches.length > 0) {
    return pickBestCategoryCandidate(coreMatches);
  }

  // 3. Fuzzy similarity against existing categories (typos like "Diabtes", "Skincrae", "Anti-Agng")
  let bestCandidate: string | null = null;
  let bestScore = 0;

  for (const cand of validExisting) {
    const cNorm = exactCategoryKey(cand.name);
    const cCore = coreCategoryKey(cand.name);

    let sim = 0;
    if (qNorm.length >= 5 && cNorm.length >= 5) {
      const distNorm = levenshteinDistance(qNorm, cNorm);
      const simNorm = normalizedLevenshteinSimilarity(qNorm, cNorm);
      if (distNorm <= 2 && simNorm >= 0.84) {
        sim = Math.max(sim, simNorm * 100);
      }
    }
    if (qCore.length >= 5 && cCore.length >= 5) {
      const distCore = levenshteinDistance(qCore, cCore);
      const simCore = normalizedLevenshteinSimilarity(qCore, cCore);
      if (distCore <= 2 && simCore >= 0.84) {
        sim = Math.max(sim, simCore * 100);
      }
    }

    const tokenFuzzy = fuzzyScore(cand.name, cleaned);
    if (tokenFuzzy >= 86) {
      sim = Math.max(sim, tokenFuzzy);
    }

    if (sim > bestScore) {
      bestScore = sim;
      bestCandidate = cand.name;
    } else if (sim > 0 && sim === bestScore && bestCandidate) {
      if (scoreCanonicalCategoryCandidate(cand.name) > scoreCanonicalCategoryCandidate(bestCandidate)) {
        bestCandidate = cand.name;
      }
    }
  }

  if (bestCandidate) return bestCandidate;

  return toSmartTitleCase(cleaned);
}
