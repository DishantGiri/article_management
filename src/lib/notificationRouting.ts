/**
 * Utility to parse notifications and resolve accurate target URLs with search and status filters.
 */

export function getNotificationTargetUrl(
  notification: { type?: string; message: string },
  currentUserRole?: string
): string {
  const msg = notification.message || "";
  const type = notification.type || "";
  const lowerMsg = msg.toLowerCase();
  const role = (currentUserRole || "WRITER").toUpperCase();

  // Extract all quoted strings from message: e.g. "CertiFlow", "Admitad", etc.
  const quotedMatches = Array.from(msg.matchAll(/"([^"]+)"/g)).map((m) => m[1].trim());
  let primaryItem = quotedMatches[0] || null;

  // If no quoted string found, try other heuristics (e.g. notice title, product lists)
  if (!primaryItem) {
    const noticeMatch = msg.match(/(?:new\s+)?notice:\s*(.+)$/i);
    if (noticeMatch) {
      primaryItem = noticeMatch[1].trim();
    } else {
      const prodsMatch = msg.match(/products?\s+(?:added|available):\s*([^.]+)/i);
      if (prodsMatch) {
        primaryItem = prodsMatch[1].split(",")[0].trim();
      }
    }
  }

  // 1. NOTICE PUBLISHED (routes to /notices)
  if (
    type === "NOTICE_PUBLISHED" ||
    lowerMsg.startsWith("new notice:") ||
    lowerMsg.includes("notice:")
  ) {
    if (primaryItem) {
      return `/notices?search=${encodeURIComponent(primaryItem)}`;
    }
    return `/notices`;
  }

  // 2. LINK ISSUES (routes to /links with status=ISSUE, or /products for WRITERS who cannot access /links)
  if (
    type === "LINK_ISSUE" ||
    lowerMsg.includes("issue with link") ||
    lowerMsg.includes("flagged an issue") ||
    lowerMsg.includes("reported an issue") ||
    lowerMsg.includes("dead link") ||
    lowerMsg.includes("link issue")
  ) {
    // Writers cannot access /links due to route middleware restrictions
    if (role === "WRITER") {
      return primaryItem
        ? `/products?search=${encodeURIComponent(primaryItem)}`
        : `/products`;
    }
    const params = new URLSearchParams();
    if (primaryItem) {
      params.set("search", primaryItem);
    }
    params.set("status", "ISSUE");
    return `/links?${params.toString()}`;
  }

  // 3. PRODUCT ADDED / IMPORTED (routes to /products with product search)
  if (
    type === "PRODUCT_ADDED" ||
    lowerMsg.includes("product added") ||
    lowerMsg.includes("new product")
  ) {
    if (primaryItem) {
      return `/products?search=${encodeURIComponent(primaryItem)}`;
    }
    return `/products`;
  }

  // 4. ARTICLE: SPECIAL APPROVAL GRANTED (UNLOCKED FOR EDITING)
  // When an edit request is approved, article status becomes IN_PROGRESS (not APPROVED).
  if (
    lowerMsg.includes("unlocked for you to edit") ||
    (lowerMsg.includes("request to update") && lowerMsg.includes("was approved"))
  ) {
    if (role === "LINKER") {
      return primaryItem ? `/links?search=${encodeURIComponent(primaryItem)}` : `/links`;
    }
    if (role === "WRITER") {
      return primaryItem
        ? `/articles?search=${encodeURIComponent(primaryItem)}`
        : `/?tab=write`;
    }
    return primaryItem ? `/articles?search=${encodeURIComponent(primaryItem)}` : `/articles`;
  }

  // 5. ARTICLE: REDO / CHANGES REQUESTED
  if (
    lowerMsg.includes("changes requested") ||
    lowerMsg.includes("redo") ||
    lowerMsg.includes("revision requested") ||
    lowerMsg.includes("needs changes")
  ) {
    if (role === "LINKER") {
      return primaryItem ? `/links?search=${encodeURIComponent(primaryItem)}` : `/links`;
    }
    const params = new URLSearchParams();
    if (primaryItem) params.set("search", primaryItem);
    params.set("status", "REDO");
    return `/articles?${params.toString()}`;
  }

  // 6. ARTICLE: COMPLETED / SUBMITTED (Ready for review by Team Lead / Admin)
  if (
    lowerMsg.includes("completed the article") ||
    lowerMsg.includes("completed writing the article") ||
    lowerMsg.includes("submitted a revision") ||
    lowerMsg.includes("ready for review") ||
    lowerMsg.includes("please review it")
  ) {
    if (role === "LINKER") {
      return primaryItem ? `/links?search=${encodeURIComponent(primaryItem)}` : `/links`;
    }
    const params = new URLSearchParams();
    if (primaryItem) params.set("search", primaryItem);
    params.set("status", "COMPLETED");
    return `/articles?${params.toString()}`;
  }

  // 7. ARTICLE: APPROVED (Initial article approval)
  if (
    lowerMsg.includes("was approved") ||
    lowerMsg.includes("article approved") ||
    type === "APPROVAL_GRANTED"
  ) {
    if (role === "LINKER") {
      return primaryItem ? `/links?search=${encodeURIComponent(primaryItem)}` : `/links`;
    }
    const params = new URLSearchParams();
    if (primaryItem) params.set("search", primaryItem);
    params.set("status", "APPROVED");
    return `/articles?${params.toString()}`;
  }

  // 8. ARTICLE: STARTED WRITING
  if (
    lowerMsg.includes("started writing the article") ||
    lowerMsg.includes("started writing")
  ) {
    if (role === "LINKER") {
      return primaryItem ? `/links?search=${encodeURIComponent(primaryItem)}` : `/links`;
    }
    const params = new URLSearchParams();
    if (primaryItem) params.set("search", primaryItem);
    params.set("status", "IN_PROGRESS");
    return `/articles?${params.toString()}`;
  }

  // 9. ARTICLE: ASSIGNED TO WRITER / NEW ARTICLE AVAILABLE
  if (
    lowerMsg.includes("assigned you the article") ||
    lowerMsg.includes("assigned to write") ||
    lowerMsg.includes("new article available") ||
    lowerMsg.includes("opened the article")
  ) {
    if (role === "LINKER") {
      return primaryItem ? `/links?search=${encodeURIComponent(primaryItem)}` : `/links`;
    }
    if (primaryItem) {
      return `/articles?search=${encodeURIComponent(primaryItem)}`;
    }
    return `/articles`;
  }

  // 10. ARTICLE: UPDATE REQUEST / SPECIAL APPROVAL / FLAG RAISED / DECLINED
  if (
    lowerMsg.includes("requested article update approval") ||
    lowerMsg.includes("requested permission to edit") ||
    lowerMsg.includes("special approval") ||
    lowerMsg.includes("update request:") ||
    lowerMsg.includes("flag raised:") ||
    lowerMsg.includes("declined by")
  ) {
    if (role === "LINKER") {
      return primaryItem ? `/links?search=${encodeURIComponent(primaryItem)}` : `/links`;
    }
    if (primaryItem) {
      return `/articles?search=${encodeURIComponent(primaryItem)}`;
    }
    return `/articles`;
  }

  // 11. Role-safe fallbacks based on role and keywords
  if (primaryItem) {
    if (role === "LINKER") {
      return `/links?search=${encodeURIComponent(primaryItem)}`;
    }
    if (role === "WRITER") {
      return `/articles?search=${encodeURIComponent(primaryItem)}`;
    }
    if (lowerMsg.includes("link")) {
      return `/links?search=${encodeURIComponent(primaryItem)}`;
    }
    if (lowerMsg.includes("product")) {
      return `/products?search=${encodeURIComponent(primaryItem)}`;
    }
    return `/articles?search=${encodeURIComponent(primaryItem)}`;
  }

  if (role === "LINKER") return "/links";
  return "/articles";
}
