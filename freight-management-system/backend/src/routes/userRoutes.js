const express = require('express');
const {
  getNotificationPreferences,
  updateNotificationPreferences,
  updateSecuritySettings,
  recordUserConsent,
} = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/preferences', getNotificationPreferences);
router.put('/preferences', updateNotificationPreferences);
router.put('/security', updateSecuritySettings);
router.post('/consents', recordUserConsent);

module.exports = router;
