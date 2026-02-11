const prisma = require('../lib/prisma');
const { InvoiceStatus } = require('../constants/prismaEnums');

const getFinanceOverview = async (companyId) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [invoices, transporterInvoices, shipments] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        OR: [{ companyId }, { shipment: { companyId } }],
      },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        grandTotal: true,
        shipment: {
          select: { id: true, trackingNumber: true, vendor: { select: { name: true } } },
        },
        issuedAt: true,
        dueDate: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.transporterInvoice.findMany({
      where: { companyId },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceAmount: true,
        approvalStatus: true,
        invoiceDate: true,
        shipment: {
          select: {
            trackingNumber: true,
            fromLocation: true,
            toLocation: true,
            vendor: { select: { name: true } },
          },
        },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.shipment.findMany({
      where: { companyId, createdAt: { gte: thirtyDaysAgo } },
      select: {
        id: true,
        cost: true,
        rateCard: {
          select: { ratePerKm: true },
        },
      },
    }),
  ]);

  const invoiceBuckets = invoices.reduce(
    (acc, invoice) => {
      acc[invoice.status] = (acc[invoice.status] || 0) + 1;
      return acc;
    },
    { Draft: 0, Issued: 0, Paid: 0 },
  );

  const invoiceKanban = ['DRAFT', 'ISSUED', 'PAID', 'OVERDUE'].map((statusKey) => ({
    status: statusKey,
    label: statusKey === 'OVERDUE' ? 'Overdue' : statusKey.charAt(0) + statusKey.slice(1).toLowerCase(),
    invoices: invoices
      .filter((inv) =>
        statusKey === 'OVERDUE'
          ? inv.status === InvoiceStatus.ISSUED && inv.dueDate && inv.dueDate < now
          : inv.status === statusKey,
      )
      .slice(0, 8)
      .map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.grandTotal,
        dueDate: inv.dueDate,
        vendor: inv.shipment?.vendor?.name || 'Unknown vendor',
      })),
    count:
      statusKey === 'OVERDUE'
        ? invoices.filter((inv) => inv.status === InvoiceStatus.ISSUED && inv.dueDate && inv.dueDate < now).length
        : invoiceBuckets[statusKey] || 0,
  }));

  const payoutStatus = transporterInvoices.reduce(
    (acc, item) => {
      acc[item.approvalStatus] = (acc[item.approvalStatus] || 0) + 1;
      return acc;
    },
    {},
  );

  const payoutRows = transporterInvoices.slice(0, 20).map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    vendorName: inv.shipment?.vendor?.name || 'Unknown vendor',
    shipmentRef: inv.shipment?.trackingNumber || '',
    amount: inv.invoiceAmount,
    status: inv.approvalStatus,
    invoiceDate: inv.invoiceDate,
  }));

  const costVariance = shipments.map((shipment) => {
    const contracted = shipment.rateCard?.ratePerKm || null;
    const actual = shipment.cost || 0;
    const variance = contracted ? actual - contracted : null;
    return {
      id: shipment.id,
      contracted,
      actual,
      variance,
    };
  });

  const taxSummary = {
    issuedGstInvoices: invoices.filter((inv) => inv.status === InvoiceStatus.ISSUED).length,
    pendingAuthorizations: transporterInvoices.filter((inv) => inv.approvalStatus === 'Pending').length,
    rejectedDocs: transporterInvoices.filter((inv) => inv.approvalStatus === 'Rejected').length,
  };

  return {
    invoiceKanban,
    invoiceStats: invoiceBuckets,
    payoutRows,
    payoutStatus,
    costVariance,
    taxSummary,
    counts: {
      transporterInvoices: transporterInvoices.length,
      invoices: invoices.length,
    },
    generatedAt: now.toISOString(),
  };
};

const buildFinanceExportRows = async (companyId, dataset) => {
  switch (dataset) {
    case 'transporter-payouts': {
      const entries = await prisma.transporterInvoice.findMany({
        where: { companyId },
        select: {
          invoiceNumber: true,
          vendor: { select: { name: true } },
          invoiceAmount: true,
          approvalStatus: true,
          invoiceDate: true,
        },
      });
      return entries.map((entry) => ({
        invoiceNumber: entry.invoiceNumber,
        vendor: entry.vendor?.name || '',
        amount: entry.invoiceAmount ?? '',
        status: entry.approvalStatus,
        invoiceDate: entry.invoiceDate ? entry.invoiceDate.toISOString() : '',
      }));
    }
    case 'invoice-ledger': {
      const entries = await prisma.invoice.findMany({
        where: {
          OR: [{ companyId }, { shipment: { companyId } }],
        },
        select: {
          invoiceNumber: true,
          status: true,
          grandTotal: true,
          issuedAt: true,
          dueDate: true,
          shipment: {
            select: { trackingNumber: true, vendor: { select: { name: true } } },
          },
        },
      });
      return entries.map((entry) => ({
        invoiceNumber: entry.invoiceNumber,
        status: entry.status,
        amount: entry.grandTotal ?? '',
        issuedAt: entry.issuedAt ? entry.issuedAt.toISOString() : '',
        dueDate: entry.dueDate ? entry.dueDate.toISOString() : '',
        vendor: entry.shipment?.vendor?.name || '',
        shipment: entry.shipment?.trackingNumber || '',
      }));
    }
    default:
      return null;
  }
};

module.exports = {
  getFinanceOverview,
  buildFinanceExportRows,
};
