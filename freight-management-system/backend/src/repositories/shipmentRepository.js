const prisma = require('../lib/prisma');
const { ShipmentStatus } = require('../constants/prismaEnums');

class ShipmentRepository {
    async create(data) {
        return await prisma.shipment.create({
            data,
        });
    }

    async findMany(where, options = {}) {
        return await prisma.shipment.findMany({
            where,
            orderBy: options.orderBy || { createdAt: 'desc' },
            include: options.include,
        });
    }

    async findById(id) {
        return await prisma.shipment.findUnique({
            where: { id },
        });
    }

    async update(id, data) {
        return await prisma.shipment.update({
            where: { id },
            data,
        });
    }

    async updateWhere(where, data) {
        return await prisma.shipment.update({
            where,
            data,
        });
    }
}

module.exports = new ShipmentRepository();
