const express = require('express');
const {
  getFinanceOverview,
  exportFinanceDataset,
} = require('../controllers/financeAnalyticsController');
const { authenticateToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');

const router = express.Router();

router.use(authenticateToken, checkRole(['COMPANY_ADMIN', 'FINANCE_APPROVER']));

router.get('/overview', getFinanceOverview);
router.get('/export/:dataset', exportFinanceDataset);

module.exports = router;
