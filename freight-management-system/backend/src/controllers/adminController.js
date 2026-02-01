const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const logger = require('../utils/logger');
const { sendApprovalEmail, sendRoleChangeEmail, sendTransporterInviteEmail } = require('../services/emailService');
const prisma = require('../lib/prisma');

const VALID_REGISTRATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
const VALID_ROLES = ['USER', 'AGENT', 'ADMIN'];

const includeAgreementRelations = {
  vendor: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  rateCards: {
    orderBy: { createdAt: 'desc' },
  },
};

const parseDate = (value) => {
  if (!value) return null;
  const asDate = new Date(value);
  return Number.isNaN(asDate.valueOf()) ? null : asDate;
};

const shapeRateCardData = (card) => ({
  routeName: card.routeName,
  origin: card.origin,
  destination: card.destination,
  distanceKm: card.distanceKm ?? null,
  ratePerKm: card.ratePerKm,
  uom: card.uom || 'Per KM',
  vehicleType: card.vehicleType,
  effectiveFrom: parseDate(card.effectiveFrom),
  remarks: card.remarks ?? null,
});

const validateRateCard = (agreementMeta, card) => {
  if (!card.routeName || !card.origin || !card.destination) {
    return 'Route name, origin, and destination are required for each rate card.';
  }

  if (card.ratePerKm === undefined || card.ratePerKm === null) {
    return 'Rate amount is required.';
  }

  if (!card.uom || !String(card.uom).trim()) {
    return 'Unit of measure is required for each rate card.';
  }

  if (!card.vehicleType) {
    return 'Vehicle type is required for each rate card.';
  }

  const cardDate = parseDate(card.effectiveFrom);
  if (cardDate && agreementMeta.effectiveFrom && cardDate < agreementMeta.effectiveFrom) {
    return 'Rate card effective date cannot precede the agreement start date.';
  }

  if (cardDate && agreementMeta.effectiveTo && cardDate > agreementMeta.effectiveTo) {
    return 'Rate card effective date must fall within the agreement period.';
  }

  return null;
};

const mapReviewers = async (records) => {
  const reviewerIds = Array.from(
    new Set(records.map((item) => item.reviewedById).filter(Boolean)),
  );

  if (!reviewerIds.length) {
    return {};
  }

  const reviewers = await prisma.user.findMany({
    where: { id: { in: reviewerIds } },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  return reviewers.reduce((accumulator, reviewer) => {
    accumulator[reviewer.id] = reviewer;
    return accumulator;
  }, {});
};

const getRegistrations = async (req, res) => {
  try {
    const { status = 'PENDING' } = req.query;

    const tokens = String(status)
      .split(',')
      .map((entry) => entry.trim().toUpperCase())
      .filter(Boolean);

    let statusFilters = null;

    if (!(tokens.length === 1 && tokens[0] === 'ALL')) {
      if (!tokens.length) {
        statusFilters = ['PENDING'];
      } else {
        const valid = tokens.filter((entry) => VALID_REGISTRATION_STATUSES.includes(entry));
        if (!valid.length) {
          return res.status(400).json({ error: 'Invalid status filter supplied.' });
        }
        statusFilters = valid;
      }
    }

    const whereClause = {};
    if (statusFilters && statusFilters.length === 1) {
      whereClause.approvalStatus = statusFilters[0];
    } else if (statusFilters && statusFilters.length > 1) {
      whereClause.approvalStatus = { in: statusFilters };
    }

    const registrations = await prisma.user.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        approvalStatus: true,
        approvalNote: true,
        rejectionReason: true,
        reviewedById: true,
        reviewedAt: true,
        isActive: true,
        vendorId: true,
        createdAt: true,
        updatedAt: true,
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const reviewerMap = await mapReviewers(registrations);

    const payload = registrations.map((registration) => ({
      ...registration,
      reviewer: registration.reviewedById
        ? reviewerMap[registration.reviewedById] ?? null
        : null,
    }));

    res.json({ registrations: payload });
  } catch (error) {
    logger.error('Failed to load registrations', error);
    res.status(500).json({ error: 'Failed to load registrations' });
  }
};

const updateRegistration = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid registration identifier.' });
    }

    const { name, phone, role } = req.body;

    if (!name && !phone && !role) {
      return res.status(400).json({ error: 'Provide at least one field to update.' });
    }

    const registration = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        approvalStatus: true,
      },
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found.' });
    }

    if (registration.approvalStatus !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending registrations can be edited.' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (role) {
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Invalid role supplied.' });
      }
      updateData.role = role;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        approvalStatus: true,
        approvalNote: true,
        rejectionReason: true,
        reviewedById: true,
        reviewedAt: true,
        isActive: true,
        vendorId: true,
        createdAt: true,
        updatedAt: true,
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({ registration: updated });
  } catch (error) {
    logger.error('Failed to update registration', error);
    res.status(500).json({ error: 'Failed to update registration' });
  }
};

const approveRegistration = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid registration identifier.' });
    }

    const { name, phone, role, approvalNote } = req.body;

    const registration = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found.' });
    }

    if (registration.approvalStatus === 'APPROVED') {
      return res.status(400).json({ error: 'Registration already approved.' });
    }

    const updateData = {
      approvalStatus: 'APPROVED',
      approvalNote: approvalNote || null,
      rejectionReason: null,
      reviewedById: req.user.id,
      reviewedAt: new Date(),
      isActive: true,
    };

    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (role) {
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Invalid role supplied.' });
      }
      updateData.role = role;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        approvalStatus: true,
        approvalNote: true,
        rejectionReason: true,
        reviewedById: true,
        reviewedAt: true,
        isActive: true,
        vendorId: true,
        createdAt: true,
        updatedAt: true,
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    let vendorProfile = updated.vendor;

    // If the approved user is a VENDOR, ensure a vendor profile exists, is active, and synced with the latest contact details.
    if (updated.role === 'VENDOR') {
      if (updated.vendorId) {
        try {
          vendorProfile = await prisma.vendor.update({
            where: { id: updated.vendorId },
            data: {
              name: updated.name,
              email: updated.email,
              phone: updated.phone,
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              isActive: true,
            },
          });
        } catch (vendorError) {
          if (vendorError instanceof Prisma.PrismaClientKnownRequestError && vendorError.code === 'P2025') {
            vendorProfile = await prisma.vendor.create({
              data: {
                name: updated.name,
                email: updated.email,
                phone: updated.phone,
                isActive: true,
              },
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                isActive: true,
              },
            });

            await prisma.user.update({
              where: { id: updated.id },
              data: { vendorId: vendorProfile.id },
            });

            logger.warn(
              `Vendor ${updated.vendorId} missing during approval for user ${updated.id}; created profile ${vendorProfile.id} instead.`,
            );
          } else {
            throw vendorError;
          }
        }
      } else {
        vendorProfile = await prisma.vendor.create({
          data: {
            name: updated.name,
            email: updated.email,
            phone: updated.phone,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
          },
        });

        await prisma.user.update({
          where: { id: updated.id },
          data: { vendorId: vendorProfile.id },
        });

        logger.info(`Created vendor profile ${vendorProfile.id} for user ${updated.id}`);
      }

      if (vendorProfile) {
        updated.vendor = vendorProfile;
        updated.vendorId = vendorProfile.id;
      }
    }

    // Send email notification
    await sendApprovalEmail(updated.email, updated.name, 'APPROVED').catch(emailError => {
      logger.error(`Failed to send approval email to ${updated.email}:`, emailError);
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'REGISTRATION_APPROVED',
        entityType: 'User',
        entityId: userId,
        details: {
          approvalNote: approvalNote || null,
        },
      },
    });

    await prisma.notification.create({
      data: {
        userId,
        title: 'Registration approved',
        message: 'Your account has been approved. You can now sign in.',
        type: 'system',
      },
    });

    res.json({ registration: updated });
  } catch (error) {
    logger.error('Failed to approve registration', error);
    res.status(500).json({ error: 'Failed to approve registration' });
  }
};

const rejectRegistration = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid registration identifier.' });
    }

    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Provide a rejection reason.' });
    }

    const registration = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found.' });
    }

    if (registration.approvalStatus === 'REJECTED') {
      return res.status(400).json({ error: 'Registration already rejected.' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        approvalStatus: 'REJECTED',
        rejectionReason: reason.trim(),
        approvalNote: null,
        reviewedById: req.user.id,
        reviewedAt: new Date(),
        isActive: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        approvalStatus: true,
        approvalNote: true,
        rejectionReason: true,
        reviewedById: true,
        reviewedAt: true,
        isActive: true,
        vendorId: true,
        createdAt: true,
        updatedAt: true,
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'REGISTRATION_REJECTED',
        entityType: 'User',
        entityId: userId,
        details: {
          rejectionReason: reason.trim(),
        },
      },
    });

    await prisma.notification.create({
      data: {
        userId,
        title: 'Registration update',
        message: `Your registration was rejected: ${reason.trim()}`,
        type: 'system',
      },
    });

    res.json({ registration: updated });
  } catch (error) {
    logger.error('Failed to reject registration', error);
    res.status(500).json({ error: 'Failed to reject registration' });
  }
};

const buildUserWhereClause = (query) => {
  const whereClause = {};
  const andConditions = [];

  if (query.role && query.role.toUpperCase() !== 'ALL') {
    const roles = String(query.role)
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter((item) => VALID_ROLES.includes(item));
    if (roles.length) {
      andConditions.push({ role: { in: roles } });
    }
  }

  if (query.status && query.status.toUpperCase() !== 'ALL') {
    const statuses = String(query.status)
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

    const statusConditions = [];
    statuses.forEach((status) => {
      switch (status) {
        case 'PENDING':
        case 'APPROVED':
        case 'REJECTED':
          statusConditions.push({ approvalStatus: status });
          break;
        case 'ACTIVE':
          statusConditions.push({
            approvalStatus: 'APPROVED',
            isActive: true,
          });
          break;
        case 'INACTIVE':
          statusConditions.push({
            OR: [
              { isActive: false },
              {
                AND: [
                  { approvalStatus: 'APPROVED' },
                  {
                    OR: [
                      { lastLoginAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
                      { lastLoginAt: null },
                    ],
                  },
                ],
              },
            ],
          });
          break;
        default:
          break;
      }
    });

    if (statusConditions.length) {
      andConditions.push({ OR: statusConditions });
    }
  }

  if (query.from || query.to) {
    const range = {};
    if (query.from) {
      const fromDate = new Date(query.from);
      if (!Number.isNaN(fromDate.valueOf())) {
        range.gte = fromDate;
      }
    }
    if (query.to) {
      const toDate = new Date(query.to);
      if (!Number.isNaN(toDate.valueOf())) {
        range.lte = toDate;
      }
    }
    if (Object.keys(range).length) {
      andConditions.push({ createdAt: range });
    }
  }

  if (query.search) {
    const needle = query.search.trim();
    if (needle) {
      andConditions.push({
        OR: [
          { name: { contains: needle, mode: 'insensitive' } },
          { email: { contains: needle, mode: 'insensitive' } },
          { phone: { contains: needle, mode: 'insensitive' } },
        ],
      });
    }
  }

  if (andConditions.length) {
    whereClause.AND = andConditions;
  }

  return whereClause;
};

const getUserStats = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
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

    res.json({ stats });
  } catch (error) {
    logger.error('Failed to compute user statistics', error);
    res.status(500).json({ error: 'Failed to compute user statistics' });
  }
};

const getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      sort = 'createdAt:desc',
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);

    const whereClause = buildUserWhereClause(req.query);

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
          vendorId: true,
          reviewedById: true,
          reviewedAt: true,
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const reviewerMap = await mapReviewers(users);

    const payload = users.map((user) => ({
      ...user,
      reviewer: user.reviewedById ? reviewerMap[user.reviewedById] ?? null : null,
    }));

    res.json({
      total,
      page: pageNumber,
      pageSize,
      users: payload,
    });
  } catch (error) {
    logger.error('Failed to load user directory', error);
    res.status(500).json({ error: 'Failed to load users' });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user identifier.' });
    }

    const { name, phone, role, isActive, approvalNote } = req.body;

    if (
      name === undefined &&
      phone === undefined &&
      role === undefined &&
      isActive === undefined &&
      approvalNote === undefined
    ) {
      return res.status(400).json({ error: 'No fields provided to update.' });
    }

    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role supplied.' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (approvalNote !== undefined) updateData.approvalNote = approvalNote;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
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
        vendorId: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'ADMIN_UPDATE_USER',
        entityType: 'User',
        entityId: userId,
        details: {
          name,
          phone,
          role,
          isActive,
          approvalNote,
        },
      },
    });

    res.json({ user: updated });
  } catch (error) {
    logger.error('Failed to update user profile', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user identifier.' });
    }

    const { password } = req.body;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const generatePassword = (length = 12) => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
      let temp = '';
      for (let i = 0; i < length; i += 1) {
        temp += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return temp;
    };

    const newPassword = password && password.trim().length >= 8 ? password.trim() : generatePassword();

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'ADMIN_RESET_PASSWORD',
        entityType: 'User',
        entityId: userId,
        details: {
          via: password ? 'custom' : 'generated',
        },
      },
    });

    res.json({
      userId,
      temporaryPassword: password ? undefined : newPassword,
      message: password
        ? 'Password reset successfully.'
        : 'Password reset successfully. Provide the temporary password to the user.',
    });
  } catch (error) {
    logger.error('Failed to reset user password', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

const getUserAuditTrail = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user identifier.' });
    }

    const audits = await prisma.auditLog.findMany({
      where: {
        OR: [
          { userId },
          {
            AND: [{ entityType: 'User' }, { entityId: userId }],
          },
        ],
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
      select: {
        id: true,
        userId: true,
        action: true,
        details: true,
        timestamp: true,
      },
    });

    res.json({ audits });
  } catch (error) {
    logger.error('Failed to fetch user audit log', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
};

const getAgreements = async (req, res) => {
  try {
    const agreements = await prisma.agreement.findMany({
      include: includeAgreementRelations,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ agreements });
  } catch (error) {
    logger.error('Failed to load agreements', error);
    res.status(500).json({ error: 'Failed to load agreements' });
  }
};

const createAgreement = async (req, res) => {
  try {
    const {
      vendorId,
      title,
      referenceCode,
      status = 'Draft',
      effectiveFrom,
      effectiveTo,
      notes,
      rateCards = [],
    } = req.body;

    if (!vendorId || !title) {
      return res.status(400).json({ error: 'Vendor and title are required.' });
    }

    const effectiveFromDate = parseDate(effectiveFrom);
    const effectiveToDate = parseDate(effectiveTo);

    if (effectiveFromDate && effectiveToDate && effectiveFromDate > effectiveToDate) {
      return res.status(400).json({ error: 'Agreement start date must be before the end date.' });
    }

    const agreementMeta = {
      effectiveFrom: effectiveFromDate,
      effectiveTo: effectiveToDate,
    };

    for (const card of rateCards) {
      const message = validateRateCard(agreementMeta, card);
      if (message) {
        return res.status(400).json({ error: message });
      }
    }

    const agreement = await prisma.agreement.create({
      data: {
        vendorId,
        title,
        referenceCode,
        status,
        effectiveFrom: effectiveFromDate,
        effectiveTo: effectiveToDate,
        notes,
        createdBy: req.user.id,
        rateCards: {
          create: rateCards.map(shapeRateCardData),
        },
      },
      include: includeAgreementRelations,
    });

    res.status(201).json({ agreement });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'Reference code must be unique.' });
    }

    logger.error('Failed to create agreement', error);
    res.status(500).json({ error: 'Failed to create agreement' });
  }
};

const updateAgreement = async (req, res) => {
  try {
    const agreementId = Number(req.params.id);
    if (Number.isNaN(agreementId)) {
      return res.status(400).json({ error: 'Invalid agreement id.' });
    }

    const existing = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: { rateCards: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Agreement not found.' });
    }

    const {
      vendorId,
      title,
      referenceCode,
      status = 'Draft',
      effectiveFrom,
      effectiveTo,
      notes,
      rateCards = [],
    } = req.body;

    if (!vendorId || !title) {
      return res.status(400).json({ error: 'Vendor and title are required.' });
    }

    const effectiveFromDate = parseDate(effectiveFrom);
    const effectiveToDate = parseDate(effectiveTo);

    if (effectiveFromDate && effectiveToDate && effectiveFromDate > effectiveToDate) {
      return res.status(400).json({ error: 'Agreement start date must be before the end date.' });
    }

    const agreementMeta = {
      effectiveFrom: effectiveFromDate,
      effectiveTo: effectiveToDate,
    };

    for (const card of rateCards) {
      const message = validateRateCard(agreementMeta, card);
      if (message) {
        return res.status(400).json({ error: message });
      }
    }

    await prisma.agreement.update({
      where: { id: agreementId },
      data: {
        vendorId,
        title,
        referenceCode,
        status,
        effectiveFrom: effectiveFromDate,
        effectiveTo: effectiveToDate,
        notes,
      },
    });

    const incomingIds = rateCards.filter((card) => card.id).map((card) => Number(card.id));
    const existingIds = existing.rateCards.map((card) => card.id);
    const toDelete = existingIds.filter((id) => !incomingIds.includes(id));

    await prisma.$transaction([
      ...(toDelete.length
        ? [prisma.rateCard.deleteMany({ where: { id: { in: toDelete } } })]
        : []),
      ...rateCards.map((card) => {
        const data = shapeRateCardData(card);
        const resolvedAgreementId = card.agreementId ? Number(card.agreementId) : agreementId;
        if (card.id) {
          return prisma.rateCard.update({
            where: { id: Number(card.id) },
            data: {
              ...data,
              agreementId: resolvedAgreementId,
            },
          });
        }
        return prisma.rateCard.create({
          data: {
            ...data,
            agreementId: resolvedAgreementId,
          },
        });
      }),
    ]);

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: includeAgreementRelations,
    });

    res.json({ agreement });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'Reference code must be unique.' });
    }

    logger.error('Failed to update agreement', error);
    res.status(500).json({ error: 'Failed to update agreement' });
  }
};

const deleteAgreement = async (req, res) => {
  try {
    const agreementId = Number(req.params.id);
    if (Number.isNaN(agreementId)) {
      return res.status(400).json({ error: 'Invalid agreement id.' });
    }

    await prisma.agreement.delete({
      where: { id: agreementId },
    });

    res.json({ message: 'Agreement deleted successfully.' });
  } catch (error) {
    logger.error('Failed to delete agreement', error);
    res.status(500).json({ error: 'Failed to delete agreement' });
  }
};

const addRateCard = async (req, res) => {
  try {
    const agreementId = Number(req.params.id);
    if (Number.isNaN(agreementId)) {
      return res.status(400).json({ error: 'Invalid agreement id.' });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
    });

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found.' });
    }

    const validationMessage = validateRateCard(agreement, req.body);
    if (validationMessage) {
      return res.status(400).json({ error: validationMessage });
    }

    const rateCard = await prisma.rateCard.create({
      data: {
        ...shapeRateCardData(req.body),
        agreementId,
      },
    });

    res.status(201).json({ rateCard });
  } catch (error) {
    logger.error('Failed to add rate card', error);
    res.status(500).json({ error: 'Failed to add rate card.' });
  }
};

const updateRateCard = async (req, res) => {
  try {
    const agreementId = Number(req.params.id);
    const cardId = Number(req.params.cardId);

    if (Number.isNaN(agreementId) || Number.isNaN(cardId)) {
      return res.status(400).json({ error: 'Invalid identifiers.' });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
    });

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found.' });
    }

    const rateCard = await prisma.rateCard.findUnique({
      where: { id: cardId },
    });

    if (!rateCard || rateCard.agreementId !== agreementId) {
      return res.status(404).json({ error: 'Rate card not found.' });
    }

    const validationMessage = validateRateCard(agreement, req.body);
    if (validationMessage) {
      return res.status(400).json({ error: validationMessage });
    }

    const updated = await prisma.rateCard.update({
      where: { id: cardId },
      data: shapeRateCardData(req.body),
    });

    res.json({ rateCard: updated });
  } catch (error) {
    logger.error('Failed to update rate card', error);
    res.status(500).json({ error: 'Failed to update rate card.' });
  }
};

const deleteRateCard = async (req, res) => {
  try {
    const agreementId = Number(req.params.id);
    const cardId = Number(req.params.cardId);

    if (Number.isNaN(agreementId) || Number.isNaN(cardId)) {
      return res.status(400).json({ error: 'Invalid identifiers.' });
    }

    const rateCard = await prisma.rateCard.findUnique({
      where: { id: cardId },
    });

    if (!rateCard || rateCard.agreementId !== agreementId) {
      return res.status(404).json({ error: 'Rate card not found.' });
    }

    await prisma.rateCard.delete({
      where: { id: cardId },
    });

    res.json({ message: 'Rate card deleted successfully.' });
  } catch (error) {
    logger.error('Failed to delete rate card', error);
    res.status(500).json({ error: 'Failed to delete rate card.' });
  }
};

const listVendors = async (req, res) => {
  try {
    const vendors = await prisma.vendor.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    res.json({ vendors });
  } catch (error) {
    logger.error('Failed to list vendors', error);
    res.status(500).json({ error: 'Failed to fetch vendor list.' });
  }
};

const getVendors = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = 'all' } = req.query;

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status && status !== 'all') {
      where.isActive = status === 'active';
    }

    const [total, vendors] = await prisma.$transaction([
      prisma.vendor.count({ where }),
      prisma.vendor.findMany({
        where,
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({
      vendors,
      total,
      page: pageNumber,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    logger.error('Failed to get vendors', error);
    res.status(500).json({ error: 'Failed to fetch vendors.' });
  }
};

const createVendor = async (req, res) => {
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
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Vendor name is required.' });
    }

    const normalizedEmail = email ? email.trim().toLowerCase() : null;
    const shouldCreateLogin = Boolean(normalizedEmail) && createLogin !== false;

    const existingByName = await prisma.vendor.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (existingByName) {
      return res.status(409).json({ error: 'A vendor with this name already exists.' });
    }

    if (normalizedEmail) {
      const existingByEmail = await prisma.vendor.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
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
          isActive: isActive !== undefined ? isActive : true,
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

    res.status(201).json({
      vendor,
      user: transporterUser,
      loginIssued: Boolean(transporterUser),
    });
  } catch (error) {
    logger.error('Failed to create vendor', error);
    res.status(500).json({ error: 'Failed to create vendor.' });
  }
};

const updateVendor = async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id, 10);
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
    } = req.body;

    const normalizedEmail = email ? email.trim().toLowerCase() : null;

    if (normalizedEmail) {
      const duplicate = await prisma.vendor.findFirst({
        where: {
          id: { not: vendorId },
          email: { equals: normalizedEmail, mode: 'insensitive' },
        },
      });
      if (duplicate) {
        return res.status(409).json({ error: 'Another vendor already uses this email address.' });
      }
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

    res.json({ vendor, user: newlyCreatedUser, loginIssued: Boolean(newlyCreatedUser) });
  } catch (error) {
    logger.error('Failed to update vendor', error);
    res.status(500).json({ error: 'Failed to update vendor.' });
  }
};

const deleteVendor = async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id, 10);
    await prisma.vendor.delete({
      where: { id: vendorId },
    });
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete vendor', error);
    if (error.code === 'P2003') {
      return res.status(409).json({ error: 'Cannot delete vendor as it is linked to existing agreements or shipments.' });
    }
    res.status(500).json({ error: 'Failed to delete vendor.' });
  }
};

module.exports = {
  getUserStats,
  getUsers,
  updateUserProfile,
  resetUserPassword,
  getUserAuditTrail,
  getRegistrations,
  updateRegistration,
  approveRegistration,
  rejectRegistration,
  getAgreements,
  createAgreement,
  updateAgreement,
  deleteAgreement,
  addRateCard,
  updateRateCard,
  deleteRateCard,
  listVendors,
  getVendors,
  createVendor,
  updateVendor,
  deleteVendor,
};
