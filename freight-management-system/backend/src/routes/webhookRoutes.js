const express = require('express');
const { body } = require('express-validator');
const { handleErpWebhook } = require('../controllers/erpWebhookController');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

const webhookValidators = [
    body('customer_name').notEmpty().withMessage('Customer name is required'),
    body('delivery_details').isObject().withMessage('Delivery details must be an object'),
    body('delivery_details.address').notEmpty().withMessage('Delivery address is required'),
    body('items').isArray().withMessage('Items must be an array'),
];

router.post(
    '/api/v1/erp-webhook',
    express.json(),
    webhookValidators,
    validateRequest,
    handleErpWebhook
);

module.exports = router;
