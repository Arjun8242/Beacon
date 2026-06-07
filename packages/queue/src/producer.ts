import { Queue } from 'bullmq';
import { redisClient } from './redis';
import { QUEUE_NAMES } from './index';
import { MonitorCheckJob } from 'shared';

export const monitorQueue = new Queue<MonitorCheckJob>(QUEUE_NAMES.MONITOR_CHECKS, {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: true,
  },
});

export async function addCheckJob(payload: MonitorCheckJob) {
  return monitorQueue.add('check', payload, {
    jobId: payload.monitorId,
  });
}
