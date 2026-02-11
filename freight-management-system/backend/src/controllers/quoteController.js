const logger = require('../utils/logger');
const {
  sendQuoteRequestInvitationEmail,
  sendBookingConsentRequestEmail,
  sendBookingConsentUpdateEmail,
} = require('../services/emailService');
const { sendSMS } = require('../services/smsService');
const prisma = require('../lib/prisma');
const syncQueueService = require('../services/syncQueueService');
const {
  QuoteStatus,
  QuoteResponseStatus,
  ShipmentStatus,
  ConsentStatus,
  BookingStatus,
  ConsentSource,
} = require('../constants/prismaEnums');
const CONSENT_SLA_MINUTES = parseInt(process.env.CONSENT_SLA_MINUTES || '120', 10);

const includeQuoteResponseMeta = {
  responses: {
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          rating: true,
          baseRate: true,
          email: true,
          phone: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
  approvedResponse: {
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      companyId: true,
    },
  },
  shipment: {
    select: {
      id: true,
      status: true,
      trackingNumber: true,
      createdAt: true,
    },
  },
};

const sanitizeVendors = (vendors) => vendors.map((vendor) => vendor.id);

const isPlatformAdmin = (user) => ['ADMIN', 'SUPER_ADMIN'].includes(user?.role);
const isCompanyScopedAdmin = (user) => user?.role === 'COMPANY_ADMIN' && Boolean(user?.companyId);

const canManageCompanyQuote = (user, quoteRequest) => {
  if (!user || !quoteRequest) return false;
  if (isPlatformAdmin(user)) return true;
  if (quoteRequest.createdByUserId === user.id) return true;
  if (isCompanyScopedAdmin(user)) {
    const creatorCompanyId = quoteRequest.createdBy?.companyId;
    return creatorCompanyId && creatorCompanyId === user.companyId;
  }
  return false;
};

const createQuoteRequest = async (req, res) => {
  try {
    const {
      fromLocation,
      toLocation,
      fromLat,
      fromLng,
      toLat,
      toLng,
      weight,
      shipmentType,
      urgency,
      notes,
      vendorIds,
    } = req.body;

    if (!fromLocation || !toLocation || !weight || !shipmentType || !urgency) {
      return res.status(400).json({ error: 'Missing required shipment details.' });
    }

    if (!Array.isArray(vendorIds) || vendorIds.length === 0) {
      return res.status(400).json({ error: 'Select at least one transporter to request a quotation.' });
    }

    const uniqueVendorIds = [...new Set(vendorIds.map((value) => parseInt(value, 10)).filter(Boolean))];

    if (uniqueVendorIds.length === 0) {
      return res.status(400).json({ error: 'No valid transporter identifiers supplied.' });
    }

    const vendors = await prisma.vendor.findMany({
      where: {
        id: { in: uniqueVendorIds },
        isActive: true,
      },
    });

    if (vendors.length !== uniqueVendorIds.length) {
      return res.status(400).json({ error: 'One or more selected transporters are unavailable.' });
    }

    const quoteRequest = await prisma.quoteRequest.create({
      data: {
        createdByUserId: req.user.id,
        fromLocation,
        toLocation,
        fromLat,
        fromLng,
        toLat,
        toLng,
        weight: parseFloat(weight),
        shipmentType,
        urgency,
        notes,
        responses: {
          create: uniqueVendorIds.map((vendorId) => ({
            vendorId,
          })),
        },
      },
      include: includeQuoteResponseMeta,
    });

    await syncQueueService.enqueue({
      entityType: 'QUOTE_REQUEST',
      entityId: quoteRequest.id,
      action: 'CREATE_QUOTE_REQUEST',
      payload: {
        fromLocation,
        toLocation,
        weight: parseFloat(weight),
        shipmentType,
        urgency,
        vendorIds: uniqueVendorIds,
        createdByUserId: req.user.id,
      },
    });

    const emailTasks = vendors
      .filter((vendor) => vendor.email)
      .map((vendor) =>
        sendQuoteRequestInvitationEmail({
          to: vendor.email,
          vendorName: vendor.name,
          shipperName: req.user?.name || req.user?.email,
          fromLocation,
          toLocation,
          weight: quoteRequest.weight,
          shipmentType,
          urgency,
          notes,
          quoteId: quoteRequest.id,
        }).catch((error) => {
          logger.error(
            `Failed to send quote request invitation to ${vendor.email} (quote ${quoteRequest.id})`,
            error,
          );
        }),
      );

    const transporterUsers = await prisma.user.findMany({
      where: {
        vendorId: { in: sanitizeVendors(vendors) },
        isActive: true,
      },
      select: { id: true },
    });

    await Promise.all(
      transporterUsers.map((user) =>
        prisma.notification.create({
          data: {
            userId: user.id,
            title: 'New quotation request',
            message: `New request for ${fromLocation} -> ${toLocation}. Respond with a price and delivery estimate.`,
            type: 'system',
          },
        }),
      ),
    );
    if (emailTasks.length) {
      await Promise.all(emailTasks);
    }
    logger.info(`Quote request ${quoteRequest.id} created by user ${req.user.id}`);

    return res.status(201).json({ quoteRequest });
  } catch (error) {
    logger.error('Create quote request error:', error);
    return res.status(500).json({ error: 'Failed to create quotation request.' });
  }
};

const getQuoteRequests = async (req, res) => {
  try {
    let where = {};
    if (isPlatformAdmin(req.user)) {
      where = {};
    } else if (isCompanyScopedAdmin(req.user)) {
      if (!req.user.companyId) {
        return res.status(403).json({ error: 'Company context missing' });
      }
      where = { createdBy: { companyId: req.user.companyId } };
    } else {
      where = { createdByUserId: req.user.id };
    }

    const requests = await prisma.quoteRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: includeQuoteResponseMeta,
    });

    return res.json({ requests });
  } catch (error) {
    logger.error('List quote requests error:', error);
    return res.status(500).json({ error: 'Failed to fetch quotation requests.' });
  }
};

const getQuoteRequestById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid quotation request identifier.' });
    }

    const request = await prisma.quoteRequest.findUnique({
      where: { id },
      include: includeQuoteResponseMeta,
    });

    if (!request) {
      return res.status(404).json({ error: 'Quotation request not found.' });
    }

    if (!canManageCompanyQuote(req.user, request)) {
      return res.status(403).json({ error: 'You are not allowed to view this quotation request.' });
    }

    return res.json({ request });
  } catch (error) {
    logger.error('Get quote request error:', error);
    return res.status(500).json({ error: 'Failed to fetch quotation request.' });
  }
};

const approveQuoteResponse = async (req, res) => {
  try {
    const responseId = parseInt(req.params.responseId, 10);

    if (Number.isNaN(responseId)) {
      return res.status(400).json({ error: 'Invalid quotation response identifier.' });
    }

    const quoteResponse = await prisma.quoteResponse.findUnique({
      where: { id: responseId },
      include: {
        vendor: true,
        quoteRequest: {
          include: {
            responses: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            companyId: true,
          },
        },
      },
    },
      },
    });

    if (!quoteResponse) {
      return res.status(404).json({ error: 'Quotation response not found.' });
    }

    const { quoteRequest } = quoteResponse;

    if (!canManageCompanyQuote(req.user, quoteRequest)) {
      return res.status(403).json({ error: 'You are not allowed to approve this quotation.' });
    }

    if (quoteResponse.status !== QuoteResponseStatus.RESPONDED) {
      return res.status(400).json({ error: 'Transporter must submit a price before approval.' });
    }

    if (quoteRequest.status === QuoteStatus.APPROVED || quoteRequest.approvedResponseId) {
      return res.status(409).json({ error: 'Quotation already approved.' });
    }

    if (!quoteResponse.quotedPrice || !quoteResponse.estimatedDelivery) {
      return res.status(400).json({ error: 'Quotation is missing price or delivery information.' });
    }

    const consentExpiresAt = new Date(Date.now() + CONSENT_SLA_MINUTES * 60 * 1000);

    const shipmentPayload = {
      userId: quoteRequest.createdByUserId,
      fromLocation: quoteRequest.fromLocation,
      toLocation: quoteRequest.toLocation,
      fromLat: quoteRequest.fromLat,
      fromLng: quoteRequest.fromLng,
      toLat: quoteRequest.toLat,
      toLng: quoteRequest.toLng,
      weight: quoteRequest.weight,
      shipmentType: quoteRequest.shipmentType,
      urgency: quoteRequest.urgency,
    selectedVendorId: quoteResponse.vendorId,
    cost: quoteResponse.quotedPrice,
    estimatedDelivery: quoteResponse.estimatedDelivery,
    status: ShipmentStatus.REQUESTED,
    bookingStatus: BookingStatus.PENDING_TRANSPORTER,
    quoteRequestId: quoteRequest.id,
    transporterQuoteId: quoteResponse.id,
      notes: quoteRequest.notes,
    };

    const result = await prisma.$transaction(async (tx) => {
        const updatedResponse = await tx.quoteResponse.update({
          where: { id: responseId },
          data: {
            status: QuoteResponseStatus.APPROVED,
            consentStatus: ConsentStatus.PENDING,
            consentAt: null,
            consentSource: null,
            expiresAt: consentExpiresAt,
          },
        });

      const updatedRequest = await tx.quoteRequest.update({
        where: { id: quoteRequest.id },
        data: {
          status: QuoteStatus.APPROVED,
          approvedResponseId: responseId,
        },
      });

        const shipment = await tx.shipment.create({
          data: shipmentPayload,
        });

        await tx.consentLog.create({
          data: {
            quoteResponseId: updatedResponse.id,
            shipmentId: shipment.id,
            statusBefore: ConsentStatus.PENDING,
            statusAfter: ConsentStatus.PENDING,
            actorType: 'SYSTEM',
            actorId: req.user.id,
            note: 'Shipment created; awaiting transporter consent.',
          },
        });

      await tx.quoteRequest.update({
        where: { id: quoteRequest.id },
        data: {
          shipment: {
            connect: { id: shipment.id },
          },
        },
      });

      const refreshedRequest = await tx.quoteRequest.findUnique({
        where: { id: quoteRequest.id },
        include: includeQuoteResponseMeta,
      });

      return { updatedResponse, updatedRequest: refreshedRequest, shipment };
    });

    await syncQueueService.enqueue({
      entityType: 'QUOTE_REQUEST',
      entityId: quoteRequest.id,
      action: 'APPROVE_QUOTE_RESPONSE',
      payload: {
        quoteRequestId: quoteRequest.id,
        responseId,
        shipmentId: result.shipment.id,
      },
    });

    const transporterUsers = await prisma.user.findMany({
      where: {
        vendorId: quoteResponse.vendorId,
        isActive: true,
      },
      select: { id: true },
    });

    const consentDeadlineLabel = consentExpiresAt.toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    await Promise.all(
      transporterUsers.map((user) =>
        prisma.notification.create({
          data: {
            userId: user.id,
            title: 'Booking awaiting your confirmation',
            message: `Shipment ${quoteRequest.fromLocation} -> ${quoteRequest.toLocation} requires your consent before ${consentDeadlineLabel}.`,
            type: 'system',
            metadata: {
              shipmentId: result.shipment.id,
              expiresAt: consentExpiresAt.toISOString(),
            },
          },
        }),
      ),
    );
    await prisma.notification.create({
      data: {
        userId: quoteRequest.createdByUserId,
        title: 'Waiting on transporter confirmation',
        message: `Transporter ${quoteResponse.vendor?.name || 'partner'} has been notified to confirm booking for ${quoteRequest.fromLocation} -> ${quoteRequest.toLocation}.`,
        type: 'system',
        metadata: {
          shipmentId: result.shipment.id,
          transporterVendorId: quoteResponse.vendorId,
          expiresAt: consentExpiresAt.toISOString(),
        },
      },
    });

    const shipperContact = result.updatedRequest.createdBy;
    const vendorContact = quoteResponse.vendor;
    const sideChannelTasks = [];

    if (vendorContact?.email) {
      sideChannelTasks.push(
        sendBookingConsentRequestEmail({
          to: vendorContact.email,
          vendorName: vendorContact.name,
          fromLocation: quoteRequest.fromLocation,
          toLocation: quoteRequest.toLocation,
          quotedPrice: quoteResponse.quotedPrice,
          expiresAt: consentExpiresAt,
          shipperName: shipperContact?.name,
          shipperEmail: shipperContact?.email,
          shipmentId: result.shipment.id,
          trackingNumber: result.shipment.trackingNumber,
          weight: quoteRequest.weight,
          shipmentType: quoteRequest.shipmentType,
          urgency: quoteRequest.urgency,
          estimatedDelivery: quoteResponse.estimatedDelivery,
        }).catch((error) => {
          logger.error(
            `Failed to send booking consent request email to ${vendorContact.email} (quote response ${responseId})`,
            error,
          );
        }),
      );
    }

    if (vendorContact?.phone) {
      sideChannelTasks.push(
        sendSMS({
          to: vendorContact.phone,
          template: 'BOOKING_CONSENT_REQUEST',
          context: {
            route: `${quoteRequest.fromLocation} -> ${quoteRequest.toLocation}`,
            deadline: consentDeadlineLabel,
          },
        }).catch((error) => {
          logger.error(
            `Failed to send booking consent SMS to ${vendorContact.phone} (quote response ${responseId})`,
            error,
          );
        }),
      );
    }

    if (shipperContact?.email) {
      sideChannelTasks.push(
        sendBookingConsentUpdateEmail({
          to: shipperContact.email,
          recipientName: shipperContact.name,
          statusLabel: 'Awaiting Confirmation',
          vendorName: vendorContact?.name || 'Transporter',
          fromLocation: quoteRequest.fromLocation,
          toLocation: quoteRequest.toLocation,
          note: null,
          actionedAt: null,
          trackingNumber: result.shipment.trackingNumber,
        }).catch((error) => {
          logger.error(
            `Failed to send booking pending email to ${shipperContact.email} (quote response ${responseId})`,
            error,
          );
        }),
      );
    }

    if (shipperContact?.phone) {
      sideChannelTasks.push(
        sendSMS({
          to: shipperContact.phone,
          template: 'BOOKING_PENDING_TRANSPORTER',
          context: {
            route: `${quoteRequest.fromLocation} -> ${quoteRequest.toLocation}`,
            transporter: vendorContact?.name || 'Transporter',
            deadline: consentDeadlineLabel,
          },
        }).catch((error) => {
          logger.error(
            `Failed to send booking pending SMS to ${shipperContact.phone} (quote response ${responseId})`,
            error,
          );
        }),
      );
    }

    if (sideChannelTasks.length) {
      await Promise.all(sideChannelTasks);
    }

    logger.info(`Quotation response ${responseId} approved, shipment ${result.shipment.id} created`);

    return res.json({
      approval: {
        quoteRequest: result.updatedRequest,
        quoteResponse: result.updatedResponse,
        shipment: result.shipment,
      },
    });
  } catch (error) {
    logger.error('Approve quote response error:', error);
    return res.status(500).json({ error: 'Failed to approve quotation response.' });
  }
};

const submitQuoteResponseConsent = async (req, res) => {
  try {
    const responseId = parseInt(req.params.responseId, 10);
    if (Number.isNaN(responseId)) {
      return res.status(400).json({ error: 'Invalid quotation response identifier.' });
    }

    const action = typeof req.body.action === 'string' ? req.body.action.trim().toUpperCase() : null;
    const note = typeof req.body.note === 'string' && req.body.note.trim().length > 0 ? req.body.note.trim() : null;

    if (!action || !['ACCEPT', 'DECLINE'].includes(action)) {
      return res.status(400).json({ error: 'Action must be either ACCEPT or DECLINE.' });
    }

    const quoteResponse = await prisma.quoteResponse.findUnique({
      where: { id: responseId },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        quoteRequest: {
          select: {
            id: true,
            createdByUserId: true,
            fromLocation: true,
            toLocation: true,
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        shipment: {
          select: {
            id: true,
            bookingStatus: true,
            transporterResponseNotes: true,
            trackingNumber: true,
          },
        },
      },
    });

    if (!quoteResponse) {
      return res.status(404).json({ error: 'Quotation response not found.' });
    }

    if (req.user.role !== 'ADMIN') {
      if (!req.user.vendorId || req.user.vendorId !== quoteResponse.vendorId) {
        return res.status(403).json({ error: 'You are not authorized to respond to this booking.' });
      }
    }

    if (quoteResponse.consentStatus !== ConsentStatus.PENDING) {
      return res.status(409).json({ error: `Consent already recorded as ${quoteResponse.consentStatus}.` });
    }

    const now = new Date();

    if (quoteResponse.expiresAt && quoteResponse.expiresAt < now) {
      await prisma.$transaction(async (tx) => {
        await tx.quoteResponse.update({
          where: { id: responseId },
          data: {
            consentStatus: ConsentStatus.EXPIRED,
            consentAt: now,
            consentSource: ConsentSource.SYSTEM,
          },
        });

        if (quoteResponse.shipment) {
          await tx.shipment.update({
            where: { id: quoteResponse.shipment.id },
            data: {
              bookingStatus: BookingStatus.EXPIRED,
              transporterRespondedAt: now,
            },
          });
        }

        await tx.consentLog.create({
          data: {
            quoteResponseId: responseId,
            shipmentId: quoteResponse.shipment ? quoteResponse.shipment.id : null,
            statusBefore: quoteResponse.consentStatus,
            statusAfter: ConsentStatus.EXPIRED,
            actorType: 'SYSTEM',
            actorId: req.user.id,
            note: 'Consent attempt after expiry marked as expired.',
          },
        });
      });

      return res.status(409).json({ error: 'Consent window has expired. Please request a new quotation.' });
    }

    const nextStatus = action === 'ACCEPT' ? ConsentStatus.ACCEPTED : ConsentStatus.DECLINED;
    const nextBookingStatus = action === 'ACCEPT' ? BookingStatus.CONFIRMED : BookingStatus.DECLINED;
    const actorType = req.user.role === 'ADMIN' ? 'ADMIN' : 'TRANSPORTER';

    const result = await prisma.$transaction(async (tx) => {
      const responseUpdate = {
        consentStatus: nextStatus,
        consentAt: now,
        consentSource: req.user.role === 'ADMIN' ? ConsentSource.SYSTEM : ConsentSource.TRANSPORTER_PORTAL,
      };

      if (note) {
        responseUpdate.transporterNotes = note;
      }

      const updatedResponse = await tx.quoteResponse.update({
        where: { id: responseId },
        data: responseUpdate,
      });

      let updatedShipment = null;
      if (quoteResponse.shipment) {
        const shipmentUpdate = {
          bookingStatus: nextBookingStatus,
          transporterRespondedAt: now,
          transporterResponseNotes: note || quoteResponse.shipment.transporterResponseNotes,
        };

        if (action === 'ACCEPT') {
          shipmentUpdate.transporterAcceptedAt = now;
          shipmentUpdate.transporterRejectedAt = null;
        } else {
          shipmentUpdate.transporterRejectedAt = now;
          shipmentUpdate.transporterAcceptedAt = null;
        }

        updatedShipment = await tx.shipment.update({
          where: { id: quoteResponse.shipment.id },
          data: shipmentUpdate,
        });
      }

      await tx.consentLog.create({
        data: {
          quoteResponseId: updatedResponse.id,
          shipmentId: updatedShipment ? updatedShipment.id : quoteResponse.shipment ? quoteResponse.shipment.id : null,
          statusBefore: quoteResponse.consentStatus,
          statusAfter: nextStatus,
          actorType,
          actorId: req.user.id,
          note,
        },
      });

      return { updatedResponse, updatedShipment };
    });

    const shipperContact = quoteResponse.quoteRequest.createdBy;
    const vendorContact = quoteResponse.vendor;
    const shipmentId =
      result.updatedShipment?.id || quoteResponse.shipment?.id || null;
    const trackingNumber =
      result.updatedShipment?.trackingNumber || quoteResponse.shipment?.trackingNumber || null;
    const routeLabel = `${quoteResponse.quoteRequest.fromLocation} -> ${quoteResponse.quoteRequest.toLocation}`;
    const vendorName = vendorContact?.name || 'Transporter';
    const statusTitle =
      action === 'ACCEPT'
        ? 'Transporter confirmed booking'
        : 'Transporter declined booking';
    const shipperMessage =
      action === 'ACCEPT'
        ? `Transporter ${vendorName} confirmed the booking for ${routeLabel}.`
        : `Transporter ${vendorName} declined the booking for ${routeLabel}.`;
    const transporterMessage =
      action === 'ACCEPT'
        ? `Booking ${routeLabel} marked as accepted.`
        : `Booking ${routeLabel} marked as declined.`;
    const notificationMetadata = {
      shipmentId,
      quoteResponseId: responseId,
      status: nextStatus,
      note: note || null,
      consentAt: result.updatedResponse.consentAt,
    };

    await prisma.notification.create({
      data: {
        userId: quoteResponse.quoteRequest.createdByUserId,
        title: statusTitle,
        message: shipperMessage,
        type: 'system',
        metadata: notificationMetadata,
      },
    });

    const transporterUsers = await prisma.user.findMany({
      where: {
        vendorId: quoteResponse.vendorId,
        isActive: true,
      },
      select: { id: true },
    });

    await Promise.all(
      transporterUsers.map((user) =>
        prisma.notification.create({
          data: {
            userId: user.id,
            title: statusTitle,
            message: transporterMessage,
        type: 'system',
            metadata: notificationMetadata,
          },
        }),
      ),
    );

    const sideChannelTasks = [];

    if (shipperContact?.email) {
      sideChannelTasks.push(
        sendBookingConsentUpdateEmail({
          to: shipperContact.email,
          recipientName: shipperContact.name,
          statusLabel: action === 'ACCEPT' ? 'Accepted' : 'Declined',
          vendorName,
          fromLocation: quoteResponse.quoteRequest.fromLocation,
          toLocation: quoteResponse.quoteRequest.toLocation,
          note,
          actionedAt: result.updatedResponse.consentAt,
          trackingNumber,
        }).catch((error) => {
          logger.error(
            `Failed to send booking ${action.toLowerCase()} email to ${shipperContact.email} (quote response ${responseId})`,
            error,
          );
        }),
      );
    }

    if (shipperContact?.phone) {
      sideChannelTasks.push(
        sendSMS({
          to: shipperContact.phone,
          template: action === 'ACCEPT'
            ? 'BOOKING_CONFIRMED_SHIPPER'
            : 'BOOKING_DECLINED_SHIPPER',
          context: {
            route: routeLabel,
            transporter: vendorName,
            note,
          },
        }).catch((error) => {
          logger.error(
            `Failed to send booking ${action.toLowerCase()} SMS to ${shipperContact.phone} (quote response ${responseId})`,
            error,
          );
        }),
      );
    }

    if (sideChannelTasks.length) {
      await Promise.all(sideChannelTasks);
    }

    logger.info(
      `Consent ${action} recorded for quote response ${responseId} by user ${req.user.id}`,
    );

    return res.json({
      consent: {
        quoteResponse: result.updatedResponse,
        shipment: result.updatedShipment,
      },
    });
  } catch (error) {
    logger.error('Submit quote response consent error:', error);
    return res.status(500).json({ error: 'Failed to record transporter consent.' });
  }
};

const getQuoteResponseConsentHistory = async (req, res) => {
  try {
    const responseId = parseInt(req.params.responseId, 10);
    if (Number.isNaN(responseId)) {
      return res.status(400).json({ error: 'Invalid quotation response identifier.' });
    }

    const quoteResponse = await prisma.quoteResponse.findUnique({
      where: { id: responseId },
      select: {
        id: true,
        vendorId: true,
        quoteRequest: {
          select: {
            createdByUserId: true,
            createdBy: {
              select: {
                companyId: true,
              },
            },
          },
        },
      },
    });

    if (!quoteResponse) {
      return res.status(404).json({ error: 'Quotation response not found.' });
    }

    const isAdmin = isPlatformAdmin(req.user);
    const isShipper = quoteResponse.quoteRequest && quoteResponse.quoteRequest.createdByUserId === req.user.id;
    const isTransporter = req.user.vendorId && req.user.vendorId === quoteResponse.vendorId;

    const isCompanyManager =
      isCompanyScopedAdmin(req.user) &&
      quoteResponse.quoteRequest?.createdBy?.companyId &&
      quoteResponse.quoteRequest.createdBy.companyId === req.user.companyId;

    if (!isAdmin && !isShipper && !isTransporter && !isCompanyManager) {
      return res.status(403).json({ error: 'You are not authorized to view this consent history.' });
    }

    const logs = await prisma.consentLog.findMany({
      where: { quoteResponseId: responseId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ logs });
  } catch (error) {
    logger.error('Get consent history error:', error);
    return res.status(500).json({ error: 'Failed to load consent history.' });
  }
};

module.exports = {
  createQuoteRequest,
  getQuoteRequests,
  getQuoteRequestById,
  approveQuoteResponse,
  submitQuoteResponseConsent,
  getQuoteResponseConsentHistory,
};











