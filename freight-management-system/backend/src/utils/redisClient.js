const { createClient } = require('redis');
const logger = require('./logger');

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  disableOfflineQueue: true,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 100, 3_000),
  },
});

let redisReady = false;

redisClient.on('error', (err) => {
  redisReady = false;
  logger.warn('Redis Client Error', err);
});

redisClient.on('ready', () => {
  redisReady = true;
  logger.info('Redis cache connected');
});

redisClient.on('end', () => {
  redisReady = false;
  logger.warn('Redis connection closed');
});

const connectRedis = async () => {
  if (redisClient.isOpen) {
    return redisClient;
  }

  try {
    await redisClient.connect();
  } catch (err) {
    logger.warn('Failed to connect to Redis. Continuing without cache.', { error: err.message });
  }
  return redisClient;
};

// Attempt connection on startup but don't block the app if it fails.
connectRedis();

const isRedisReady = () => redisReady && redisClient.isOpen;

module.exports = {
  redisClient,
  isRedisReady,
  connectRedis,
};
