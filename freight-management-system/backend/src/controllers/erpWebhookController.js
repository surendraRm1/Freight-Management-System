const prisma = require('../lib/prisma');
const { ShipmentStatus } = require('../constants/prismaEnums');

const normalizeLocation = (details = {}) => {
  if (details.address) return details.address;
  const parts = [details.city, details.state, details.country].filter(Boolean);
  if (parts.length) return parts.join(', ');
  return 'Unknown';
};

const toCoordinate = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const accumulateWeight = (items = []) =>
  items.reduce((total, item) => total + (Number(item?.weight) || 0), 0) || null;

const resolveCompanyActor = async (companyId) => {
  const prioritized = await prisma.user.findFirst({
    where: {
      companyId,
      isActive: true,
      role: { in: ['COMPANY_ADMIN', 'ADMIN'] },
    },
    orderBy: { role: 'asc' },
    select: { id: true },
  });

  if (prioritized) {
    return prioritized.id;
  }

  const fallback = await prisma.user.findFirst({
    where: { companyId, isActive: true },
    select: { id: true },
  });

  return fallback?.id || null;
};

const handleErpWebhook = async (req, res) => {
  const companyId = req.query.company;
  const providedSecret = req.headers['x-secret-key'];

  if (!companyId) {
    return res.status(400).json({ error: 'Missing company query parameter' });
  }

  try {
    const company = await prisma.company.findUnique({
      where: { id: Number(companyId) },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    if (!providedSecret || providedSecret !== company.webhookSecret) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    const {
      customer_name,
      pickup_details,
      delivery_details,
      items,
      erp_order_id,
      shipmentType,
      urgency,
      notes,
    } = req.body;

    const actorUserId = await resolveCompanyActor(company.id);
    if (!actorUserId) {
      return res.status(409).json({
        error: 'No active users found for company. Assign a company administrator before using the ERP webhook.',
      });
    }

    const shipment = await prisma.shipment.create({
      data: {
        userId: actorUserId,
        companyId: company.id,
        fromLocation: normalizeLocation(pickup_details),
        toLocation: normalizeLocation(delivery_details),
        fromLat: toCoordinate(pickup_details?.latitude ?? pickup_details?.lat),
        fromLng: toCoordinate(pickup_details?.longitude ?? pickup_details?.lng),
        toLat: toCoordinate(delivery_details?.latitude ?? delivery_details?.lat),
        toLng: toCoordinate(delivery_details?.longitude ?? delivery_details?.lng),
        weight: accumulateWeight(Array.isArray(items) ? items : []),
        shipmentType: shipmentType || 'STANDARD',
        urgency: urgency || 'MEDIUM',
        notes: notes || `ERP order for ${customer_name || 'customer'}`,
        trackingNumber: erp_order_id || undefined,
        status: ShipmentStatus.REQUESTED,
        source: 'erp',
      },
    });

    return res.status(201).json({ shipment_id: shipment.id });
  } catch (error) {
    console.error('ERP webhook failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  handleErpWebhook,
};
