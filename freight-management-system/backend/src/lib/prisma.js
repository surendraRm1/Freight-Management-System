const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

if (!global.__sharedPrisma) {
  global.__sharedPrisma = new PrismaClient();
  if ((process.env.DATABASE_PROVIDER || '').toLowerCase() === 'sqlite') {
    (async () => {
      try {
        await global.__sharedPrisma.$executeRawUnsafe('PRAGMA journal_mode=WAL;');
        await global.__sharedPrisma.$executeRawUnsafe('PRAGMA synchronous=NORMAL;');
        await global.__sharedPrisma.$executeRawUnsafe('PRAGMA busy_timeout=5000;');
        logger.info('SQLite safety pragmas applied (WAL, busy_timeout=5000ms).');
      } catch (error) {
        logger.warn('Failed to apply SQLite pragmas', { error: error?.message });
      }
    })();
  }
}

module.exports = global.__sharedPrisma;
