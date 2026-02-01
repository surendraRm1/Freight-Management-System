const express = require('express');

const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const invoiceController = require('../controllers/invoiceController');

router.post(
  '/',
  authenticateToken,
  authorizeRole('ADMIN'),
  invoiceController.createInvoice,
);

router.get('/:id', authenticateToken, invoiceController.getInvoice);

router.get(
  '/:id/download',
  authenticateToken,
  authorizeRole('ADMIN', 'USER'),
  invoiceController.downloadInvoice,
);

router.post(
  '/transporter',
  authenticateToken,
  invoiceController.createTransporterInvoice,
);

router.get(
  '/transporter/pending',
  authenticateToken,
  authorizeRole('ADMIN'),
  invoiceController.getAllPendingTransporterInvoices,
);

router.put(
  '/transporter/:id/approve',
  authenticateToken,
  authorizeRole('ADMIN'),
  invoiceController.approveTransporterInvoice,
);

router.put(
  '/transporter/:id/reject',
  authenticateToken,
  authorizeRole('ADMIN'),
  invoiceController.rejectTransporterInvoice,
);

module.exports = router;
