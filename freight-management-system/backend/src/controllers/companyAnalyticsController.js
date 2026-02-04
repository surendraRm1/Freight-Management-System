const analyticsService = require('../services/analyticsService');
const analyticsIntegrationService = require('../services/analyticsIntegrationService');
const logger = require('../utils/logger');

const ensureCompanyContext = (req, res) => {
  if (!req.user?.companyId) {
    res.status(403).json({ error: 'Company context missing' });
    return null;
  }
  return req.user.companyId;
};

const getCompanyOverview = async (req, res) => {
  const companyId = ensureCompanyContext(req, res);
  if (!companyId) return;

  try {
    const rangeDays = Number.parseInt(req.query.range, 10) || 30;
    const data = await analyticsService.getCompanyOverview(companyId, { rangeDays });
    res.json(data);
  } catch (error) {
    logger.error('Failed to build company analytics overview', error);
    res.status(500).json({ error: 'Failed to load analytics data.' });
  }
};

const convertToCsv = (rows) => {
  if (!rows || rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const escapeCell = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.join(',');
  const csvRows = [`# Generated for ${new Date().toISOString()}`, headerRow];
  rows.forEach((row) => {
    csvRows.push(headers.map((header) => escapeCell(row[header])).join(','));
  });

  return csvRows.join('\n');
};

const exportDataset = async (req, res) => {
  const companyId = ensureCompanyContext(req, res);
  if (!companyId) return;

  const dataset = String(req.params.dataset || '').toLowerCase();

  try {
    const rows = await analyticsService.buildExportRows(companyId, dataset);
    if (!rows) {
      return res.status(400).json({ error: 'Unsupported dataset requested.' });
    }

    const csv = convertToCsv(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${dataset}-report.csv`);
    return res.status(200).send(csv);
  } catch (error) {
    logger.error(`Failed to export analytics dataset ${dataset}`, error);
    return res.status(500).json({ error: 'Failed to export dataset.' });
  }
};

const publishAnalytics = async (req, res) => {
  const companyId = ensureCompanyContext(req, res);
  if (!companyId) return;

  if (req.user?.role !== 'COMPANY_ADMIN') {
    return res.status(403).json({ error: 'Only company admins can publish analytics snapshots.' });
  }

  try {
    const publishedAt = await analyticsIntegrationService.publishSnapshot(companyId, req.body?.webhookUrl);
    logger.info(`Published analytics snapshot for company ${companyId}`, {
      companyId,
      userId: req.user.id,
    });
    return res.json({ status: 'ok', publishedAt });
  } catch (error) {
    logger.error('Failed to publish analytics snapshot', error);
    return res.status(500).json({ error: error.message || 'Failed to publish snapshot.' });
  }
};

module.exports = {
  getCompanyOverview,
  exportDataset,
  publishAnalytics,
};
