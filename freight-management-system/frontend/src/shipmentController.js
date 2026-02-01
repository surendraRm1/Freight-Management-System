const { PrismaClient } = require('@prisma/client');
const { customAlphabet } = require('nanoid');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// Generate a unique tracking number
const nanoid = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 10);

// Create a new shipment
const createShipment = async (req, res) => {
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
      selectedVendorId,
      cost,
      distance,
      estimatedDelivery,
    } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!fromLocation || !toLocation || !weight || !shipmentType || !urgency || !selectedVendorId || !cost || !distance || !estimatedDelivery) {
      return res.status(400).json({ error: 'Missing required fields for shipment creation' });
    }

    const trackingNumber = `FR${nanoid()}`;

    const shipment = await prisma.shipment.create({
      data: {
        fromLocation,
        toLocation,
        fromLat,
        fromLng,
        toLat,
        toLng,
        weight,
        shipmentType,
        urgency,
        cost,
        distance,
        estimatedDelivery: new Date(estimatedDelivery),
        trackingNumber,
        status: 'PENDING',
        userId,
        vendorId: selectedVendorId,
        statusHistory: {
          create: {
            status: 'PENDING',
            notes: 'Shipment created and awaiting assignment.',
            updatedBy: userId,
          },
        },
      },
      include: {
        vendor: true,
      },
    });

    logger.info(`Shipment created: ${shipment.trackingNumber} by user ${userId}`);
    res.status(201).json({ message: 'Shipment created successfully', shipment });

  } catch (error) {
    logger.error('Create shipment error:', error);
    res.status(500).json({ error: 'Failed to create shipment' });
  }
};

// Get all shipments for the logged-in user (or all for admin)
const getShipments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const where = {};

    if (req.user.role !== 'ADMIN') {
      where.userId = req.user.id;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { trackingNumber: { contains: search, mode: 'insensitive' } },
        { fromLocation: { contains: search, mode: 'insensitive' } },
        { toLocation: { contains: search, mode: 'insensitive' } },
      ];
    }

    const shipments = await prisma.shipment.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: { select: { name: true } },
      },
    });

    const totalShipments = await prisma.shipment.count({ where });

    res.json({
      shipments,
      totalPages: Math.ceil(totalShipments / Number(limit)),
      currentPage: Number(page),
      totalShipments,
    });

  } catch (error) {
    logger.error('Get shipments error:', error);
    res.status(500).json({ error: 'Failed to fetch shipments' });
  }
};

// Get a single shipment by ID
const getShipmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const where = { id };

    if (req.user.role !== 'ADMIN') {
      where.userId = req.user.id;
    }

    const shipment = await prisma.shipment.findFirst({
      where,
      include: {
        vendor: true,
        statusHistory: {
          orderBy: { timestamp: 'desc' },
          include: { updatedByUser: { select: { name: true } } },
        },
      },
    });

    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    res.json({ shipment });

  } catch (error) {
    logger.error('Get shipment by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch shipment details' });
  }
};

// Update shipment status (for admins/agents)
const updateShipmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, location } = req.body;

    const shipment = await prisma.shipment.update({
      where: { id },
      data: {
        status,
        statusHistory: {
          create: {
            status,
            notes,
            location,
            updatedBy: req.user.id,
          },
        },
      },
    });

    logger.info(`Shipment ${shipment.trackingNumber} status updated to ${status} by user ${req.user.id}`);
    res.json({ message: 'Shipment status updated successfully', shipment });

  } catch (error) {
    logger.error('Update shipment status error:', error);
    res.status(500).json({ error: 'Failed to update shipment status' });
  }
};

// Get public tracking info
const getShipmentTracking = async (req, res) => {
  try {
    const { trackingNumber } = req.params;
    const shipment = await prisma.shipment.findUnique({
      where: { trackingNumber },
      include: {
        statusHistory: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!shipment) {
      return res.status(404).json({ error: 'Tracking number not found' });
    }

    res.json({ shipment });
  } catch (error) {
    logger.error('Get shipment tracking error:', error);
    res.status(500).json({ error: 'Failed to fetch tracking information' });
  }
};

module.exports = {
  createShipment,
  getShipments,
  getShipmentById,
  updateShipmentStatus,
  getShipmentTracking,
};