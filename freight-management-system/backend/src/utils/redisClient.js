const logger = require('./logger');

const CACHE_DRIVER = (process.env.CACHE_DRIVER || 'redis').toLowerCase();

let redisClient;
let redisReady = false;

if (CACHE_DRIVER === 'redis') {
  const { createClient } = require('redis');

  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    disableOfflineQueue: true,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 100, 3_000),
    },
  });

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
} else {
  const store = new Map();
  const ttlHandles = new Map();

  const clearKey = (key) => {
    if (ttlHandles.has(key)) {
      clearTimeout(ttlHandles.get(key));
      ttlHandles.delete(key);
    }
    store.delete(key);
  };

  redisClient = {
    isOpen: true,
    async connect() {
      redisReady = true;
      logger.info('In-memory cache ready (CACHE_DRIVER=memory)');
      return redisClient;
    },
    async quit() {
      store.clear();
      ttlHandles.forEach((handle) => clearTimeout(handle));
      ttlHandles.clear();
      redisReady = false;
    },
    async get(key) {
      return store.get(key) ?? null;
    },
    async setEx(key, ttlSeconds, value) {
      clearKey(key);
      store.set(key, value);
      const handle = setTimeout(() => {
        store.delete(key);
        ttlHandles.delete(key);
      }, ttlSeconds * 1000);
      ttlHandles.set(key, handle);
    },
    async del(key) {
      clearKey(key);
    },
    on() {
      // Memory driver does not emit events.
    },
  };

  redisReady = true;
}

const connectRedis = async () => {
  if (redisClient.isOpen) {
    return redisClient;
  }

  try {
    await redisClient.connect();
  } catch (err) {
    logger.warn('Failed to connect to cache backend, continuing without cache.', { error: err.message });
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
