import { Worker, Job } from 'bullmq';
import { redisConnection, QUEUE_NAMES } from 'queue';
import { prisma } from 'database';
import type { AlertNotificationJob } from 'shared';
import { processAlertJob } from './processors/alertProcessor';

export { processAlertJob };

/**
 * Handles a failed BullMQ job. On final retry exhaustion, persists
 * the job to the FailedJob table. On intermediate failures, logs
 * retry information.
 */
export async function handleFailedJob(
  job: { id?: string; attemptsMade?: number; opts?: { attempts?: number }; data?: any } | null | undefined,
  err: Error
): Promise<void> {
  if (!job) return;

  const maxAttempts = job.opts?.attempts ?? 3;
  const attemptsMade = job.attemptsMade ?? 0;

  if (attemptsMade >= maxAttempts) {
    // Dead letter: final retry exhausted
    console.error(
      JSON.stringify({
        event: 'alert_job_dead_letter',
        jobId: job.id,
        incidentId: job.data?.incidentId,
        eventType: job.data?.eventType,
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
      console.error('Failed to persist FailedJob row:', dbErr);
    }
  } else {
    // Intermediate failure — BullMQ will retry
    console.error(
      JSON.stringify({
        event: 'alert_job_retry',
        jobId: job.id,
        incidentId: job.data?.incidentId,
        attemptsMade,
        maxAttempts,
        error: err.message,
      })
    );
  }
}

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
    await handleFailedJob(job, err);
  });

  return worker;
}
