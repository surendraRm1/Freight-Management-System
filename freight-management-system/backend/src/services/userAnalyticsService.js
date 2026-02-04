const { ShipmentStatus, ComplianceStatus, QuoteStatus } = require('@prisma/client');
const prisma = require('../lib/prisma');

const getUserOverview = async (userId) => {
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  const [shipments, quoteRequests, issues] = await Promise.all([
    prisma.shipment.findMany({
      where: { userId },
      select: {
        id: true,
        trackingNumber: true,
        fromLocation: true,
        toLocation: true,
        status: true,
        bookingStatus: true,
        paymentStatus: true,
        estimatedDelivery: true,
        pickupTime: true,
        deliveryTime: true,
        createdAt: true,
        updatedAt: true,
        cost: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.quoteRequest.findMany({
      where: { createdByUserId: userId },
      select: {
        id: true,
        fromLocation: true,
        toLocation: true,
        status: true,
        createdAt: true,
        responses: {
          select: {
            id: true,
            quotedPrice: true,
            estimatedDelivery: true,
            status: true,
            vendor: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.shipment.findMany({
      where: {
        userId,
        OR: [
          { complianceStatus: { not: ComplianceStatus.APPROVED } },
          { status: ShipmentStatus.DELIVERED, podStatus: { not: 'Collected' } },
          { status: { in: [ShipmentStatus.PENDING, ShipmentStatus.REQUESTED] }, createdAt: { lt: twoDaysAgo } },
        ],
      },
      select: {
        id: true,
        trackingNumber: true,
        status: true,
        complianceStatus: true,
        podStatus: true,
        fromLocation: true,
        toLocation: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 6,
    }),
  ]);

  const shipmentSummary = {
    total: shipments.length,
    delivered: shipments.filter((s) => s.status === ShipmentStatus.DELIVERED).length,
    inTransit: shipments.filter((s) => s.status === ShipmentStatus.IN_TRANSIT).length,
    pending: shipments.filter((s) => s.status === ShipmentStatus.PENDING).length,
  };

  const quoteSummary = quoteRequests.reduce(
    (acc, request) => {
      if (request.status === QuoteStatus.PENDING) acc.pending += 1;
      if (request.status === QuoteStatus.APPROVED) acc.approved += 1;
      acc.totalResponses += request.responses.length;
      return acc;
    },
    { pending: 0, approved: 0, totalResponses: 0 },
  );

  const quoteEntries = quoteRequests.map((request) => ({
    id: request.id,
    route: `${request.fromLocation} → ${request.toLocation}`,
    status: request.status,
    createdAt: request.createdAt,
    responses: request.responses.map((response) => ({
      id: response.id,
      vendorName: response.vendor?.name || 'Unknown vendor',
      price: response.quotedPrice,
      eta: response.estimatedDelivery,
      status: response.status,
    })),
  }));

  const issueLog = issues.map((shipment) => {
    let severity = 'medium';
    let description = 'Pending follow-up';

    if (shipment.complianceStatus && shipment.complianceStatus !== ComplianceStatus.APPROVED) {
      severity = 'high';
      description = `Compliance status: ${shipment.complianceStatus}`;
    } else if (shipment.status === ShipmentStatus.DELIVERED && shipment.podStatus !== 'Collected') {
      severity = 'medium';
      description = 'Waiting for POD collection.';
    } else if (shipment.status === ShipmentStatus.PENDING) {
      severity = 'low';
      description = 'Awaiting transporter assignment.';
    }

    return {
      id: shipment.id,
      trackingNumber: shipment.trackingNumber,
      status: shipment.status,
      description,
      severity,
      updatedAt: shipment.updatedAt,
    };
  });

  return {
    summary: shipmentSummary,
    shipments,
    quoteInsights: {
      pendingRequests: quoteSummary.pending,
      approvedRequests: quoteSummary.approved,
      averageResponses:
        quoteRequests.length > 0 ? Number((quoteSummary.totalResponses / quoteRequests.length).toFixed(1)) : 0,
      entries: quoteEntries,
    },
    issueLog,
    generatedAt: now.toISOString(),
  };
};

module.exports = {
  getUserOverview,
};
