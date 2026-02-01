const {
  ComplianceStatus,
} = require('@prisma/client');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const logger = require('../../utils/logger');
const prisma = require('../../lib/prisma');
const uploadsDir = path.resolve(process.cwd(), '..', 'uploads');

const ensureUploadsDir = async () => {
  await fs.mkdir(uploadsDir, { recursive: true });
};

const sanitizeOriginalName = (name = 'document') =>
  path
    .basename(name)
    .replace(/[^a-zA-Z0-9._-]/g, '_');

const saveKycFile = async ({ buffer, originalname }) => {
  await ensureUploadsDir();
  const timestamp = Date.now();
  const safeName = sanitizeOriginalName(originalname);
  const extension = path.extname(safeName).toLowerCase();
  const filename = `${timestamp}-${crypto.randomBytes(6).toString('hex')}${extension}`;
  const filePath = path.join(uploadsDir, filename);
  await fs.writeFile(filePath, buffer);
  return filename;
};

const recordKycDocument = async ({ shipmentId, type, filePath, metadata }) => {
  const document = await prisma.$transaction(async (tx) => {
    const created = await tx.complianceDocument.create({
      data: {
        shipmentId,
        type,
        status: ComplianceStatus.SUBMITTED,
        fileUrl: filePath,
        metadata,
        remarks: 'KYC document uploaded.',
      },
    });

    await tx.complianceEvent.create({
      data: {
        documentId: created.id,
        eventType: 'UPLOADED',
        details: metadata,
      },
    });

    return created;
  });

  logger.info(`KYC document recorded for shipment ${shipmentId} type ${type}`);
  return document;
};

const approveKycDocument = async (documentId, approverId) => {
  const document = await prisma.$transaction(async (tx) => {
    const updated = await tx.complianceDocument.update({
      where: { id: documentId },
      data: {
        status: ComplianceStatus.APPROVED,
        remarks: 'Approved via admin action.',
      },
    });

    await tx.complianceEvent.create({
      data: {
        documentId,
        eventType: 'APPROVED',
        details: { approverId },
      },
    });

    return updated;
  });

  logger.info(`KYC document ${documentId} approved by user ${approverId}`);
  return document;
};

const rejectKycDocument = async (documentId, approverId, reason) => {
  const document = await prisma.$transaction(async (tx) => {
    const existing = await tx.complianceDocument.findUnique({
      where: { id: documentId },
      select: { metadata: true },
    });

    const updated = await tx.complianceDocument.update({
      where: { id: documentId },
      data: {
        status: ComplianceStatus.REJECTED,
        remarks: reason || 'Rejected via admin action.',
        metadata: {
          ...(existing?.metadata || {}),
          rejectionReason: reason || null,
          rejectionHandledBy: approverId,
          rejectionHandledAt: new Date().toISOString(),
        },
      },
    });

    await tx.complianceEvent.create({
      data: {
        documentId,
        eventType: 'REJECTED',
        details: { approverId, reason },
      },
    });

    return updated;
  });

  logger.info(`KYC document ${documentId} rejected by user ${approverId}`);
  return document;
};

module.exports = {
  saveKycFile,
  recordKycDocument,
  approveKycDocument,
  rejectKycDocument,
};
