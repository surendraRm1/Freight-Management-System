const express = require('express');
const router = express.Router();

const { authenticateToken, authorizeRole } = require('../middleware/auth');
const transporterController = require('../controllers/transporterController');

router.get(
  '/analytics/overview',
  authenticateToken,
  authorizeRole('TRANSPORTER', 'AGENT', 'COMPANY_ADMIN', 'SUPER_ADMIN'),
  transporterController.getTransporterOverview,
);

router.get(
  '/quotes',
  authenticateToken,
  authorizeRole('AGENT', 'VENDOR', 'TRANSPORTER', 'ADMIN', 'COMPANY_ADMIN'),
  transporterController.getPendingQuoteRequests,
);

router.post(
  '/quotes/:responseId/respond',
  authenticateToken,
  authorizeRole('AGENT', 'VENDOR', 'TRANSPORTER', 'ADMIN'),
  transporterController.respondToQuoteRequest,
);

router.get(
  '/assignments',
  authenticateToken,
  authorizeRole('AGENT', 'VENDOR', 'TRANSPORTER', 'ADMIN', 'COMPANY_ADMIN'),
  transporterController.getPendingAssignments,
);

router.post(
  '/assignments/:shipmentId/respond',
  authenticateToken,
  authorizeRole('AGENT', 'VENDOR', 'TRANSPORTER', 'ADMIN'),
  transporterController.respondToAssignment,
);

router.post(
  '/shipments/:shipmentId/driver-info',
  authenticateToken,
  authorizeRole('AGENT', 'VENDOR', 'TRANSPORTER', 'ADMIN'),
  transporterController.updateDriverInfo,
);

router.post(
  '/shipments/:shipmentId/location',
  authenticateToken,
  authorizeRole('AGENT', 'VENDOR', 'TRANSPORTER', 'ADMIN'),
  transporterController.updateDriverLocation,
);

router.get(
  '/drivers',
  authenticateToken,
  authorizeRole('AGENT', 'VENDOR', 'TRANSPORTER', 'COMPANY_ADMIN', 'ADMIN'),
  transporterController.getDrivers,
);

router.post(
  '/drivers',
  authenticateToken,
  authorizeRole('AGENT', 'VENDOR', 'TRANSPORTER'),
  transporterController.createDriver,
);

router.put(
  '/drivers/:driverId',
  authenticateToken,
  authorizeRole('AGENT', 'VENDOR', 'TRANSPORTER'),
  transporterController.updateDriver,
);

router.delete(
  '/drivers/:driverId',
  authenticateToken,
  authorizeRole('AGENT', 'VENDOR', 'TRANSPORTER'),
  transporterController.deleteDriver,
);

module.exports = router;
