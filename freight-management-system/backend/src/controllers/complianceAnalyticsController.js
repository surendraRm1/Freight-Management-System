const { getComplianceOverview } = require('../services/complianceAnalyticsService');
const logger = require('../utils/logger');

const getComplianceAnalytics = async (req, res) => {
  if (!req.user?.companyId) {
    return res.status(403).json({ error: 'Company context missing' });
  }
  if (req.user.role !== 'COMPANY_ADMIN') {
    return res.status(403).json({ error: 'Only company admins can access compliance overview.' });
  }

  try {
    const data = await getComplianceOverview(req.user.companyId);
    return res.json(data);
  } catch (error) {
    logger.error('Failed to load compliance analytics overview', error);
    return res.status(500).json({ error: 'Failed to load compliance analytics.' });
  }
};

module.exports = {
  getComplianceAnalytics,
};
