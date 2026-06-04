const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const universes = [
  {
    slug: 'hogar',
    name: 'Hogar',
    description: 'Productos 3D para tu hogar: portavasos, lifestyle, iluminacion, mesa y comedor.',
    icon: 'home',
    primaryColor: '#10B981',
    secondaryColor: '#D1FAE5',
    accentColor: '#065F46',
    order: 1,
    isActive: true,
    comingSoon: false,
  },
  {
    slug: 'kpop',
    name: 'Kpop',
    description: 'Productos 3D inspirados en tus grupos favoritos de K-pop: BTS, Stray Kids y mas.',
    icon: 'music',
    primaryColor: '#EC4899',
    secondaryColor: '#FCE7F3',
    accentColor: '#9D174D',
    order: 2,
    isActive: true,
    comingSoon: false,
  },
  {
    slug: 'gamer',
    name: 'Gamer',
    description: 'Productos 3D para gamers y amantes de los videojuegos.',
    icon: 'gamepad',
    primaryColor: '#8B5CF6',
    secondaryColor: '#EDE9FE',
    accentColor: '#5B21B6',
    order: 3,
    isActive: true,
    comingSoon: true,
  },
];

async function main() {
  console.log('Seeding universes...');

  const created = {};
  for (const u of universes) {
    const universe = await prisma.universe.upsert({
      where: { slug: u.slug },
      update: {
        name: u.name,
        description: u.description,
        icon: u.icon,
        primaryColor: u.primaryColor,
        secondaryColor: u.secondaryColor,
        accentColor: u.accentColor,
        order: u.order,
        isActive: u.isActive,
        comingSoon: u.comingSoon,
      },
      create: u,
    });
    created[u.slug] = universe;
    console.log(`  - ${u.slug} (${universe.id})`);
  }

  console.log("Backfilling existing categories to 'hogar' universe...");
  const result = await prisma.category.updateMany({
    where: { universeId: null },
    data: { universeId: created.hogar.id },
  });
  console.log(`  - Updated ${result.count} categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
