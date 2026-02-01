const { body } = require('express-validator');

const createShipmentValidator = [
    body('fromLocation').trim().notEmpty().withMessage('From Location is required'),
    body('toLocation').trim().notEmpty().withMessage('To Location is required'),
    body('weight').optional().isFloat({ min: 0 }).withMessage('Weight must be a positive number'),
    body('fromLat').optional().isFloat().withMessage('From Latitude must be a valid coordinate'),
    body('fromLng').optional().isFloat().withMessage('From Longitude must be a valid coordinate'),
    body('toLat').optional().isFloat().withMessage('To Latitude must be a valid coordinate'),
    body('toLng').optional().isFloat().withMessage('To Longitude must be a valid coordinate'),
    body('shipmentType').optional().isIn(['STANDARD', 'EXPRESS', 'FRAGILE']).withMessage('Invalid shipment type'),
    body('urgency').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid urgency level'),
];

module.exports = {
    createShipmentValidator,
};
