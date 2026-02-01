const express = require('express');
const {
  createCompany,
  listCompanies,
  updateCompanyProfile,
  rotateCompanyWebhook,
  getCompanyUsers,
  upsertCompanyUser,
  deleteCompanyUser,
  getOverview,
  listPlatformUsers,
  upsertPlatformUser,
  deletePlatformUser,
  exportAuditLogs,
} = require('../controllers/superAdminController');
const { authenticateToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');

const router = express.Router();

router.use(authenticateToken, checkRole(['SUPER_ADMIN']));

router.post('/companies', createCompany);
router.get('/companies', listCompanies);
router.put('/companies/:companyId', updateCompanyProfile);
router.post('/companies/:companyId/rotate-webhook', rotateCompanyWebhook);
router.get('/companies/:companyId/users', getCompanyUsers);
router.post('/companies/:companyId/users', upsertCompanyUser);
router.put('/companies/:companyId/users/:userId', upsertCompanyUser);
router.delete('/companies/:companyId/users/:userId', deleteCompanyUser);
router.get('/overview', getOverview);
router.get('/platform-users', listPlatformUsers);
router.post('/platform-users', upsertPlatformUser);
router.put('/platform-users/:id', upsertPlatformUser);
router.delete('/platform-users/:id', deletePlatformUser);
router.get('/audit-logs/export', exportAuditLogs);

module.exports = router;
