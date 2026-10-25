const path = require('path');
const dotenv = require('dotenv');

// Load .env file from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/paypilot_ai',
  jwtSecret: process.env.JWT_SECRET || 'super_secret_paypilot_jwt_signing_key_for_local_dev',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
  stalePendingHours: parseInt(process.env.STALE_PENDING_HOURS, 10) || 24,
};

module.exports = config;
