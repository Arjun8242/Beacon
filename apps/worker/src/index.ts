import './config/env';
import { Worker } from 'bullmq';
import { redisConnection, QUEUE_NAMES } from 'queue';
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
    await detectIncident({ monitorId, checkStatus: result.checkStatus });

    console.log(JSON.stringify({
      event: 'check_complete',
      monitorId,
      status: result.checkStatus,
      statusCode: result.statusCode,
      responseTime: result.responseTime,
    }));
  },
  {
    connection: redisConnection,
    concurrency: env.WORKER_CONCURRENCY,
  }
);

worker.on('failed', (job, err) => {
  console.error(JSON.stringify({ event: 'job_failed', jobId: job?.id, error: err.message }));
});

console.log(JSON.stringify({ event: 'worker_started', concurrency: env.WORKER_CONCURRENCY }));

