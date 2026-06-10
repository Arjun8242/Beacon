import { Queue } from 'bullmq';
import { redisConnection } from './redis';
import { QUEUE_NAMES } from './constants';
import { MonitorCheckJob } from 'shared';

export const monitorQueue = new Queue<MonitorCheckJob>(QUEUE_NAMES.MONITOR_CHECKS, {
  connection: redisConnection,
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
