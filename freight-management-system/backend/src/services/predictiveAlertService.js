const { ShipmentStatus, QuoteStatus, ComplianceStatus } = require('@prisma/client');
const prisma = require('../lib/prisma');

const getPredictiveAlerts = async (companyId) => {
  const now = new Date();
  const twelveHoursAhead = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [shipmentsAtRisk, compliancePending, slowQuotes] = await Promise.all([
    prisma.shipment.findMany({
      where: {
        companyId,
        status: { in: [ShipmentStatus.ASSIGNED, ShipmentStatus.PICKED_UP, ShipmentStatus.IN_TRANSIT] },
        estimatedDelivery: { not: null, lte: twelveHoursAhead },
      },
      select: {
        id: true,
        trackingNumber: true,
        fromLocation: true,
        toLocation: true,
        estimatedDelivery: true,
        status: true,
      },
      orderBy: { estimatedDelivery: 'asc' },
      take: 10,
    }),
    prisma.complianceDocument.findMany({
      where: {
        shipment: { companyId },
        status: { in: [ComplianceStatus.PENDING, ComplianceStatus.SUBMITTED] },
      },
      select: {
        id: true,
        type: true,
        status: true,
        shipment: { select: { trackingNumber: true, fromLocation: true, toLocation: true } },
        updatedAt: true,
      },
      orderBy: { updatedAt: 'asc' },
      take: 10,
    }),
    prisma.quoteRequest.findMany({
      where: {
        createdBy: { companyId },
        status: QuoteStatus.PENDING,
        createdAt: { lt: twentyFourHoursAgo },
      },
      select: {
        id: true,
        fromLocation: true,
        toLocation: true,
        createdAt: true,
        responses: { select: { id: true } },
      },
      take: 10,
    }),
  ]);

  const alerts = [];

  shipmentsAtRisk.forEach((shipment) => {
    alerts.push({
      type: 'SHIPMENT',
      severity: 'HIGH',
      title: `Shipment ${shipment.trackingNumber || shipment.id} may miss ETA`,
      details: `${shipment.fromLocation} → ${shipment.toLocation}`,
      meta: {
        shipmentId: shipment.id,
        eta: shipment.estimatedDelivery,
        status: shipment.status,
      },
      suggestion: 'Coordinate with transporter or notify customer.',
    });
  });

  compliancePending.forEach((doc) => {
    alerts.push({
      type: 'COMPLIANCE',
      severity: 'MEDIUM',
      title: `${doc.type.replace(/_/g, ' ')} pending approval`,
      details: `Shipment ${doc.shipment?.trackingNumber || doc.id}`,
      meta: {
        documentId: doc.id,
        status: doc.status,
      },
      suggestion: 'Review and approve or request resubmission.',
    });
  });

  slowQuotes.forEach((quote) => {
    alerts.push({
      type: 'QUOTE',
      severity: 'LOW',
      title: 'Quote request awaiting transporter responses',
      details: `${quote.fromLocation} → ${quote.toLocation}`,
      meta: {
        quoteId: quote.id,
        requestedAt: quote.createdAt,
        responses: quote.responses.length,
      },
      suggestion: 'Ping preferred transporters or widen the invite list.',
    });
  });

  return alerts;
};

module.exports = {
  getPredictiveAlerts,
};
