const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const redisClient = require('../utils/redisClient');
const logger = require('../utils/logger');

const isTokenRevoked = async (token) => {
  if (!token) return false;
  try {
    const revoked = await redisClient.get(`revoked:${token}`);
    return Boolean(revoked);
  } catch (error) {
    logger.warn('Token revocation check failed', { error: error.message });
    return false;
  }
};

const isIpAllowed = (allowedList, ip) => {
  if (!Array.isArray(allowedList) || !allowedList.length) return true;
  if (!ip) return false;
  const candidates = allowedList.map((value) => String(value || '').trim()).filter(Boolean);
  if (!candidates.length) return true;
  if (candidates.includes('*')) return true;
  const normalizedIp = ip.replace('::ffff:', '');
  return candidates.includes(normalizedIp) || candidates.includes(ip);
};

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const revoked = await isTokenRevoked(token);
    if (revoked) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    const userId = decoded.userId || decoded.id;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        isActive: true,
        vendorId: true,
        notificationPreferences: true,
        twoFactorEnabled: true,
        twoFactorChannel: true,
        allowedIpRanges: true,
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'User account is inactive' });
    }

    if (!isIpAllowed(user.allowedIpRanges, req.ip)) {
      return res.status(403).json({ error: 'Access denied from this IP address' });
    }

    req.user = user;
    req.authToken = token;
    req.authPayload = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Check user role
const ROLE_INHERITANCE = {
  SUPER_ADMIN: ['SUPER_ADMIN'],
  ADMIN: ['ADMIN'],
  COMPANY_ADMIN: ['COMPANY_ADMIN', 'USER'],
  FINANCE_APPROVER: ['FINANCE_APPROVER', 'USER'],
  OPERATIONS: ['OPERATIONS', 'USER'],
  TRANSPORTER: ['TRANSPORTER'],
  AGENT: ['AGENT'],
  USER: ['USER'],
};

const deriveRoleSet = (role) => {
  const normalized = ROLE_INHERITANCE[role] || [role];
  return new Set(normalized);
};

const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRoles = deriveRoleSet(req.user.role);
    const allowed = roles.some((role) => userRoles.has(role));

    if (!allowed) {
      return res.status(403).json({
        error: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRole,
  deriveRoleSet,
  _test: {
    isIpAllowed
  }
};
