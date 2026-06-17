// Global error handlers to prevent silent crashes in production
process.on('unhandledRejection', (err) => {
  console.error('Scheduler Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Scheduler Uncaught Exception:', err);
  process.exit(1);
});

import './config/env'; // validates env vars on startup
import './scheduler';   // registers the cron job
import './jobs/dataRetention'; // registers the 30-day data retention cleanup job
