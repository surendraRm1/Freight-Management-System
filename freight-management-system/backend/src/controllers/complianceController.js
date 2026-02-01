const {
  DocumentType,
  ComplianceStatus,
} = require('@prisma/client');
const logger = require('../utils/logger');
const {
  gstService,
  rcmService,
  tdsService,
  ewayService,
  kycService,
} = require('../services/compliance');
const { notifyKycRejection } = require('../services/compliance/complianceNotifier');

const prisma = require('../lib/prisma');

const safeDateIso = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }
  return parsed.toISOString();
};

const recomputeShipmentComplianceStatus = async (shipmentId) => {
  const documents = await prisma.complianceDocument.findMany({
    where: { shipmentId },
    select: { status: true },
  });

  let nextStatus = ComplianceStatus.PENDING;
  if (!documents.length) {
    nextStatus = ComplianceStatus.PENDING;
  } else if (documents.some((doc) => doc.status === ComplianceStatus.REJECTED)) {
    nextStatus = ComplianceStatus.REJECTED;
  } else if (
    documents.every(
      (doc) => doc.status === ComplianceStatus.APPROVED || doc.status === ComplianceStatus.EXEMPT,
    )
  ) {
    nextStatus = ComplianceStatus.APPROVED;
  } else {
    nextStatus = ComplianceStatus.SUBMITTED;
  }

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: { complianceStatus: nextStatus },
  });

  return nextStatus;
};

const ensureShipmentAccess = async (shipmentId, user) => {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!shipment) {
    return { allowed: false, code: 404, message: 'Shipment not found.' };
  }

  if (user.role !== 'ADMIN' && shipment.userId !== user.id) {
    return { allowed: false, code: 403, message: 'You do not have access to this shipment.' };
  }

  return { allowed: true, shipment };
};

const generateGstInvoice = async (req, res) => {
  try {
    const shipmentId = parseInt(req.body.shipmentId, 10);
    if (!shipmentId) {
      return res.status(400).json({ error: 'shipmentId is required.' });
    }

    const access = await ensureShipmentAccess(shipmentId, req.user);
    if (!access.allowed) {
      return res.status(access.code).json({ error: access.message });
    }

    const payload = await gstService.createGSTInvoiceDraft(shipmentId);

    const document = await prisma.$transaction(async (tx) => {
      const created = await tx.complianceDocument.create({
        data: {
          shipmentId,
          type: DocumentType.GST_INVOICE,
          status: ComplianceStatus.SUBMITTED,
          payload,
          remarks: 'GST invoice generated (mock draft).',
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
        where: { id: shipmentId },
        data: {
          gstInvoiceId: created.id,
          complianceStatus: ComplianceStatus.SUBMITTED,
        },
      });

      return created;
    });

    logger.info(`GST invoice document created for shipment ${shipmentId}`);
    return res.status(201).json({ document });
  } catch (error) {
    logger.error('Generate GST invoice error', error);
    return res.status(500).json({ error: 'Failed to generate GST invoice.' });
  }
};

const generateRcmSelfInvoice = async (req, res) => {
  try {
    const shipmentId = parseInt(req.body.shipmentId, 10);
    if (!shipmentId) {
      return res.status(400).json({ error: 'shipmentId is required.' });
    }

    const access = await ensureShipmentAccess(shipmentId, req.user);
    if (!access.allowed) {
      return res.status(access.code).json({ error: access.message });
    }

    const document = await rcmService.createRCMSelfInvoice(shipmentId);
    if (!document) {
      return res.status(204).send();
    }
    await recomputeShipmentComplianceStatus(shipmentId);

    return res.status(201).json({ document });
  } catch (error) {
    logger.error('Generate RCM self invoice error', error);
    return res.status(500).json({ error: 'Failed to generate RCM document.' });
  }
};

const createEwayBill = async (req, res) => {
  try {
    const shipmentId = parseInt(req.body.shipmentId, 10);
    if (!shipmentId) {
      return res.status(400).json({ error: 'shipmentId is required.' });
    }

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrators can create e-way bills.' });
    }

    const document = await ewayService.createEwayBill(shipmentId);
    await recomputeShipmentComplianceStatus(shipmentId);
    return res.status(201).json({ document });
  } catch (error) {
    logger.error('Create e-way bill error', error);
    return res.status(500).json({ error: 'Failed to create e-way bill.' });
  }
};

const extendEwayBill = async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    if (!documentId) {
      return res.status(400).json({ error: 'Invalid document identifier.' });
    }

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrators can extend e-way bills.' });
    }

    const updated = await ewayService.extendEwayBill(documentId);
    await recomputeShipmentComplianceStatus(updated.shipmentId);
    return res.json({ document: updated });
  } catch (error) {
    logger.error('Extend e-way bill error', error);
    return res.status(500).json({ error: 'Failed to extend e-way bill.' });
  }
};

const cancelEwayBill = async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    if (!documentId) {
      return res.status(400).json({ error: 'Invalid document identifier.' });
    }

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrators can cancel e-way bills.' });
    }

    const updated = await ewayService.cancelEwayBill(documentId);
    await recomputeShipmentComplianceStatus(updated.shipmentId);
    return res.json({ document: updated });
  } catch (error) {
    logger.error('Cancel e-way bill error', error);
    return res.status(500).json({ error: 'Failed to cancel e-way bill.' });
  }
};

const uploadDriverKyc = async (req, res) => {
  try {
    const shipmentId = parseInt(req.body.shipmentId, 10);
    if (!shipmentId) {
      return res.status(400).json({ error: 'shipmentId is required.' });
    }

    const access = await ensureShipmentAccess(shipmentId, req.user);
    if (!access.allowed) {
      return res.status(access.code).json({ error: access.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Driver document file is required.' });
    }

    const fileName = await kycService.saveKycFile({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
    });

    const document = await kycService.recordKycDocument({
      shipmentId,
      type: DocumentType.DRIVER_KYC,
      filePath: fileName,
      metadata: {
        uploadedBy: req.user.id,
        mimeType: req.file.mimetype,
      },
    });

    await recomputeShipmentComplianceStatus(shipmentId);

    return res.status(201).json({ document });
  } catch (error) {
    logger.error('Upload driver KYC error', error);
    return res.status(500).json({ error: 'Failed to upload driver KYC.' });
  }
};

const uploadVehicleKyc = async (req, res) => {
  try {
    const shipmentId = parseInt(req.body.shipmentId, 10);
    if (!shipmentId) {
      return res.status(400).json({ error: 'shipmentId is required.' });
    }

    const access = await ensureShipmentAccess(shipmentId, req.user);
    if (!access.allowed) {
      return res.status(access.code).json({ error: access.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Vehicle document file is required.' });
    }

    const fileName = await kycService.saveKycFile({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
    });

    const document = await kycService.recordKycDocument({
      shipmentId,
      type: DocumentType.VEHICLE_KYC,
      filePath: fileName,
      metadata: {
        uploadedBy: req.user.id,
        mimeType: req.file.mimetype,
      },
    });

    await recomputeShipmentComplianceStatus(shipmentId);

    return res.status(201).json({ document });
  } catch (error) {
    logger.error('Upload vehicle KYC error', error);
    return res.status(500).json({ error: 'Failed to upload vehicle KYC.' });
  }
};

const uploadLorryReceipt = async (req, res) => {
  try {
    const shipmentId = parseInt(req.body.shipmentId, 10);
    if (!shipmentId) {
      return res.status(400).json({ error: 'shipmentId is required.' });
    }

    const access = await ensureShipmentAccess(shipmentId, req.user);
    if (!access.allowed) {
      return res.status(access.code).json({ error: access.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Lorry receipt document file is required.' });
    }

    const fileName = await kycService.saveKycFile({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
    });

    const document = await kycService.recordKycDocument({
      shipmentId,
      type: DocumentType.LORRY_RECEIPT,
      filePath: fileName,
      metadata: {
        uploadedBy: req.user.id,
        mimeType: req.file.mimetype,
        lrNumber: req.body?.lrNumber || null,
        issuedAt: safeDateIso(req.body?.issuedAt || req.body?.lrDate),
      },
    });

    await recomputeShipmentComplianceStatus(shipmentId);

    return res.status(201).json({ document });
  } catch (error) {
    logger.error('Upload lorry receipt error', error);
    return res.status(500).json({ error: 'Failed to upload lorry receipt.' });
  }
};

const rejectComplianceDocument = async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    const reason = req.body?.reason;

    if (!documentId) {
      return res.status(400).json({ error: 'Invalid document identifier.' });
    }

    const document = await prisma.complianceDocument.findUnique({
      where: { id: documentId },
      include: {
        shipment: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const rejectableTypes = [
      DocumentType.DRIVER_KYC,
      DocumentType.VEHICLE_KYC,
      DocumentType.LORRY_RECEIPT,
    ];
    if (!rejectableTypes.includes(document.type)) {
      return res.status(400).json({ error: 'Only KYC/LR documents can be rejected via this endpoint.' });
    }

    const access = await ensureShipmentAccess(document.shipmentId, req.user);
    if (!access.allowed) {
      return res.status(access.code).json({ error: access.message });
    }

    const updated = await kycService.rejectKycDocument(documentId, req.user.id, reason);
    await recomputeShipmentComplianceStatus(document.shipmentId);
    await notifyKycRejection({ documentId, reason });

    return res.json({ document: updated });
  } catch (error) {
    logger.error('Reject compliance document error', error);
    return res.status(500).json({ error: 'Failed to reject compliance document.' });
  }
};

const approveComplianceDocument = async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    if (!documentId) {
      return res.status(400).json({ error: 'Invalid document identifier.' });
    }

    const document = await prisma.complianceDocument.findUnique({
      where: { id: documentId },
      include: {
        shipment: { select: { id: true, userId: true } },
      },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const approvableTypes = [
      DocumentType.DRIVER_KYC,
      DocumentType.VEHICLE_KYC,
      DocumentType.LORRY_RECEIPT,
    ];
    if (!approvableTypes.includes(document.type)) {
      return res.status(400).json({ error: 'Only KYC/LR documents can be approved via this endpoint.' });
    }

    const updated = await kycService.approveKycDocument(documentId, req.user.id);
    await recomputeShipmentComplianceStatus(document.shipmentId);

    return res.json({ document: updated });
  } catch (error) {
    logger.error('Approve compliance document error', error);
    return res.status(500).json({ error: 'Failed to approve compliance document.' });
  }
};

const listComplianceQueue = async (req, res) => {
  try {
    const { status, type, limit } = req.query;
    const where = {};

    if (status) {
      const normalizedStatus = String(status).toUpperCase();
      if (!ComplianceStatus[normalizedStatus]) {
        return res.status(400).json({ error: 'Invalid compliance status filter.' });
      }
      where.status = normalizedStatus;
    }

    if (type) {
      const normalizedType = String(type).toUpperCase();
      if (!DocumentType[normalizedType]) {
        return res.status(400).json({ error: 'Invalid document type filter.' });
      }
      where.type = normalizedType;
    }

    const take = Math.min(Number(limit) || 50, 200);

    const documents = await prisma.complianceDocument.findMany({
      where,
      take,
      orderBy: { updatedAt: 'desc' },
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            fromLocation: true,
            toLocation: true,
            status: true,
            complianceStatus: true,
            createdAt: true,
          },
        },
        events: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
    });

    return res.json({ documents });
  } catch (error) {
    logger.error('List compliance queue error', error);
    return res.status(500).json({ error: 'Failed to load compliance queue.' });
  }
};

const listPendingKycShipments = async (req, res) => {
  try {
    const shipments = await prisma.shipment.findMany({
      where: {
        complianceStatus: { in: [ComplianceStatus.PENDING, ComplianceStatus.SUBMITTED] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        trackingNumber: true,
        fromLocation: true,
        toLocation: true,
        status: true,
        createdAt: true,
        complianceDocs: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            status: true,
            updatedAt: true,
            createdAt: true,
          },
        },
      },
    });

    const pending = shipments
      .map((shipment) => {
        const driver = shipment.complianceDocs.find((doc) => doc.type === DocumentType.DRIVER_KYC);
        const vehicle = shipment.complianceDocs.find(
          (doc) => doc.type === DocumentType.VEHICLE_KYC,
        );
        const lorryReceipt = shipment.complianceDocs.find(
          (doc) => doc.type === DocumentType.LORRY_RECEIPT,
        );
        const driverApproved = driver?.status === ComplianceStatus.APPROVED;
        const vehicleApproved = vehicle?.status === ComplianceStatus.APPROVED;
        const lrUploaded = Boolean(lorryReceipt);

        return {
          ...shipment,
          driverStatus: driver?.status || ComplianceStatus.PENDING,
          vehicleStatus: vehicle?.status || ComplianceStatus.PENDING,
          lorryReceiptStatus: lorryReceipt?.status || ComplianceStatus.PENDING,
          driverUpdatedAt: driver?.updatedAt || driver?.createdAt || shipment.createdAt,
          vehicleUpdatedAt: vehicle?.updatedAt || vehicle?.createdAt || shipment.createdAt,
          lorryReceiptUpdatedAt:
            lorryReceipt?.updatedAt || lorryReceipt?.createdAt || shipment.createdAt,
          requiresAction: !driverApproved || !vehicleApproved || !lrUploaded,
        };
      })
      .filter((shipment) => shipment.requiresAction);

    return res.json({ shipments: pending });
  } catch (error) {
    logger.error('List pending KYC shipments error', error);
    return res.status(500).json({ error: 'Failed to load pending KYC shipments.' });
  }
};

const listComplianceDocuments = async (req, res) => {
  try {
    const shipmentId = parseInt(req.query.shipmentId, 10);
    if (!shipmentId) {
      return res.status(400).json({ error: 'shipmentId query parameter is required.' });
    }

    const access = await ensureShipmentAccess(shipmentId, req.user);
    if (!access.allowed) {
      return res.status(access.code).json({ error: access.message });
    }

    const documents = await prisma.complianceDocument.findMany({
      where: { shipmentId },
      orderBy: { createdAt: 'desc' },
      include: {
        events: {
          orderBy: { recordedAt: 'desc' },
        },
      },
    });

    return res.json({ documents });
  } catch (error) {
    logger.error('List compliance documents error', error);
    return res.status(500).json({ error: 'Failed to list compliance documents.' });
  }
};

const downloadComplianceDocument = async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    if (!documentId) {
      return res.status(400).json({ error: 'Invalid document identifier.' });
    }

    const document = await prisma.complianceDocument.findUnique({
      where: { id: documentId },
      include: {
        shipment: {
          select: { id: true, userId: true },
        },
      },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    if (req.user.role !== 'ADMIN' && document.shipment.userId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have access to this document.' });
    }

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=compliance-${document.id}.json`,
    );
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify(document, null, 2));
  } catch (error) {
    logger.error('Download compliance document error', error);
    return res.status(500).json({ error: 'Failed to download compliance document.' });
  }
};

module.exports = {
  generateGstInvoice,
  generateRcmSelfInvoice,
  createEwayBill,
  extendEwayBill,
  cancelEwayBill,
  uploadDriverKyc,
  uploadVehicleKyc,
  uploadLorryReceipt,
  approveComplianceDocument,
  rejectComplianceDocument,
  listComplianceQueue,
  listPendingKycShipments,
  listComplianceDocuments,
  downloadComplianceDocument,
};
