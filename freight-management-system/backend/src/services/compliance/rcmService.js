const prisma = require('../../lib/prisma');
const logger = require('../../utils/logger');
const { ComplianceStatus, DocumentType } = require('../../constants/prismaEnums');

const isRCMApplicable = ({ vendorProfile, shipment }) => {
  if (!vendorProfile) {
    return false;
  }

  const exemptStatuses = new Set(['DELIVERED', 'CANCELLED']);
  if (exemptStatuses.has(shipment.status)) {
    return false;
  }

  if (vendorProfile.rcmEligible) {
    return true;
  }

  return false;
};

const calculateRcmLiability = (amount) => {
  if (!amount || amount <= 0) {
    return 0;
  }
  const rate = Number(process.env.RCM_RATE || 5);
  return Number(((amount * rate) / 100).toFixed(2));
};

const createRCMSelfInvoice = async (shipmentId) => {
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

  const vendorProfile = shipment.selectedVendorId
    ? await prisma.vendorProfile.findUnique({ where: { vendorId: shipment.selectedVendorId } })
    : null;

  const applicable = isRCMApplicable({ vendorProfile, shipment });
  if (!applicable) {
    logger.info(`RCM not applicable for shipment ${shipmentId}`);
    return null;
  }

  const liability = calculateRcmLiability(shipment.cost);

  const payload = {
    documentType: DocumentType.SELF_INVOICE_RCM,
    recipient: {
      gstin: vendorProfile?.gstin || '',
      legalName: vendorProfile?.legalName || shipment.vendor?.name || '',
    },
    shipment: {
      id: shipment.id,
      route: `${shipment.fromLocation} -> ${shipment.toLocation}`,
      cost: shipment.cost || 0,
    },
    liability,
  };

  const document = await prisma.$transaction(async (tx) => {
    const created = await tx.complianceDocument.create({
      data: {
        shipmentId: shipment.id,
        type: DocumentType.SELF_INVOICE_RCM,
        status: ComplianceStatus.SUBMITTED,
        payload,
        remarks: 'RCM self-invoice generated (mock).',
      },
    });

    await tx.complianceEvent.create({
      data: {
        documentId: created.id,
        eventType: 'GENERATED',
        details: payload,
      },
    });

    await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        complianceStatus: ComplianceStatus.SUBMITTED,
      },
    });

    return created;
  });

  logger.info(`RCM self-invoice created for shipment ${shipment.id}`);
  return document;
};

module.exports = {
  isRCMApplicable,
  createRCMSelfInvoice,
  calculateRcmLiability,
};
