const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');
const { getOperationsOverview } = require('../controllers/operationsAnalyticsController');

const router = express.Router();

router.use(authenticateToken, checkRole(['COMPANY_ADMIN', 'OPERATIONS']));

router.get('/overview', getOperationsOverview);

module.exports = router;
