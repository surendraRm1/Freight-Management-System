const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Role } = require('@prisma/client');
const prisma = require('../lib/prisma');
const { sendTransporterInviteEmail } = require('../services/emailService');
const logger = require('../utils/logger');

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

  const { email, password, name, role, vendorId } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: 'email, password, and role are required' });
  }

  if ([Role.SUPER_ADMIN, Role.COMPANY_ADMIN].includes(role)) {
    return res.status(400).json({ error: 'Cannot create Super Admin or Company Admin via this endpoint' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const data = {
      email,
      passwordHash: hash,
      name,
      role,
      companyId,
    };

    if (role === Role.TRANSPORTER) {
      const numericVendorId = Number(vendorId);
      if (!Number.isInteger(numericVendorId)) {
        return res.status(400).json({ error: 'vendorId is required for transporter users' });
      }
      const vendor = await prisma.vendor.findUnique({ where: { id: numericVendorId } });
      if (!vendor) {
        return res.status(404).json({ error: 'Vendor not found' });
      }
      data.vendorId = vendor.id;
    }
    const user = await prisma.user.create({
      data,
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        vendorId: true,
      },
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
        updatedAt: true,
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
      const { approvalStatus, isActive, createdAt, updatedAt, lastLoginAt } = user;
      if (approvalStatus === 'PENDING') {
        stats.pendingApprovals += 1;
        return;
      }
      if (approvalStatus === 'REJECTED') {
        stats.rejectedUsers += 1;
        return;
      }

      stats.approvedUsers += 1;

      const lastActivity = lastLoginAt ?? updatedAt ?? createdAt;
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
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
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

  const {
    name,
    phone,
    role,
    approvalNote,
    isActive,
    vendorId,
    approvalStatus,
    rejectionReason,
  } = req.body || {};

  if (role && [Role.SUPER_ADMIN, Role.ADMIN, Role.COMPANY_ADMIN].includes(role)) {
    return res.status(400).json({ error: 'Cannot assign this role via company admin.' });
  }

  let vendorPatch;
  if (vendorId !== undefined) {
    const normalized = vendorId === null || vendorId === '' ? null : Number(vendorId);
    if (normalized !== null && !Number.isInteger(normalized)) {
      return res.status(400).json({ error: 'Invalid vendorId supplied.' });
    }
    if (normalized !== null) {
      const vendor = await prisma.vendor.findUnique({ where: { id: normalized } });
      if (!vendor) {
        return res.status(404).json({ error: 'Vendor not found.' });
      }
    }
    vendorPatch = normalized;
  }

  let existing;
  try {
    existing = await prisma.user.findFirst({
      where: { id: userId, companyId },
      select: { approvalStatus: true },
    });
  } catch (error) {
    console.error('Failed to load user for update', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }

  if (!existing) {
    return res.status(404).json({ error: 'User not found.' });
  }

  let nextStatus;
  if (approvalStatus !== undefined) {
    const normalized = String(approvalStatus).trim().toUpperCase();
    const allowed = ['PENDING', 'APPROVED', 'REJECTED'];
    if (!allowed.includes(normalized)) {
      return res.status(400).json({ error: 'Invalid approvalStatus supplied.' });
    }
    nextStatus = normalized;
  }

  let rejectionPatch;
  if (nextStatus === 'REJECTED') {
    rejectionPatch = (rejectionReason || '').trim();
    if (!rejectionPatch) {
      return res.status(400).json({ error: 'rejectionReason is required to reject a user.' });
    }
  }

  const dataPatch = {
    name,
    phone,
    role,
    approvalNote,
    isActive,
    ...(vendorPatch !== undefined ? { vendorId: vendorPatch } : {}),
  };

  if (nextStatus) {
    dataPatch.approvalStatus = nextStatus;
    dataPatch.reviewedById = req.user.id;
    dataPatch.reviewedAt = new Date();

    if (nextStatus === 'APPROVED') {
      dataPatch.rejectionReason = null;
      if (typeof isActive === 'undefined') {
        dataPatch.isActive = true;
      }
    } else if (nextStatus === 'REJECTED') {
      dataPatch.rejectionReason = rejectionPatch;
      dataPatch.isActive = false;
    } else {
      dataPatch.rejectionReason = null;
      dataPatch.reviewedById = null;
      dataPatch.reviewedAt = null;
    }
  } else if (rejectionReason !== undefined) {
    dataPatch.rejectionReason = (rejectionReason || '').trim() || null;
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId, companyId },
      data: dataPatch,
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
        lastLoginAt: true,
        updatedAt: true,
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
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

const buildVendorFilters = (query = {}) => {
  const where = {};

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

  if (query.status && query.status !== 'all') {
    where.isActive = query.status === 'active';
  }

  return where;
};

const listCompanyVendors = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = 'all',
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

    const whereClause = buildVendorFilters({ search, status });
    whereClause.companyId = companyId;

    const [total, vendors] = await prisma.$transaction([
      prisma.vendor.count({ where: whereClause }),
      prisma.vendor.findMany({
        where: whereClause,
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        orderBy: { name: 'asc' },
      }),
    ]);

    return res.json({
      vendors,
      total,
      page: pageNumber,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
    });
  } catch (error) {
    console.error('Failed to load vendors', error);
    return res.status(500).json({ error: 'Failed to load vendors.' });
  }
};

const createCompanyVendor = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  try {
    const {
      name,
      email,
      phone,
      baseRate,
      rating,
      speed,
      isActive,
      createLogin = true,
      contactName,
    } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'Vendor name is required.' });
    }

    const normalizedEmail = email ? email.trim().toLowerCase() : null;
    const shouldCreateLogin = Boolean(normalizedEmail) && createLogin !== false;

    const existingByName = await prisma.vendor.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        companyId,
      },
    });
    if (existingByName) {
      return res.status(409).json({ error: 'A vendor with this name already exists.' });
    }

    if (normalizedEmail) {
      const existingByEmail = await prisma.vendor.findFirst({
        where: {
          email: { equals: normalizedEmail, mode: 'insensitive' },
          companyId,
        },
      });
      if (existingByEmail) {
        return res.status(409).json({ error: 'A vendor with this email already exists.' });
      }
    }

    if (shouldCreateLogin) {
      const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existingUser) {
        return res.status(409).json({ error: 'A user with this email already exists. Please use another email or link the existing account.' });
      }
    }

    let transporterUser = null;
    let temporaryPassword = null;

    const vendor = await prisma.$transaction(async (tx) => {
      const createdVendor = await tx.vendor.create({
        data: {
          name,
          email: normalizedEmail,
          phone,
          baseRate: baseRate ? parseFloat(baseRate) : null,
          rating: rating ? parseFloat(rating) : 0,
          speed: speed ? parseFloat(speed) : 60,
          isActive: isActive !== undefined ? Boolean(isActive) : true,
          companyId,
        },
      });

      if (shouldCreateLogin) {
        temporaryPassword = crypto.randomBytes(9).toString('base64url');
        const passwordHash = await bcrypt.hash(temporaryPassword, 10);

        transporterUser = await tx.user.create({
          data: {
            name: contactName || name,
            email: normalizedEmail,
            phone,
            role: 'AGENT',
            vendorId: createdVendor.id,
            passwordHash,
            approvalStatus: 'APPROVED',
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            email: true,
            vendorId: true,
          },
        });
      }

      return createdVendor;
    });

    if (transporterUser && temporaryPassword) {
      const portalUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
      await sendTransporterInviteEmail({
        to: transporterUser.email,
        transporterName: transporterUser.name,
        vendorName: name,
        tempPassword: temporaryPassword,
        portalUrl,
      }).catch((inviteError) => {
        logger.error(`Failed to send transporter invite to ${transporterUser.email}`, inviteError);
      });
    }

    return res.status(201).json({
      vendor,
      user: transporterUser,
      loginIssued: Boolean(transporterUser),
    });
  } catch (error) {
    console.error('Failed to create vendor', error);
    return res.status(500).json({ error: 'Failed to create vendor.' });
  }
};

const updateCompanyVendor = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  try {
    const vendorId = parseInt(req.params.id, 10);
    if (!Number.isInteger(vendorId)) {
      return res.status(400).json({ error: 'Invalid vendor identifier.' });
    }

    const {
      name,
      email,
      phone,
      baseRate,
      rating,
      speed,
      isActive,
      createLogin = true,
      contactName,
    } = req.body || {};

    const normalizedEmail = email ? email.trim().toLowerCase() : null;

    if (normalizedEmail) {
      const duplicate = await prisma.vendor.findFirst({
        where: {
          id: { not: vendorId },
          email: { equals: normalizedEmail, mode: 'insensitive' },
          companyId,
        },
      });
      if (duplicate) {
        return res.status(409).json({ error: 'Another vendor already uses this email address.' });
      }
    }

    const existing = await prisma.vendor.findFirst({
      where: { id: vendorId, companyId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }

    const vendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        name,
        email: normalizedEmail,
        phone,
        baseRate: baseRate ? parseFloat(baseRate) : null,
        rating: rating ? parseFloat(rating) : undefined,
        speed: speed ? parseFloat(speed) : undefined,
        isActive,
      },
    });

    let newlyCreatedUser = null;
    let temporaryPassword = null;

    if (createLogin !== false && vendor.email) {
      const linkedUsers = await prisma.user.findMany({ where: { vendorId } });
      if (!linkedUsers.length) {
        const existingUserByEmail = await prisma.user.findUnique({ where: { email: vendor.email } });
        if (!existingUserByEmail) {
          temporaryPassword = crypto.randomBytes(9).toString('base64url');
          const passwordHash = await bcrypt.hash(temporaryPassword, 10);

          newlyCreatedUser = await prisma.user.create({
            data: {
              name: contactName || vendor.name,
              email: vendor.email,
              phone: vendor.phone,
              role: 'AGENT',
              vendorId,
              passwordHash,
              approvalStatus: 'APPROVED',
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              email: true,
              vendorId: true,
            },
          });

          const portalUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
          await sendTransporterInviteEmail({
            to: newlyCreatedUser.email,
            transporterName: newlyCreatedUser.name,
            vendorName: vendor.name,
            tempPassword: temporaryPassword,
            portalUrl,
          }).catch((inviteError) => {
            logger.error(`Failed to send transporter invite to ${newlyCreatedUser.email}`, inviteError);
          });
        }
      }
    }

    return res.json({ vendor, user: newlyCreatedUser, loginIssued: Boolean(newlyCreatedUser) });
  } catch (error) {
    console.error('Failed to update vendor', error);
    return res.status(500).json({ error: 'Failed to update vendor.' });
  }
};

const deleteCompanyVendor = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  try {
    const vendorId = parseInt(req.params.id, 10);
    if (!Number.isInteger(vendorId)) {
      return res.status(400).json({ error: 'Invalid vendor identifier.' });
    }

    const existing = await prisma.vendor.findFirst({
      where: { id: vendorId, companyId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }

    await prisma.vendor.delete({ where: { id: vendorId } });
    return res.status(204).send();
  } catch (error) {
    console.error('Failed to delete vendor', error);
    if (error.code === 'P2003') {
      return res.status(409).json({ error: 'Cannot delete vendor as it is linked to existing agreements or shipments.' });
    }
    return res.status(500).json({ error: 'Failed to delete vendor.' });
  }
};

const listVendorOptions = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  try {
    const vendors = await prisma.vendor.findMany({
      where: { isActive: true, companyId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true },
    });
    return res.json(vendors);
  } catch (error) {
    console.error('Failed to list vendors', error);
    return res.status(500).json({ error: 'Failed to load vendors' });
  }
};

module.exports = {
  createCompanyUser,
  getCompanyUsers,
  getCompanyUserStats,
  updateCompanyUser,
  resetCompanyUserPassword,
  getCompanyUserAuditTrail,
  listCompanyVendors,
  createCompanyVendor,
  updateCompanyVendor,
  deleteCompanyVendor,
  listVendorOptions,
};
