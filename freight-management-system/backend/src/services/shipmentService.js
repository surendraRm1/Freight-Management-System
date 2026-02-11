const shipmentRepository = require('../repositories/shipmentRepository');
const AppError = require('../utils/AppError');
const { redisClient, isRedisReady } = require('../utils/redisClient');
const logger = require('../utils/logger');
const syncQueueService = require('./syncQueueService');
const { ShipmentStatus } = require('../constants/prismaEnums');

const CACHE_TTL = 3600; // 1 hour
const buildCacheKey = (companyId) => `shipments:company:${companyId}:v2`;

const buildCompanyShipmentScope = (companyId) => ({
    OR: [
        { companyId },
        {
            AND: [
                { companyId: null },
                { user: { companyId } },
            ],
        },
    ],
});

class ShipmentService {
    async createShipment(data, user) {
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
        } = data;

        const companyId = user?.companyId;

        if (!companyId) {
            throw new AppError('Company context missing. Contact support.', 403);
        }

        if (!fromLocation || !toLocation) {
            throw new AppError('fromLocation and toLocation are required', 400);
        }

        const shipmentData = {
            userId: user.id,
            companyId,
            fromLocation,
            toLocation,
            fromLat: fromLat ? Number(fromLat) : null,
            fromLng: fromLng ? Number(fromLng) : null,
            toLat: toLat ? Number(toLat) : null,
            toLng: toLng ? Number(toLng) : null,
            weight: weight ? Number(weight) : null,
            shipmentType: shipmentType || 'STANDARD',
            urgency: urgency || 'MEDIUM',
            notes: notes || null,
            status: ShipmentStatus.PENDING,
            source: 'manual',
            assignedToId: user.id,
        };

        const newShipment = await shipmentRepository.create(shipmentData);

        // Invalidate cache
        if (isRedisReady()) {
            try {
                await redisClient.del(buildCacheKey(companyId));
            } catch (err) {
                logger.error('Failed to invalidate cache', err);
            }
        }

        await syncQueueService.enqueue({
            entityType: 'SHIPMENT',
            entityId: newShipment.id,
            action: 'CREATE_SHIPMENT',
            payload: shipmentData,
        });

        return newShipment;
    }

    async getAllShipments(companyId) {
        if (!companyId) {
            throw new AppError('Company context missing. Contact support.', 403);
        }

        const cacheKey = buildCacheKey(companyId);

        if (isRedisReady()) {
            try {
                const cachedData = await redisClient.get(cacheKey);
                if (cachedData) {
                    logger.info(`Cache HIT for ${cacheKey}`);
                    return JSON.parse(cachedData);
                }
            } catch (err) {
                logger.warn('Redis cache read error', err);
            }
        }

        const shipments = await shipmentRepository.findMany(
            buildCompanyShipmentScope(companyId),
            {
                include: {
                    vendor: {
                        select: { id: true, name: true },
                    },
                    payments: {
                        select: { id: true, status: true },
                    },
                },
            }
        );

        if (isRedisReady()) {
            try {
                await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(shipments));
                logger.info(`Cache SET for ${cacheKey}`);
            } catch (err) {
                logger.warn('Failed to set cache', err);
            }
        }

        return shipments;
    }

    async uploadPOD(shipmentId, companyId, podData) {
        if (!companyId) {
            throw new AppError('Company context missing. Contact support.', 403);
        }

        const { podUrl, podNotes } = podData;

        if (!shipmentId) {
            throw new AppError('Invalid shipment identifier', 400);
        }

        if (!podUrl) {
            throw new AppError('podUrl is required', 400);
        }

        try {
            const updatedShipment = await shipmentRepository.updateWhere(
                { id: shipmentId, companyId },
                {
                    podStatus: 'Collected',
                    podUrl,
                    podNotes,
                    status: ShipmentStatus.DELIVERED,
                    deliveryTime: new Date(),
                }
            );

            await syncQueueService.enqueue({
                entityType: 'SHIPMENT',
                entityId: updatedShipment.id,
                action: 'UPLOAD_POD',
                payload: { shipmentId, podUrl, podNotes },
            });

            // Invalidate cache
            if (isRedisReady()) {
                try {
                await redisClient.del(buildCacheKey(companyId));
                } catch (err) {
                    logger.error('Failed to invalidate cache', err);
                }
            }

            return updatedShipment;
        } catch (error) {
            // P2025 is Prisma's "Record to update not found."
            if (error.code === 'P2025') {
                throw new AppError('Shipment not found', 404);
            }
            throw error;
        }
    }
}

module.exports = new ShipmentService();
