const { PrismaClient } = require('@prisma/client');

if (!global.__sharedPrisma) {
  global.__sharedPrisma = new PrismaClient();
}

module.exports = global.__sharedPrisma;
