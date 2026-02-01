require('dotenv/config');
const { PrismaClient, ShipmentStatus, BookingStatus, PaymentStatus, ComplianceStatus } = require('@prisma/client');

const prisma = new PrismaClient();

const pickUser = async () => {
  const preferredEmails = [
    'company.admin@kconexus.com',
    'admin@kcofreight.com',
  ];

  for (const email of preferredEmails) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, companyId: true },
    });
    if (user) return user;
  }

  const fallback = await prisma.user.findFirst({
    select: { id: true, companyId: true },
  });
  if (!fallback) {
    throw new Error('No users found. Run the user seed script first.');
  }
  return fallback;
};

const upsertVendors = async () => {
  const demoVendors = [
    { name: 'Galaxy Logistics', email: 'galaxy@vendors.com', phone: '+91-900000001', baseRate: 18.5, rating: 4.6, speed: 55 },
    { name: 'Rapid Fleet', email: 'rapid@vendors.com', phone: '+91-900000002', baseRate: 22, rating: 4.2, speed: 60 },
    { name: 'Coastal Movers', email: 'coastal@vendors.com', phone: '+91-900000003', baseRate: 20, rating: 4.4, speed: 58 },
  ];

  const vendorIds = [];
  for (const vendor of demoVendors) {
    const record = await prisma.vendor.upsert({
      where: { email: vendor.email },
      update: vendor,
      create: vendor,
    });
    vendorIds.push(record.id);
  }
  return vendorIds;
};

const shipmentPayloads = [
  {
    fromLocation: 'Bangalore, KA',
    toLocation: 'Chennai, TN',
    weight: 250,
    shipmentType: 'STANDARD',
    urgency: 'MEDIUM',
    status: ShipmentStatus.REQUESTED,
    bookingStatus: BookingStatus.PENDING_TRANSPORTER,
    distance: 330,
  },
  {
    fromLocation: 'Hyderabad, TS',
    toLocation: 'Mumbai, MH',
    weight: 540,
    shipmentType: 'EXPRESS',
    urgency: 'HIGH',
    status: ShipmentStatus.ASSIGNED,
    bookingStatus: BookingStatus.CONFIRMED,
    distance: 710,
  },
  {
    fromLocation: 'Delhi, DL',
    toLocation: 'Jaipur, RJ',
    weight: 120,
    shipmentType: 'FRAGILE',
    urgency: 'MEDIUM',
    status: ShipmentStatus.IN_TRANSIT,
    bookingStatus: BookingStatus.CONFIRMED,
    distance: 270,
  },
  {
    fromLocation: 'Pune, MH',
    toLocation: 'Ahmedabad, GJ',
    weight: 890,
    shipmentType: 'STANDARD',
    urgency: 'LOW',
    status: ShipmentStatus.ACCEPTED,
    bookingStatus: BookingStatus.CONFIRMED,
    distance: 660,
  },
  {
    fromLocation: 'Kochi, KL',
    toLocation: 'Coimbatore, TN',
    weight: 320,
    shipmentType: 'HAZARDOUS',
    urgency: 'URGENT',
    status: ShipmentStatus.PICKED_UP,
    bookingStatus: BookingStatus.CONFIRMED,
    distance: 380,
  },
  {
    fromLocation: 'Nagpur, MH',
    toLocation: 'Raipur, CG',
    weight: 150,
    shipmentType: 'STANDARD',
    urgency: 'MEDIUM',
    status: ShipmentStatus.DELIVERED,
    bookingStatus: BookingStatus.CONFIRMED,
    paymentStatus: PaymentStatus.PAID,
    distance: 285,
  },
];

const createShipments = async (user, vendorIds) => {
  const results = [];

  for (let index = 0; index < shipmentPayloads.length; index += 1) {
    const payload = shipmentPayloads[index];
    const trackingNumber = `DEM-${Date.now()}-${index}`;

    const existing = await prisma.shipment.findUnique({
      where: { trackingNumber },
    });
    if (existing) {
      results.push(existing);
      continue;
    }

    const vendorId = vendorIds[index % vendorIds.length];
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + (index + 2));

    const shipment = await prisma.shipment.create({
      data: {
        ...payload,
        trackingNumber,
        userId: user.id,
        companyId: user.companyId,
        selectedVendorId: vendorId,
        assignedDriver: `Driver ${index + 1}`,
        driverPhone: `+91-92000${1000 + index}`,
        cost: payload.distance * (payload.weight / 100) * 12,
        estimatedDelivery,
        complianceStatus: ComplianceStatus.PENDING,
        notes: 'Demo shipment record',
        source: 'demo-seed',
      },
    });
    results.push(shipment);
  }

  return results;
};

const main = async () => {
  const user = await pickUser();
  const vendorIds = await upsertVendors();
  const shipments = await createShipments(user, vendorIds);

  console.log(`Seeded ${shipments.length} demo shipments for company ${user.companyId}`);
};

main()
  .catch((error) => {
    console.error('Demo data seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
