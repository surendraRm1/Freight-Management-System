const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { syncPlanToBilling } = require('../services/billingService');

const ensureCompany = (req, res) => {
  if (!req.user?.companyId) {
    res.status(403).json({ error: 'Company context missing' });
    return null;
  }
  return req.user.companyId;
};

const getCompanyProfile = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        billingEmail: true,
        plan: true,
        subscriptionStatus: true,
        settings: true,
        webhookSecret: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const masked = company?.webhookSecret ? company.webhookSecret.slice(-4) : null;
    const response = {
      ...company,
      webhookSecretLast4: masked,
    };
    delete response.webhookSecret;

    return res.status(200).json(response);
  } catch (error) {
    console.error('Failed to load company profile', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const updateCompanyProfile = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  const { name, billingEmail, settings } = req.body || {};

  try {
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        name,
        billingEmail,
        settings,
      },
    });

    await syncPlanToBilling(updated);

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Failed to update company profile', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const updateBillingSettings = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  const { plan, subscriptionStatus, billingEmail, trialEndsAt } = req.body || {};

  try {
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        plan,
        subscriptionStatus,
        billingEmail,
        trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : undefined,
      },
    });

    await syncPlanToBilling(updated);

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Failed to update billing settings', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const rotateWebhookSecret = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  try {
    const newSecret = crypto.randomBytes(32).toString('hex');
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: { webhookSecret: newSecret },
      select: { id: true, webhookSecret: true },
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Failed to rotate webhook secret', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  getCompanyProfile,
  updateCompanyProfile,
  updateBillingSettings,
  rotateWebhookSecret,
};
