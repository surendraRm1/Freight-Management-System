const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/authRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const reportRoutes = require('./routes/reportRoutes');
const companyAdminRoutes = require('./routes/companyAdminRoutes');
const legacyAdminRoutes = require('./routes/admin');
const companyRoutes = require('./routes/companyRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const financeRoutes = require('./routes/financeRoutes');
const freightRoutes = require('./routes/freight');
const quoteRoutes = require('./routes/quotes');
const transporterRoutes = require('./routes/transporter');
const assistantRoutes = require('./routes/assistant');
const userRoutes = require('./routes/userRoutes');
const complianceRoutes = require('./routes/compliance');
const syncRoutes = require('./routes/syncRoutes');
const { authenticateToken } = require('./middleware/auth');
const operationsRoutes = require('./routes/operationsRoutes');
const { startReportDigestScheduler } = require('./services/reportDigestService');
const syncQueueWorker = require('./services/syncQueueWorker');
const mdnsService = require('./services/mdnsService');
const syncReconciliationService = require('./services/syncReconciliationService');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
app.set('etag', false);
const PORT = process.env.PORT || 5000;

const rawOrigins = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = rawOrigins
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check allowed origins list
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow Local Network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    const isLocalNetwork = /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
      /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
      /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
      /^http:\/\/localhost(:\d+)?$/.test(origin);

    if (isLocalNetwork) {
      return callback(null, true);
    }

    logger.warn(`Blocked CORS request from origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

// Security middleware
app.use(helmet());
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Logging
// const logger = require('./utils/logger'); // Already imported above
const requestLogger = require('./middleware/requestLogger');

app.use(requestLogger);

// Static file serving for local storage
const storageService = require('./services/storageService');
// Check if using local provider
if (!process.env.STORAGE_PROVIDER || process.env.STORAGE_PROVIDER === 'local') {
  app.use('/uploads', (req, res, next) => {
    const currentRoot = storageService.localRoot;
    express.static(currentRoot)(req, res, next);
  });
  // logger.info(`Serving static files from ${storageService.localRoot}`);
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/shipments', shipmentRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/admin', (req, res, next) => {
  authenticateToken(req, res, (err) => {
    if (err) return;
    if (req.user?.role === 'COMPANY_ADMIN') {
      return companyAdminRoutes(req, res, next);
    }
    return legacyAdminRoutes(req, res, next);
  });
});
app.use('/api/v1/company', companyRoutes);
app.use('/api/v1/finance', financeRoutes);
app.use('/api/v1/operations', operationsRoutes);
app.use('/api/v1/super-admin', superAdminRoutes);
app.use('/api/v1/freight', freightRoutes);
app.use('/api/v1/quotes', quoteRoutes);
app.use('/api/v1/transporter', transporterRoutes);
app.use('/api/v1/assistant', assistantRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/compliance', complianceRoutes);
app.use('/api/v1/sync', syncRoutes);
app.use(webhookRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  // background schedulers intentionally omitted in SaaS starter
  startReportDigestScheduler();
  syncQueueWorker.start();
  mdnsService.start();
  syncReconciliationService.start();
});

module.exports = app;

const gracefulShutdown = () => {
  syncQueueWorker.stop?.();
  mdnsService.stop();
  syncReconciliationService.stop();
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
