require('dotenv/config');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PrismaClient, Role } = require('@prisma/client');

const prisma = new PrismaClient();

const COMPANY_NAME = 'KConexus Logistics';
const BILLING_EMAIL = 'finance@kconexus.com';
const TRANSPORTER_VENDOR_NAME = 'KConexus Partner Fleet';
const TRANSPORTER_VENDOR_EMAIL = 'transporter@kconexus.com';

const ACCOUNTS = [
  {
    role: Role.SUPER_ADMIN,
    email: 'Surendra@kconexus.com',
    password: '99665588',
    name: 'Surendra (Super Admin)',
  },
  {
    role: Role.COMPANY_ADMIN,
    email: 'company.admin@kconexus.com',
    password: 'Admin@123',
    name: 'KConexus Company Admin',
    linkToCompany: true,
  },
  {
    role: Role.FINANCE_APPROVER,
    email: 'finance@kconexus.com',
    password: 'Fin@1234',
    name: 'KConexus Finance',
    linkToCompany: true,
  },
  {
    role: Role.OPERATIONS,
    email: 'operations@kconexus.com',
    password: 'Ops@1234',
    name: 'KConexus Ops',
    linkToCompany: true,
  },
  {
    role: Role.TRANSPORTER,
    email: 'transporter@kconexus.com',
    password: 'Tran@1234',
    name: 'KConexus Transporter',
    linkToCompany: true,
    linkToVendor: true,
  },
  {
    role: Role.USER,
    email: 'user@kconexus.com',
    password: 'User@1234',
    name: 'KConexus Client',
    linkToCompany: true,
  },
];

async function ensureCompany() {
  let company = await prisma.company.findFirst({
    where: { name: COMPANY_NAME },
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: COMPANY_NAME,
        webhookSecret: crypto.randomBytes(32).toString('hex'),
        billingEmail: BILLING_EMAIL,
        plan: 'enterprise',
        subscriptionStatus: 'active',
        status: 'active',
      },
    });

    await prisma.companyProfile.create({
      data: {
        companyId: company.id,
        legalName: COMPANY_NAME,
        addressLine1: 'KConexus HQ',
        city: 'Bengaluru',
        state: 'KA',
        postalCode: '560001',
        country: 'IN',
      },
    });
  }

  return company;
}

async function ensureVendor() {
  let vendor = await prisma.vendor.findFirst({
    where: { email: TRANSPORTER_VENDOR_EMAIL },
  });

  if (!vendor) {
    vendor = await prisma.vendor.create({
      data: {
        name: TRANSPORTER_VENDOR_NAME,
        email: TRANSPORTER_VENDOR_EMAIL,
        phone: '+91-9876543210',
        baseRate: 12.5,
        rating: 4.6,
        speed: 70,
        isActive: true,
      },
    });
  }

  return vendor;
}

async function upsertUser({ email, password, role, companyId, vendorId, name }) {
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role,
      companyId: companyId ?? null,
      vendorId: vendorId ?? null,
      approvalStatus: 'APPROVED',
      isActive: true,
      name,
    },
    create: {
      email,
      passwordHash,
      role,
      companyId: companyId ?? null,
      vendorId: vendorId ?? null,
      approvalStatus: 'APPROVED',
      isActive: true,
      name,
    },
  });

  console.log(`Provisioned ${role} account: ${email}`);
}

async function main() {
  const company = await ensureCompany();
  const vendor = await ensureVendor();

  for (const account of ACCOUNTS) {
    await upsertUser({
      email: account.email,
      password: account.password,
      role: account.role,
      companyId: account.linkToCompany ? company.id : null,
      vendorId: account.linkToVendor ? vendor.id : null,
      name: account.name,
    });
  }

  console.log('\nAll KConexus accounts are ready. Use /login with the listed credentials.');
}

main()
  .catch((error) => {
    console.error('Failed to provision KConexus tenant:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
