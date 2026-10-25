const mongoose = require('mongoose');
const config = require('./env');

/**
 * Connect to MongoDB with error handling and retry guidance
 */
async function connectDB() {
  try {
    const conn = await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    console.error('[MongoDB] Please ensure MongoDB is running locally on port 27017 or check your MONGODB_URI in .env');
    // We throw so the caller knows the state, but we don't crash the entire test runner if tests are offline
    throw error;
  }
}

async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('[MongoDB] Disconnected successfully');
  } catch (error) {
    console.error(`[MongoDB] Error disconnecting: ${error.message}`);
  }
}

module.exports = { connectDB, disconnectDB };
