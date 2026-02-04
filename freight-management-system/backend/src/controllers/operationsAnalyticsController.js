const operationsAnalyticsService = require('../services/operationsAnalyticsService');
const logger = require('../utils/logger');

const ensureOperationsAccess = (req, res) => {
  if (!req.user?.companyId) {
    res.status(403).json({ error: 'Company context missing' });
    return null;
  }
  if (!['COMPANY_ADMIN', 'OPERATIONS'].includes(req.user.role)) {
    res.status(403).json({ error: 'Insufficient permissions for operations analytics' });
    return null;
  }
  return req.user.companyId;
};

const getOperationsOverview = async (req, res) => {
  const companyId = ensureOperationsAccess(req, res);
  if (!companyId) return;

  try {
    const data = await operationsAnalyticsService.getOperationsOverview(companyId);
    res.json(data);
  } catch (error) {
    logger.error('Failed to build operations analytics overview', error);
    res.status(500).json({ error: 'Failed to load operations analytics.' });
  }
};

module.exports = {
  getOperationsOverview,
};
