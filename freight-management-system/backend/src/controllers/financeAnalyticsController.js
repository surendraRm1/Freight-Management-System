const financeAnalyticsService = require('../services/financeAnalyticsService');
const logger = require('../utils/logger');

const ensureFinanceAccess = (req, res) => {
  if (!req.user?.companyId) {
    res.status(403).json({ error: 'Company context missing' });
    return null;
  }
  if (!['COMPANY_ADMIN', 'FINANCE_APPROVER'].includes(req.user.role)) {
    res.status(403).json({ error: 'Insufficient permissions for finance analytics' });
    return null;
  }
  return req.user.companyId;
};

const getFinanceOverview = async (req, res) => {
  const companyId = ensureFinanceAccess(req, res);
  if (!companyId) return;

  try {
    const data = await financeAnalyticsService.getFinanceOverview(companyId);
    res.json(data);
  } catch (error) {
    logger.error('Failed to build finance analytics overview', error);
    res.status(500).json({ error: 'Failed to load finance analytics.' });
  }
};

const exportFinanceDataset = async (req, res) => {
  const companyId = ensureFinanceAccess(req, res);
  if (!companyId) return;

  const dataset = String(req.params.dataset || '').toLowerCase();

  try {
    const rows = await financeAnalyticsService.buildFinanceExportRows(companyId, dataset);
    if (!rows) {
      return res.status(400).json({ error: 'Unsupported finance dataset requested.' });
    }
    const headers = Object.keys(rows[0] || {});
    const csvRows = [
      headers.join(','),
      ...rows.map((row) => headers.map((header) => `"${(row[header] ?? '').toString().replace(/"/g, '""')}"`).join(',')),
    ];
    const csv = csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${dataset}-finance.csv`);
    res.status(200).send(csv);
  } catch (error) {
    logger.error(`Failed to export finance dataset ${dataset}`, error);
    res.status(500).json({ error: 'Failed to export finance dataset.' });
  }
};

module.exports = {
  getFinanceOverview,
  exportFinanceDataset,
};
