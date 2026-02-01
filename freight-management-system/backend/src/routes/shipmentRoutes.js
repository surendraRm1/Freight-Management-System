const express = require('express');
const { createManualShipment, getAllShipments, uploadPOD } = require('../controllers/shipmentController');
const { authenticateToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');

const router = express.Router();

const { createShipmentValidator } = require('../validators/shipmentValidators');
const validateRequest = require('../middleware/validateRequest');

router.post(
  '/',
  authenticateToken,
  checkRole(['OPERATIONS', 'COMPANY_ADMIN', 'USER']),
  createShipmentValidator,
  validateRequest,
  createManualShipment,
);

router.get(
  '/',
  authenticateToken,
  checkRole(['OPERATIONS', 'COMPANY_ADMIN', 'FINANCE_APPROVER', 'USER']),
  getAllShipments,
);

router.put(
  '/:id/pod',
  authenticateToken,
  checkRole(['OPERATIONS', 'TRANSPORTER']),
  uploadPOD,
);

module.exports = router;
