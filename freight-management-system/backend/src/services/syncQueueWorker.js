const axios = require('axios');
const prisma = require('../lib/prisma');
const logger = require('../utils/logger');

const STATUSES = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
};

class SyncQueueWorker {
  constructor() {
    this.webhookUrl = process.env.SYNC_WEBHOOK_URL || '';
    this.pollInterval = parseInt(process.env.SYNC_POLL_INTERVAL_MS || '15000', 10);
    this.batchSize = parseInt(process.env.SYNC_BATCH_SIZE || '10', 10);
    this.maxAttempts = parseInt(process.env.SYNC_MAX_ATTEMPTS || '5', 10);
    this.timer = null;
    this.isProcessing = false;
  }

  start() {
    if (this.timer || !this.webhookUrl) {
      if (!this.webhookUrl) {
        logger.info('SyncQueueWorker disabled (set SYNC_WEBHOOK_URL to enable).');
      }
      return;
    }

    this.timer = setInterval(() => {
      this.processQueue().catch((error) => {
        logger.error('SyncQueueWorker encountered an error', error);
      });
    }, this.pollInterval);

    // kick-off immediately
    this.processQueue().catch((error) => {
      logger.error('SyncQueueWorker initial run failed', error);
    });

    logger.info(`SyncQueueWorker started. Poll interval: ${this.pollInterval}ms`);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async processQueue() {
    if (this.isProcessing || !this.webhookUrl) return;
    this.isProcessing = true;

    try {
      const entries = await prisma.syncQueue.findMany({
        where: { status: STATUSES.PENDING },
        orderBy: { createdAt: 'asc' },
        take: this.batchSize,
      });

      for (const entry of entries) {
        // eslint-disable-next-line no-await-in-loop
        await this.handleEntry(entry);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async handleEntry(entry) {
    const attempts = entry.attempts + 1;
    await prisma.syncQueue.update({
      where: { id: entry.id },
      data: {
        status: STATUSES.PROCESSING,
        attempts,
        errorMessage: null,
      },
    });

    try {
      await axios.post(this.webhookUrl, {
        id: entry.id,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        payload: entry.payload,
        attempts,
      });

      await prisma.syncQueue.update({
        where: { id: entry.id },
        data: {
          status: STATUSES.SUCCESS,
          errorMessage: null,
        },
      });
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Unknown sync error';
      const nextStatus = attempts >= this.maxAttempts ? STATUSES.ERROR : STATUSES.PENDING;

      await prisma.syncQueue.update({
        where: { id: entry.id },
        data: {
          status: nextStatus,
          errorMessage: message,
        },
      });

      logger.warn(`Sync job ${entry.id} failed (attempt ${attempts})`, { message });
    }
  }
}

module.exports = new SyncQueueWorker();
