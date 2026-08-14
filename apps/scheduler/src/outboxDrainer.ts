import { prisma } from 'database';
import { drainOutbox } from './scheduler';

/**
 * Drains any leftover PendingCheck rows from a previous crash.
 * Called once on startup before the cron scheduler registers,
 * ensuring no claimed monitors are silently lost.
 */
export async function drainStaleOutbox(): Promise<void> {
  try {
    const staleRows = await prisma.pendingCheck.findMany({
      select: { id: true, monitorId: true, url: true },
    });

    if (staleRows.length === 0) {
      console.log(JSON.stringify({ event: 'outbox_drain_startup', stale: 0 }));
      return;
    }

    console.log(JSON.stringify({ event: 'outbox_drain_startup_found', stale: staleRows.length }));

    const enqueued = await drainOutbox(staleRows);

    console.log(JSON.stringify({ event: 'outbox_drain_startup_complete', enqueued }));
  } catch (error) {
    console.error(JSON.stringify({
      event: 'outbox_drain_startup_error',
      error: (error as Error).message,
    }));
  }
}
