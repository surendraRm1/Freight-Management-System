const express = require('express');
const {
  getCompanyProfile,
  updateCompanyProfile,
  updateBillingSettings,
  rotateWebhookSecret,
} = require('../controllers/companyController');
const { authenticateToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');

const router = express.Router();

router.use(authenticateToken, checkRole(['COMPANY_ADMIN']));

router.get('/', getCompanyProfile);
router.put('/', updateCompanyProfile);
router.put('/billing', updateBillingSettings);
router.post('/rotate-webhook', rotateWebhookSecret);

module.exports = router;
