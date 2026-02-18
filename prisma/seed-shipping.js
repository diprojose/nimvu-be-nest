
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const country = 'Colombia';

  // Check if default rate exists
  const existing = await prisma.shippingRate.findFirst({
    where: { country, state: null, city: null }
  });

  if (!existing) {
    console.log(`Creating default shipping rate for ${country}...`);
    await prisma.shippingRate.create({
      data: {
        country,
        price: 15000
      }
    });
    console.log('Default shipping rate created.');
  } else {
    console.log('Default shipping rate already exists.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
