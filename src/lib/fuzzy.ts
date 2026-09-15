/**
 * High-performance Fuzzy Search Utility for Product & Entity Search Boxes
 *
 * Supports:
 * 1. Exact match (100)
 * 2. Prefix match (95)
 * 3. Word-level prefix match (e.g. "whey" matches "Alpha Whey Protein") (85-90)
 * 4. Multi-token out-of-order matching (e.g. "protein alpha" matches "Alpha Whey Protein") (80)
 * 5. Acronym / initials matching for multi-word targets (e.g. "awp" matches "Alpha Whey Protein") (70-75)
 * 6. Substring & typo tolerance ONLY for longer queries (5+ chars) (65-75)
 *
 * Short Query Rule (1-4 chars):
 * Queries with 1-4 characters require exact match, whole-string prefix, or word-boundary prefix.
 * Arbitrary middle-of-word substrings and typo-edit distances are disabled to prevent
 * massive false positive explosions (e.g. "hi" matching "v", "health", "Shiridhar", "Dolphin").
 */

/**
 * Calculates the Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prevRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  let currRow = new Array(b.length + 1);

  for (let i = 0; i < a.length; i++) {
    currRow[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      currRow[j + 1] = Math.min(
        currRow[j] + 1, // insertion
        prevRow[j + 1] + 1, // deletion
        prevRow[j] + cost // substitution
      );
    }
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[b.length];
}

/**
 * Cleans and normalizes text for robust comparisons.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/([a-z])([A-Z])/g, "$1 $2") // split camelCase e.g. UltraHi -> Ultra Hi
    .replace(/([a-zA-Z])(\d)/g, "$1 $2") // split letter-number e.g. Whey1 -> Whey 1
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .replace(/[_\-\\/.,+&()|[\]{}:;!?'"`~*^%$#@]/g, " ") // replace delimiters with spaces
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Evaluates whether a single target string fuzzy-matches a search query.
 * Returns a score from 0 (no match) to 100 (exact match).
 */
export function fuzzyScore(rawTarget: string | null | undefined, rawQuery: string): number {
  if (!rawQuery || !rawQuery.trim()) return 100;
  if (!rawTarget) return 0;

  const target = normalize(rawTarget);
  const query = normalize(rawQuery);

  if (!target || !query) return 0;

  // 1. Exact match
  if (target === query) return 100;

  // 2. Exact prefix
  if (target.startsWith(query)) return 95;

  const queryTokens = query.split(" ").filter(Boolean);
  const targetTokens = target.split(" ").filter(Boolean);

  if (queryTokens.length === 0) return 100;

  const isShortQuery = query.length <= 4;

  // 3. Multi-token query (e.g. "whey pro" or "alpha whey")
  if (queryTokens.length > 1) {
    const allTokensMatch = queryTokens.every((qTok) =>
      targetTokens.some((tTok) => {
        if (qTok.length <= 4) {
          return tTok.startsWith(qTok);
        } else {
          return (
            tTok.includes(qTok) ||
            (Math.abs(tTok.length - qTok.length) <= 1 && levenshteinDistance(tTok, qTok) <= 1)
          );
        }
      })
    );
    if (allTokensMatch) return 85;
    return 0;
  }

  const qTok = queryTokens[0];

  // 4. Word-prefix match (any word in target starts with the query token)
  // e.g. "hi" in "Alpha High" or "Hi-Tech", "whey" in "Alpha Whey Protein"
  const hasWordPrefix = targetTokens.some((tTok) => tTok.startsWith(qTok));
  if (hasWordPrefix) {
    // If one of the words is exactly the query token, score higher
    if (targetTokens.some((tTok) => tTok === qTok)) {
      return 90;
    }
    return 85;
  }

  // 5. Acronym / Initials match for multi-word targets (e.g. "awp" in "Alpha Whey Protein")
  if (targetTokens.length >= 2 && qTok.length >= 2 && qTok.length <= targetTokens.length) {
    const initials = targetTokens.map((t) => t[0]).join("");
    if (initials === qTok) {
      return 75;
    }
    if (initials.startsWith(qTok)) {
      return 70;
    }
  }

  // FOR SHORT QUERIES (1-4 chars): STOP HERE!
  // Do NOT allow middle-of-word substrings (e.g. "hi" in "Shiridhar" or "Dolphin")
  // Do NOT allow typo edit distance (e.g. "hi" matching "ti", "fi", "he")
  if (isShortQuery) {
    return 0;
  }

  // 6. Substring match for longer queries (5+ characters)
  // e.g. query "protein" inside "UltraProteinPlus"
  if (target.includes(qTok)) return 75;

  // 7. Typo-tolerant match for longer single-word queries (5+ characters)
  // e.g. query "protien" (7 chars) for "protein" (dist 1)
  const maxAllowedDistance = qTok.length <= 6 ? 1 : 2;
  for (const tTok of targetTokens) {
    if (Math.abs(tTok.length - qTok.length) <= maxAllowedDistance) {
      const dist = levenshteinDistance(tTok, qTok);
      if (dist <= maxAllowedDistance) {
        return 70 - dist * 5;
      }
    }
  }

  return 0;
}

/**
 * Returns true if the target matches the query according to fuzzy search rules.
 */
export function fuzzyMatch(target: string | null | undefined, query: string, minScore = 40): boolean {
  if (!query || !query.trim()) return true;
  return fuzzyScore(target, query) >= minScore;
}

/**
 * Checks multiple fields of an item and returns true if any field fuzzy-matches the query.
 */
export function fuzzyMatchAny(
  fields: (string | null | undefined)[],
  query: string,
  minScore = 40
): boolean {
  if (!query || !query.trim()) return true;

  const qLower = query.toLowerCase().trim();
  const isShort = qLower.length <= 4;

  if (isShort) {
    // For short queries (1-4 characters):
    // Require word-prefix, exact match, or initials match via fuzzyScore
    for (const field of fields) {
      if (field && fuzzyScore(field, query) >= minScore) {
        return true;
      }
    }
    return false;
  }

  // For longer queries (5+ characters):
  // Fast path: direct includes check
  for (const field of fields) {
    if (field && field.toLowerCase().includes(qLower)) {
      return true;
    }
  }

  for (const field of fields) {
    if (field && fuzzyScore(field, query) >= minScore) {
      return true;
    }
  }

  // Combined text check for multi-word queries across fields (e.g. "Alpha NutraVital")
  const combined = fields.filter(Boolean).join(" ");
  return fuzzyScore(combined, query) >= minScore;
}

/**
 * Fuzzy filters and sorts a list of items based on their match score against a query.
 */
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  getFields: (item: T) => (string | null | undefined)[],
  minScore = 40
): T[] {
  if (!query || !query.trim()) return items;

  const scored: { item: T; score: number }[] = [];

  for (const item of items) {
    const fields = getFields(item);
    let bestScore = 0;

    for (const field of fields) {
      if (field) {
        const s = fuzzyScore(field, query);
        if (s > bestScore) bestScore = s;
      }
    }

    // Check combined text only for longer queries (5+ chars)
    if (query.trim().length >= 5) {
      const combined = fields.filter(Boolean).join(" ");
      const combinedScore = fuzzyScore(combined, query);
      if (combinedScore > bestScore) bestScore = combinedScore;
    }

    if (bestScore >= minScore) {
      scored.push({ item, score: bestScore });
    }
  }

  // Sort descending by score to bring highest-quality matches to the top
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.item);
}
