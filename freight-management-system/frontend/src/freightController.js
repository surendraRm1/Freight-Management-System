const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// Calculate route distance using OSRM
const calculateDistance = async (fromLat, fromLng, toLat, toLng) => {
  try {
    const url = `http://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
    const response = await axios.get(url);
    
    if (response.data.routes && response.data.routes.length > 0) {
      // Distance in meters, convert to km
      return response.data.routes[0].distance / 1000;
    }
    
    // Fallback to Haversine formula
    return calculateHaversineDistance(fromLat, fromLng, toLat, toLng);
  } catch (error) {
    logger.error('OSRM API error:', error.message);
    // Fallback to Haversine formula
    return calculateHaversineDistance(fromLat, fromLng, toLat, toLng);
  }
};

// Haversine formula for distance calculation (fallback)
const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Calculate freight cost
const calculateFreightCost = (distance, weight, shipmentType, urgency, baseRate) => {
  let cost = baseRate * distance;
  
  // Weight multiplier
  if (weight > 1000) {
    cost *= 1.5;
  } else if (weight > 500) {
    cost *= 1.3;
  } else if (weight > 100) {
    cost *= 1.1;
  }
  
  // Shipment type multiplier
  const typeMultiplier = {
    STANDARD: 1.0,
    EXPRESS: 1.5,
    FRAGILE: 1.3,
    HAZARDOUS: 1.8
  };
  cost *= typeMultiplier[shipmentType] || 1.0;
  
  // Urgency multiplier
  const urgencyMultiplier = {
    LOW: 0.9,
    MEDIUM: 1.0,
    HIGH: 1.3,
    URGENT: 1.6
  };
  cost *= urgencyMultiplier[urgency] || 1.0;
  
  return Math.round(cost * 100) / 100; // Round to 2 decimal places
};

// Estimate delivery date
const estimateDeliveryDate = (distance, speed, urgency, shipmentType) => {
  // Base travel time in hours
  let travelTime = distance / speed;
  
  // Add processing time based on urgency
  const processingHours = {
    LOW: 48,
    MEDIUM: 24,
    HIGH: 12,
    URGENT: 4
  };
  travelTime += processingHours[urgency] || 24;
  
  // Add extra time for special shipment types
  if (shipmentType === 'FRAGILE') {
    travelTime *= 1.2;
  } else if (shipmentType === 'HAZARDOUS') {
    travelTime *= 1.3;
  }
  
  const deliveryDate = new Date();
  deliveryDate.setHours(deliveryDate.getHours() + travelTime);
  
  return deliveryDate;
};

// Calculate freight and get vendor quotes
const calculateFreight = async (req, res) => {
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
      urgency 
    } = req.body;

    // Validate required fields
    if (!fromLocation || !toLocation || !weight || !shipmentType || !urgency) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }

    // Validate coordinates
    if (!fromLat || !fromLng || !toLat || !toLng) {
      return res.status(400).json({ 
        error: 'Location coordinates are required' 
      });
    }

    // Calculate distance
    const distance = await calculateDistance(fromLat, fromLng, toLat, toLng);

    // Get active vendors
    const vendors = await prisma.vendor.findMany({
      where: { isActive: true }
    });

    if (vendors.length === 0) {
      return res.status(404).json({ 
        error: 'No vendors available' 
      });
    }

    // Calculate quotes for each vendor
    const quotes = vendors.map(vendor => {
      const cost = calculateFreightCost(
        distance, 
        weight, 
        shipmentType, 
        urgency, 
        vendor.baseRate || 10
      );

      const estimatedDelivery = estimateDeliveryDate(
        distance,
        vendor.speed || 60,
        urgency,
        shipmentType
      );

      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        cost,
        distance: Math.round(distance * 100) / 100,
        estimatedDelivery,
        rating: vendor.rating || 0,
        // Score for ranking (lower is better)
        score: cost * 0.7 + (5 - vendor.rating) * 100
      };
    });

    // Sort by score (best deals first)
    quotes.sort((a, b) => a.score - b.score);

    logger.info(`Freight calculated: ${fromLocation} to ${toLocation}, Distance: ${distance}km`);

    res.json({
      fromLocation,
      toLocation,
      distance: Math.round(distance * 100) / 100,
      weight,
      shipmentType,
      urgency,
      quotes: quotes.map(({ score, ...quote }) => quote) // Remove score from response
    });

  } catch (error) {
    logger.error('Freight calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate freight' });
  }
};

// Get vendor list
const getVendors = async (req, res) => {
  try {
    const vendors = await prisma.vendor.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        rating: true,
        baseRate: true
      }
    });

    res.json({ vendors });
  } catch (error) {
    logger.error('Get vendors error:', error);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
};

module.exports = {
  calculateFreight,
  getVendors
};