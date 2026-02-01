const express = require('express');
const {
  createInvoice,
  getAllPendingInvoices,
  approveInvoice,
  rejectInvoice,
} = require('../controllers/invoiceController');
const { authenticateToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');

const router = express.Router();

router.post(
  '/',
  authenticateToken,
  checkRole(['OPERATIONS', 'TRANSPORTER', 'COMPANY_ADMIN']),
  createInvoice,
);

router.get(
  '/pending',
  authenticateToken,
  checkRole(['FINANCE_APPROVER', 'COMPANY_ADMIN']),
  getAllPendingInvoices,
);

router.put(
  '/:id/approve',
  authenticateToken,
  checkRole(['FINANCE_APPROVER', 'COMPANY_ADMIN']),
  approveInvoice,
);

router.put(
  '/:id/reject',
  authenticateToken,
  checkRole(['FINANCE_APPROVER', 'COMPANY_ADMIN']),
  rejectInvoice,
);

module.exports = router;
