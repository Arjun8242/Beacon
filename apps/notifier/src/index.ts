// Global error handlers to prevent silent crashes in production
process.on('unhandledRejection', (err) => {
  console.error('Notifier Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Notifier Uncaught Exception:', err);
  process.exit(1);
});

import './config/env';
import { createAlertConsumer } from './consumer';

const worker = createAlertConsumer();

console.log(
  JSON.stringify({
    event: 'notifier_started',
    queue: 'ALERT_NOTIFICATIONS',
  })
);

// Graceful shutdown handling
const shutdown = async (signal: string) => {
  console.log(JSON.stringify({ event: 'notifier_shutting_down', signal }));
  try {
    await worker.close();
    console.log(JSON.stringify({ event: 'notifier_stopped_successfully' }));
    process.exit(0);
  } catch (err) {
    console.error('Error closing notifier worker during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
