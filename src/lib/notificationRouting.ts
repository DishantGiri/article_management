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

  // Extract all quoted strings from message: e.g. "CertiFlow", "Admitad", etc.
  const quotedMatches = Array.from(msg.matchAll(/"([^"]+)"/g)).map((m) => m[1].trim());
  const primaryItem = quotedMatches[0] || null;

  // 1. LINK ISSUES (routes directly to /links with status=ISSUE and item search)
  if (
    type === "LINK_ISSUE" ||
    lowerMsg.includes("issue with link") ||
    lowerMsg.includes("flagged an issue") ||
    lowerMsg.includes("reported an issue") ||
    lowerMsg.includes("dead link") ||
    lowerMsg.includes("link issue")
  ) {
    const params = new URLSearchParams();
    if (primaryItem) {
      params.set("search", primaryItem);
    }
    params.set("status", "ISSUE");
    return `/links?${params.toString()}`;
  }

  // 2. PRODUCT ADDED (routes directly to /products with product search)
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

  // 3. NOTICE PUBLISHED (routes to /notices)
  if (
    type === "NOTICE_PUBLISHED" ||
    lowerMsg.startsWith("new notice:") ||
    lowerMsg.includes("notice:")
  ) {
    return `/notices`;
  }

  // 4. ARTICLE: REDO / CHANGES REQUESTED
  if (
    lowerMsg.includes("changes requested") ||
    lowerMsg.includes("redo") ||
    lowerMsg.includes("revision requested") ||
    lowerMsg.includes("needs changes")
  ) {
    if (currentUserRole === "WRITER") {
      // If writer has an active assignment, navigating to / allows direct authoring,
      // while /articles with REDO filter gives full visibility.
      if (primaryItem) {
        return `/articles?search=${encodeURIComponent(primaryItem)}&status=REDO`;
      }
      return `/?tab=write`;
    }
    const params = new URLSearchParams();
    if (primaryItem) params.set("search", primaryItem);
    params.set("status", "REDO");
    return `/articles?${params.toString()}`;
  }

  // 5. ARTICLE: COMPLETED / SUBMITTED (Ready for review)
  if (
    lowerMsg.includes("completed the article") ||
    lowerMsg.includes("completed writing the article") ||
    lowerMsg.includes("submitted a revision") ||
    lowerMsg.includes("ready for review") ||
    lowerMsg.includes("please review it")
  ) {
    const params = new URLSearchParams();
    if (primaryItem) params.set("search", primaryItem);
    params.set("status", "COMPLETED");
    return `/articles?${params.toString()}`;
  }

  // 6. ARTICLE: APPROVED
  if (
    lowerMsg.includes("was approved") ||
    lowerMsg.includes("article approved") ||
    lowerMsg.includes("approval granted") ||
    type === "APPROVAL_GRANTED"
  ) {
    const params = new URLSearchParams();
    if (primaryItem) params.set("search", primaryItem);
    params.set("status", "APPROVED");
    return `/articles?${params.toString()}`;
  }

  // 7. ARTICLE: STARTED WRITING
  if (
    lowerMsg.includes("started writing the article") ||
    lowerMsg.includes("started writing")
  ) {
    const params = new URLSearchParams();
    if (primaryItem) params.set("search", primaryItem);
    params.set("status", "IN_PROGRESS");
    return `/articles?${params.toString()}`;
  }

  // 8. ARTICLE: ASSIGNED TO WRITER
  if (
    lowerMsg.includes("assigned you the article") ||
    lowerMsg.includes("assigned to write")
  ) {
    if (currentUserRole === "WRITER") {
      if (primaryItem) {
        return `/articles?search=${encodeURIComponent(primaryItem)}`;
      }
      return `/?tab=write`;
    }
    if (primaryItem) {
      return `/articles?search=${encodeURIComponent(primaryItem)}`;
    }
    return `/articles`;
  }

  // 9. ARTICLE: UPDATE REQUEST / SPECIAL APPROVAL
  if (
    lowerMsg.includes("requested article update approval") ||
    lowerMsg.includes("special approval") ||
    lowerMsg.includes("update request:") ||
    lowerMsg.includes("flag raised:")
  ) {
    if (primaryItem) {
      return `/articles?search=${encodeURIComponent(primaryItem)}`;
    }
    return `/articles`;
  }

  // 10. Fallback Heuristics
  if (primaryItem) {
    if (lowerMsg.includes("link") || currentUserRole === "LINKER") {
      return `/links?search=${encodeURIComponent(primaryItem)}`;
    }
    if (lowerMsg.includes("product")) {
      return `/products?search=${encodeURIComponent(primaryItem)}`;
    }
    return `/articles?search=${encodeURIComponent(primaryItem)}`;
  }

  if (currentUserRole === "LINKER") return "/links";
  return "/articles";
}
