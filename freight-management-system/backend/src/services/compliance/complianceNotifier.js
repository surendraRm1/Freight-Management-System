const {
  DocumentType,
  ComplianceStatus,
} = require('@prisma/client');
const prisma = require('../../lib/prisma');
const logger = require('../../utils/logger');
const { notifyUserWithEmail, formatDateTime } = require('../notificationService');

const minutesToMillis = (minutes) => minutes * 60 * 1000;

const buildShipmentLink = (shipmentId) => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${baseUrl}/shipments/${shipmentId}`;
};

const buildExpiryEmailBody = ({ userName, shipment, document }) => {
  const validUpto = formatDateTime(document.payload?.validUpto);
  const shipmentLink = buildShipmentLink(shipment.id);
  const billNo = document.payload?.billNo || document.id;

  return `
    <p>Hi ${userName || 'there'},</p>
    <p>The e-way bill <strong>${billNo}</strong> for shipment
      <strong>${shipment.fromLocation}</strong> → <strong>${shipment.toLocation}</strong>
      is nearing expiry.</p>
    <ul>
      <li><strong>Tracking:</strong> ${shipment.trackingNumber || shipment.id}</li>
      <li><strong>Valid upto:</strong> ${validUpto || 'N/A'}</li>
    </ul>
    <p>Please extend the validity or complete delivery before expiry to avoid compliance penalties.</p>
    <p>
      <a href="${shipmentLink}" target="_blank" rel="noopener noreferrer">
        View shipment details
      </a>
    </p>
    <p>– KCO Freight Compliance</p>
  `;
};

const alertExpiringEwayBills = async () => {
  const alertWindowMinutes = Number(process.env.EWAY_EXPIRY_ALERT_MINUTES || 360);
  const threshold = new Date(Date.now() + minutesToMillis(alertWindowMinutes));

  const documents = await prisma.complianceDocument.findMany({
    where: {
      type: DocumentType.EWAY_BILL,
      status: ComplianceStatus.SUBMITTED,
      payload: {
        path: ['validUpto'],
        lte: threshold.toISOString(),
      },
    },
    include: {
      shipment: {
        select: {
          id: true,
          trackingNumber: true,
          fromLocation: true,
          toLocation: true,
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  const eligibleDocuments = documents.filter(
    (document) => document.metadata?.expiryAlertSent !== true,
  );

  if (!eligibleDocuments.length) {
    return;
  }

  await Promise.all(
    eligibleDocuments.map(async (document) => {
      const { shipment } = document;
      if (!shipment?.user) {
        return;
      }

      const message = `E-way bill ${document.payload?.billNo || document.id} will expire on ${formatDateTime(
        document.payload?.validUpto,
      )}.`;

      await notifyUserWithEmail({
        user: shipment.user,
        title: 'E-way bill expiration alert',
        message,
        metadata: {
          documentId: document.id,
          shipmentId: shipment.id,
          validUpto: document.payload?.validUpto,
        },
        emailSubject: 'Action needed: E-way bill expiring soon',
        emailBody: buildExpiryEmailBody({
          userName: shipment.user.name,
          shipment,
          document,
        }),
      });

      const metadata = {
        ...(document.metadata || {}),
        expiryAlertSent: true,
        expiryAlertSentAt: new Date().toISOString(),
      };

      await prisma.complianceDocument.update({
        where: { id: document.id },
        data: { metadata },
      });
    }),
  );

  logger.info(`Compliance notifier: triggered ${eligibleDocuments.length} e-way expiry alerts.`);
};

const buildKycRejectionEmail = ({ userName, documentType, reason, shipment }) => {
  const shipmentLink = buildShipmentLink(shipment.id);
  return `
    <p>Hi ${userName || 'there'},</p>
    <p>Your ${documentType} submission for shipment
      <strong>${shipment.fromLocation}</strong> → <strong>${shipment.toLocation}</strong>
      has been rejected.</p>
    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
    <p>Please upload revised documents for approval.</p>
    <p>
      <a href="${shipmentLink}" target="_blank" rel="noopener noreferrer">
        View shipment details
      </a>
    </p>
    <p>– KCO Freight Compliance</p>
  `;
};

const notifyKycRejection = async ({ documentId, reason }) => {
  const document = await prisma.complianceDocument.findUnique({
    where: { id: documentId },
    include: {
      shipment: {
        select: {
          id: true,
          trackingNumber: true,
          fromLocation: true,
          toLocation: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!document?.shipment?.user) {
    logger.warn('KYC rejection notification skipped – missing shipment user.', { documentId });
    return;
  }

  const readableType = document.type.replace(/_/g, ' ').toLowerCase();
  const message = `${readableType} was rejected. ${reason ? `Reason: ${reason}` : 'Upload new documents.'}`;

  await notifyUserWithEmail({
    user: document.shipment.user,
    title: `KYC ${readableType} rejected`,
    message,
    metadata: {
      documentId,
      shipmentId: document.shipment.id,
      rejectionReason: reason,
    },
    emailSubject: `Action needed: ${readableType} rejected`,
    emailBody: buildKycRejectionEmail({
      userName: document.shipment.user.name,
      documentType: readableType,
      reason,
      shipment: document.shipment,
    }),
  });
};

let monitorHandle;

const startComplianceMonitors = () => {
  if (process.env.COMPLIANCE_ALERTS_DISABLED === 'true') {
    logger.info('Compliance monitors disabled via COMPLIANCE_ALERTS_DISABLED flag.');
    return;
  }

  if (monitorHandle) {
    return;
  }

  const intervalMinutes = Number(process.env.EWAY_ALERT_INTERVAL_MINUTES || 30);
  const schedule = async () => {
    try {
      await alertExpiringEwayBills();
    } catch (error) {
      logger.error('Compliance notifier job failed', error);
    }
  };

  schedule();
  monitorHandle = setInterval(schedule, minutesToMillis(intervalMinutes));
  logger.info(`Compliance monitors started (interval ${intervalMinutes} minutes).`);
};

module.exports = {
  startComplianceMonitors,
  notifyKycRejection,
};
