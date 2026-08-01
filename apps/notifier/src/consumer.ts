import { Worker, Job } from 'bullmq';
import { redisConnection, QUEUE_NAMES } from 'queue';
import { prisma } from 'database';
import type { AlertNotificationJob } from 'shared';
import { processAlertJob } from './processors/alertProcessor';

export { processAlertJob };

export function createAlertConsumer(): Worker<AlertNotificationJob> {
  const worker = new Worker<AlertNotificationJob>(
    QUEUE_NAMES.ALERT_NOTIFICATIONS,
    async (job: Job<AlertNotificationJob>) => {
      await processAlertJob(job.data);
    },
    {
      connection: redisConnection,
    }
  );

  worker.on('failed', async (job, err) => {
    const maxAttempts = job?.opts?.attempts ?? 3;
    const attemptsMade = job?.attemptsMade ?? 0;

    if (job && attemptsMade >= maxAttempts) {
      console.error(
        JSON.stringify({
          event: 'alert_job_dead_letter',
          jobId: job.id,
          incidentId: job.data?.incidentId,
          attemptsMade,
          error: err.message,
        })
      );
      try {
        await prisma.failedJob.create({
          data: {
            jobType: 'EMAIL_NOTIFICATION',
            monitorId: job.data?.monitorId ?? null,
            jobId: job.id ?? null,
            payload: job.data as any,
            errorMessage: err.message,
            attemptsMade,
            failedAt: new Date(),
          },
        });
      } catch (dbErr) {
        console.error('Failed to persist EMAIL_NOTIFICATION to FailedJob table:', dbErr);
      }
    } else {
      console.error(
        JSON.stringify({
          event: 'alert_job_failed',
          jobId: job?.id,
          attemptsMade,
          error: err.message,
        })
      );
    }
  });

  return worker;
}
