const prisma = require('../lib/prisma');
const { BookingStatus, QuoteStatus, ShipmentStatus } = require('../constants/prismaEnums');

const DEFAULT_LIMIT = 20;

const toStartOfDay = (input) => {
  const date = new Date(input);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
};

const toEndOfDay = (input) => {
  const date = new Date(input);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }
  date.setHours(23, 59, 59, 999);
  return date;
};

const normaliseLimit = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, 100);
};

const normaliseRoleName = (role) => String(role || '').trim().toUpperCase();

const denyAccess = (where) => {
  // Assumes IDs are positive integers; impossible filter produces zero rows.
  Object.assign(where, { id: -1 });
  return where;
};

const applyShipmentAccessFilters = (where, context = {}) => {
  const role = normaliseRoleName(context.role);
  if (!role || role === 'SUPER_ADMIN') {
    return where;
  }

  if (['ADMIN', 'COMPANY_ADMIN', 'FINANCE_APPROVER', 'OPERATIONS'].includes(role)) {
    if (context.companyId) {
      where.companyId = context.companyId;
    } else {
      denyAccess(where);
    }
    return where;
  }

  if (role === 'AGENT') {
    if (context.companyId) {
      where.companyId = context.companyId;
    } else {
      denyAccess(where);
    }
    return where;
  }

  if (role === 'USER') {
    if (context.companyId) {
      where.companyId = context.companyId;
    } else if (context.userId) {
      where.userId = context.userId;
    } else {
      denyAccess(where);
    }
    return where;
  }

  if (['TRANSPORTER', 'VENDOR'].includes(role)) {
    if (context.vendorId) {
      where.selectedVendorId = context.vendorId;
    } else {
      denyAccess(where);
    }
    return where;
  }

  return where;
};

const mergeCreatedByFilter = (where, companyId) => {
  const base = where.createdBy || {};
  where.createdBy = { ...base, companyId };
};

const applyQuoteAccessFilters = (where, context = {}) => {
  const role = normaliseRoleName(context.role);
  if (!role || role === 'SUPER_ADMIN') {
    return where;
  }

  if (['ADMIN', 'COMPANY_ADMIN', 'FINANCE_APPROVER', 'OPERATIONS'].includes(role)) {
    if (context.companyId) {
      mergeCreatedByFilter(where, context.companyId);
    } else {
      denyAccess(where);
    }
    return where;
  }

  if (role === 'AGENT') {
    if (context.companyId) {
      mergeCreatedByFilter(where, context.companyId);
    } else {
      denyAccess(where);
    }
    return where;
  }

  if (role === 'USER') {
    if (context.companyId) {
      mergeCreatedByFilter(where, context.companyId);
    } else if (context.userId) {
      where.createdByUserId = context.userId;
    } else {
      denyAccess(where);
    }
    return where;
  }

  if (['TRANSPORTER', 'VENDOR'].includes(role)) {
    if (context.vendorId) {
      where.responses = {
        ...(where.responses || {}),
        some: {
          ...(where.responses?.some || {}),
          vendorId: context.vendorId,
        },
      };
    } else {
      denyAccess(where);
    }
    return where;
  }

  return where;
};

const canAccessShipment = (shipment, context = {}) => {
  if (!shipment) {
    return false;
  }
  const role = normaliseRoleName(context.role);
  if (!role || role === 'SUPER_ADMIN') {
    return true;
  }

  if (['ADMIN', 'COMPANY_ADMIN', 'FINANCE_APPROVER', 'OPERATIONS', 'AGENT'].includes(role)) {
    if (!context.companyId) {
      return false;
    }
    return shipment.companyId === context.companyId;
  }

  if (role === 'USER') {
    if (context.companyId) {
      return shipment.companyId === context.companyId;
    }
    if (context.userId) {
      return shipment.userId === context.userId;
    }
    return false;
  }

  if (['TRANSPORTER', 'VENDOR'].includes(role)) {
    if (!context.vendorId) {
      return false;
    }
    return shipment.selectedVendorId === context.vendorId;
  }

  return false;
};

const SHIPMENT_STATUS_KEYWORDS = {
  PENDING: [ShipmentStatus.PENDING, ShipmentStatus.PENDING_QUOTE, ShipmentStatus.REQUESTED],
  ACTIVE: [
    ShipmentStatus.QUOTE_SUBMITTED,
    ShipmentStatus.QUOTE_APPROVED,
    ShipmentStatus.ASSIGNED,
    ShipmentStatus.ACCEPTED,
    ShipmentStatus.PICKED_UP,
    ShipmentStatus.IN_TRANSIT,
  ],
  ATTENTION: [
    ShipmentStatus.REQUESTED,
    ShipmentStatus.ASSIGNED,
    ShipmentStatus.ACCEPTED,
    ShipmentStatus.PICKED_UP,
  ],
  TRANSIT: [ShipmentStatus.PICKED_UP, ShipmentStatus.IN_TRANSIT],
  IN_TRANSIT: [ShipmentStatus.PICKED_UP, ShipmentStatus.IN_TRANSIT],
  DELIVERED: [ShipmentStatus.DELIVERED],
  COMPLETED: [ShipmentStatus.DELIVERED],
  CANCELLED: [ShipmentStatus.CANCELLED],
  REJECTED: [ShipmentStatus.REJECTED],
};

const QUOTE_STATUS_KEYWORDS = {
  PENDING: [QuoteStatus.PENDING],
  ACTIVE: [QuoteStatus.RESPONDED, QuoteStatus.APPROVED],
  RESPONDED: [QuoteStatus.RESPONDED],
  APPROVED: [QuoteStatus.APPROVED],
  CLOSED: [QuoteStatus.CLOSED],
};

const mapShipmentStatuses = (token) => {
  if (!token) return null;
  const keyword = String(token).toUpperCase().replace(/[^A-Z_]/g, '_');
  if (ShipmentStatus[keyword]) {
    return [ShipmentStatus[keyword]];
  }
  if (SHIPMENT_STATUS_KEYWORDS[keyword]) {
    return SHIPMENT_STATUS_KEYWORDS[keyword];
  }
  return null;
};

const mapQuoteStatuses = (token) => {
  if (!token) return null;
  const keyword = String(token).toUpperCase().replace(/[^A-Z_]/g, '_');
  if (QuoteStatus[keyword]) {
    return [QuoteStatus[keyword]];
  }
  if (QUOTE_STATUS_KEYWORDS[keyword]) {
    return QUOTE_STATUS_KEYWORDS[keyword];
  }
  return null;
};

const parseDateFilter = (value) => {
  if (!value) {
    return {};
  }

  const token = String(value).trim().toLowerCase();
  const today = new Date();

  if (token === 'today') {
    const from = toStartOfDay(today);
    const to = toEndOfDay(today);
    return { from, to };
  }

  if (token === 'yesterday') {
    const date = new Date(today);
    date.setDate(date.getDate() - 1);
    const from = toStartOfDay(date);
    const to = toEndOfDay(date);
    return { from, to };
  }

  const parsed = new Date(token);
  if (!Number.isNaN(parsed.valueOf())) {
    const from = toStartOfDay(parsed);
    const to = toEndOfDay(parsed);
    return { from, to };
  }

  return {};
};

const buildShipmentWhere = (filters = {}, context = {}) => {
  const where = {};
  const statuses = mapShipmentStatuses(filters.status);
  if (statuses && statuses.length === 1) {
    [where.status] = statuses;
  } else if (statuses && statuses.length > 1) {
    where.status = { in: statuses };
  }

  if (filters.vendorId) {
    const vendorId = Number.parseInt(filters.vendorId, 10);
    if (!Number.isNaN(vendorId)) {
      where.selectedVendorId = vendorId;
    }
  }

  if (filters.search) {
    const term = String(filters.search).trim();
    if (term.length) {
      where.OR = [
        { trackingNumber: { contains: term, mode: 'insensitive' } },
        { fromLocation: { contains: term, mode: 'insensitive' } },
        { toLocation: { contains: term, mode: 'insensitive' } },
        { notes: { contains: term, mode: 'insensitive' } },
      ];
    }
  }

  if (filters.date) {
    const { from, to } = parseDateFilter(filters.date);
    if (from && to) {
      where.createdAt = { gte: from, lte: to };
    }
  }

  return applyShipmentAccessFilters(where, context);
};

const buildQuoteWhere = (filters = {}, context = {}) => {
  const where = {};

  const statuses = mapQuoteStatuses(filters.status);
  if (statuses && statuses.length === 1) {
    [where.status] = statuses;
  } else if (statuses && statuses.length > 1) {
    where.status = { in: statuses };
  }

  if (filters.vendorId) {
    const vendorId = Number.parseInt(filters.vendorId, 10);
    if (!Number.isNaN(vendorId)) {
      where.responses = {
        some: {
          vendorId,
        },
      };
    }
  }

  if (filters.search) {
    const term = String(filters.search).trim();
    if (term.length) {
      where.OR = [
        { fromLocation: { contains: term, mode: 'insensitive' } },
        { toLocation: { contains: term, mode: 'insensitive' } },
        { notes: { contains: term, mode: 'insensitive' } },
      ];
    }
  }

  return applyQuoteAccessFilters(where, context);
};

const formatShipmentSelect = () => ({
  id: true,
  trackingNumber: true,
  fromLocation: true,
  toLocation: true,
  status: true,
  complianceStatus: true,
  bookingStatus: true,
  paymentStatus: true,
  estimatedDelivery: true,
  assignedDriver: true,
  driverPhone: true,
  vehicleRegistration: true,
  cost: true,
  updatedAt: true,
  deliveryTime: true,
  transporterResponseNotes: true,
  vendor: {
    select: {
      id: true,
      name: true,
      rating: true,
    },
  },
});

async function get_shipments(filters = {}, context = {}) {
  const where = buildShipmentWhere(filters, context);
  const limit = normaliseLimit(filters.limit);

  const data = await prisma.shipment.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: formatShipmentSelect(),
  });

  return { data };
}

async function get_quote_requests(filters = {}, context = {}) {
  const where = buildQuoteWhere(filters, context);
  const limit = normaliseLimit(filters.limit);

  const data = await prisma.quoteRequest.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      fromLocation: true,
      toLocation: true,
      status: true,
      urgency: true,
      weight: true,
      createdAt: true,
      updatedAt: true,
      notes: true,
      responses: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          quotedPrice: true,
          transporterNotes: true,
          estimatedDelivery: true,
          consentStatus: true,
          consentAt: true,
          expiresAt: true,
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      shipment: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  return { data };
}

async function get_transporter_assignments(filters = {}, context = {}) {
  const limit = normaliseLimit(filters.limit);
  const statusFilter = mapShipmentStatuses(filters.status);

  const baseConditions = [
    { bookingStatus: BookingStatus.PENDING_TRANSPORTER },
    {
      status: {
        in: [
          ShipmentStatus.REQUESTED,
          ShipmentStatus.PENDING,
          ShipmentStatus.ASSIGNED,
          ShipmentStatus.ACCEPTED,
        ],
      },
    },
    {
      status: ShipmentStatus.ACCEPTED,
      OR: [
        { assignedDriver: null },
        { driverPhone: null },
        { vehicleRegistration: null },
      ],
    },
  ];

  const where = {};

  if (filters.vendorId) {
    const vendorId = Number.parseInt(filters.vendorId, 10);
    if (!Number.isNaN(vendorId)) {
      where.selectedVendorId = vendorId;
    }
  }

  if (statusFilter && statusFilter.length) {
    where.status = statusFilter.length === 1 ? statusFilter[0] : { in: statusFilter };
  }

  applyShipmentAccessFilters(where, context);

  const data = await prisma.shipment.findMany({
    where: {
      ...where,
      OR: baseConditions,
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      ...formatShipmentSelect(),
      transporterQuote: {
        select: {
          id: true,
          quotedPrice: true,
          transporterNotes: true,
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return { data };
}

async function update_shipment(identifier, payload = {}, context = {}) {
  if (!identifier) {
    throw new Error('Shipment identifier is required.');
  }

  const where = {};
  if (/^\d+$/.test(String(identifier))) {
    where.id = Number.parseInt(identifier, 10);
  } else {
    where.trackingNumber = String(identifier).trim();
  }

  const existing = await prisma.shipment.findUnique({
    where,
    select: {
      id: true,
      status: true,
      companyId: true,
      userId: true,
      selectedVendorId: true,
    },
  });

  if (!existing) {
    throw new Error('Shipment not found.');
  }

  if (!canAccessShipment(existing, context)) {
    throw new Error('Permission denied for this shipment.');
  }

  const updates = {};
  if (payload.status) {
    const [status] = mapShipmentStatuses(payload.status) || [];
    if (!status) {
      throw new Error(`Unsupported shipment status: ${payload.status}`);
    }
    updates.status = status;
  }

  if (payload.notes) {
    updates.notes = payload.notes;
  }

  if (payload.assignedDriver !== undefined) {
    updates.assignedDriver = payload.assignedDriver;
  }

  if (payload.driverPhone !== undefined) {
    updates.driverPhone = payload.driverPhone;
  }

  if (payload.vehicleRegistration !== undefined) {
    updates.vehicleRegistration = payload.vehicleRegistration;
  }

  if (payload.transporterResponseNotes !== undefined) {
    updates.transporterResponseNotes = payload.transporterResponseNotes;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('No update fields were provided for the shipment.');
  }

  const updated = await prisma.shipment.update({
    where,
    data: updates,
    select: formatShipmentSelect(),
  });

  if (updates.status && updates.status !== existing.status && context.userId) {
    await prisma.statusHistory.create({
      data: {
        shipmentId: updated.id,
        status: updates.status,
        notes: payload.notes || null,
        updatedBy: context.userId,
      },
    });
  }

  return updated;
}

class OperationsManager {
  async getShipments(filters, context = {}) {
    try {
      const result = await get_shipments(filters, context);
      return result.data || [];
    } catch (error) {
      throw new Error(`Failed to fetch shipments: ${error.message}`);
    }
  }

  async getQuoteRequests(filters, context = {}) {
    try {
      const result = await get_quote_requests(filters, context);
      return result.data || [];
    } catch (error) {
      throw new Error(`Failed to fetch quotes: ${error.message}`);
    }
  }

  async getTransporterAssignments(filters, context = {}) {
    try {
      const result = await get_transporter_assignments(filters, context);
      return result.data || [];
    } catch (error) {
      throw new Error(`Failed to fetch assignments: ${error.message}`);
    }
  }

  async updateShipment(params, context = {}) {
    if (!params.shipment_id) {
      throw new Error('Shipment ID required. Usage: "update shipment SHIP-123 with status delivered"');
    }

    const payload = this.parseUpdatePayload(params);

    try {
      const updated = await update_shipment(params.shipment_id, payload, context);
      return {
        message: `Shipment ${params.shipment_id} updated successfully`,
        data: updated,
      };
    } catch (error) {
      throw new Error(`Failed to update shipment: ${error.message}`);
    }
  }

  parseUpdatePayload(params) {
    const payload = {};

    if (params.status) payload.status = params.status;
    if (params.notes !== undefined) payload.notes = params.notes;
    if (params.assignedDriver !== undefined) payload.assignedDriver = params.assignedDriver;
    if (params.driverPhone !== undefined) payload.driverPhone = params.driverPhone;
    if (params.vehicleRegistration !== undefined) {
      payload.vehicleRegistration = params.vehicleRegistration;
    }
    if (params.transporterResponseNotes !== undefined) {
      payload.transporterResponseNotes = params.transporterResponseNotes;
    }

    return payload;
  }
}

module.exports = OperationsManager;
module.exports.tools = {
  get_shipments,
  get_quote_requests,
  get_transporter_assignments,
  update_shipment,
};
