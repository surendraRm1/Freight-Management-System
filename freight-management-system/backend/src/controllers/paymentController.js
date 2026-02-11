const logger = require('../utils/logger');
const paymentGateway = require('../services/paymentGateway');
const { createInvoiceDraft } = require('../services/invoiceService');
const { gstService, rcmService, tdsService } = require('../services/compliance');
const prisma = require('../lib/prisma');
const syncQueueService = require('../services/syncQueueService');
const {
  PaymentStatus,
  InvoiceStatus,
  DocumentType,
  ComplianceStatus,
} = require('../constants/prismaEnums');
const DEFAULT_DUE_DAYS = parseInt(process.env.INVOICE_DUE_IN_DAYS || '7', 10);

const parseDueInDays = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DUE_DAYS;
};

const toEventDetails = (payload) => JSON.parse(JSON.stringify(payload ?? {}));

const mapGatewayStatus = (status, success) => {
  if (!status) {
    return success ? PaymentStatus.AUTHORIZED : PaymentStatus.FAILED;
  }
  const upper = String(status).toUpperCase();
  if (PaymentStatus[upper]) {
    return PaymentStatus[upper];
  }
  return success ? PaymentStatus.AUTHORIZED : PaymentStatus.FAILED;
};

const ensureShipmentAccess = (user, shipment) => {
  if (!shipment) {
    return { allowed: false, code: 404, message: 'Shipment not found.' };
  }

  if (user.role !== 'ADMIN' && shipment.userId !== user.id) {
    return { allowed: false, code: 403, message: 'You cannot manage payments for this shipment.' };
  }

  return { allowed: true };
};

const ensureGstComplianceDocument = async (shipmentId) => {
  const existing = await prisma.complianceDocument.findFirst({
    where: { shipmentId, type: DocumentType.GST_INVOICE },
  });

  if (existing) {
    return existing;
  }

  const payload = await gstService.createGSTInvoiceDraft(shipmentId);

  const document = await prisma.$transaction(async (tx) => {
    const created = await tx.complianceDocument.create({
      data: {
        shipmentId,
        type: DocumentType.GST_INVOICE,
        status: ComplianceStatus.SUBMITTED,
        payload,
        remarks: 'Generated after payment capture.',
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
        complianceStatus: ComplianceStatus.SUBMITTED,
        gstInvoiceId: created.id,
      },
    });

    return created;
  });

  return document;
};

const handlePostCaptureCompliance = async (shipmentId) => {
  try {
    await ensureGstComplianceDocument(shipmentId);
  } catch (error) {
    logger.warn(`GST compliance generation failed for shipment ${shipmentId}`, error);
  }

  try {
    await rcmService.createRCMSelfInvoice(shipmentId);
  } catch (error) {
    logger.warn(`RCM self-invoice generation failed for shipment ${shipmentId}`, error);
  }
};

const serializePayment = (payment) => {
  if (!payment) return null;
  return {
    id: payment.id,
    shipmentId: payment.shipmentId,
    invoiceId: payment.invoiceId,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    gateway: payment.gateway,
    transactionRef: payment.transactionRef,
    authorizedAt: payment.authorizedAt,
    capturedAt: payment.capturedAt,
    failureReason: payment.failureReason,
    metadata: payment.metadata,
    tdsAmount: payment.tdsAmount,
    tcsAmount: payment.tcsAmount,
    rcmLiability: payment.rcmLiability,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    invoice: payment.invoice
      ? {
          id: payment.invoice.id,
          invoiceNumber: payment.invoice.invoiceNumber,
          status: payment.invoice.status,
          issuedAt: payment.invoice.issuedAt,
          dueDate: payment.invoice.dueDate,
          grandTotal: payment.invoice.grandTotal,
        }
      : null,
  };
};

const createPayment = async (req, res) => {
  try {
    const {
      shipmentId,
      amount,
      currency = 'INR',
      gateway = 'MOCK',
      taxes = [],
      metadata = {},
      dueInDays,
    } = req.body || {};

    const parsedShipmentId = parseInt(shipmentId, 10);
    if (!parsedShipmentId) {
      return res.status(400).json({ error: 'shipmentId is required.' });
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id: parsedShipmentId },
      include: {
        invoice: true,
        user: { select: { id: true } },
      },
    });

    const access = ensureShipmentAccess(req.user, shipment);
    if (!access.allowed) {
      return res.status(access.code).json({ error: access.message });
    }

    const chargeAmount = amount !== undefined ? Number(amount) : shipment.cost;
    if (!chargeAmount || Number.isNaN(chargeAmount) || chargeAmount <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required.' });
    }

    const dueDays = parseDueInDays(dueInDays);
    const authorizeResponse = await paymentGateway.authorize({
      amount: chargeAmount,
      currency,
      metadata: { shipmentId: parsedShipmentId, ...metadata?.gateway },
    });

    const paymentStatus = mapGatewayStatus(authorizeResponse.status, authorizeResponse.success);

    const result = await prisma.$transaction(async (tx) => {
      let invoiceRecord = shipment.invoice;
      if (!invoiceRecord) {
        const draft = createInvoiceDraft({
          shipment,
          taxes: Array.isArray(taxes) ? taxes : [],
        });

        const issueTimestamp = authorizeResponse.success ? new Date() : null;
        const dueDate = authorizeResponse.success
          ? new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000)
          : null;

        invoiceRecord = await tx.invoice.create({
          data: {
            shipmentId: shipment.id,
            invoiceNumber: draft.invoiceNumber,
            status: authorizeResponse.success ? InvoiceStatus.ISSUED : InvoiceStatus.DRAFT,
            issuedAt: issueTimestamp,
            dueDate,
            subtotal: draft.subtotal,
            taxTotal: draft.taxTotal,
            grandTotal: draft.grandTotal,
            lineItems: draft.lineItems,
            metadata: metadata?.invoice ?? null,
          },
        });
      } else if (
        authorizeResponse.success &&
        invoiceRecord.status !== InvoiceStatus.PAID &&
        invoiceRecord.status !== InvoiceStatus.ISSUED
      ) {
        const issueTimestamp = invoiceRecord.issuedAt || new Date();
        const dueDate =
          invoiceRecord.dueDate ||
          new Date(issueTimestamp.getTime() + dueDays * 24 * 60 * 60 * 1000);

        invoiceRecord = await tx.invoice.update({
          where: { id: invoiceRecord.id },
          data: {
            status: InvoiceStatus.ISSUED,
            issuedAt: issueTimestamp,
            dueDate,
          },
        });
      }

      const paymentRecord = await tx.payment.create({
        data: {
          shipmentId: shipment.id,
          invoiceId: invoiceRecord.id,
          amount: chargeAmount,
          currency,
          status: paymentStatus,
          gateway,
          transactionRef: authorizeResponse.transactionRef || null,
          authorizedAt: paymentStatus === PaymentStatus.AUTHORIZED ? new Date() : null,
          failureReason: authorizeResponse.failureReason || null,
          metadata: metadata?.payment ?? null,
        },
      });

      await tx.paymentEvent.create({
        data: {
          paymentId: paymentRecord.id,
          eventType: 'AUTHORIZE',
          details: toEventDetails(authorizeResponse),
        },
      });

      await tx.shipment.update({
        where: { id: shipment.id },
        data: { paymentStatus },
      });

      const hydratedPayment = await tx.payment.findUnique({
        where: { id: paymentRecord.id },
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              issuedAt: true,
              dueDate: true,
              grandTotal: true,
            },
          },
        },
      });

      return hydratedPayment;
    });

    await syncQueueService.enqueue({
      entityType: 'PAYMENT',
      entityId: result.id,
      action: 'CREATE_PAYMENT',
      payload: {
        paymentId: result.id,
        shipmentId: parsedShipmentId,
        amount: chargeAmount,
        currency,
        metadata,
      },
    });

    logger.info(
      `Payment initiated for shipment ${shipment.id} status=${paymentStatus} amount=${chargeAmount}`,
    );

    try {
      await tdsService.applyTaxDeductions(result.id);
    } catch (taxError) {
      logger.warn(`TDS/TCS calculation failed for payment ${result.id}`, taxError);
    }

    const httpStatus = authorizeResponse.success ? 201 : 202;
    return res.status(httpStatus).json({ payment: serializePayment(result) });
  } catch (error) {
    logger.error('Create payment error', error);
    return res.status(500).json({ error: 'Failed to initiate payment.' });
  }
};

const confirmPayment = async (req, res) => {
  try {
    const paymentId = parseInt(req.params.id, 10);
    if (!paymentId) {
      return res.status(400).json({ error: 'Invalid payment identifier.' });
    }

    const { status, failureReason, transactionRef, dueInDays } = req.body || {};
    const upper = typeof status === 'string' ? status.toUpperCase() : null;
    if (!upper || !PaymentStatus[upper]) {
      return res.status(400).json({ error: 'Unsupported payment status supplied.' });
    }
    const nextStatus = PaymentStatus[upper];

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        shipment: { select: { id: true, userId: true } },
        invoice: true,
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

    const access = ensureShipmentAccess(req.user, payment.shipment);
    if (!access.allowed && req.user.role !== 'ADMIN') {
      return res.status(access.code).json({ error: access.message });
    }

    const confirmed = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: nextStatus,
          transactionRef: transactionRef || payment.transactionRef,
          authorizedAt: nextStatus === PaymentStatus.AUTHORIZED ? now : payment.authorizedAt,
          failureReason: nextStatus === PaymentStatus.FAILED ? failureReason || null : null,
        },
        include: { invoice: true },
      });

      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          eventType: 'CONFIRM',
          details: toEventDetails({ status: nextStatus, transactionRef, failureReason }),
        },
      });

      await tx.shipment.update({
        where: { id: payment.shipmentId },
        data: { paymentStatus: nextStatus },
      });

      if (updatedPayment.invoice) {
        if (nextStatus === PaymentStatus.AUTHORIZED) {
          const dueDays = parseDueInDays(dueInDays);
          const issueTimestamp = updatedPayment.invoice.issuedAt || now;
          const dueDate =
            updatedPayment.invoice.dueDate ||
            new Date(issueTimestamp.getTime() + dueDays * 24 * 60 * 60 * 1000);

          await tx.invoice.update({
            where: { id: updatedPayment.invoice.id },
            data: {
              status: InvoiceStatus.ISSUED,
              issuedAt: issueTimestamp,
              dueDate,
            },
          });
        }
        if (nextStatus === PaymentStatus.FAILED) {
          await tx.invoice.update({
            where: { id: updatedPayment.invoice.id },
            data: {
              status: InvoiceStatus.DRAFT,
              issuedAt: null,
              dueDate: null,
            },
          });
        }
      }

      return updatedPayment;
    });

    if ([PaymentStatus.AUTHORIZED, PaymentStatus.PAID].includes(nextStatus)) {
      try {
        await tdsService.applyTaxDeductions(confirmed.id);
      } catch (taxError) {
        logger.warn(`TDS/TCS recalculation failed for payment ${confirmed.id}`, taxError);
      }
    }

    logger.info(`Payment ${payment.id} confirmed with status ${nextStatus}`);
    await syncQueueService.enqueue({
      entityType: 'PAYMENT',
      entityId: confirmed.id,
      action: 'CONFIRM_PAYMENT',
      payload: {
        paymentId,
        status: nextStatus,
        failureReason,
        transactionRef,
      },
    });

    return res.json({ payment: serializePayment(confirmed) });
  } catch (error) {
    logger.error('Confirm payment error', error);
    return res.status(500).json({ error: 'Failed to confirm payment.' });
  }
};

const capturePayment = async (req, res) => {
  try {
    const paymentId = parseInt(req.params.id, 10);
    if (!paymentId) {
      return res.status(400).json({ error: 'Invalid payment identifier.' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        shipment: { select: { id: true, userId: true } },
        invoice: true,
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

    const captureResponse = await paymentGateway.capture({
      transactionRef: payment.transactionRef,
    });
    const nextStatus = mapGatewayStatus(captureResponse.status, captureResponse.success);

    const updated = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const paymentRecord = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: nextStatus,
          capturedAt: captureResponse.success ? now : payment.capturedAt,
          failureReason: captureResponse.success ? null : captureResponse.failureReason || null,
        },
        include: { invoice: true },
      });

      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          eventType: 'CAPTURE',
          details: toEventDetails(captureResponse),
        },
      });

      await tx.shipment.update({
        where: { id: payment.shipmentId },
        data: { paymentStatus: nextStatus },
      });

      if (paymentRecord.invoice && captureResponse.success) {
        await tx.invoice.update({
          where: { id: paymentRecord.invoice.id },
          data: {
            status: InvoiceStatus.PAID,
          },
        });
      }

      return paymentRecord;
    });

    if (captureResponse.success) {
      try {
        await tdsService.applyTaxDeductions(updated.id);
      } catch (taxError) {
        logger.warn(`TDS/TCS update failed for payment ${updated.id}`, taxError);
      }

      await handlePostCaptureCompliance(payment.shipmentId);
    }

    await syncQueueService.enqueue({
      entityType: 'PAYMENT',
      entityId: updated.id,
      action: 'CAPTURE_PAYMENT',
      payload: {
        paymentId,
        status: nextStatus,
        captureSuccess: captureResponse.success,
      },
    });

    logger.info(`Payment ${payment.id} capture processed status=${nextStatus}`);
    return res.json({ payment: serializePayment(updated) });
  } catch (error) {
    logger.error('Capture payment error', error);
    return res.status(500).json({ error: 'Failed to capture payment.' });
  }
};

const getPayment = async (req, res) => {
  try {
    const paymentId = parseInt(req.params.id, 10);
    if (!paymentId) {
      return res.status(400).json({ error: 'Invalid payment identifier.' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: true,
        shipment: { select: { id: true, userId: true } },
        events: {
          orderBy: { recordedAt: 'desc' },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

    if (req.user.role !== 'ADMIN' && payment.shipment.userId !== req.user.id) {
      return res.status(403).json({ error: 'You are not allowed to view this payment.' });
    }

    const serialized = serializePayment(payment);
    serialized.events = payment.events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      details: event.details,
      recordedAt: event.recordedAt,
    }));

    return res.json({ payment: serialized });
  } catch (error) {
    logger.error('Get payment error', error);
    return res.status(500).json({ error: 'Failed to load payment details.' });
  }
};

module.exports = {
  createPayment,
  confirmPayment,
  capturePayment,
  getPayment,
};
