const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, shipmentController.createShipment);
router.get('/', authenticateToken, shipmentController.getShipments);
router.get('/:id', authenticateToken, shipmentController.getShipmentById);
router.put('/:id/status', authenticateToken, shipmentController.updateShipmentStatus);
router.put('/:id/pod', authenticateToken, shipmentController.uploadPOD);
router.get('/tracking/:trackingNumber', shipmentController.getShipmentTracking);

module.exports = router;
