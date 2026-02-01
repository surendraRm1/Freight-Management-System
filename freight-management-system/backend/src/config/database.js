const prisma = require('../lib/prisma');
const logger = require('../utils/logger');

let shutdownRegistered = false;

const getPrismaClient = () => {
  registerShutdownHooks();
  return prisma;
};

const registerShutdownHooks = () => {
  if (shutdownRegistered) return;
  shutdownRegistered = true;

  const gracefulShutdown = async (signal) => {
    try {
      await prisma.$disconnect();
      logger.info('Prisma client disconnected gracefully');
    } catch (error) {
      logger.error('Error during Prisma disconnect', error);
    } finally {
      if (signal) {
        logger.info(`Process exiting after ${signal}`);
        process.exit(0);
      }
    }
  };

  process.on('beforeExit', () => gracefulShutdown());
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
};

module.exports = {
  prisma: getPrismaClient(),
  getPrismaClient
};
