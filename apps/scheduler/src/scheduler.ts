import cron from 'node-cron';
import { prisma } from 'database';
import { addCheckJob } from 'queue';

async function tick() {
  const now = new Date();

  let monitors: { id: string; url: string; interval: number }[] = [];

  try {
    monitors = await prisma.monitor.findMany({
      where: { active: true, nextCheckAt: { lte: now } },
      select: { id: true, url: true, interval: true },
    });
  } catch (error) {
    // Graceful recovery — log and skip this tick, do not crash
    console.error(JSON.stringify({ event: 'tick_db_error', error: (error as Error).message }));
    return;
  }

  let enqueued = 0;

  for (const monitor of monitors) {
    try {
      await addCheckJob({ monitorId: monitor.id, url: monitor.url });

      await prisma.monitor.update({
        where: { id: monitor.id },
        data: { nextCheckAt: new Date(now.getTime() + monitor.interval * 1000) },
      });

      enqueued++;
    } catch (error) {
      // Log per-monitor failure and continue with remaining monitors
      console.error(JSON.stringify({ event: 'enqueue_error', monitorId: monitor.id, error: (error as Error).message }));
    }
  }

  console.log(JSON.stringify({ event: 'tick_complete', found: monitors.length, enqueued }));
}

// Run every 30 seconds
cron.schedule('*/30 * * * * *', tick);

console.log(JSON.stringify({ event: 'scheduler_started' }));
