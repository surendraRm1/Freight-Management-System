const prisma = require('../lib/prisma');

const ensureCompany = (req, res) => {
  if (!req.user?.companyId) {
    res.status(403).json({ error: 'Company context missing' });
    return null;
  }
  return req.user.companyId;
};

const postInvoiceToERP = async (invoice) => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return { success: true, reference: `ERP-${invoice.id}` };
};

const normalizeInvoicePayload = (body = {}) => {
  const invoiceNumber = body.invoice_number || body.invoiceNumber;
  const invoiceDate = body.invoice_date || body.invoiceDate;
  const invoiceAmountRaw = body.invoice_amount || body.invoiceAmount;
  const invoiceUrl = body.invoice_url || body.invoiceUrl;

  return {
    shipmentId: body.shipmentId,
    invoiceNumber,
    invoiceDate,
    invoiceAmount: invoiceAmountRaw !== undefined ? Number(invoiceAmountRaw) : undefined,
    invoiceUrl,
  };
};

const serializeInvoice = (invoice) => ({
  id: invoice.id,
  invoice_number: invoice.invoiceNumber,
  invoice_date: invoice.invoiceDate,
  invoice_amount: invoice.invoiceAmount,
  invoice_url: invoice.invoiceUrl,
  approval_status: invoice.approvalStatus,
  rejection_notes: invoice.rejectionNotes,
  posted_to_erp_at: invoice.postedToErpAt,
  shipment: invoice.shipment
    ? {
        id: invoice.shipment.id,
        customer_name:
          invoice.shipment.user?.name ||
          invoice.shipment.user?.email ||
            invoice.shipment.trackingNumber ||
          `Shipment #${invoice.shipment.id}`,
        tracking_number: invoice.shipment.trackingNumber,
      }
    : null,
});

const createInvoice = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  const payload = normalizeInvoicePayload(req.body);

  if (
    !payload.shipmentId ||
    !payload.invoiceNumber ||
    !payload.invoiceDate ||
    payload.invoiceAmount === undefined ||
    !payload.invoiceUrl
  ) {
    return res.status(400).json({ error: 'Missing required invoice fields' });
  }

  try {
    const invoice = await prisma.transporterInvoice.create({
      data: {
        shipmentId: payload.shipmentId,
        invoiceNumber: payload.invoiceNumber,
        invoiceDate: new Date(payload.invoiceDate),
        invoiceAmount: payload.invoiceAmount,
        invoiceUrl: payload.invoiceUrl,
        companyId,
      },
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    return res.status(201).json(serializeInvoice(invoice));
  } catch (error) {
    console.error('Failed to create invoice', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getAllPendingInvoices = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  try {
    const invoices = await prisma.transporterInvoice.findMany({
      where: {
        companyId,
        approvalStatus: 'Pending',
      },
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.status(200).json(invoices.map(serializeInvoice));
  } catch (error) {
    console.error('Failed to fetch invoices', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const approveInvoice = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  const { id } = req.params;

  try {
    const invoice = await prisma.transporterInvoice.findFirst({
      where: { id, companyId },
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const erpResult = await postInvoiceToERP(invoice);
    if (!erpResult.success) {
      return res.status(502).json({ error: 'Failed to post invoice to ERP' });
    }

    const updated = await prisma.transporterInvoice.update({
      where: { id },
      data: {
        approvalStatus: 'PostedToERP',
        postedToErpAt: new Date(),
        approvedById: req.user.id,
      },
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    return res.status(200).json(serializeInvoice(updated));
  } catch (error) {
    console.error('Failed to approve invoice', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const rejectInvoice = async (req, res) => {
  const companyId = ensureCompany(req, res);
  if (!companyId) return;

  const { id } = req.params;
  const { notes } = req.body;

  if (!notes) {
    return res.status(400).json({ error: 'Rejection notes are required' });
  }

  try {
    const updated = await prisma.transporterInvoice.update({
      where: {
        id,
        companyId,
      },
      data: {
        approvalStatus: 'Rejected',
        rejectionNotes: notes,
        approvedById: req.user.id,
      },
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    return res.status(200).json(serializeInvoice(updated));
  } catch (error) {
    console.error('Failed to reject invoice', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  createInvoice,
  getAllPendingInvoices,
  approveInvoice,
  rejectInvoice,
};
