import { prisma } from '../src/lib/prisma';
import { fuzzyMatchAny } from '../src/lib/fuzzy';

async function main() {
  const products = await prisma.product.findMany({
    include: {
      site: true,
      category: true,
      addedBy: true,
      article: {
        include: {
          writer: true,
        },
      },
    },
  });

  console.log(`Total products in DB: ${products.length}`);

  const testQueries = ['hi', 'v', 'lap', 'test'];

  for (const query of testQueries) {
    const matchedProducts = products.filter((p) => {
      return fuzzyMatchAny(
        [
          p.name,
          p.slug,
          p.site?.name,
          p.category?.name,
          p.productCategory,
          p.affiliateName,
          p.addedBy?.name,
        ],
        query
      );
    });

    console.log(`\n--- Results for query: "${query}" (count: ${matchedProducts.length}) ---`);
    matchedProducts.slice(0, 10).forEach((p) => {
      console.log(`  - Product: "${p.name}", Site: "${p.site?.name}", Cat: "${p.category?.name}", AddedBy: "${p.addedBy?.name}"`);
    });
  }

  // Articles test
  const articles = await prisma.article.findMany({
    include: {
      product: {
        include: {
          site: true,
        },
      },
      writer: true,
    },
  });

  console.log(`\nTotal articles in DB: ${articles.length}`);

  for (const query of testQueries) {
    const matchedArticles = articles.filter((a) => {
      return fuzzyMatchAny(
        [
          a.product?.name,
          a.product?.slug,
          a.writer?.name,
          a.product?.site?.name,
          String(a.id),
          String(a.product?.id),
        ],
        query
      );
    });

    console.log(`\n--- Articles for query: "${query}" (count: ${matchedArticles.length}) ---`);
    matchedArticles.slice(0, 10).forEach((a) => {
      console.log(`  - Article ID ${a.id}: Product "${a.product?.name}", Site "${a.product?.site?.name}", Writer "${a.writer?.name}"`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
