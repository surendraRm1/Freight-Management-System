const { ShipmentStatus, QuoteResponseStatus } = require('@prisma/client');
const prisma = require('../lib/prisma');

const ACTIVE_ASSIGNMENT_STATUSES = [
  ShipmentStatus.ASSIGNED,
  ShipmentStatus.ACCEPTED,
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.IN_TRANSIT,
];

const getTransporterOverview = async (vendorId) => {
  const [quotePipeline, pendingResponses, respondedQuotes, assignments, performanceShipments, drivers] =
    await Promise.all([
      prisma.quoteResponse.groupBy({
        by: ['status'],
        where: { vendorId },
        _count: { _all: true },
      }),
    prisma.quoteResponse.findMany({
      where: { vendorId, status: QuoteResponseStatus.PENDING },
      select: {
        id: true,
        quoteRequest: {
          select: {
            fromLocation: true,
            toLocation: true,
            createdAt: true,
          },
        },
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.quoteResponse.findMany({
      where: {
        vendorId,
        status: { in: [QuoteResponseStatus.RESPONDED, QuoteResponseStatus.APPROVED] },
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.shipment.findMany({
      where: {
        selectedVendorId: vendorId,
        status: { in: [...ACTIVE_ASSIGNMENT_STATUSES, ShipmentStatus.DELIVERED] },
      },
      select: {
        id: true,
        trackingNumber: true,
        status: true,
        fromLocation: true,
        toLocation: true,
        estimatedDelivery: true,
        podStatus: true,
        deliveryTime: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
    prisma.shipment.findMany({
      where: {
        selectedVendorId: vendorId,
        status: { in: [ShipmentStatus.DELIVERED, ShipmentStatus.IN_TRANSIT, ShipmentStatus.PICKED_UP] },
      },
      select: {
        id: true,
        status: true,
        cost: true,
        podStatus: true,
        createdAt: true,
      },
    }),
    prisma.driver.findMany({
      where: { vendorId },
      select: {
        id: true,
        name: true,
        phone: true,
        isActive: true,
        licenseNumber: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const pipelineCounts = quotePipeline.reduce((acc, entry) => {
    acc[entry.status] = entry._count._all;
    return acc;
  }, {});

  const averageResponseTime = (() => {
    if (!respondedQuotes.length) return 0;
    const totalHours = respondedQuotes.reduce((acc, response) => {
      const diffMs = response.updatedAt.getTime() - response.createdAt.getTime();
      return acc + diffMs / (1000 * 60 * 60);
    }, 0);
    return Number((totalHours / respondedQuotes.length).toFixed(1));
  })();

  const delivered = performanceShipments.filter((shipment) => shipment.status === ShipmentStatus.DELIVERED);
  const podCollected = performanceShipments.filter((shipment) => shipment.podStatus === 'Collected');
  const performance = {
    deliveredCount: delivered.length,
    podCompliance: performanceShipments.length
      ? Math.round((podCollected.length / performanceShipments.length) * 100)
      : 0,
    activeAssignments: assignments.filter((shipment) => ACTIVE_ASSIGNMENT_STATUSES.includes(shipment.status)).length,
  };

  const driverCompliance = {
    totalDrivers: drivers.length,
    activeDrivers: drivers.filter((driver) => driver.isActive).length,
    flaggedDrivers: drivers.filter((driver) => !driver.licenseNumber || !driver.isActive).slice(0, 5),
  };

  return {
    quotePipeline: {
      pending: pipelineCounts.PENDING || 0,
      responded: pipelineCounts.RESPONDED || 0,
      approved: pipelineCounts.APPROVED || 0,
      declined: pipelineCounts.DECLINED || 0,
      backlog: pendingResponses,
    },
    assignmentQueue: assignments.map((shipment) => ({
      id: shipment.id,
      trackingNumber: shipment.trackingNumber,
      status: shipment.status,
      route: `${shipment.fromLocation} → ${shipment.toLocation}`,
      eta: shipment.estimatedDelivery,
      podStatus: shipment.podStatus,
    })),
    performance: {
      ...performance,
      averageResponseHours: averageResponseTime,
    },
    driverCompliance,
  };
};

module.exports = {
  getTransporterOverview,
};
