const prisma = require('../lib/prisma');
const logger = require('../utils/logger');

const VALID_STATUSES = ['PENDING', 'PROCESSING', 'SUCCESS', 'ERROR'];

const enqueueSyncJob = async (req, res) => {
  try {
    const { entityType, entityId, action, payload } = req.body || {};

    if (!entityType || !action || payload === undefined) {
      return res.status(400).json({ error: 'entityType, action, and payload are required.' });
    }

    const entry = await prisma.syncQueue.create({
      data: {
        entityType,
        entityId,
        action,
        payload,
      },
    });

    return res.status(201).json({ entry });
  } catch (error) {
    logger.error('Failed to enqueue sync item', error);
    return res.status(500).json({ error: 'Failed to enqueue sync item.' });
  }
};

const listSyncQueue = async (req, res) => {
  try {
    const { status = 'PENDING', limit = 50 } = req.query;
    const normalizedStatus = String(status).toUpperCase();

    if (normalizedStatus && !VALID_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Invalid status filter.' });
    }

    const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

    const entries = await prisma.syncQueue.findMany({
      where: normalizedStatus ? { status: normalizedStatus } : undefined,
      orderBy: { createdAt: 'asc' },
      take,
    });

    return res.json({ entries });
  } catch (error) {
    logger.error('Failed to list sync queue', error);
    return res.status(500).json({ error: 'Failed to load sync queue.' });
  }
};

const updateSyncEntry = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid queue identifier.' });
    }

    const { status, errorMessage = null } = req.body || {};
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }

    const entry = await prisma.syncQueue.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        errorMessage,
      },
    });

    return res.json({ entry });
  } catch (error) {
    logger.error('Failed to update sync entry', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Sync entry not found.' });
    }
    return res.status(500).json({ error: 'Failed to update sync entry.' });
  }
};

module.exports = {
  enqueueSyncJob,
  listSyncQueue,
  updateSyncEntry,
};
