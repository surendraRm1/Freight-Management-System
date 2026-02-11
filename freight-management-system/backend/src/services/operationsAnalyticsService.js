const prisma = require('../lib/prisma');
const {
  ShipmentStatus,
  ComplianceStatus,
  QuoteStatus,
  QuoteResponseStatus,
} = require('../constants/prismaEnums');

const ACTIVE_BOARD_STATUSES = [ShipmentStatus.PENDING, ShipmentStatus.ASSIGNED, ShipmentStatus.IN_TRANSIT];
const COMPLETED_STATUS = [ShipmentStatus.DELIVERED];

const getOperationsOverview = async (companyId) => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [pendingShipments, activeShipments, deliveredShipments, exceptionShipments] = await Promise.all([
    prisma.shipment.findMany({
      where: { companyId, status: ShipmentStatus.PENDING },
      select: {
        id: true,
        trackingNumber: true,
        fromLocation: true,
        toLocation: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.shipment.findMany({
      where: { companyId, status: { in: ACTIVE_BOARD_STATUSES } },
      select: {
        id: true,
        trackingNumber: true,
        status: true,
        fromLocation: true,
        toLocation: true,
        estimatedDelivery: true,
        driverEta: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    }),
    prisma.shipment.findMany({
      where: { companyId, status: { in: COMPLETED_STATUS } },
      select: {
        id: true,
        trackingNumber: true,
        fromLocation: true,
        toLocation: true,
        deliveryTime: true,
      },
      orderBy: { deliveryTime: 'desc' },
      take: 6,
    }),
    prisma.shipment.findMany({
      where: {
        companyId,
        status: { in: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.PICKED_UP, ShipmentStatus.ASSIGNED] },
        OR: [
          { estimatedDelivery: { lt: now } },
          { driverEta: { lt: now } },
          { complianceStatus: { not: ComplianceStatus.APPROVED } },
        ],
      },
      select: {
        id: true,
        trackingNumber: true,
        fromLocation: true,
        toLocation: true,
        estimatedDelivery: true,
        driverEta: true,
        complianceStatus: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
  ]);

  const drivers = await prisma.driver.findMany({
    where: { vendor: { companyId } },
    select: {
      id: true,
      name: true,
      phone: true,
      isActive: true,
      updatedAt: true,
      vendor: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });

  const driverSummary = {
    total: drivers.length,
    active: drivers.filter((d) => d.isActive).length,
    inactive: drivers.filter((d) => !d.isActive).length,
    flagged: drivers.filter((d) => !d.phone || !d.isActive).slice(0, 5),
  };

  const quoteResponses = await prisma.quoteResponse.findMany({
    where: {
      vendor: { companyId },
      createdAt: { gte: sevenDaysAgo },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const avgResponseHours = (() => {
    const responded = quoteResponses.filter((response) =>
      [QuoteResponseStatus.RESPONDED, QuoteResponseStatus.APPROVED].includes(response.status),
    );
    if (!responded.length) return 0;
    const totalHours = responded.reduce((acc, response) => {
      const duration = (response.updatedAt.getTime() - response.createdAt.getTime()) / (1000 * 60 * 60);
      return acc + duration;
    }, 0);
    return Number((totalHours / responded.length).toFixed(1));
  })();

  const pendingQuotes = await prisma.quoteRequest.count({
    where: {
      createdBy: { companyId },
      status: QuoteStatus.PENDING,
    },
  });

  return {
    board: {
      pending: pendingShipments,
      active: activeShipments,
      delivered: deliveredShipments,
    },
    exceptions: exceptionShipments,
    driverReadiness: {
      summary: {
        total: driverSummary.total,
        active: driverSummary.active,
        inactive: driverSummary.inactive,
      },
      flaggedDrivers: driverSummary.flagged.map((driver) => ({
        id: driver.id,
        name: driver.name,
        vendor: driver.vendor?.name || 'Unknown vendor',
        phone: driver.phone,
        status: driver.isActive ? 'Active' : 'Inactive',
        updatedAt: driver.updatedAt,
      })),
    },
    quoteSla: {
      averageResponseHours: avgResponseHours,
      responsesCollected: quoteResponses.length,
      pendingQuotes,
    },
    generatedAt: now.toISOString(),
  };
};

module.exports = {
  getOperationsOverview,
};
