const predictiveAlertService = require('../services/predictiveAlertService');
const logger = require('../utils/logger');

const getPredictiveAlerts = async (req, res) => {
  if (!req.user?.companyId) {
    return res.status(403).json({ error: 'Company context missing' });
  }
  if (!['COMPANY_ADMIN', 'OPERATIONS'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions for alerts dashboard.' });
  }

  try {
    const alerts = await predictiveAlertService.getPredictiveAlerts(req.user.companyId);
    return res.json({ alerts, generatedAt: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to load predictive alerts', error);
    return res.status(500).json({ error: 'Failed to load predictive alerts.' });
  }
};

module.exports = {
  getPredictiveAlerts,
};
