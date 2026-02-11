const os = require('os');
const axios = require('axios');
const prisma = require('../lib/prisma');
const logger = require('../utils/logger');

const CLOUD_SYNC_URL = process.env.CLOUD_SYNC_URL || `${process.env.INTERNAL_SYNC_URL || `http://localhost:${process.env.PORT || 5000}`}/api/v1/sync`;
const DEVICE_ID = process.env.DEVICE_ID || os.hostname();
const SYNC_RECON_BATCH_SIZE = Number(process.env.SYNC_RECON_BATCH_SIZE || 25);
const SYNC_INTERVAL_MS = Number(process.env.SYNC_POLL_INTERVAL_MS || 15000);

const ENTITY_DELEGATES = [
  { key: 'companies', delegate: prisma.company },
  { key: 'users', delegate: prisma.user },
  { key: 'vendors', delegate: prisma.vendor },
  { key: 'quoteRequests', delegate: prisma.quoteRequest },
  { key: 'quoteResponses', delegate: prisma.quoteResponse },
  { key: 'shipments', delegate: prisma.shipment },
  { key: 'invoices', delegate: prisma.invoice },
];

let timer = null;

const buildPayload = (rows) =>
  rows.map((row) => ({
    id: row.id,
    updatedAt: row.updatedAt,
    deviceId: row.deviceId || DEVICE_ID,
    data: row,
  }));

const applyRemoteOverrides = async (entityKey, delegate, overrides = []) => {
  for (const item of overrides) {
    if (!item?.id || !item?.data) continue;
    try {
      await delegate.update({
        where: { id: item.id },
        data: {
          ...item.data,
          isSynced: true,
          deviceId: DEVICE_ID,
        },
      });
    } catch (error) {
      logger.warn('Failed to apply remote override', { entity: entityKey, id: item.id, error: error.message });
    }
  }
};

const markRowsSynced = async (delegate, ids = []) => {
  if (!ids.length) return;
  await delegate.updateMany({
    where: { id: { in: ids } },
    data: { isSynced: true, deviceId: DEVICE_ID },
  });
};

const processEntity = async (entity) => {
  const rows = await entity.delegate.findMany({
    where: { isSynced: false },
    take: SYNC_RECON_BATCH_SIZE,
    orderBy: { updatedAt: 'asc' },
  });

  if (!rows.length) {
    return;
  }

  const payload = buildPayload(rows);
  try {
    const endpoint = `${CLOUD_SYNC_URL.replace(/\/$/, '')}/${entity.key}`;
    const { data } = await axios.post(endpoint, {
      records: payload,
      deviceId: DEVICE_ID,
    });

    await markRowsSynced(entity.delegate, data?.syncedIds || rows.map((row) => row.id));

    if (Array.isArray(data?.overrides)) {
      await applyRemoteOverrides(entity.key, entity.delegate, data.overrides);
    }
  } catch (error) {
    logger.warn('Cloud sync push failed', {
      entity: entity.key,
      error: error.response?.data || error.message,
    });
  }
};

const tick = async () => {
  if (!CLOUD_SYNC_URL) {
    return;
  }
  for (const entity of ENTITY_DELEGATES) {
    await processEntity(entity);
  }
};

const start = () => {
  if (!CLOUD_SYNC_URL) {
    logger.info('Cloud sync disabled (CLOUD_SYNC_URL not set).');
    return;
  }
  if (timer) return;
  logger.info(`Cloud sync worker started. Poll interval: ${SYNC_INTERVAL_MS}ms`);
  tick().catch((error) => logger.error('Initial sync tick failed', error));
  timer = setInterval(() => {
    tick().catch((error) => logger.error('Sync worker tick failed', error));
  }, SYNC_INTERVAL_MS);
};

const stop = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

module.exports = {
  start,
  stop,
};
