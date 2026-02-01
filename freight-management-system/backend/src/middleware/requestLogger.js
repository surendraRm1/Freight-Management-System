const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const SENSITIVE_FIELDS = [
    'password',
    'token',
    'authorization',
    'secret',
    'creditCard',
    'cvv',
    'apiKey',
    'webhook',
    'gst',
    'gstin',
    'pan',
    'aadhaar',
    'bank',
    'account',
    'ifsc',
];

const sanitize = (obj) => {
    if (!obj) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        return obj.map(sanitize);
    }

    const sanitized = { ...obj };

    for (const key in sanitized) {
        if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
            if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
                sanitized[key] = '***';
            } else if (typeof sanitized[key] === 'object') {
                sanitized[key] = sanitize(sanitized[key]);
            }
        }
    }

    return sanitized;
};

const requestLogger = (req, res, next) => {
    const correlationId = req.headers['x-correlation-id'] || uuidv4();
    req.correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);

    const start = Date.now();

    // Log Request
    logger.info(`Incoming Request: ${req.method} ${req.url}`, {
        correlationId,
        ip: req.ip,
        body: sanitize(req.body),
        query: sanitize(req.query),
        params: sanitize(req.params),
    });

    // Log Response (on finish)
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`Request Completed: ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`, {
            correlationId,
            statusCode: res.statusCode,
            duration,
        });
    });

    next();
};

module.exports = requestLogger;
