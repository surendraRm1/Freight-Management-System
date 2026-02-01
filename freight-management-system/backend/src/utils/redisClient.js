const { createClient } = require('redis');
const logger = require('./logger');

const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
    logger.warn('Redis Client Error', err);
});

redisClient.on('connect', () => {
    logger.info('Redis Client Connected');
});

// Graceful startup
(async () => {
    try {
        await redisClient.connect();
    } catch (err) {
        logger.warn('Failed to connect to Redis on startup. Caching will be disabled.');
    }
})();

module.exports = redisClient;
