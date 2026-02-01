const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  console.log('Creating admin user...');
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@freight.com' },
    update: {
      passwordHash: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
      phone: '+1-555-0100',
      approvalStatus: 'APPROVED',
      isActive: true,
    },
    create: {
      email: 'admin@freight.com',
      passwordHash: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
      phone: '+1-555-0100',
      approvalStatus: 'APPROVED',
      isActive: true,
    }
  });
  console.log('✅ Admin user created');

  // Create sample users
  console.log('Creating sample users...');
  const user1Password = await bcrypt.hash('user123', 10);
  const user1 = await prisma.user.upsert({
    where: { email: 'user@freight.com' },
    update: {
      passwordHash: user1Password,
      name: 'Regular User',
      role: 'USER',
      phone: '+1-555-0200',
      approvalStatus: 'APPROVED',
      isActive: true,
    },
    create: {
      email: 'user@freight.com',
      passwordHash: user1Password,
      name: 'Regular User',
      role: 'USER',
      phone: '+1-555-0200',
      approvalStatus: 'APPROVED',
      isActive: true,
    }
  });

  const agentPassword = await bcrypt.hash('agent123', 10);
  const agent = await prisma.user.upsert({
    where: { email: 'agent@freight.com' },
    update: {
      passwordHash: agentPassword,
      name: 'Agent User',
      role: 'AGENT',
      phone: '+1-555-0300',
      approvalStatus: 'APPROVED',
      isActive: true,
    },
    create: {
      email: 'agent@freight.com',
      passwordHash: agentPassword,
      name: 'Agent User',
      role: 'AGENT',
      phone: '+1-555-0300',
      approvalStatus: 'APPROVED',
      isActive: true,
    }
  });
  console.log('✅ Sample users created');

  // Create sample vendors
  console.log('Creating sample vendors...');
  const vendors = await Promise.all([
    prisma.vendor.create({
      data: {
        name: 'FastShip Logistics',
        email: 'contact@fastship.com',
        phone: '+1-555-1001',
        baseRate: 12.5,
        rating: 4.5,
        speed: 70,
        isActive: true
      }
    }),
    prisma.vendor.create({
      data: {
        name: 'Reliable Transport Co.',
        email: 'info@reliable.com',
        phone: '+1-555-1002',
        baseRate: 10.0,
        rating: 4.2,
        speed: 60,
        isActive: true
      }
    }),
    prisma.vendor.create({
      data: {
        name: 'Express Freight Services',
        email: 'hello@express.com',
        phone: '+1-555-1003',
        baseRate: 15.0,
        rating: 4.8,
        speed: 80,
        isActive: true
      }
    }),
    prisma.vendor.create({
      data: {
        name: 'Economy Shippers',
        email: 'sales@economy.com',
        phone: '+1-555-1004',
        baseRate: 8.5,
        rating: 3.9,
        speed: 50,
        isActive: true
      }
    })
  ]);

  // Link seeded agent user to the first vendor for transporter access
  const primaryVendor = vendors[0];
  if (primaryVendor) {
    await prisma.user.update({
      where: { email: 'agent@freight.com' },
      data: { vendorId: primaryVendor.id },
    });
    console.log('Linked agent@freight.com to vendor', primaryVendor.name);

    const existingDrivers = await prisma.driver.count({
      where: { vendorId: primaryVendor.id },
    });
    if (existingDrivers === 0) {
      console.log('Creating sample drivers...');
      await prisma.driver.createMany({
        data: [
          {
            vendorId: primaryVendor.id,
            name: 'Ramesh Kumar',
            phone: '+91-9876543210',
            licenseNumber: 'DL-0420120012345',
            vehicleNumber: 'KA-01 AB 1234',
            notes: 'Prefers Bangalore -> Chennai express runs.',
          },
          {
            vendorId: primaryVendor.id,
            name: 'Sujatha Rao',
            phone: '+91-9865321470',
            licenseNumber: 'MH-0520150087654',
            vehicleNumber: 'MH-12 XY 5678',
            notes: 'Hazmat certified - assign for chemical loads.',
          },
        ],
      });
    }
  }
  console.log('Sample vendors created');

  // Create sample shipment
  console.log('Creating sample shipment...');
  let shipment = await prisma.shipment.findUnique({
    where: { trackingNumber: 'FMS1001' }
  });

  if (!shipment) {
    shipment = await prisma.shipment.create({
      data: {
        userId: user1.id,
        fromLocation: 'Mumbai, Maharashtra',
        toLocation: 'Delhi, Delhi',
        fromLat: 19.0760,
        fromLng: 72.8777,
        toLat: 28.7041,
        toLng: 77.1025,
        weight: 500,
        shipmentType: 'STANDARD',
        urgency: 'MEDIUM',
        status: 'IN_TRANSIT',
        selectedVendorId: vendors[0].id,
        cost: 8500,
        distance: 1400,
        estimatedDelivery: new Date('2025-10-15T10:00:00Z'),
        trackingNumber: 'FMS1001',
        assignedDriver: 'Rajesh Kumar',
        driverPhone: '+91-9876543210',
        pickupTime: new Date('2025-10-08T08:00:00Z'),
        notes: 'Handle with care'
      }
    });

    // Create status history for the shipment
    await prisma.statusHistory.createMany({
      data: [
        {
          shipmentId: shipment.id,
          status: 'PENDING',
          notes: 'Shipment created and awaiting assignment',
          updatedBy: user1.id,
          timestamp: new Date('2025-10-08T06:00:00Z')
        },
        {
          shipmentId: shipment.id,
          status: 'ASSIGNED',
          notes: 'Driver assigned: Rajesh Kumar',
          updatedBy: agent.id,
          timestamp: new Date('2025-10-08T07:00:00Z')
        },
        {
          shipmentId: shipment.id,
          status: 'PICKED_UP',
          notes: 'Package picked up from Mumbai warehouse',
          updatedBy: agent.id,
          location: 'Mumbai Warehouse',
          latitude: 19.0760,
          longitude: 72.8777,
          timestamp: new Date('2025-10-08T08:30:00Z')
        },
        {
          shipmentId: shipment.id,
          status: 'IN_TRANSIT',
          notes: 'Package in transit, on highway to Delhi',
          updatedBy: agent.id,
          location: 'National Highway 48',
          latitude: 23.0225,
          longitude: 72.5714,
          timestamp: new Date('2025-10-09T06:00:00Z')
        }
      ]
    });

    // Create sample notifications
    console.log('Creating sample notifications...');
    await prisma.notification.create({
      data: {
        userId: user1.id,
        title: 'Shipment Update',
        message: 'Your shipment FMS1001 is now in transit',
        type: 'shipment_update',
        isRead: false
      }
    });
    console.log('✅ Sample shipment created with status history');
    console.log('✅ Sample notifications created');
  } else {
    console.log('ℹ️ Sample shipment already exists, skipping shipment/history/notification creation.');
  }

  // Create audit log entries
  console.log('Creating audit log entries...');
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user1.id,
      details: { email: user1.email }
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: user1.id,
      action: 'SHIPMENT_CREATED',
      entityType: 'Shipment',
      entityId: shipment.id,
      details: { trackingNumber: shipment.trackingNumber }
    }
  });
  console.log('✅ Audit log entries created');

  // --- Presentation Dummy Data ---
  console.log('✨ Generating presentation dummy data...');

  // 1. Dummy Vendors
  const dummyVendorsData = [
    { name: 'Speedy Logistics', email: 'contact@speedy.com', phone: '+1-555-2001', baseRate: 11.0, rating: 4.3, speed: 75 },
    { name: 'Global Freight', email: 'info@globalfreight.com', phone: '+1-555-2002', baseRate: 14.5, rating: 4.7, speed: 85 },
    { name: 'Metro Movers', email: 'sales@metromovers.com', phone: '+1-555-2003', baseRate: 9.5, rating: 4.0, speed: 60 },
    { name: 'QuickHaul', email: 'support@quickhaul.com', phone: '+1-555-2004', baseRate: 13.0, rating: 4.6, speed: 78 },
    { name: 'TransLink', email: 'hello@translink.com', phone: '+1-555-2005', baseRate: 10.5, rating: 4.1, speed: 65 }
  ];

  const dummyVendors = [];
  for (const v of dummyVendorsData) {
    const vendor = await prisma.vendor.create({
      data: { ...v, isActive: true }
    });
    dummyVendors.push(vendor);
  }
  console.log('   - Created 5 extra vendors');

  // 2. Dummy Drivers (assign to random vendors)
  const dummyDriversData = [
    { name: 'Vikram Singh', phone: '+91-9876500001', licenseNumber: 'DL-01', vehicleNumber: 'DL-01 AB 1111' },
    { name: 'Amit Patel', phone: '+91-9876500002', licenseNumber: 'GJ-01', vehicleNumber: 'GJ-01 CD 2222' },
    { name: 'Rahul Sharma', phone: '+91-9876500003', licenseNumber: 'MH-02', vehicleNumber: 'MH-02 EF 3333' },
    { name: 'Deepak Verma', phone: '+91-9876500004', licenseNumber: 'UP-32', vehicleNumber: 'UP-32 GH 4444' },
    { name: 'Suresh Reddy', phone: '+91-9876500005', licenseNumber: 'KA-05', vehicleNumber: 'KA-05 IJ 5555' }
  ];

  for (let i = 0; i < dummyDriversData.length; i++) {
    const vendor = dummyVendors[i % dummyVendors.length];
    await prisma.driver.create({
      data: {
        ...dummyDriversData[i],
        vendorId: vendor.id,
        notes: 'Presentation dummy driver'
      }
    });
  }
  console.log('   - Created 5 extra drivers');

  // 3. Dummy Shipments
  const routes = [
    { from: 'Pune, Maharashtra', to: 'Bangalore, Karnataka', dist: 840 },
    { from: 'Chennai, Tamil Nadu', to: 'Hyderabad, Telangana', dist: 630 },
    { from: 'Kolkata, West Bengal', to: 'Bhubaneswar, Odisha', dist: 440 },
    { from: 'Jaipur, Rajasthan', to: 'Ahmedabad, Gujarat', dist: 680 },
    { from: 'Lucknow, UP', to: 'Patna, Bihar', dist: 530 }
  ];

  const statuses = ['PENDING', 'IN_TRANSIT', 'DELIVERED', 'PENDING_QUOTE', 'CANCELLED'];

  for (let i = 0; i < 5; i++) {
    const route = routes[i];
    const status = statuses[i];
    await prisma.shipment.create({
      data: {
        userId: user1.id,
        trackingNumber: `DEMO-${100 + i}`,
        fromLocation: route.from,
        toLocation: route.to,
        distance: route.dist,
        status: status,
        cost: 5000 + (i * 1000),
        weight: 100 + (i * 50),
        urgency: i % 2 === 0 ? 'HIGH' : 'MEDIUM',
        shipmentType: 'STANDARD',
        estimatedDelivery: new Date(Date.now() + 86400000 * (i + 1)), // +1 to +5 days
        companyId: admin.companyId || null // Ensure visibility if company exists
      }
    });
  }
  console.log('   - Created 5 extra shipments');

  // 4. Dummy Quote Requests
  for (let i = 0; i < 5; i++) {
    const route = routes[(i + 2) % 5]; // Shift routes
    await prisma.quoteRequest.create({
      data: {
        createdByUserId: user1.id,
        fromLocation: route.from,
        toLocation: route.to,
        weight: 200 + (i * 100),
        status: 'PENDING',
        urgency: 'LOW',
        shipmentType: 'EXPRESS'
      }
    });
  }
  console.log('   - Created 5 extra quote requests');
  console.log('✨ Presentation data generation complete.');

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📋 Login Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Admin:');
  console.log('  Email: admin@freight.com');
  console.log('  Password: admin123');
  console.log('\nRegular User:');
  console.log('  Email: user@freight.com');
  console.log('  Password: user123');
  console.log('\nAgent:');
  console.log('  Email: agent@freight.com');
  console.log('  Password: agent123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

