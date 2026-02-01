const { ConsentStatus } = require('@prisma/client');
const prisma = require('../lib/prisma');

const normalizeIpList = (ips = []) =>
  Array.isArray(ips)
    ? ips
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    : [];

const getNotificationPreferences = async (req, res) => {
  return res.json({
    preferences: req.user.notificationPreferences || {},
  });
};

const updateNotificationPreferences = async (req, res) => {
  const preferences = req.body?.preferences || {};
  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: { notificationPreferences: preferences },
    select: { notificationPreferences: true },
  });

  return res.json(updated);
};

const updateSecuritySettings = async (req, res) => {
  const { allowedIpRanges, twoFactorEnabled } = req.body || {};

  const data = {};
  if (typeof twoFactorEnabled === 'boolean') {
    data.twoFactorEnabled = twoFactorEnabled;
  }
  if (allowedIpRanges !== undefined) {
    data.allowedIpRanges = normalizeIpList(allowedIpRanges);
  }

  if (!Object.keys(data).length) {
    return res.status(400).json({ error: 'Provide at least one security setting.' });
  }

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data,
    select: {
      twoFactorEnabled: true,
      allowedIpRanges: true,
    },
  });

  return res.json(updated);
};

const recordUserConsent = async (req, res) => {
  const { consentType, status = 'ACCEPTED', metadata } = req.body || {};

  if (!consentType) {
    return res.status(400).json({ error: 'consentType is required.' });
  }

  const normalizedStatus = String(status || '')
    .trim()
    .toUpperCase();
  const validStatus = Object.keys(ConsentStatus).includes(normalizedStatus)
    ? normalizedStatus
    : ConsentStatus.ACCEPTED;

  await prisma.userConsent.create({
    data: {
      userId: req.user.id,
      consentType,
      status: validStatus,
      metadata,
    },
  });

  return res.status(201).json({ message: 'Consent recorded.' });
};

module.exports = {
  getNotificationPreferences,
  updateNotificationPreferences,
  updateSecuritySettings,
  recordUserConsent,
};
