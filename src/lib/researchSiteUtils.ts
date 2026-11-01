export const PRODUCT_RESEARCH_SITE_NAME = "Product Research";

export function isResearchSite(siteName?: string | null): boolean {
  if (!siteName) return false;
  const lower = siteName.toLowerCase().trim();
  return lower === "product research" || lower === "product research hub";
}
