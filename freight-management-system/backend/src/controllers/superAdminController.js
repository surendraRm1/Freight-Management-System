const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Role } = require('@prisma/client');
const prisma = require('../lib/prisma');

const createCompany = async (req, res) => {
  const { name, billingEmail, plan = 'standard', subscriptionStatus = 'active', settings, admin } = req.body || {};

  if (!name) {
    return res.status(400).json({ error: 'Company name is required' });
  }

  if (!admin?.email || !admin?.password) {
    return res.status(400).json({ error: 'Admin email and password are required' });
  }

  try {
    const secret = crypto.randomBytes(32).toString('hex');

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name,
          billingEmail,
          plan,
          subscriptionStatus,
          settings: settings || {},
          webhookSecret: secret,
        },
      });

      const passwordHash = await bcrypt.hash(admin.password, 10);

      const adminUser = await tx.user.create({
        data: {
          email: admin.email,
          name: admin.name,
          password: passwordHash,
          role: Role.COMPANY_ADMIN,
          companyId: company.id,
        },
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
          companyId: true,
        },
      });

      return { company, adminUser };
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Failed to create company', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Admin email already exists' });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const listCompanies = async (_req, res) => {
  try {
    const companiesRaw = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        billingEmail: true,
        plan: true,
        subscriptionStatus: true,
        status: true,
        trialEndsAt: true,
        createdAt: true,
        webhookSecret: true,
        _count: {
          select: { users: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const companies = companiesRaw.map((company) => ({
      ...company,
      webhookSecretLast4: company.webhookSecret ? company.webhookSecret.slice(-4) : null,
    }));
    companies.forEach((company) => {
      delete company.webhookSecret;
    });
    return res.status(200).json(companies);
  } catch (error) {
    console.error('Failed to list companies', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const exportAuditLogs = async (_req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    });

    const headers = ['id', 'action', 'entityType', 'entityId', 'userId', 'userEmail', 'createdAt'];
    const csvRows = logs.map((log) => [
      log.id,
      log.action,
      log.entityType,
      log.entityId ?? '',
      log.userId ?? '',
      log.user?.email ?? '',
      log.createdAt.toISOString(),
    ]);

    const toCsv = (row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',');
    const csv = [toCsv(headers), ...csvRows.map(toCsv)].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    return res.send(csv);
  } catch (error) {
    console.error('Failed to export audit logs', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const updateCompanyProfile = async (req, res) => {
  const { companyId } = req.params;
  const { name, billingEmail, plan, subscriptionStatus, trialEndsAt, status } = req.body || {};

  try {
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        name,
        billingEmail,
        plan,
        subscriptionStatus,
        trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : undefined,
        status,
      },
    });
    return res.status(200).json(updated);
  } catch (error) {
    console.error('Failed to update company', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Company not found' });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const rotateCompanyWebhook = async (req, res) => {
  const { companyId } = req.params;

  if (!companyId) {
    return res.status(400).json({ error: 'companyId is required' });
  }

  try {
    const newSecret = crypto.randomBytes(32).toString('hex');
    const company = await prisma.company.update({
      where: { id: companyId },
      data: { webhookSecret: newSecret },
      select: { id: true, webhookSecret: true },
    });

    return res.status(200).json(company);
  } catch (error) {
    console.error('Failed to rotate company webhook secret', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Company not found' });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getCompanyUsers = async (req, res) => {
  const { companyId } = req.params;

  try {
    const users = await prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json(users);
  } catch (error) {
    console.error('Failed to fetch company users', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const upsertCompanyUser = async (req, res) => {
  const { companyId, userId } = req.params;
  const { email, name, password, role, isActive = true } = req.body || {};

  try {
    let data = {
      email,
      name,
      role,
      isActive,
      companyId,
    };

    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    const user = userId
      ? await prisma.user.update({
          where: { id: userId },
          data,
          select: { id: true, email: true, role: true, isActive: true },
        })
      : await prisma.user.create({
          data,
          select: { id: true, email: true, role: true, isActive: true },
        });

    return res.status(userId ? 200 : 201).json(user);
  } catch (error) {
    console.error('Failed to upsert company user', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const deleteCompanyUser = async (req, res) => {
  const { userId } = req.params;

  try {
    await prisma.user.delete({ where: { id: userId } });
    return res.status(204).send();
  } catch (error) {
    console.error('Failed to delete company user', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getOverview = async (_req, res) => {
  try {
    const [companyCount, activeCompanies, userCount, recentCompanies] = await Promise.all([
      prisma.company.count(),
      prisma.company.count({ where: { status: 'active' } }),
      prisma.user.count({ where: { role: { not: Role.SUPER_ADMIN } } }),
      prisma.company.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, createdAt: true, status: true },
      }),
    ]);

    return res.status(200).json({
      companyCount,
      activeCompanies,
      userCount,
      recentCompanies,
    });
  } catch (error) {
    console.error('Failed to load overview', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const listPlatformUsers = async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: Role.SUPER_ADMIN },
      select: { id: true, email: true, name: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return res.status(200).json(users);
  } catch (error) {
    console.error('Failed to list platform users', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const upsertPlatformUser = async (req, res) => {
  const { id } = req.params;
  const { email, name, password, isActive = true } = req.body || {};

  try {
    let data = { email, name, isActive, role: Role.SUPER_ADMIN };
    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    const user = id
      ? await prisma.user.update({
          where: { id },
          data,
          select: { id: true, email: true, isActive: true },
        })
      : await prisma.user.create({
          data,
          select: { id: true, email: true, isActive: true },
        });

    return res.status(id ? 200 : 201).json(user);
  } catch (error) {
    console.error('Failed to upsert platform user', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const deletePlatformUser = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.user.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    console.error('Failed to delete platform user', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  createCompany,
  listCompanies,
  updateCompanyProfile,
  rotateCompanyWebhook,
  getCompanyUsers,
  upsertCompanyUser,
  deleteCompanyUser,
  getOverview,
  listPlatformUsers,
  upsertPlatformUser,
  deletePlatformUser,
  exportAuditLogs,
};
