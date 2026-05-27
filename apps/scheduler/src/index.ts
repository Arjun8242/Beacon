import { Queue } from 'bullmq';
import { redisConnection, QUEUE_NAMES } from 'queue';
import { prisma } from 'database';

const monitorQueue = new Queue(QUEUE_NAMES.MONITOR_QUEUE, {
  connection: redisConnection
});

const runScheduler = async () => {
  console.log('Scheduler running...');
  // Logic to query db and enqueue jobs will go here
};

setInterval(runScheduler, 10000); // run every 10 seconds
