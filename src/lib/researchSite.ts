import { prisma } from "@/lib/prisma";

export const PRODUCT_RESEARCH_SITE_NAME = "Product Research";

export async function getOrCreateResearchSite() {
  let site = await prisma.site.findFirst({
    where: {
      name: { in: [PRODUCT_RESEARCH_SITE_NAME, "Product Research Hub"] },
    },
  });

  if (!site) {
    site = await prisma.site.create({
      data: {
        name: PRODUCT_RESEARCH_SITE_NAME,
        url: "https://product-research.internal",
      },
    });
  }

  return site;
}

export function isResearchSite(siteName?: string | null): boolean {
  if (!siteName) return false;
  const lower = siteName.toLowerCase().trim();
  return lower === "product research" || lower === "product research hub";
}
