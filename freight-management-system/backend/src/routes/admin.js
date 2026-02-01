const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const analyticsController = require('../controllers/analyticsController');

router.use(authenticateToken, authorizeRole('ADMIN'));

router.get('/users/stats', adminController.getUserStats);
router.get('/users', adminController.getUsers);
router.patch('/users/:id', adminController.updateUserProfile);
router.post('/users/:id/reset-password', adminController.resetUserPassword);
router.get('/users/:id/audit-log', adminController.getUserAuditTrail);

router.get('/registrations', adminController.getRegistrations);
router.patch('/registrations/:id', adminController.updateRegistration);
router.post('/registrations/:id/approve', adminController.approveRegistration);
router.post('/registrations/:id/reject', adminController.rejectRegistration);

router.get('/agreements', adminController.getAgreements);
router.post('/agreements', adminController.createAgreement);
router.put('/agreements/:id', adminController.updateAgreement);
router.delete('/agreements/:id', adminController.deleteAgreement);

router.post('/agreements/:id/rate-cards', adminController.addRateCard);
router.put('/agreements/:id/rate-cards/:cardId', adminController.updateRateCard);
router.delete('/agreements/:id/rate-cards/:cardId', adminController.deleteRateCard);

router.get('/vendors/list', adminController.listVendors);
router.get('/vendors', adminController.getVendors);
router.post('/vendors', adminController.createVendor);
router.put('/vendors/:id', adminController.updateVendor);
router.delete('/vendors/:id', adminController.deleteVendor);

router.get('/analytics', analyticsController.getAnalytics);

module.exports = router;
