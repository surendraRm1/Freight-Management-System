const { ShipmentStatus } = require('@prisma/client');
const prisma = require('../lib/prisma');
const logger = require('../utils/logger');

const safeQuery = (promise, fallback) =>
  promise.catch((error) => {
    logger.warn('A query failed during analytics generation, using fallback.', {
      error: error.message,
    });
    return fallback;
  });

const getAnalytics = async (_req, res) => {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalAgreements,
      activeAgreements,
      expiringAgreements,
      agreementsWithoutRateCards,
      rateCardCount,
      activeVendorCount,
      totalShipments,
      deliveredShipments,
      vendorShipmentStats,
      vendorDeliveredStats,
      routeHeatmap,
    ] = await Promise.all([
      safeQuery(prisma.agreement.count(), 0),
      safeQuery(prisma.agreement.count({ where: { status: 'ACTIVE' } }), 0),
      safeQuery(
        prisma.agreement.count({
          where: {
            effectiveTo: {
              not: null,
              lte: thirtyDaysFromNow,
              gte: now,
            },
          },
        }),
        0,
      ),
      safeQuery(
        prisma.agreement.count({
          where: {
            rateCards: {
              none: {},
            },
          },
        }),
        0,
      ),
      safeQuery(prisma.rateCard.count(), 0),
      safeQuery(prisma.vendor.count({ where: { isActive: true } }), 0),
      safeQuery(prisma.shipment.count(), 0),
      safeQuery(prisma.shipment.count({ where: { status: ShipmentStatus.DELIVERED } }), 0),
      safeQuery(
        prisma.shipment.groupBy({
          by: ['selectedVendorId'],
          where: { selectedVendorId: { not: null } },
          _count: { id: true },
          _avg: { cost: true },
        }),
        [],
      ),
      safeQuery(
        prisma.shipment.groupBy({
          by: ['selectedVendorId'],
          where: { selectedVendorId: { not: null }, status: ShipmentStatus.DELIVERED },
          _count: { id: true },
        }),
        [],
      ),
      safeQuery(
        prisma.shipment.findMany({
          where: { fromLat: { not: null }, toLat: { not: null } },
          select: {
            id: true,
            fromLat: true,
            fromLng: true,
            toLat: true,
            toLng: true,
            status: true,
          },
          take: 100,
        }),
        [],
      ),
    ]);

    const deliveredLookup = vendorDeliveredStats.reduce((acc, entry) => {
      acc.set(entry.selectedVendorId, entry._count.id);
      return acc;
    }, new Map());

    const vendorIds = vendorShipmentStats.map((entry) => entry.selectedVendorId).filter(Boolean);
    const vendorsMeta = vendorIds.length
      ? await prisma.vendor.findMany({
          where: { id: { in: vendorIds } },
          select: { id: true, name: true },
        })
      : [];
    const vendorMap = new Map(vendorsMeta.map((v) => [v.id, v.name]));

    const vendorPerformance = vendorShipmentStats
      .map((entry) => {
        const total = entry._count.id;
        const delivered = deliveredLookup.get(entry.selectedVendorId) || 0;
        return {
          vendorId: entry.selectedVendorId,
          vendorName: vendorMap.get(entry.selectedVendorId) || 'Unknown Vendor',
          shipments: total,
          delivered,
          deliveryRate: total ? Number(((delivered / total) * 100).toFixed(1)) : 0,
          averageCost: entry._avg.cost ? Number(entry._avg.cost.toFixed(2)) : 0,
        };
      })
      .sort((a, b) => b.shipments - a.shipments);

    res.json({
      summary: {
        totalAgreements,
        activeAgreements,
        expiringSoon: expiringAgreements,
        agreementsWithoutRateCards,
        totalRateCards: rateCardCount,
        activeVendors: activeVendorCount,
        totalShipments,
        deliveredShipments,
      },
      vendorPerformance,
      routeHeatmap,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    logger.error('Failed to build analytics', error);
    res.status(500).json({ error: 'Failed to generate analytics dashboard data.' });
  }
};

module.exports = {
  getAnalytics,
};
