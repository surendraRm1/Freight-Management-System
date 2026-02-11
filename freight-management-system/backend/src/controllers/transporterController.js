const logger = require('../utils/logger');
const { notifyUserWithEmail, formatDateTime } = require('../services/notificationService');
const prisma = require('../lib/prisma');
const transporterAnalyticsService = require('../services/transporterAnalyticsService');
const syncQueueService = require('../services/syncQueueService');
const {
  QuoteResponseStatus,
  QuoteStatus,
  ShipmentStatus,
  BookingStatus,
  ConsentStatus,
} = require('../constants/prismaEnums');

const hasTransporterPrivileges = (user = {}) =>
  user.role === 'ADMIN' || user.role === 'COMPANY_ADMIN';

const ensureTransporter = (user) => {
  if (hasTransporterPrivileges(user)) {
    return;
  }

  if (!user.vendorId) {
    const error = new Error('Transporter profile not linked to a vendor.');
    error.status = 403;
    throw error;
  }
};

const driverSelectFields = {
  id: true,
  vendorId: true,
  name: true,
  phone: true,
  licenseNumber: true,
  vehicleNumber: true,
  notes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

const toNullableString = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

const getPendingQuoteRequests = async (req, res) => {
  try {
    ensureTransporter(req.user);

    let vendorId = req.user.vendorId;
    if (hasTransporterPrivileges(req.user)) {
      if (req.query.vendorId !== undefined) {
        const parsedVendorId = parseInt(req.query.vendorId, 10);
        if (Number.isNaN(parsedVendorId)) {
          return res.status(400).json({ error: 'Invalid vendor identifier.' });
        }
        vendorId = parsedVendorId;
      } else {
        vendorId = null;
      }
    } else if (!vendorId) {
      const error = new Error('Transporter profile not linked to a vendor.');
      error.status = 403;
      throw error;
    }

    const responseWhere = {
      status: QuoteResponseStatus.PENDING,
    };

    if (vendorId !== null && vendorId !== undefined) {
      responseWhere.vendorId = vendorId;
    }

    const responsesRaw = await prisma.quoteResponse.findMany({
      where: responseWhere,
      include: {
        quoteRequest: {
          include: {
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
      },
      orderBy: { createdAt: 'desc' },
    });

    const responses =
      vendorId === null || vendorId === undefined
        ? responsesRaw
        : responsesRaw.filter((response) => response.vendorId === vendorId);

    return res.json({ responses });
  } catch (error) {
    const status = error.status || 500;
    if (status === 403) {
      return res.status(status).json({ error: error.message });
    }
    logger.error('Get pending quote requests error:', error);
    return res.status(500).json({ error: 'Failed to fetch quotation requests.' });
  }
};

const respondToQuoteRequest = async (req, res) => {
  try {
    ensureTransporter(req.user);

    const responseId = parseInt(req.params.responseId, 10);
    if (Number.isNaN(responseId)) {
      return res.status(400).json({ error: 'Invalid quotation response identifier.' });
    }

    const {
      quotedPrice,
      estimatedDelivery,
      transporterNotes,
      action = 'RESPOND',
    } = req.body;

    const responseRecord = await prisma.quoteResponse.findUnique({
      where: { id: responseId },
      include: {
        quoteRequest: {
          include: {
            responses: true,
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!responseRecord) {
      return res.status(404).json({ error: 'Quotation response not found.' });
    }

    if (!hasTransporterPrivileges(req.user) && responseRecord.vendorId !== req.user.vendorId) {
      return res.status(403).json({ error: 'This quotation does not belong to your transporter profile.' });
    }

    if (responseRecord.status !== QuoteResponseStatus.PENDING) {
      return res.status(400).json({ error: 'Quotation already processed.' });
    }

    const now = new Date();
    let updatePayload;

    if (action === 'DECLINE') {
      updatePayload = {
        status: QuoteResponseStatus.DECLINED,
        transporterNotes,
      };
    } else {
      if (quotedPrice === undefined || quotedPrice === null || !estimatedDelivery) {
        return res.status(400).json({ error: 'Quoted price and estimated delivery date are required.' });
      }

      updatePayload = {
        quotedPrice: parseFloat(quotedPrice),
        estimatedDelivery: new Date(estimatedDelivery),
        transporterNotes,
        status: QuoteResponseStatus.RESPONDED,
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedResponse = await tx.quoteResponse.update({
        where: { id: responseId },
        data: updatePayload,
      });

      const siblingResponses = await tx.quoteResponse.findMany({
        where: { quoteRequestId: responseRecord.quoteRequestId },
      });

      let newStatus = responseRecord.quoteRequest.status;

      if (updatePayload.status === QuoteResponseStatus.RESPONDED) {
        newStatus = QuoteStatus.RESPONDED;
      } else if (siblingResponses.every((item) => {
        if (item.id === responseId) {
          return updatePayload.status === QuoteResponseStatus.DECLINED;
        }
        return item.status === QuoteResponseStatus.DECLINED;
      })) {
        newStatus = QuoteStatus.CLOSED;
      }

      await tx.quoteRequest.update({
        where: { id: responseRecord.quoteRequestId },
        data: { status: newStatus },
      });

      return { updatedResponse };
    });

    await syncQueueService.enqueue({
      entityType: 'QUOTE_RESPONSE',
      entityId: responseId,
      action: action === 'DECLINE' ? 'DECLINE_QUOTE_RESPONSE' : 'RESPOND_QUOTE_RESPONSE',
      payload: {
        responseId,
        quoteRequestId: responseRecord.quoteRequestId,
        action,
        quotedPrice: updatePayload.quotedPrice ?? null,
        estimatedDelivery: updatePayload.estimatedDelivery ?? null,
        transporterNotes,
      },
    });

    const requester = responseRecord.quoteRequest.createdBy;
    const isDeclined = updatePayload.status === QuoteResponseStatus.DECLINED;
    const fallbackAdminEmail = requester
      && (!requester.email || !requester.email.includes('@'))
      && requester.role === 'ADMIN'
      ? 'Sbnlmdsurendra@gamil.com'
      : null;

    const messageText = isDeclined
      ? `A transporter declined the quotation for ${responseRecord.quoteRequest.fromLocation} → ${responseRecord.quoteRequest.toLocation}.`
      : `A transporter responded with pricing for ${responseRecord.quoteRequest.fromLocation} → ${responseRecord.quoteRequest.toLocation}.`;

    await notifyUserWithEmail({
      user: requester,
      title: isDeclined ? 'Quotation declined' : 'New quotation received',
      message: messageText,
      metadata: {
        quoteRequestId: responseRecord.quoteRequestId,
        quoteResponseId: responseId,
        status: updatePayload.status,
        quotedPrice: updatePayload.quotedPrice ?? null,
        estimatedDelivery: updatePayload.estimatedDelivery ?? null,
      },
      emailSubject: isDeclined
        ? 'Transporter declined your quotation request'
        : 'New transporter quotation received',
      emailBody: `
        <p>Hi ${requester?.name || 'there'},</p>
        <p>
          ${isDeclined
            ? 'A transporter has declined to bid on your quotation request'
            : 'A transporter has submitted pricing for your quotation request'}
          covering <strong>${responseRecord.quoteRequest.fromLocation}</strong> to <strong>${responseRecord.quoteRequest.toLocation}</strong>.
        </p>
        ${
          isDeclined
            ? '<p>You can invite other transporters or adjust the request parameters from the portal.</p>'
            : `<ul>
                <li><strong>Quoted price:</strong> INR ${Number(updatePayload.quotedPrice || 0).toLocaleString('en-IN')}</li>
                <li><strong>Estimated delivery:</strong> ${formatDateTime(updatePayload.estimatedDelivery)}</li>
                ${
                  updatePayload.transporterNotes
                    ? `<li><strong>Transporter notes:</strong> ${updatePayload.transporterNotes}</li>`
                    : ''
                }
              </ul>`
        }
        <p>Please review the response in the Freight Management System.</p>
        <p>&ndash; KCO Freight Operations</p>
      `,
      emailOverride: fallbackAdminEmail,
    });

    return res.json({ response: updated.updatedResponse });
  } catch (error) {
    const status = error.status || 500;
    if (status === 403) {
      return res.status(status).json({ error: error.message });
    }
    logger.error('Respond to quotation error:', error);
    return res.status(500).json({ error: 'Failed to submit quotation response.' });
  }
};


const getPendingAssignments = async (req, res) => {
  try {
    ensureTransporter(req.user);

    let vendorId = req.user.vendorId;
    if (hasTransporterPrivileges(req.user)) {
      if (req.query.vendorId !== undefined) {
        const parsedVendorId = parseInt(req.query.vendorId, 10);
        if (Number.isNaN(parsedVendorId)) {
          return res.status(400).json({ error: 'Invalid vendor identifier.' });
        }
        vendorId = parsedVendorId;
      } else {
        vendorId = null;
      }
    }

    const assignmentWhere = {
      OR: [
        { bookingStatus: BookingStatus.PENDING_TRANSPORTER },
        {
          status: {
            in: [ShipmentStatus.REQUESTED, ShipmentStatus.PENDING, ShipmentStatus.ASSIGNED],
          },
        },
        {
          status: ShipmentStatus.ACCEPTED,
          OR: [
            { assignedDriver: null },
            { driverPhone: null },
          ],
        },
      ],
    };

    if (vendorId !== null && vendorId !== undefined) {
      assignmentWhere.selectedVendorId = vendorId;
    }

    const assignments = await prisma.shipment.findMany({
      where: assignmentWhere,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        quoteRequest: true,
        transporterQuote: {
          select: {
            id: true,
            quotedPrice: true,
            estimatedDelivery: true,
            consentStatus: true,
            expiresAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ assignments });
  } catch (error) {
    const status = error.status || 500;
    if (status === 403) {
      return res.status(status).json({ error: error.message });
    }
    logger.error('Get pending assignments error:', error);
    return res.status(500).json({ error: 'Failed to fetch transporter assignments.' });
  }
};

const respondToAssignment = async (req, res) => {
  try {
    ensureTransporter(req.user);

    const shipmentId = parseInt(req.params.shipmentId, 10);
    if (Number.isNaN(shipmentId)) {
      return res.status(400).json({ error: 'Invalid shipment identifier.' });
    }

    const { action, notes } = req.body;
    if (!['ACCEPT', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'Unsupported action supplied.' });
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        user: true,
      },
    });

    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found.' });
    }

    if (!hasTransporterPrivileges(req.user) && shipment.selectedVendorId !== req.user.vendorId) {
      return res.status(403).json({ error: 'Shipment not assigned to your transporter profile.' });
    }

    if (![ShipmentStatus.REQUESTED, ShipmentStatus.PENDING, ShipmentStatus.ASSIGNED].includes(shipment.status)) {
      return res.status(400).json({ error: 'Shipment no longer requires transporter confirmation.' });
    }

    const now = new Date();
    let statusUpdate;
    let historyStatus;

    if (action === 'ACCEPT') {
      statusUpdate = {
        status: ShipmentStatus.ACCEPTED,
        bookingStatus: BookingStatus.CONFIRMED,
        transporterResponseNotes: notes,
        updatedAt: now,
      };
      historyStatus = ShipmentStatus.ACCEPTED;
    } else {
      statusUpdate = {
        status: ShipmentStatus.REJECTED,
        bookingStatus: BookingStatus.DECLINED,
        transporterResponseNotes: notes,
        updatedAt: now,
      };
      historyStatus = ShipmentStatus.REJECTED;
    }

    const updatedShipment = await prisma.shipment.update({
      where: { id: shipmentId },
      data: statusUpdate,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    await prisma.statusHistory.create({
      data: {
        shipmentId,
        status: historyStatus,
        notes,
        updatedBy: req.user.id,
      },
    });

    await prisma.notification.create({
      data: {
        userId: updatedShipment.userId,
        title: action === 'ACCEPT' ? 'Shipment accepted' : 'Shipment declined',
        message:
          action === 'ACCEPT'
            ? `Your transporter confirmed the shipment ${updatedShipment.trackingNumber || shipmentId}.`
            : `Your transporter declined the shipment ${updatedShipment.trackingNumber || shipmentId}.`,
        type: 'system',
      },
    });

    await syncQueueService.enqueue({
      entityType: 'SHIPMENT',
      entityId: shipmentId,
      action: action === 'ACCEPT' ? 'ACCEPT_ASSIGNMENT' : 'REJECT_ASSIGNMENT',
      payload: {
        shipmentId,
        action,
        notes,
      },
    });

    return res.json({ shipment: updatedShipment });
  } catch (error) {
    const status = error.status || 500;
    if (status === 403) {
      return res.status(status).json({ error: error.message });
    }
    logger.error('Respond to assignment error:', error);
    return res.status(500).json({ error: 'Failed to update shipment assignment.' });
  }
};

const updateDriverInfo = async (req, res) => {
  try {
    ensureTransporter(req.user);

    const shipmentId = parseInt(req.params.shipmentId, 10);
    if (Number.isNaN(shipmentId)) {
      return res.status(400).json({ error: 'Invalid shipment identifier.' });
    }

    const {
      driverName,
      driverPhone,
      driverPhotoUrl,
      vehicleType,
      vehicleModel,
      vehicleRegistration,
      driverEta,
    } = req.body;

    if (!driverName || !driverPhone || !vehicleType || !vehicleRegistration) {
      return res.status(400).json({
        error: 'Driver name, phone, vehicle type, and registration number are required.',
      });
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found.' });
    }

    if (!hasTransporterPrivileges(req.user) && shipment.selectedVendorId !== req.user.vendorId) {
      return res.status(403).json({ error: 'Shipment not assigned to your transporter profile.' });
    }

    const updatePayload = {
      assignedDriver: driverName,
      driverPhone,
      driverPhotoUrl: driverPhotoUrl || null,
      vehicleType: vehicleType || null,
      vehicleModel: vehicleModel || null,
      vehicleRegistration: vehicleRegistration || null,
      driverEta: driverEta ? new Date(driverEta) : shipment.driverEta,
    };

    const updated = await prisma.shipment.update({
      where: { id: shipmentId },
      data: updatePayload,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await prisma.statusHistory.create({
      data: {
        shipmentId,
        status: updated.status,
        notes: `Driver assigned: ${driverName} (${vehicleRegistration})`,
        updatedBy: req.user.id,
      },
    });

    await notifyUserWithEmail({
      user: updated.user,
      title: 'Driver assigned to your shipment',
      message: `Driver ${driverName} will operate vehicle ${vehicleRegistration}.`,
      metadata: {
        shipmentId,
        driverName,
        driverPhone,
        vehicleRegistration,
        driverEta: updated.driverEta,
      },
      emailSubject: 'Driver assigned for your shipment',
      emailBody: `
        <p>Hi ${updated.user.name || 'there'},</p>
        <p>Your transporter has assigned a driver for shipment ${
          updated.trackingNumber || shipmentId
        }.</p>
        <ul>
          <li><strong>Driver:</strong> ${driverName} (${driverPhone})</li>
          <li><strong>Vehicle:</strong> ${vehicleType || 'N/A'} ${
        vehicleModel ? `– ${vehicleModel}` : ''
      } (${vehicleRegistration})</li>
          ${
            updated.driverEta
              ? `<li><strong>ETA:</strong> ${formatDateTime(updated.driverEta)}</li>`
              : ''
          }
        </ul>
        <p>You can view live updates from the shipment dashboard.</p>
        <p>– KCO Freight Operations</p>
      `,
    });

    await syncQueueService.enqueue({
      entityType: 'SHIPMENT',
      entityId: shipmentId,
      action: 'UPDATE_DRIVER_INFO',
      payload: {
        shipmentId,
        driverName,
        driverPhone,
        driverEta,
      },
    });

    return res.json({ shipment: updated });
  } catch (error) {
    const status = error.status || 500;
    if (status === 403) {
      return res.status(status).json({ error: error.message });
    }
    logger.error('Update driver info error:', error);
    return res.status(500).json({ error: 'Failed to update driver information.' });
  }
};

const updateDriverLocation = async (req, res) => {
  try {
    ensureTransporter(req.user);

    const shipmentId = parseInt(req.params.shipmentId, 10);
    if (Number.isNaN(shipmentId)) {
      return res.status(400).json({ error: 'Invalid shipment identifier.' });
    }

    const { latitude, longitude, eta, locationLabel } = req.body;
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Latitude and longitude are required.' });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'Latitude and longitude must be numeric.' });
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found.' });
    }

    if (!hasTransporterPrivileges(req.user) && shipment.selectedVendorId !== req.user.vendorId) {
      return res.status(403).json({ error: 'Shipment not assigned to your transporter profile.' });
    }

    const updatePayload = {
      driverLastKnownLat: lat,
      driverLastKnownLng: lng,
      driverLocationUpdatedAt: new Date(),
    };

    if (eta) {
      const etaDate = new Date(eta);
      if (Number.isNaN(etaDate.getTime())) {
        return res.status(400).json({ error: 'Invalid ETA supplied.' });
      }
      updatePayload.driverEta = etaDate;
    }

    const updated = await prisma.shipment.update({
      where: { id: shipmentId },
      data: updatePayload,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await prisma.statusHistory.create({
      data: {
        shipmentId,
        status: updated.status,
        notes: `Driver location update${
          locationLabel ? `: ${locationLabel}` : ` (lat ${lat.toFixed(4)}, lng ${lng.toFixed(4)})`
        }`,
        updatedBy: req.user.id,
      },
    });

    await notifyUserWithEmail({
      user: updated.user,
      title: 'Driver location updated',
      message: `Driver is now near ${locationLabel || `(${lat.toFixed(2)}, ${lng.toFixed(2)})`}.`,
      metadata: {
        shipmentId,
        latitude: lat,
        longitude: lng,
        driverEta: updated.driverEta,
      },
    });

    await syncQueueService.enqueue({
      entityType: 'SHIPMENT',
      entityId: shipmentId,
      action: 'UPDATE_DRIVER_LOCATION',
      payload: {
        shipmentId,
        latitude: lat,
        longitude: lng,
        eta: eta || null,
      },
    });

    return res.json({ shipment: updated });
  } catch (error) {
    const status = error.status || 500;
    if (status === 403) {
      return res.status(status).json({ error: error.message });
    }
    logger.error('Update driver location error:', error);
    return res.status(500).json({ error: 'Failed to update driver location.' });
  }
};

const getDrivers = async (req, res) => {
  try {
    ensureTransporter(req.user);
    let vendorId = req.user.vendorId;
    if (hasTransporterPrivileges(req.user)) {
      if (req.query.vendorId !== undefined) {
        const parsedVendorId = parseInt(req.query.vendorId, 10);
        if (Number.isNaN(parsedVendorId)) {
          return res.status(400).json({ error: 'Invalid vendor identifier.' });
        }
        vendorId = parsedVendorId;
      } else {
        vendorId = null;
      }
    } else if (!vendorId) {
      return res.status(403).json({ error: 'Transporter profile not linked to a vendor.' });
    }

    const driverWhere = {};
    if (vendorId !== null && vendorId !== undefined) {
      driverWhere.vendorId = vendorId;
    }

    const drivers = await prisma.driver.findMany({
      where: driverWhere,
      select: driverSelectFields,
      orderBy: { name: 'asc' },
    });

    return res.json({ drivers });
  } catch (error) {
    logger.error('Get drivers error:', error);
    return res.status(500).json({ error: 'Failed to load driver directory.' });
  }
};

const createDriver = async (req, res) => {
  try {
    ensureTransporter(req.user);
    const vendorId = req.user.vendorId;
    if (!vendorId) {
      return res.status(403).json({ error: 'Transporter profile not linked to a vendor.' });
    }

    const { name, phone, licenseNumber, vehicleNumber, notes, isActive } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Driver name is required.' });
    }

    const driver = await prisma.driver.create({
      data: {
        vendorId,
        name: String(name).trim(),
        phone: toNullableString(phone) ?? null,
        licenseNumber: toNullableString(licenseNumber) ?? null,
        vehicleNumber: toNullableString(vehicleNumber) ?? null,
        notes: toNullableString(notes) ?? null,
        isActive: isActive === undefined ? true : Boolean(isActive),
      },
      select: driverSelectFields,
    });

    await syncQueueService.enqueue({
      entityType: 'DRIVER',
      entityId: driver.id,
      action: 'CREATE_DRIVER',
      payload: {
        vendorId,
        driver,
      },
    });

    return res.status(201).json({ driver });
  } catch (error) {
    logger.error('Create driver error:', error);
    return res.status(500).json({ error: 'Failed to create driver record.' });
  }
};

const updateDriver = async (req, res) => {
  try {
    ensureTransporter(req.user);
    const vendorId = req.user.vendorId;
    if (!vendorId) {
      return res.status(403).json({ error: 'Transporter profile not linked to a vendor.' });
    }

    const driverId = parseInt(req.params.driverId, 10);
    if (Number.isNaN(driverId)) {
      return res.status(400).json({ error: 'Invalid driver identifier supplied.' });
    }

    const existing = await prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true, vendorId: true },
    });

    if (!existing || existing.vendorId !== vendorId) {
      return res.status(404).json({ error: 'Driver not found.' });
    }

    const { name, phone, licenseNumber, vehicleNumber, notes, isActive } = req.body;
    const updateData = {};

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ error: 'Driver name cannot be empty.' });
      }
      updateData.name = String(name).trim();
    }

    const phoneValue = toNullableString(phone);
    if (phone !== undefined) {
      updateData.phone = phoneValue ?? null;
    }

    const licenseValue = toNullableString(licenseNumber);
    if (licenseNumber !== undefined) {
      updateData.licenseNumber = licenseValue ?? null;
    }

    const vehicleValue = toNullableString(vehicleNumber);
    if (vehicleNumber !== undefined) {
      updateData.vehicleNumber = vehicleValue ?? null;
    }

    const notesValue = toNullableString(notes);
    if (notes !== undefined) {
      updateData.notes = notesValue ?? null;
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    if (!Object.keys(updateData).length) {
      return res.status(400).json({ error: 'No driver fields supplied for update.' });
    }

    const driver = await prisma.driver.update({
      where: { id: driverId },
      data: updateData,
      select: driverSelectFields,
    });

    await syncQueueService.enqueue({
      entityType: 'DRIVER',
      entityId: driver.id,
      action: 'UPDATE_DRIVER',
      payload: {
        driverId,
        changes: updateData,
      },
    });

    return res.json({ driver });
  } catch (error) {
    logger.error('Update driver error:', error);
    return res.status(500).json({ error: 'Failed to update driver record.' });
  }
};

const deleteDriver = async (req, res) => {
  try {
    ensureTransporter(req.user);
    const vendorId = req.user.vendorId;
    if (!vendorId) {
      return res.status(403).json({ error: 'Transporter profile not linked to a vendor.' });
    }

    const driverId = parseInt(req.params.driverId, 10);
    if (Number.isNaN(driverId)) {
      return res.status(400).json({ error: 'Invalid driver identifier supplied.' });
    }

    const existing = await prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true, vendorId: true, isActive: true },
    });

    if (!existing || existing.vendorId !== vendorId) {
      return res.status(404).json({ error: 'Driver not found.' });
    }

    if (!existing.isActive) {
      return res.json({ driver: existing });
    }

    const driver = await prisma.driver.update({
      where: { id: driverId },
      data: { isActive: false },
      select: driverSelectFields,
    });

    await syncQueueService.enqueue({
      entityType: 'DRIVER',
      entityId: driver.id,
      action: 'ARCHIVE_DRIVER',
      payload: { driverId },
    });

    return res.json({ driver });
  } catch (error) {
    logger.error('Delete driver error:', error);
    return res.status(500).json({ error: 'Failed to archive driver record.' });
  }
};

const getTransporterOverview = async (req, res) => {
  try {
    let vendorId = req.user?.vendorId ?? null;
    if (!vendorId && hasTransporterPrivileges(req.user)) {
      const override = parseInt(req.query.vendorId, 10);
      if (!Number.isNaN(override)) {
        vendorId = override;
      }
    }

    if (!vendorId) {
      return res.status(403).json({ error: 'Transporter context missing' });
    }

    const overview = await transporterAnalyticsService.getTransporterOverview(vendorId);
    return res.json(overview);
  } catch (error) {
    logger.error('Transporter overview error', error);
    return res.status(500).json({ error: 'Failed to load transporter analytics overview.' });
  }
};

module.exports = {
  getPendingQuoteRequests,
  respondToQuoteRequest,
  getPendingAssignments,
  respondToAssignment,
  updateDriverInfo,
  updateDriverLocation,
  getDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
  getTransporterOverview,
};
