import cron from 'node-cron';
import { prisma } from 'database';
import { addCheckJob, addCheckJobsBulk } from 'queue';

const BATCH_SIZE = 1000;
const MAX_BATCHES = 10;
let isExecuting = false;

async function tick() {
  if (isExecuting) {
    console.warn(JSON.stringify({ event: 'tick_skipped', reason: 'Previous tick still running' }));
    return;
  }

  isExecuting = true;
  const now = new Date();
  let totalFound = 0;
  let totalEnqueued = 0;

  try {
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      let monitors: { id: string; url: string; interval: number }[] = [];

      try {
        monitors = await prisma.monitor.findMany({
          where: { active: true, nextCheckAt: { lte: now } },
          select: { id: true, url: true, interval: true },
          take: BATCH_SIZE,
        });
      } catch (error) {
        console.error(JSON.stringify({ event: 'tick_db_error', error: (error as Error).message }));
        break; // Stop processing batches on db error
      }

      if (monitors.length === 0) {
        break;
      }

      totalFound += monitors.length;
      let batchEnqueued = 0;

      // 1. Bulk enqueue jobs to BullMQ
      const payloads = monitors.map((monitor) => ({
        monitorId: monitor.id,
        url: monitor.url,
      }));

      try {
        await addCheckJobsBulk(payloads);
        batchEnqueued = monitors.length;
      } catch (bulkError) {
        console.warn(JSON.stringify({
          event: 'enqueue_bulk_error_falling_back',
          error: (bulkError as Error).message,
        }));

        // Fallback to individual enqueues in case bulk fails
        for (const monitor of monitors) {
          try {
            await addCheckJob({ monitorId: monitor.id, url: monitor.url });
            batchEnqueued++;
          } catch (individualError) {
            console.error(JSON.stringify({
              event: 'enqueue_individual_error',
              monitorId: monitor.id,
              error: (individualError as Error).message,
            }));
          }
        }
      }

      totalEnqueued += batchEnqueued;

      // 2. Batch update nextCheckAt in Prisma by grouping by interval
      const monitorsByInterval = new Map<number, string[]>();
      for (const monitor of monitors) {
        const list = monitorsByInterval.get(monitor.interval) || [];
        list.push(monitor.id);
        monitorsByInterval.set(monitor.interval, list);
      }

      const updatePromises = [];
      for (const [interval, ids] of monitorsByInterval.entries()) {
        const nextCheckDate = new Date(now.getTime() + interval * 1000);
        updatePromises.push(
          prisma.monitor.updateMany({
            where: { id: { in: ids } },
            data: { nextCheckAt: nextCheckDate },
          })
        );
      }

      try {
        await Promise.all(updatePromises);
      } catch (dbUpdateError) {
        console.error(JSON.stringify({
          event: 'tick_db_update_error',
          error: (dbUpdateError as Error).message,
        }));
        // Break to avoid infinite loop since the monitors' nextCheckAt wasn't updated
        break;
      }
    }

    console.log(JSON.stringify({ event: 'tick_complete', found: totalFound, enqueued: totalEnqueued }));
  } finally {
    isExecuting = false;
  }
}

// Run every 30 seconds
cron.schedule('*/30 * * * * *', tick);

console.log(JSON.stringify({ event: 'scheduler_started' }));
