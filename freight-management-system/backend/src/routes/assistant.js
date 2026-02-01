const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const assistantController = require('../controllers/assistantController');

router.use(authenticateToken, authorizeRole('ADMIN', 'USER'));

router.post('/query', assistantController.assistantQuery);

module.exports = router;
