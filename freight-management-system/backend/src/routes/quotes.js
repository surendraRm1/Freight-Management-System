const express = require('express');
const router = express.Router();

const { authenticateToken, authorizeRole } = require('../middleware/auth');
const quoteController = require('../controllers/quoteController');

router.post(
  '/',
  authenticateToken,
  authorizeRole('USER', 'ADMIN'),
  quoteController.createQuoteRequest,
);

router.get('/', authenticateToken, quoteController.getQuoteRequests);

router.get('/:id', authenticateToken, quoteController.getQuoteRequestById);

router.post(
  '/responses/:responseId/approve',
  authenticateToken,
  authorizeRole('USER', 'ADMIN'),
  quoteController.approveQuoteResponse,
);

router.post(
  '/responses/:responseId/consent',
  authenticateToken,
  authorizeRole('AGENT', 'VENDOR', 'ADMIN'),
  quoteController.submitQuoteResponseConsent,
);

router.get(
  '/responses/:responseId/consent-history',
  authenticateToken,
  quoteController.getQuoteResponseConsentHistory,
);

module.exports = router;
