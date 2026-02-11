const prisma = require('../lib/prisma');
const { ShipmentStatus, QuoteStatus, InvoiceStatus } = require('../constants/prismaEnums');

const ACTIVE_TRANSIT_STATUSES = [
  ShipmentStatus.ASSIGNED,
  ShipmentStatus.ACCEPTED,
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.IN_TRANSIT,
];

const PENDING_STATUSES = [ShipmentStatus.PENDING, ShipmentStatus.REQUESTED, ShipmentStatus.PENDING_QUOTE];

const toISODate = (date) => date.toISOString().split('T')[0];

const getCompanyOverview = async (companyId, options = {}) => {
  const rangeDays = Number(options.rangeDays) > 0 ? Number(options.rangeDays) : 30;
  const now = new Date();
  const sinceDate = new Date(now.getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(now.getMonth() - 5, 1);

  const [
    totalShipments,
    inTransitShipments,
    deliveredShipments,
    pendingShipments,
    quoteStats,
    invoiceStats,
    totalVendors,
    activeVendors,
    shipmentSamples,
    vendorShipmentStats,
    vendorDeliveredStats,
    companyUsers,
    revenueSamples,
    riskShipments,
  ] = await Promise.all([
    prisma.shipment.count({ where: { companyId } }),
    prisma.shipment.count({ where: { companyId, status: { in: ACTIVE_TRANSIT_STATUSES } } }),
    prisma.shipment.count({ where: { companyId, status: ShipmentStatus.DELIVERED } }),
    prisma.shipment.count({ where: { companyId, status: { in: PENDING_STATUSES } } }),
    prisma.quoteRequest.groupBy({
      by: ['status'],
      where: { createdBy: { companyId } },
      _count: { _all: true },
    }),
    prisma.invoice.groupBy({
      by: ['status'],
      where: {
        OR: [{ companyId }, { shipment: { companyId } }],
      },
      _count: { _all: true },
    }),
    prisma.vendor.count({ where: { companyId } }),
    prisma.vendor.count({ where: { companyId, isActive: true } }),
    prisma.shipment.findMany({
      where: { companyId, createdAt: { gte: sinceDate } },
      select: { id: true, createdAt: true, status: true },
    }),
    prisma.shipment.groupBy({
      by: ['selectedVendorId'],
      where: { companyId, selectedVendorId: { not: null } },
      _count: { id: true },
      _avg: { cost: true },
    }),
    prisma.shipment.groupBy({
      by: ['selectedVendorId'],
      where: {
        companyId,
        selectedVendorId: { not: null },
        status: ShipmentStatus.DELIVERED,
      },
      _count: { id: true },
    }),
    prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        role: true,
        isActive: true,
        approvalStatus: true,
        lastLoginAt: true,
      },
    }),
    prisma.shipment.findMany({
      where: {
        companyId,
        createdAt: { gte: sixMonthsAgo },
        cost: { not: null },
      },
      select: { cost: true, createdAt: true },
    }),
    prisma.shipment.findMany({
      where: {
        companyId,
        status: { in: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.PICKED_UP, ShipmentStatus.ASSIGNED] },
        estimatedDelivery: { not: null, lt: now },
      },
      select: {
        id: true,
        trackingNumber: true,
        fromLocation: true,
        toLocation: true,
        status: true,
      },
      take: 8,
    }),
  ]);

  const vendorIds = vendorShipmentStats
    .map((entry) => entry.selectedVendorId)
    .filter((value) => typeof value === 'number');

  const vendorMetadata = vendorIds.length
    ? await prisma.vendor.findMany({
        where: {
          companyId,
          id: { in: vendorIds },
        },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          rating: true,
          updatedAt: true,
        },
      })
    : [];

  const shipmentBuckets = shipmentSamples.reduce((acc, shipment) => {
    const key = toISODate(shipment.createdAt);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const shipmentsByDay = Array.from({ length: rangeDays }).map((_, idx) => {
    const day = new Date(now.getTime() - (rangeDays - 1 - idx) * 24 * 60 * 60 * 1000);
    const key = toISODate(day);
    return { date: key, count: shipmentBuckets[key] || 0 };
  });

  const vendorDeliveredLookup = vendorDeliveredStats.reduce((acc, entry) => {
    acc.set(entry.selectedVendorId, entry._count.id);
    return acc;
  }, new Map());

  const vendorMetaMap = vendorMetadata.reduce((acc, entry) => {
    acc.set(entry.id, entry);
    return acc;
  }, new Map());

  const vendorScorecards = vendorShipmentStats
    .map((entry) => {
      const vendorId = entry.selectedVendorId;
      const delivered = vendorDeliveredLookup.get(vendorId) || 0;
      const meta = vendorMetaMap.get(vendorId);
      return {
        id: vendorId,
        name: meta?.name || `Vendor ${vendorId}`,
        email: meta?.email || '',
        isActive: meta?.isActive ?? true,
        rating: meta?.rating ?? null,
        totalShipments: entry._count.id,
        deliveryRate: entry._count.id ? Math.round((delivered / entry._count.id) * 100) : 0,
        avgCost: entry._avg.cost ? Number(entry._avg.cost.toFixed(2)) : 0,
        lastActivity: meta?.updatedAt?.toISOString() || null,
      };
    })
    .sort((a, b) => b.totalShipments - a.totalShipments)
    .slice(0, 6);

  const userGovernanceMap = {};
  companyUsers.forEach((user) => {
    if (!userGovernanceMap[user.role]) {
      userGovernanceMap[user.role] = {
        role: user.role,
        total: 0,
        active: 0,
        pending: 0,
        suspended: 0,
        latestLogin: null,
      };
    }
    const bucket = userGovernanceMap[user.role];
    bucket.total += 1;
    if (user.isActive) bucket.active += 1;
    if (user.approvalStatus === 'PENDING') bucket.pending += 1;
    if (!user.isActive) bucket.suspended += 1;
    if (user.lastLoginAt) {
      if (!bucket.latestLogin || bucket.latestLogin < user.lastLoginAt) {
        bucket.latestLogin = user.lastLoginAt;
      }
    }
  });

  const userGovernance = Object.values(userGovernanceMap).map((entry) => ({
    ...entry,
    latestLogin: entry.latestLogin ? entry.latestLogin.toISOString() : null,
  }));

  const revenueBuckets = revenueSamples.reduce((acc, item) => {
    const key = `${item.createdAt.getFullYear()}-${String(item.createdAt.getMonth() + 1).padStart(2, '0')}`;
    acc[key] = (acc[key] || 0) + (item.cost || 0);
    return acc;
  }, {});

  const revenueSeries = Array.from({ length: 6 }).map((_, idx) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    return {
      label: monthDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
      value: Number((revenueBuckets[key] || 0).toFixed(2)),
    };
  });

  const quoteLookup = quoteStats.reduce((acc, entry) => {
    acc[entry.status] = entry._count._all;
    return acc;
  }, {});

  const invoiceLookup = invoiceStats.reduce((acc, entry) => {
    acc[entry.status] = entry._count._all;
    return acc;
  }, {});

  const requestedQuotes = quoteLookup[QuoteStatus.PENDING] || 0;
  const respondedQuotes = quoteLookup[QuoteStatus.RESPONDED] || 0;
  const approvedQuotes = quoteLookup[QuoteStatus.APPROVED] || 0;

  return {
    summary: {
      shipments: {
        total: totalShipments,
        inTransit: inTransitShipments,
        delivered: deliveredShipments,
        pending: pendingShipments,
      },
      quotes: {
        requested: requestedQuotes,
        responded: respondedQuotes,
        approved: approvedQuotes,
        closed: quoteLookup[QuoteStatus.CLOSED] || 0,
      },
      invoices: {
        total: Object.values(invoiceLookup).reduce((sum, value) => sum + value, 0),
        paid: invoiceLookup[InvoiceStatus.PAID] || 0,
        draft: invoiceLookup[InvoiceStatus.DRAFT] || 0,
        issued: invoiceLookup[InvoiceStatus.ISSUED] || 0,
      },
      vendors: {
        total: totalVendors,
        active: activeVendors,
      },
    },
    charts: {
      shipmentsByDay,
      quoteFunnel: {
        requested: requestedQuotes,
        responded: respondedQuotes,
        approved: approvedQuotes,
      },
    },
    insights: {
      vendorScorecards,
      userGovernance,
      revenueSeries,
      alerts: riskShipments,
    },
    generatedAt: now.toISOString(),
  };
};

const buildExportRows = async (companyId, dataset) => {
  switch (dataset) {
    case 'shipments': {
      const shipments = await prisma.shipment.findMany({
        where: { companyId },
        select: {
          id: true,
          trackingNumber: true,
          fromLocation: true,
          toLocation: true,
          status: true,
          cost: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      return shipments.map((shipment) => ({
        id: shipment.id,
        trackingNumber: shipment.trackingNumber || '',
        from: shipment.fromLocation,
        to: shipment.toLocation,
        status: shipment.status,
        cost: shipment.cost ?? '',
        createdAt: shipment.createdAt.toISOString(),
        updatedAt: shipment.updatedAt.toISOString(),
      }));
    }
    case 'quotes': {
      const quotes = await prisma.quoteRequest.findMany({
        where: { createdBy: { companyId } },
        select: {
          id: true,
          fromLocation: true,
          toLocation: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          responses: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return quotes.map((quote) => ({
        id: quote.id,
        from: quote.fromLocation,
        to: quote.toLocation,
        status: quote.status,
        responseCount: quote.responses.length,
        createdAt: quote.createdAt.toISOString(),
        updatedAt: quote.updatedAt.toISOString(),
      }));
    }
    case 'invoices': {
      const invoices = await prisma.invoice.findMany({
        where: {
          OR: [{ companyId }, { shipment: { companyId } }],
        },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          grandTotal: true,
          issuedAt: true,
          dueDate: true,
          shipment: {
            select: {
              trackingNumber: true,
              fromLocation: true,
              toLocation: true,
            },
          },
        },
        orderBy: { issuedAt: 'desc' },
      });
      return invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        amount: invoice.grandTotal ?? '',
        issuedAt: invoice.issuedAt ? invoice.issuedAt.toISOString() : '',
        dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : '',
        shipment: invoice.shipment?.trackingNumber || '',
        from: invoice.shipment?.fromLocation || '',
        to: invoice.shipment?.toLocation || '',
      }));
    }
    case 'vendors': {
      const vendors = await prisma.vendor.findMany({
        where: { companyId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          isActive: true,
          rating: true,
          baseRate: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
      });
      return vendors.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        email: vendor.email || '',
        phone: vendor.phone || '',
        status: vendor.isActive ? 'Active' : 'Inactive',
        rating: vendor.rating ?? '',
        baseRate: vendor.baseRate ?? '',
        createdAt: vendor.createdAt.toISOString(),
      }));
    }
    default:
      return null;
  }
};

module.exports = {
  getCompanyOverview,
  buildExportRows,
};
