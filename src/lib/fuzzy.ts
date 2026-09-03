/**
 * High-performance Fuzzy Search Utility for Product & Entity Search Boxes
 *
 * Supports:
 * 1. Exact substring matching (case-insensitive)
 * 2. Word boundary & prefix matching (e.g. "whey" in "Alpha Whey Protein")
 * 3. Multi-token out-of-order matching (e.g. "protein alpha" matches "Alpha Whey Protein")
 * 4. Subsequence / acronym matching (e.g. "awp" matches "Alpha Whey Protein")
 * 5. Typo tolerance via Levenshtein edit distance (e.g. "protien" -> "protein", "crreatine" -> "creatine")
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
 * Checks if query characters appear in target in sequential order.
 */
function isSubsequence(target: string, query: string): boolean {
  if (!query) return true;
  if (query.length > target.length) return false;

  let qIdx = 0;
  for (let tIdx = 0; tIdx < target.length && qIdx < query.length; tIdx++) {
    if (target[tIdx] === query[qIdx]) {
      qIdx++;
    }
  }
  return qIdx === query.length;
}

/**
 * Cleans and normalizes text for robust comparisons.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[_\-\\/.,+&]/g, " ") // replace delimiters with spaces
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

  // 3. Exact substring match
  if (target.includes(query)) return 90;

  // 4. Multi-token match (all words in query must match a word or prefix in target)
  const queryTokens = query.split(" ").filter(Boolean);
  const targetTokens = target.split(" ").filter(Boolean);

  if (queryTokens.length > 1) {
    const allTokensMatch = queryTokens.every((qTok) =>
      targetTokens.some(
        (tTok) =>
          tTok.includes(qTok) ||
          (qTok.length >= 3 && levenshteinDistance(tTok, qTok) <= (qTok.length > 5 ? 2 : 1))
      )
    );
    if (allTokensMatch) return 85;
  }

  // 5. Individual word match or word-prefix match
  for (const tTok of targetTokens) {
    if (tTok.startsWith(query)) return 80;
    if (tTok.includes(query)) return 75;
  }

  // 6. Typo-tolerant match for single-word queries
  if (queryTokens.length === 1) {
    const qTok = queryTokens[0];
    const maxAllowedDistance = qTok.length <= 3 ? 1 : qTok.length <= 6 ? 2 : 3;

    for (const tTok of targetTokens) {
      // Direct word edit distance
      const dist = levenshteinDistance(tTok, qTok);
      if (dist <= maxAllowedDistance) {
        return 70 - dist * 5;
      }

      // Check prefix edit distance (e.g. target="protein", query="protin" or "proten")
      if (tTok.length > qTok.length) {
        const prefix = tTok.slice(0, qTok.length);
        if (levenshteinDistance(prefix, qTok) <= 1) {
          return 65;
        }
      }
    }
  }

  // 7. Subsequence / Acronym match (e.g. "awp" in "alpha whey protein")
  if (query.length >= 2 && isSubsequence(target.replace(/\s+/g, ""), query.replace(/\s+/g, ""))) {
    const initials = targetTokens.map((t) => t[0]).join("");
    if (initials.includes(query.replace(/\s+/g, ""))) {
      return 60;
    }
    return 50;
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

  // Fast path: direct includes check on any field
  const qLower = query.toLowerCase().trim();
  for (const field of fields) {
    if (field && field.toLowerCase().includes(qLower)) {
      return true;
    }
  }

  // Fuzzy score check on each field
  for (const field of fields) {
    if (field && fuzzyScore(field, query) >= minScore) {
      return true;
    }
  }

  // Also check combined fields string (e.g. "Alpha Whey Protein Ecomm")
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

    // Check combined text
    const combined = fields.filter(Boolean).join(" ");
    const combinedScore = fuzzyScore(combined, query);
    if (combinedScore > bestScore) bestScore = combinedScore;

    if (bestScore >= minScore) {
      scored.push({ item, score: bestScore });
    }
  }

  // Sort descending by score to bring highest-quality matches to the top
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.item);
}
