const prisma = require('../../lib/prisma');
const logger = require('../../utils/logger');

const buildGSTPayload = ({ shipment, companyProfile, vendorProfile }) => {
  if (!shipment) {
    throw new Error('Shipment is required to build GST payload.');
  }

  const invoiceLines = [
    {
      description: `Freight for ${shipment.fromLocation} -> ${shipment.toLocation}`,
      hsn: process.env.DEFAULT_GST_HSN || '996511',
      quantity: 1,
      amount: Number(shipment.cost || 0),
      taxRate: Number(process.env.DEFAULT_GST_RATE || 0),
    },
  ];

  return {
    documentType: 'GST_INVOICE',
    supplier: {
      gstin: companyProfile?.gstin || process.env.COMPANY_GSTIN || '',
      legalName: companyProfile?.legalName || process.env.COMPANY_LEGAL_NAME || '',
      address: {
        line1: companyProfile?.addressLine1 || '',
        line2: companyProfile?.addressLine2 || '',
        city: companyProfile?.city || '',
        state: companyProfile?.state || '',
        postalCode: companyProfile?.postalCode || '',
        country: companyProfile?.country || 'IN',
      },
    },
    recipient: {
      gstin: vendorProfile?.gstin || '',
      legalName: vendorProfile?.legalName || shipment.vendor?.name || '',
      address: {
        line1: vendorProfile?.addressLine1 || '',
        line2: vendorProfile?.addressLine2 || '',
        city: vendorProfile?.city || '',
        state: vendorProfile?.state || '',
        postalCode: vendorProfile?.postalCode || '',
        country: vendorProfile?.country || 'IN',
      },
    },
    invoice: {
      number: null,
      issueDate: new Date().toISOString(),
      lineItems: invoiceLines,
      remarks: shipment.notes || '',
    },
  };
};

const createGSTInvoiceDraft = async (shipmentId) => {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      vendor: true,
      payments: true,
    },
  });

  if (!shipment) {
    throw new Error('Shipment not found.');
  }

  const [companyProfile, vendorProfile] = await Promise.all([
    prisma.companyProfile.findFirst({ orderBy: { id: 'desc' } }),
    shipment.selectedVendorId
      ? prisma.vendorProfile.findUnique({ where: { vendorId: shipment.selectedVendorId } })
      : null,
  ]);

  const payload = buildGSTPayload({
    shipment,
    companyProfile,
    vendorProfile,
  });

  logger.info(`GST payload prepared for shipment ${shipmentId}`);
  return payload;
};

module.exports = {
  buildGSTPayload,
  createGSTInvoiceDraft,
};
