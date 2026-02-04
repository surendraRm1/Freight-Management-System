const { ComplianceStatus } = require('@prisma/client');
const prisma = require('../lib/prisma');

const getComplianceOverview = async (companyId) => {
  const now = new Date();
  const [documentStats, recentDocuments, events, deadlines] = await Promise.all([
    prisma.complianceDocument.groupBy({
      by: ['type', 'status'],
      where: { shipment: { companyId } },
      _count: { id: true },
    }),
    prisma.complianceDocument.findMany({
      where: { shipment: { companyId } },
      select: {
        id: true,
        type: true,
        status: true,
        issuedAt: true,
        updatedAt: true,
        shipment: { select: { trackingNumber: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 12,
    }),
    prisma.complianceEvent.findMany({
      where: { document: { shipment: { companyId } } },
      select: {
        id: true,
        eventType: true,
        recordedAt: true,
        details: true,
        document: { select: { type: true, shipment: { select: { trackingNumber: true } } } },
      },
      orderBy: { recordedAt: 'desc' },
      take: 20,
    }),
    prisma.shipment.findMany({
      where: { companyId, complianceStatus: { not: ComplianceStatus.APPROVED } },
      select: {
        id: true,
        trackingNumber: true,
        fromLocation: true,
        toLocation: true,
        pickupTime: true,
        complianceStatus: true,
      },
      orderBy: { pickupTime: 'asc' },
      take: 10,
    }),
  ]);

  const vault = documentStats.reduce((acc, entry) => {
    const key = entry.type;
    if (!acc[key]) {
      acc[key] = { type: key, statuses: {} };
    }
    acc[key].statuses[entry.status] = entry._count.id;
    return acc;
  }, {});

  return {
    documentVault: Object.values(vault),
    recentDocuments,
    events,
    deadlines,
    generatedAt: now.toISOString(),
  };
};

module.exports = {
  getComplianceOverview,
};
