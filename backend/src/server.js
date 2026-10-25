const app = require('./app');
const config = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');

let server;

async function startServer() {
  try {
    // Attempt database connection
    try {
      await connectDB();
    } catch (dbErr) {
      console.warn('[Warning] Running backend without active MongoDB connection or in degraded mode.');
    }

    server = app.listen(config.port, () => {
      console.log(`===================================================`);
      console.log(`🚀 PayPilot AI Backend running on port ${config.port}`);
      console.log(`📡 Health Check: http://localhost:${config.port}/api/health`);
      console.log(`🌐 Allowed Client: ${config.clientUrl}`);
      console.log(`===================================================`);
    });

    const shutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
      if (server) {
        server.close(async () => {
          await disconnectDB();
          console.log('[Server] Process terminated safely.');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error(`[Server Fatal Error] ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
