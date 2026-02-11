const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'Surendra@kumbhatco.in';
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || '99665588@Rm1';
const SUPERADMIN_NAME = process.env.SUPERADMIN_NAME || 'Surendra (Super Admin)';

async function main() {
  console.log('Seeding superadmin account...');
  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: SUPERADMIN_EMAIL },
    update: {
      passwordHash,
      name: SUPERADMIN_NAME,
      role: 'SUPER_ADMIN',
      approvalStatus: 'APPROVED',
      isActive: true,
    },
    create: {
      email: SUPERADMIN_EMAIL,
      passwordHash,
      name: SUPERADMIN_NAME,
      role: 'SUPER_ADMIN',
      approvalStatus: 'APPROVED',
      isActive: true,
    },
  });

  console.log(`Superadmin ready: ${SUPERADMIN_EMAIL}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
