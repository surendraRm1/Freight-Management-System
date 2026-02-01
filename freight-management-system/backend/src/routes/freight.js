const express = require('express');
const router = express.Router();
const freightController = require('../controllers/freightController');
const { authenticateToken } = require('../middleware/auth');

router.post('/calculate', authenticateToken, freightController.calculateFreight);
router.get('/vendors', authenticateToken, freightController.getVendors);

module.exports = router;