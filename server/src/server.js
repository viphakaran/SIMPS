import env from './config/env.js';
import app from './app.js';
import { closePool } from './config/db.js';
import { initScheduler, stopScheduler } from './scheduler.js';

const PORT = env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`SIMPS Server running on port ${PORT} in ${env.NODE_ENV} mode`);
  initScheduler();
});

async function shutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  stopScheduler();
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      await closePool();
      console.log('Database connections closed.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
