const { ShipmentStatus } = require('@prisma/client');
const prisma = require('../lib/prisma');

const ensureCompany = (req, res) => {
  if (!req.user?.companyId) {
    res.status(403).json({ error: 'Company context missing' });
    return null;
  }
  return req.user.companyId;
};

const getAccruedCostsReport = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  try {
    const shipments = await prisma.shipment.findMany({
      where: {
        companyId,
        status: ShipmentStatus.DELIVERED,
        invoice: null,
      },
      select: {
        id: true,
        trackingNumber: true,
        updatedAt: true,
        user: {
          select: { name: true, email: true },
        },
      },
      orderBy: { updatedAt: 'asc' },
    });

    const response = shipments.map((shipment) => ({
      id: shipment.id,
      erp_order_id: shipment.trackingNumber,
      customer_name: shipment.user?.name || shipment.user?.email || 'Unknown customer',
      updatedAt: shipment.updatedAt,
    }));

    return res.status(200).json(response);
  } catch (error) {
    console.error('Accrued costs report failed', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getRejectedInvoiceAnalysis = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  try {
    const analysis = await prisma.transporterInvoice.groupBy({
      by: ['rejectionNotes'],
      where: {
        companyId,
        approvalStatus: 'Rejected',
        rejectionNotes: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const response = analysis.map((item) => ({
      reason: item.rejectionNotes,
      count: item._count.id,
    }));

    return res.status(200).json(response);
  } catch (error) {
    console.error('Rejected invoice analysis failed', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getPodPerformanceKpi = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  try {
    const totalDelivered = await prisma.shipment.count({
      where: { companyId, status: ShipmentStatus.DELIVERED },
    });

    if (!totalDelivered) {
      return res.status(200).json({ percentage: 100, totalDelivered: 0, totalCollected: 0 });
    }

    const totalCollected = await prisma.shipment.count({
      where: { companyId, status: ShipmentStatus.DELIVERED, podStatus: 'Collected' },
    });

    return res.status(200).json({
      percentage: Math.round((totalCollected / totalDelivered) * 100),
      totalDelivered,
      totalCollected,
    });
  } catch (error) {
    console.error('POD KPI failed', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getTransporterScorecard = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  try {
    const shipments = await prisma.shipment.findMany({
      where: { companyId },
      select: {
        id: true,
        cost: true,
        status: true,
        podStatus: true,
        assignedToId: true,
        assignedTo: {
          select: { name: true },
        },
        transporterInvoices: {
          select: { approvalStatus: true },
        },
      },
    });

    const grouped = shipments.reduce((acc, shipment) => {
      const key = shipment.assignedToId ?? 'unassigned';
      if (!acc[key]) {
        acc[key] = {
          id: key,
          displayName:
            shipment.assignedTo?.name ||
            (shipment.assignedToId ? `Assignee ${shipment.assignedToId}` : 'Unassigned'),
          total: 0,
          totalCost: 0,
          podCollected: 0,
          invoices: [],
        };
      }

      acc[key].total += 1;
      acc[key].totalCost += shipment.cost || 0;
      if (shipment.podStatus === 'Collected') acc[key].podCollected += 1;
      acc[key].invoices.push(...shipment.transporterInvoices);
      return acc;
    }, {});

    const scorecard = Object.values(grouped).map((entry) => {
      const invoiceCount = entry.invoices.length;
      const rejectionCount = entry.invoices.filter((inv) => inv.approvalStatus === 'Rejected').length;

      return {
        id: entry.id,
        name: entry.displayName,
        totalShipments: entry.total,
        avgCost: entry.total ? entry.totalCost / entry.total : 0,
        podCompliance: entry.total ? Math.round((entry.podCollected / entry.total) * 100) : 0,
        invoiceRejectionRate: invoiceCount ? Math.round((rejectionCount / invoiceCount) * 100) : 0,
      };
    });

    return res.status(200).json(scorecard);
  } catch (error) {
    console.error('Transporter scorecard failed', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  getAccruedCostsReport,
  getRejectedInvoiceAnalysis,
  getPodPerformanceKpi,
  getTransporterScorecard,
};
