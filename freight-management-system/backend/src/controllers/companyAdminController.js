const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Role } = require('@prisma/client');
const prisma = require('../lib/prisma');

const ensureCompany = (req, res) => {
  if (!req.user?.companyId) {
    res.status(403).json({ error: 'Company context missing' });
    return null;
  }
  return req.user.companyId;
};

const createCompanyUser = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  const { email, password, name, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: 'email, password, and role are required' });
  }

  if ([Role.SUPER_ADMIN, Role.COMPANY_ADMIN].includes(role)) {
    return res.status(400).json({ error: 'Cannot create Super Admin or Company Admin via this endpoint' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hash,
        name,
        role,
        companyId,
      },
      select: { id: true, email: true, role: true, name: true },
    });

    return res.status(201).json(user);
  } catch (error) {
    console.error('Failed to create company user', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const buildCompanyUserFilters = (query = {}) => {
  const where = {};

  if (query.role && query.role !== 'ALL') {
    where.role = query.role;
  }

  if (query.status && query.status !== 'ALL') {
    if (query.status === 'PENDING') {
      where.approvalStatus = 'PENDING';
    } else if (query.status === 'APPROVED') {
      where.approvalStatus = 'APPROVED';
    } else if (query.status === 'REJECTED') {
      where.approvalStatus = 'REJECTED';
    } else if (query.status === 'ACTIVE') {
      where.isActive = true;
    } else if (query.status === 'INACTIVE') {
      where.isActive = false;
    }
  }

  if (query.search) {
    const needle = query.search.trim();
    if (needle) {
      where.OR = [
        { name: { contains: needle, mode: 'insensitive' } },
        { email: { contains: needle, mode: 'insensitive' } },
        { phone: { contains: needle, mode: 'insensitive' } },
      ];
    }
  }

  return where;
};

const getCompanyUserStats = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  try {
    const users = await prisma.user.findMany({
      where: { companyId },
      select: {
        approvalStatus: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const thresholds = {
      d30: now - 30 * day,
      d60: now - 60 * day,
      d90: now - 90 * day,
    };

    const stats = {
      totalUsers: users.length,
      pendingApprovals: 0,
      rejectedUsers: 0,
      approvedUsers: 0,
      activeUsers: 0,
      inactive30: 0,
      inactive60: 0,
      inactive90: 0,
    };

    users.forEach((user) => {
      const { approvalStatus, isActive, createdAt, lastLoginAt } = user;
      if (approvalStatus === 'PENDING') {
        stats.pendingApprovals += 1;
        return;
      }
      if (approvalStatus === 'REJECTED') {
        stats.rejectedUsers += 1;
        return;
      }

      stats.approvedUsers += 1;

      const lastActivity = lastLoginAt ?? createdAt;
      const lastActivityTime = lastActivity ? new Date(lastActivity).getTime() : 0;

      if (isActive && lastActivityTime >= thresholds.d30) {
        stats.activeUsers += 1;
        return;
      }

      if (lastActivityTime >= thresholds.d30) {
        stats.inactive30 += 1;
      } else if (lastActivityTime >= thresholds.d60) {
        stats.inactive60 += 1;
      } else {
        stats.inactive90 += 1;
      }
    });

    return res.json({ stats });
  } catch (error) {
    console.error('Failed to compute company user stats', error);
    return res.status(500).json({ error: 'Failed to compute user statistics' });
  }
};

const getCompanyUsers = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  try {
    const {
      page = 1,
      limit = 25,
      sort = 'createdAt:desc',
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);

    const whereClause = {
      companyId,
      ...buildCompanyUserFilters(req.query),
    };

    const [field, direction] = sort.split(':');
    const orderBy = {};
    if (['createdAt', 'name', 'email', 'lastLoginAt'].includes(field)) {
      orderBy[field] = direction?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        orderBy,
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          approvalStatus: true,
          approvalNote: true,
          rejectionReason: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
        },
      }),
    ]);

    return res.json({
      total,
      page: pageNumber,
      pageSize,
      users,
    });
  } catch (error) {
    console.error('Failed to fetch company users', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const updateCompanyUser = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user identifier.' });
  }

  const { name, phone, role, approvalNote, isActive } = req.body || {};

  if (role && [Role.SUPER_ADMIN, Role.ADMIN, Role.COMPANY_ADMIN].includes(role)) {
    return res.status(400).json({ error: 'Cannot assign this role via company admin.' });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId, companyId },
      data: {
        name,
        phone,
        role,
        approvalNote,
        isActive,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        approvalStatus: true,
        approvalNote: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return res.json({ user: updated });
  } catch (error) {
    console.error('Failed to update company user', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const resetCompanyUserPassword = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user identifier.' });
  }

  try {
    const tempPassword = crypto.randomBytes(6).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await prisma.user.update({
      where: { id: userId, companyId },
      data: { passwordHash },
    });

    return res.json({
      userId,
      temporaryPassword: tempPassword,
      message: 'Temporary password generated. Share it securely with the user.',
    });
  } catch (error) {
    console.error('Failed to reset company user password', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getCompanyUserAuditTrail = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user identifier.' });
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, companyId },
    select: { id: true },
  });

  if (!target) {
    return res.status(404).json({ error: 'User not found.' });
  }

  try {
    const audits = await prisma.auditLog.findMany({
      where: {
        OR: [
          { userId: target.id },
          {
            AND: [{ entityType: 'User' }, { entityId: target.id }],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.json({ audits });
  } catch (error) {
    console.error('Failed to fetch audit trail', error);
    return res.status(500).json({ error: 'Failed to fetch audit trail.' });
  }
};

module.exports = {
  createCompanyUser,
  getCompanyUsers,
  getCompanyUserStats,
  updateCompanyUser,
  resetCompanyUserPassword,
  getCompanyUserAuditTrail,
};
