const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { redisClient, isRedisReady } = require('../utils/redisClient');
const logger = require('../utils/logger');
const { sendPasswordResetEmail, sendTwoFactorCodeEmail } = require('../services/emailService');

const RESET_TOKEN_TTL_MINUTES = 30;
const TWO_FACTOR_TTL_MINUTES = 10;
const ALLOWED_PUBLIC_ROLES = new Set(['USER', 'VENDOR', 'AGENT']);
const EMAILS_DISABLED = process.env.DISABLE_EMAIL_DELIVERY === 'true';

const register = async (req, res) => {
  const {
    name,
    email,
    phone,
    password,
    role = 'USER',
    vendorId,
  } = req.body || {};

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  if (!ALLOWED_PUBLIC_ROLES.has(role)) {
    return res.status(400).json({ error: 'Unsupported role selected.' });
  }

  if (role === 'AGENT' && !vendorId) {
    return res.status(400).json({ error: 'Vendor ID is required for agent registrations.' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const data = {
      name,
      email,
      phone,
      passwordHash,
      role,
      vendorId: role === 'AGENT' && vendorId ? Number(vendorId) : null,
    };

    await prisma.user.create({ data });

    return res.status(201).json({
      message: 'Registration submitted. An administrator will review and activate your account.',
    });
  } catch (error) {
    console.error('Registration failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const createPasswordResetToken = async (userId) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return rawToken;
};

const createTwoFactorChallenge = async (user) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const expiresAt = new Date(Date.now() + TWO_FACTOR_TTL_MINUTES * 60 * 1000);

  const challenge = await prisma.twoFactorChallenge.create({
    data: {
      userId: user.id,
      codeHash,
      expiresAt,
    },
    select: {
      id: true,
      expiresAt: true,
    },
  });

  await sendTwoFactorCodeEmail(user.email, code);
  logger.info(`Two-factor code dispatched to ${user.email}`);
  return challenge;
};

const verifyTwoFactorChallenge = async (userId, challengeId, code) => {
  const numericId = Number(challengeId);
  if (!Number.isInteger(numericId)) {
    return false;
  }

  const challenge = await prisma.twoFactorChallenge.findUnique({
    where: { id: numericId },
  });

  if (
    !challenge ||
    challenge.userId !== userId ||
    challenge.consumed ||
    challenge.expiresAt < new Date()
  ) {
    return false;
  }

  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const valid = codeHash === challenge.codeHash;
  if (!valid) {
    return false;
  }

  await prisma.twoFactorChallenge.update({
    where: { id: challenge.id },
    data: { consumed: true },
  });

  return true;
};

const login = async (req, res) => {
  const { email, password, twoFactorCode, challengeId } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        companyId: true,
        vendorId: true,
        isActive: true,
        twoFactorEnabled: true,
        company: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is disabled. Contact support.' });
    }

    if (user.role !== 'SUPER_ADMIN') {
      if (user.company && user.company.status !== 'active') {
        return res.status(403).json({ error: 'Company is suspended. Contact support.' });
      }
    }

    if (user.twoFactorEnabled) {
      if (EMAILS_DISABLED) {
        logger.warn('Two-factor enabled but email delivery disabled; skipping challenge.', { userId: user.id });
      } else {
        if (!twoFactorCode || !challengeId) {
          const challenge = await createTwoFactorChallenge(user);
          return res.status(202).json({
            twoFactorRequired: true,
            challengeId: challenge.id,
            expiresAt: challenge.expiresAt,
            message: 'Verification code sent to your email address.',
          });
        }

        const validTwoFactor = await verifyTwoFactorChallenge(user.id, challengeId, twoFactorCode);
        if (!validTwoFactor) {
          return res.status(401).json({ error: 'Invalid two-factor code.' });
        }
      }
    }

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    } catch (updateError) {
      logger.warn('Failed to update last login timestamp', { userId: user.id, error: updateError.message });
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId || null,
      vendorId: user.vendorId || null,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: '12h',
    });

    return res.status(200).json({ token, user: tokenPayload });
  } catch (error) {
    console.error('Login failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const logout = async (req, res) => {
  if (!req.authToken || !req.authPayload) {
    return res.status(400).json({ error: 'Session token missing.' });
  }

  const exp = req.authPayload.exp ? req.authPayload.exp * 1000 : null;
  const ttlSeconds = exp ? Math.max(Math.floor((exp - Date.now()) / 1000), 1) : 12 * 60 * 60;

  try {
    if (isRedisReady()) {
      try {
        await redisClient.setEx(`revoked:${req.authToken}`, ttlSeconds, 'true');
      } catch (cacheError) {
        logger.warn('Failed to cache revocation token', { error: cacheError.message });
      }
    }
  } catch (error) {
    logger.warn('Failed to persist logout token', { error: error.message });
  }

  return res.json({ message: 'Logged out successfully.' });
};

const requestPasswordReset = async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (!user) {
      return res.json({ message: 'If the account exists, a reset link has been emailed.' });
    }

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const rawToken = await createPasswordResetToken(user.id);
    await sendPasswordResetEmail(user.email, rawToken);

    return res.json({ message: 'If the account exists, a reset link has been emailed.' });
  } catch (error) {
    logger.error('Password reset request failed', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const resetPassword = async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password are required.' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.used || record.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }

    const hash = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: hash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { used: true },
      }),
    ]);

    return res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    logger.error('Password reset failed', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getProfile = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        vendorId: true,
        notificationPreferences: true,
        twoFactorEnabled: true,
        allowedIpRanges: true,
      },
    });

    return res.status(200).json({ user });
  } catch (error) {
    console.error('Failed to load profile', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  register,
  login,
  logout,
  requestPasswordReset,
  resetPassword,
  getProfile,
};
