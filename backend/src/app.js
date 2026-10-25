const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config/env');
const apiRoutes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// Security and CORS
const allowedOrigins = [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'];
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // For local prototype development, permit local dev tools
    },
    credentials: true,
  })
);

// Request body parsers with sensible size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Logging
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// API Root greeting and documentation hint
app.get('/', (req, res) => {
  res.json({
    service: 'PayPilot AI Backend',
    version: '1.0.0',
    description: 'Payment Incident Investigation and Reconciliation Platform',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      orders: '/api/orders',
      payments: '/api/payments',
      reconciliation: '/api/reconciliation',
      incidents: '/api/incidents',
      dashboard: '/api/dashboard/stats',
      reports: '/api/reports',
    },
  });
});

// Mount all API endpoints under /api
app.use('/api', apiRoutes);

// Catch 404s
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
