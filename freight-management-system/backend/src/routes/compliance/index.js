const express = require('express');
const {
  generateGstInvoice,
  generateRcmSelfInvoice,
  createEwayBill,
  extendEwayBill,
  cancelEwayBill,
  uploadDriverKyc,
  uploadVehicleKyc,
  uploadLorryReceipt,
  approveComplianceDocument,
  rejectComplianceDocument,
  listComplianceQueue,
  listPendingKycShipments,
  listComplianceDocuments,
  downloadComplianceDocument,
} = require('../../controllers/complianceController');
const { getComplianceAnalytics } = require('../../controllers/complianceAnalyticsController');
const { authenticateToken, authorizeRole } = require('../../middleware/auth');
const upload = require('../../middleware/upload');

const operationsTeamRoles = ['ADMIN', 'SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATIONS', 'AGENT'];

const router = express.Router();

router.post(
  '/gst',
  authenticateToken,
  authorizeRole('ADMIN'),
  generateGstInvoice,
);

router.post(
  '/rcm',
  authenticateToken,
  authorizeRole('ADMIN'),
  generateRcmSelfInvoice,
);

router.post(
  '/eway/create',
  authenticateToken,
  authorizeRole('ADMIN'),
  createEwayBill,
);

router.post(
  '/eway/:id/extend',
  authenticateToken,
  authorizeRole('ADMIN'),
  extendEwayBill,
);

router.post(
  '/eway/:id/cancel',
  authenticateToken,
  authorizeRole('ADMIN'),
  cancelEwayBill,
);

router.post(
  '/kyc/driver',
  authenticateToken,
  authorizeRole(...operationsTeamRoles),
  upload.single('document'),
  uploadDriverKyc,
);

router.post(
  '/kyc/vehicle',
  authenticateToken,
  authorizeRole(...operationsTeamRoles),
  upload.single('document'),
  uploadVehicleKyc,
);

router.post(
  '/lr',
  authenticateToken,
  authorizeRole(...operationsTeamRoles),
  upload.single('document'),
  uploadLorryReceipt,
);

router.post(
  '/documents/:id/approve',
  authenticateToken,
  authorizeRole('ADMIN'),
  approveComplianceDocument,
);

router.post(
  '/documents/:id/reject',
  authenticateToken,
  authorizeRole('ADMIN'),
  rejectComplianceDocument,
);

router.get(
  '/queue',
  authenticateToken,
  authorizeRole('ADMIN', 'COMPANY_ADMIN'),
  listComplianceQueue,
);

router.get(
  '/documents',
  authenticateToken,
  listComplianceDocuments,
);

router.get(
  '/documents/:id/download',
  authenticateToken,
  authorizeRole('ADMIN', 'USER'),
  downloadComplianceDocument,
);

router.get(
  '/analytics/overview',
  authenticateToken,
  authorizeRole('COMPANY_ADMIN'),
  getComplianceAnalytics,
);

router.get(
  '/kyc/pending',
  authenticateToken,
  authorizeRole(...operationsTeamRoles),
  listPendingKycShipments,
);

module.exports = router;
