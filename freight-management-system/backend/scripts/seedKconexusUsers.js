require('dotenv/config');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PrismaClient, Role } = require('@prisma/client');

const prisma = new PrismaClient();

const companyName = 'KConexus Logistics';

const tenantUsers = [
  {
    email: 'company.admin@kconexus.com',
    name: 'KConexus Admin',
    password: 'Admin@123',
    role: Role.COMPANY_ADMIN,
  },
  {
    email: 'finance@kconexus.com',
    name: 'Finance Approver',
    password: 'Fin@1234',
    role: Role.FINANCE_APPROVER,
  },
  {
    email: 'operations@kconexus.com',
    name: 'Operations Lead',
    password: 'Ops@1234',
    role: Role.OPERATIONS,
  },
  {
    email: 'transporter@kconexus.com',
    name: 'Transporter Partner',
    password: 'Tran@1234',
    role: Role.TRANSPORTER,
  },
  {
    email: 'user@kconexus.com',
    name: 'Client User',
    password: 'User@1234',
    role: Role.USER,
  },
];

async function main() {
  let company = await prisma.company.findFirst({ where: { name: companyName } });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: companyName,
        billingEmail: 'billing@kconexus.com',
        plan: 'standard',
        subscriptionStatus: 'active',
        webhookSecret: crypto.randomBytes(32).toString('hex'),
        settings: {},
      },
    });
    console.log(`Created company ${company.name} (${company.id})`);
  } else {
    console.log(`Using existing company ${company.name} (${company.id})`);
  }

  for (const userDef of tenantUsers) {
    const existing = await prisma.user.findUnique({ where: { email: userDef.email } });
    const hashed = await bcrypt.hash(userDef.password, 10);

    if (existing) {
      if (!existing.passwordHash) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash: hashed },
        });
        console.log(`Updated password hash for ${userDef.email}`);
      } else {
        console.log(`User ${userDef.email} already exists, skipping.`);
      }
      continue;
    }

    await prisma.user.create({
      data: {
        email: userDef.email,
        name: userDef.name,
        passwordHash: hashed,
        role: userDef.role,
        companyId: company.id,
      },
    });

    console.log(`Created ${userDef.role} user ${userDef.email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
