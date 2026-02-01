const express = require('express');
const {
  createCompanyUser,
  getCompanyUsers,
  getCompanyUserStats,
  updateCompanyUser,
  resetCompanyUserPassword,
  getCompanyUserAuditTrail
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

module.exports = router;
