const {
  ComplianceStatus,
  DocumentType,
} = require('@prisma/client');
const prisma = require('../../lib/prisma');
const logger = require('../../utils/logger');

const simulateEwayBillResponse = (action, data = {}) => {
  const now = new Date();
  return {
    action,
    billNo: data.billNo || `EWB${now.getTime()}`,
    validUpto: data.validUpto || new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    generatedAt: now.toISOString(),
    remarks: data.remarks || 'Mock e-way bill response',
  };
};

const createEwayBill = async (shipmentId) => {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      ewayBillNumber: true,
    },
  });

  if (!shipment) {
    throw new Error('Shipment not found.');
  }

  const response = simulateEwayBillResponse('CREATE');

  const document = await prisma.$transaction(async (tx) => {
    const created = await tx.complianceDocument.create({
      data: {
        shipmentId: shipment.id,
        type: DocumentType.EWAY_BILL,
        status: ComplianceStatus.SUBMITTED,
        payload: response,
        remarks: 'Mock e-way bill created.',
      },
    });

    await tx.complianceEvent.create({
      data: {
        documentId: created.id,
        eventType: 'CREATED',
        details: response,
      },
    });

    await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        complianceStatus: ComplianceStatus.SUBMITTED,
        ewayBillNumber: response.billNo,
      },
    });

    return created;
  });

  logger.info(`Mock e-way bill created for shipment ${shipment.id}`);
  return document;
};

const extendEwayBill = async (documentId) => {
  const document = await prisma.complianceDocument.findUnique({
    where: { id: documentId },
    include: {
      shipment: { select: { id: true } },
    },
  });

  if (!document || document.type !== DocumentType.EWAY_BILL) {
    throw new Error('E-way bill document not found.');
  }

  const response = simulateEwayBillResponse('EXTEND', {
    billNo: document.payload?.billNo,
    remarks: 'Mock extension successful.',
  });

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.complianceDocument.update({
      where: { id: document.id },
      data: {
        payload: response,
        status: ComplianceStatus.SUBMITTED,
      },
    });

    await tx.complianceEvent.create({
      data: {
        documentId: document.id,
        eventType: 'EXTENDED',
        details: response,
      },
    });

    await tx.shipment.update({
      where: { id: document.shipmentId },
      data: {
        complianceStatus: ComplianceStatus.SUBMITTED,
        ewayBillNumber: response.billNo,
      },
    });

    return next;
  });

  logger.info(`Mock e-way bill extended for document ${document.id}`);
  return updated;
};

const cancelEwayBill = async (documentId) => {
  const document = await prisma.complianceDocument.findUnique({
    where: { id: documentId },
    include: {
      shipment: { select: { id: true } },
    },
  });

  if (!document || document.type !== DocumentType.EWAY_BILL) {
    throw new Error('E-way bill document not found.');
  }

  const response = simulateEwayBillResponse('CANCEL', {
    billNo: document.payload?.billNo,
    remarks: 'Mock cancellation successful.',
  });

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.complianceDocument.update({
      where: { id: document.id },
      data: {
        payload: response,
        status: ComplianceStatus.REJECTED,
        remarks: 'Mock e-way bill cancelled.',
      },
    });

    await tx.complianceEvent.create({
      data: {
        documentId: document.id,
        eventType: 'CANCELLED',
        details: response,
      },
    });

    await tx.shipment.update({
      where: { id: document.shipmentId },
      data: {
        complianceStatus: ComplianceStatus.PENDING,
        ewayBillNumber: null,
      },
    });

    return next;
  });

  logger.info(`Mock e-way bill cancelled for document ${document.id}`);
  return updated;
};

module.exports = {
  createEwayBill,
  extendEwayBill,
  cancelEwayBill,
};
