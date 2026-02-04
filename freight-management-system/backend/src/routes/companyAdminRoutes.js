const express = require('express');
const {
  createCompanyUser,
  getCompanyUsers,
  getCompanyUserStats,
  updateCompanyUser,
  resetCompanyUserPassword,
  getCompanyUserAuditTrail,
  listCompanyVendors,
  createCompanyVendor,
  updateCompanyVendor,
  deleteCompanyVendor,
  listVendorOptions,
} = require('../controllers/companyAdminController');
const adminController = require('../controllers/adminController');
const {
  getCompanyOverview,
  exportDataset: exportAnalyticsDataset,
  publishAnalytics,
} = require('../controllers/companyAnalyticsController');
const { getPredictiveAlerts } = require('../controllers/predictiveAlertController');
const { authenticateToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');

const router = express.Router();

router.use(authenticateToken, checkRole(['COMPANY_ADMIN']));

router.get('/users/stats', getCompanyUserStats);
router.post('/users', createCompanyUser);
router.get('/users', getCompanyUsers);
router.patch('/users/:id', updateCompanyUser);
router.post('/users/:id/reset-password', resetCompanyUserPassword);
router.get('/users/:id/audit-log', getCompanyUserAuditTrail);
router.get('/vendors', listCompanyVendors);
router.get('/vendors/list', listCompanyVendors);
router.post('/vendors', createCompanyVendor);
router.put('/vendors/:id', updateCompanyVendor);
router.delete('/vendors/:id', deleteCompanyVendor);
router.get('/vendors/options', listVendorOptions);
router.get('/analytics/overview', getCompanyOverview);
router.get('/analytics/export/:dataset', exportAnalyticsDataset);
router.post('/analytics/publish', publishAnalytics);
router.get('/analytics/alerts', getPredictiveAlerts);
router.get('/agreements', adminController.getAgreements);
router.post('/agreements', adminController.createAgreement);
router.put('/agreements/:id', adminController.updateAgreement);
router.delete('/agreements/:id', adminController.deleteAgreement);
router.post('/agreements/:id/rate-cards', adminController.addRateCard);
router.put('/agreements/:id/rate-cards/:cardId', adminController.updateRateCard);
router.delete('/agreements/:id/rate-cards/:cardId', adminController.deleteRateCard);

module.exports = router;
