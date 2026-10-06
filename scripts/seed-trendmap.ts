import { prisma } from "../src/lib/prisma";

async function main() {
  const initialItems = [
    {
      name: "Tru Supplements",
      productUrl: "https://getsupplementreviews.com/tru-supplements-review/",
      competitor: "getsupplementreviews.com",
      searchDemand: "26 / 100",
      demandScore: 26,
      demandLevel: "LOW",
      category: "Supplements",
      market: "United (US)",
      modifiedDate: "Jan 19, 2026",
      discoveredDate: "Oct 6",
      notes: "Opportunity from Trendmap checklist",
      status: "PENDING",
      addedToCatalog: false,
    },
    {
      name: "Psilly Gummies",
      productUrl: "https://getsupplementreviews.com/psilly-gummies-review-what-you-need-to-know/",
      competitor: "getsupplementreviews.com",
      searchDemand: null,
      demandScore: null,
      demandLevel: "NOT_ANALYZED",
      category: "Supplements",
      market: "United (US)",
      modifiedDate: "Jan 19, 2026",
      discoveredDate: "Oct 6",
      notes: "High potential mushroom gummy competitor review",
      status: "PENDING",
      addedToCatalog: false,
    },
    {
      name: "Auri Gummies",
      productUrl: "https://getsupplementreviews.com/auri-gummies-review-is-it-effective/",
      competitor: "getsupplementreviews.com",
      searchDemand: null,
      demandScore: null,
      demandLevel: "NOT_ANALYZED",
      category: "Supplements",
      market: "United (US)",
      modifiedDate: "Jan 19, 2026",
      discoveredDate: "Oct 6",
      notes: "Emerging competitor gummy opportunity",
      status: "PENDING",
      addedToCatalog: false,
    },
    {
      name: "Provence Beauty",
      productUrl: "https://getsupplementreviews.com/provence-beauty-reviews/",
      competitor: "getsupplementreviews.com",
      searchDemand: null,
      demandScore: null,
      demandLevel: "NOT_ANALYZED",
      category: "Skincare",
      market: "United (US)",
      modifiedDate: "Jan 19, 2026",
      discoveredDate: "Oct 6",
      notes: "Top skincare brand competitor review",
      status: "PENDING",
      addedToCatalog: false,
    },
    {
      name: "Plasmalogen Supplement",
      productUrl: "https://getsupplementreviews.com/plasmalogen-supplement-reviews-are-they-effective/",
      competitor: "getsupplementreviews.com",
      searchDemand: null,
      demandScore: null,
      demandLevel: "NOT_ANALYZED",
      category: "Supplements",
      market: "United (US)",
      modifiedDate: "Jan 19, 2026",
      discoveredDate: "Oct 6",
      notes: "Nootropic plasmalogen cognitive supplement",
      status: "PENDING",
      addedToCatalog: false,
    },
  ];

  for (const item of initialItems) {
    const existing = await prisma.trendmapProduct.findFirst({
      where: { name: item.name },
    });
    if (!existing) {
      await prisma.trendmapProduct.create({ data: item });
      console.log(`Created: ${item.name}`);
    } else {
      console.log(`Already exists: ${item.name}`);
    }
  }

  console.log("Trendmap initial seeding completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
