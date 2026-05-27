import { Worker } from 'bullmq';
import { redisConnection, QUEUE_NAMES } from 'queue';
import { prisma } from 'database';

const worker = new Worker(
  QUEUE_NAMES.MONITOR_QUEUE,
  async (job) => {
    console.log(`Processing job: ${job.id}`);
  },
  { connection: redisConnection }
);

console.log('Worker started, listening for jobs...');
