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

module.exports = router;
