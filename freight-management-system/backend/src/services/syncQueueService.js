const prisma = require('../lib/prisma');
const logger = require('../utils/logger');

class SyncQueueService {
  async enqueue({ entityType, entityId, action, payload }) {
    try {
      return await prisma.syncQueue.create({
        data: {
          entityType,
          entityId: entityId ? String(entityId) : null,
          action,
          payload,
        },
      });
    } catch (error) {
      logger.error('Failed to enqueue sync job', error);
      return null;
    }
  }
}

module.exports = new SyncQueueService();
