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
const freightRoutes = require('./routes/freight');
const quoteRoutes = require('./routes/quotes');
const transporterRoutes = require('./routes/transporter');
const assistantRoutes = require('./routes/assistant');
const userRoutes = require('./routes/userRoutes');
const complianceRoutes = require('./routes/compliance');
const { authenticateToken } = require('./middleware/auth');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 5000;

const rawOrigins = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = rawOrigins
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
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
app.use('/api/v1/super-admin', superAdminRoutes);
app.use('/api/v1/freight', freightRoutes);
app.use('/api/v1/quotes', quoteRoutes);
app.use('/api/v1/transporter', transporterRoutes);
app.use('/api/v1/assistant', assistantRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/compliance', complianceRoutes);
app.use(webhookRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  // background schedulers intentionally omitted in SaaS starter
});

module.exports = app;
