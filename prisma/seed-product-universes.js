const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Backfilling product universeId...');

  const hogar = await prisma.universe.findUnique({ where: { slug: 'hogar' } });
  if (!hogar) {
    throw new Error("'hogar' universe not found. Run seed-universes.js first.");
  }

  // 1) For products WITH a category: inherit category's universeId.
  const productsWithCategory = await prisma.product.findMany({
    where: { universeId: null, categoryId: { not: null } },
    include: { category: true },
  });

  let inheritedCount = 0;
  for (const p of productsWithCategory) {
    const targetUniverseId = p.category?.universeId || hogar.id;
    await prisma.product.update({
      where: { id: p.id },
      data: { universeId: targetUniverseId },
    });
    inheritedCount++;
  }
  console.log(`  - Inherited universeId on ${inheritedCount} products from their category.`);

  // 2) For products WITHOUT a category: default to hogar.
  const result = await prisma.product.updateMany({
    where: { universeId: null },
    data: { universeId: hogar.id },
  });
  console.log(`  - Defaulted ${result.count} category-less products to 'hogar'.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
