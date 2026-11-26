import { fuzzyScore, levenshteinDistance } from "@/lib/fuzzy";
import { isPlaceholderName } from "@/lib/user-resolver";

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
  smartadv: "SmartADV",
  smartadvrajan: "smart adv rajan",
  buygoods: "BuyGoods",
  buygood: "BuyGoods",
  clickshunt: "ClicksHunt",
  clickhunt: "ClicksHunt",
  mediascalers: "MediaScalers",
  mediascaler: "MediaScalers",
  smashloud: "SmashLoud",
  smashload: "SmashLoud",
  clickbank: "ClickBank",
  amazon: "Amazon Associates",
  amazonassociates: "Amazon Associates",
  amazonassociate: "Amazon Associates",
  amzn: "Amazon Associates",
  spyrevenue: "SpyRevenue",
  clicksadv: "ClicksADV",
  clickadv: "ClicksADV",
  dynuinmedia: "DynuinMedia",
  dynuin: "DynuinMedia",
  terraleads: "Terraleads",
  terralead: "Terraleads",
  trafficlight: "TrafficLight",
  adcombo: "Adcombo",
  giddyup: "Giddy Up",
  inb: "inb",
  kissmyads: "kissmyads",
  leadbit: "Leadbit",
  maxweb: "Maxweb",
  mylead: "mylead",
  myleads: "mylead",
  sellhealth: "Sell Health",
  blitzads: "BlitzAds",
  blitzad: "BlitzAds",
  metacpa: "Meta Cpa",
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
  return [...matches].sort((a, b) => {
    const aCompact = !/\s/.test(a.name.trim()) ? 0 : 1;
    const bCompact = !/\s/.test(b.name.trim()) ? 0 : 1;
    if (aCompact !== bCompact) return aCompact - bCompact;
    return a.name.length - b.name.length;
  })[0].name;
}

/**
 * Resolve raw affiliate network name (e.g. "Smart ADV", "Buy Goods", "Clicks Hunt",
 * "MediaScaler", "SmashLoad") to its canonical AffiliateName in DB/aliases.
 * Returns null for placeholders or explicit "No Affiliate" values.
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

  const singularStripped = stripSingularAlnumLower(cleaned);
  const aliasTarget = AFFILIATE_ALIASES[stripped] ?? AFFILIATE_ALIASES[singularStripped] ?? null;

  // 1. Exact stripped key match against DB (and prefer aliasTarget when DB has duplicates)
  const strippedMatches = existingAffiliates.filter(
    (a) => stripAlnumLower(a.name) === stripped
  );
  if (strippedMatches.length > 0) {
    return pickCanonicalAffiliate(strippedMatches, aliasTarget);
  }

  // 2. Alias match -> resolve to matching DB record or canonical alias string
  if (aliasTarget) {
    const aliasKey = stripAlnumLower(aliasTarget);
    const dbMatch = existingAffiliates.filter(
      (a) => stripAlnumLower(a.name) === aliasKey || stripSingularAlnumLower(a.name) === stripSingularAlnumLower(aliasTarget)
    );
    if (dbMatch.length > 0) {
      return pickCanonicalAffiliate(dbMatch, aliasTarget);
    }
    return aliasTarget;
  }

  // 3. Singularized stripped match against DB (e.g. MediaScaler -> MediaScalers)
  const singularMatches = existingAffiliates.filter(
    (a) => stripSingularAlnumLower(a.name) === singularStripped
  );
  if (singularMatches.length > 0) {
    return pickCanonicalAffiliate(singularMatches);
  }

  // 4. High-precision fuzzy match against DB affiliates (e.g. small typo like "SmarADV")
  if (stripped.length >= 5) {
    let bestName: string | null = null;
    let bestScore = 0;

    for (const candidate of existingAffiliates) {
      const candStrip = stripAlnumLower(candidate.name);
      if (candStrip.length < 5) continue;
      // Prevent short base names from collapsing onto distinct multi-word variants like "smart adv rajan"
      if (Math.abs(candStrip.length - stripped.length) > 3) continue;

      const dist = levenshteinDistance(stripped, candStrip);
      const sim = normalizedLevenshteinSimilarity(stripped, candStrip);
      if (dist <= 2 && sim >= 0.8 && sim > bestScore) {
        bestScore = sim;
        bestName = candidate.name;
      }
    }
    if (bestName) return bestName;

    // Also check fuzzy typos against known aliases
    for (const [key, canonical] of Object.entries(AFFILIATE_ALIASES)) {
      if (key.length < 5 || Math.abs(key.length - stripped.length) > 2) continue;
      const dist = levenshteinDistance(stripped, key);
      const sim = normalizedLevenshteinSimilarity(stripped, key);
      if (dist <= 2 && sim >= 0.8) {
        const dbMatch = existingAffiliates.find(
          (a) => stripAlnumLower(a.name) === stripAlnumLower(canonical)
        );
        return dbMatch ? dbMatch.name : canonical;
      }
    }
  }

  return cleaned;
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
