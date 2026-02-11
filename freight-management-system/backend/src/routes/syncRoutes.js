const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { enqueueSyncJob, listSyncQueue, updateSyncEntry } = require('../controllers/syncQueueController');
const { syncEntityCollection } = require('../controllers/syncController');

const router = express.Router();

router.use(authenticateToken);

router.post('/queue', enqueueSyncJob);
router.get('/queue', listSyncQueue);
router.patch('/queue/:id', updateSyncEntry);
router.post('/:entity', syncEntityCollection);

module.exports = router;
