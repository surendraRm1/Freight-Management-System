const express = require('express');
const {
  getAccruedCostsReport,
  getRejectedInvoiceAnalysis,
  getPodPerformanceKpi,
  getTransporterScorecard,
} = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');

const router = express.Router();

router.use(authenticateToken, checkRole(['FINANCE_APPROVER', 'COMPANY_ADMIN']));

router.get('/accrued-costs', getAccruedCostsReport);
router.get('/rejected-invoice-analysis', getRejectedInvoiceAnalysis);
router.get('/pod-performance-kpi', getPodPerformanceKpi);
router.get('/transporter-scorecard', getTransporterScorecard);

module.exports = router;
