import { prisma } from "@/lib/prisma";
import { PRODUCT_RESEARCH_SITE_NAME, isResearchSite } from "./researchSiteUtils";

export { PRODUCT_RESEARCH_SITE_NAME, isResearchSite };

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
