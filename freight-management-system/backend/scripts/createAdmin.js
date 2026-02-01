const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  const email = 'surendra@kumbhatco.in';
  const plainPassword = '99665588';

  try {
    console.log(`Ensuring admin account exists for ${email}...`);

    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const admin = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        role: 'ADMIN',
        isActive: true,
        name: 'Surendra Chakali',
        phone: '+91-0000000000',
      },
      create: {
        email,
        passwordHash,
        name: 'Surendra Chakali',
        role: 'ADMIN',
        phone: '+91-0000000000',
        isActive: true,
      },
    });

    console.log('Admin account ready:', {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    });
  } catch (error) {
    console.error('Failed to create admin user:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
