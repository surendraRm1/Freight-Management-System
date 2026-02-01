const express = require('express');

const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

router.post(
  '/',
  authenticateToken,
  authorizeRole('USER', 'ADMIN'),
  paymentController.createPayment,
);

router.post(
  '/:id/confirm',
  authenticateToken,
  authorizeRole('ADMIN'),
  paymentController.confirmPayment,
);

router.post(
  '/:id/capture',
  authenticateToken,
  authorizeRole('ADMIN'),
  paymentController.capturePayment,
);

router.get('/:id', authenticateToken, paymentController.getPayment);

module.exports = router;
