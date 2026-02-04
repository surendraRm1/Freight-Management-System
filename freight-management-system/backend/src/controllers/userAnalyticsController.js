const { getUserOverview } = require('../services/userAnalyticsService');
const logger = require('../utils/logger');

const getUserAnalyticsOverview = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const data = await getUserOverview(userId);
    return res.json(data);
  } catch (error) {
    logger.error('Failed to load user analytics overview', error);
    return res.status(500).json({ error: 'Failed to load user insights.' });
  }
};

module.exports = {
  getUserAnalyticsOverview,
};
