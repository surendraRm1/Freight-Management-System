const prisma = require('../lib/prisma');
const logger = require('../utils/logger');

const ENTITY_MAP = {
  companies: prisma.company,
  users: prisma.user,
  vendors: prisma.vendor,
  quoteRequests: prisma.quoteRequest,
  quoteResponses: prisma.quoteResponse,
  shipments: prisma.shipment,
  invoices: prisma.invoice,
};

const syncEntityCollection = async (req, res) => {
  try {
    const { entity } = req.params;
    const delegate = ENTITY_MAP[entity];
    if (!delegate) {
      return res.status(404).json({ error: `Unsupported entity: ${entity}` });
    }

    const { records = [], deviceId } = req.body || {};
    if (!Array.isArray(records) || !records.length) {
      return res.status(400).json({ error: 'records array is required.' });
    }

    const syncedIds = [];
    const overrides = [];

    for (const entry of records) {
      const { id, updatedAt, data = {} } = entry || {};
      if (!id) continue;
      try {
        const existing = await delegate.findUnique({ where: { id } });
        if (!existing) {
          await delegate.create({
            data: {
              ...data,
              id,
              isSynced: true,
              deviceId: deviceId || entry.deviceId || 'unknown-device',
            },
          });
          syncedIds.push(id);
          continue;
        }

        if (existing.updatedAt && updatedAt && new Date(existing.updatedAt) > new Date(updatedAt)) {
          overrides.push({ id, data: existing });
          continue;
        }

        await delegate.update({
          where: { id },
          data: {
            ...data,
            isSynced: true,
            deviceId: deviceId || entry.deviceId || existing.deviceId,
          },
        });
        syncedIds.push(id);
      } catch (error) {
        logger.warn('Sync reconciliation failed for entity', { entity, id, error: error.message });
      }
    }

    return res.json({ syncedIds, overrides });
  } catch (error) {
    logger.error('Sync reconciliation endpoint failed', error);
    return res.status(500).json({ error: 'Failed to process sync payload.' });
  }
};

module.exports = {
  syncEntityCollection,
};
