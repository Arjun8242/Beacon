// Global error handlers to prevent silent crashes in production
process.on('unhandledRejection', (err) => {
  console.error('Worker Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Worker Uncaught Exception:', err);
  process.exit(1);
});

import './config/env';
import { Worker } from 'bullmq';
import { redisConnection, QUEUE_NAMES } from 'queue';
import { prisma } from 'database';
import type { MonitorCheckJob } from 'shared';
import { env } from './config/env';
import { runCheck } from './processor/checkRunner';
import { persistResult } from './processor/resultPersist';
import { detectIncident } from './processor/incidentDetect';

const worker = new Worker<MonitorCheckJob>(
  QUEUE_NAMES.MONITOR_CHECKS,
  async (job) => {
    const { monitorId, url } = job.data;

    const result = await runCheck(url);
    await persistResult({ monitorId, ...result });
    await detectIncident({ monitorId, checkStatus: result.checkStatus, failureReason: result.failureReason });

    console.log(JSON.stringify({
      event: 'check_complete',
      monitorId,
      status: result.checkStatus,
      statusCode: result.statusCode,
      responseTime: result.responseTime,
      failureReason: result.failureReason,
    }));
  },
  {
    connection: redisConnection,
    concurrency: env.WORKER_CONCURRENCY,
  }
);

worker.on('failed', async (job, err) => {
  const maxAttempts = job?.opts?.attempts ?? 3;
  const attemptsMade = job?.attemptsMade ?? 0;

  if (job && attemptsMade >= maxAttempts) {
    console.error(JSON.stringify({ event: 'job_dead_letter', jobId: job.id, monitorId: job.data?.monitorId, attemptsMade, error: err.message }));
    try {
      await prisma.failedJob.create({
        data: {
          jobType: 'MONITOR_CHECK',
          monitorId: job.data?.monitorId ?? null,
          jobId: job.id ?? null,
          payload: job.data as any,
          errorMessage: err.message,
          attemptsMade,
          failedAt: new Date(),
        },
      });
    } catch (dbErr) {
      console.error('Failed to persist MONITOR_CHECK to FailedJob table:', dbErr);
    }
  } else {
    console.error(JSON.stringify({ event: 'job_failed', jobId: job?.id, attemptsMade, error: err.message }));
  }
});

console.log(JSON.stringify({ event: 'worker_started', concurrency: env.WORKER_CONCURRENCY }));

