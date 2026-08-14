import cron from 'node-cron';
import { prisma } from 'database';
import { addCheckJobsBulk } from 'queue';

// ─── Old Implementation (Race-Condition-Prone) ────────────────────────────────
// The previous implementation used a non-locking `findMany()` to fetch monitors
// due for a check. In a multi-replica environment, two scheduler instances
// ticking at the same time would both read the same rows and enqueue duplicate
// check jobs into BullMQ.
//
// import { addCheckJob, addCheckJobsBulk } from 'queue';
//
// const BATCH_SIZE = 1000;
// const MAX_BATCHES = 10;
// let isExecuting = false;
//
// async function tick() {
//   if (isExecuting) {
//     console.warn(JSON.stringify({ event: 'tick_skipped', reason: 'Previous tick still running' }));
//     return;
//   }
//
//   isExecuting = true;
//   const now = new Date();
//   let totalFound = 0;
//   let totalEnqueued = 0;
//
//   try {
//     for (let batch = 0; batch < MAX_BATCHES; batch++) {
//       let monitors: { id: string; url: string; interval: number }[] = [];
//
//       try {
//         monitors = await prisma.monitor.findMany({
//           where: { active: true, nextCheckAt: { lte: now } },
//           select: { id: true, url: true, interval: true },
//           take: BATCH_SIZE,
//         });
//       } catch (error) {
//         console.error(JSON.stringify({ event: 'tick_db_error', error: (error as Error).message }));
//         break; // Stop processing batches on db error
//       }
//
//       if (monitors.length === 0) {
//         break;
//       }
//
//       totalFound += monitors.length;
//       let batchEnqueued = 0;
//
//       // 1. Bulk enqueue jobs to BullMQ
//       const payloads = monitors.map((monitor) => ({
//         monitorId: monitor.id,
//         url: monitor.url,
//       }));
//
//       try {
//         await addCheckJobsBulk(payloads);
//         batchEnqueued = monitors.length;
//       } catch (bulkError) {
//         console.warn(JSON.stringify({
//           event: 'enqueue_bulk_error_falling_back',
//           error: (bulkError as Error).message,
//         }));
//
//         // Fallback to individual enqueues in case bulk fails
//         for (const monitor of monitors) {
//           try {
//             await addCheckJob({ monitorId: monitor.id, url: monitor.url });
//             batchEnqueued++;
//           } catch (individualError) {
//             console.error(JSON.stringify({
//               event: 'enqueue_individual_error',
//               monitorId: monitor.id,
//               error: (individualError as Error).message,
//             }));
//           }
//         }
//       }
//
//       totalEnqueued += batchEnqueued;
//
//       // 2. Batch update nextCheckAt in Prisma by grouping by interval
//       const monitorsByInterval = new Map<number, string[]>();
//       for (const monitor of monitors) {
//         const list = monitorsByInterval.get(monitor.interval) || [];
//         list.push(monitor.id);
//         monitorsByInterval.set(monitor.interval, list);
//       }
//
//       const updatePromises = [];
//       for (const [interval, ids] of monitorsByInterval.entries()) {
//         const nextCheckDate = new Date(now.getTime() + interval * 1000);
//         updatePromises.push(
//           prisma.monitor.updateMany({
//             where: { id: { in: ids } },
//             data: { nextCheckAt: nextCheckDate },
//           })
//         );
//       }
//
//       try {
//         await Promise.all(updatePromises);
//       } catch (dbUpdateError) {
//         console.error(JSON.stringify({
//           event: 'tick_db_update_error',
//           error: (dbUpdateError as Error).message,
//         }));
//         // Break to avoid infinite loop since the monitors' nextCheckAt wasn't updated
//         break;
//       }
//     }
//
//     console.log(JSON.stringify({ event: 'tick_complete', found: totalFound, enqueued: totalEnqueued }));
//   } finally {
//     isExecuting = false;
//   }
// }
// ─── End Old Implementation ───────────────────────────────────────────────────

// ─── New Implementation (Race-Safe with Transactional Outbox) ─────────────────
// Uses FOR UPDATE SKIP LOCKED to atomically claim monitors so only one scheduler
// instance picks up each row. Claimed monitors are written to the PendingCheck
// outbox table within the same transaction that bumps nextCheckAt. After commit,
// the outbox is drained → jobs enqueued to BullMQ → outbox rows deleted.
// If the process crashes between commit and enqueue, the outbox drainer
// (outboxDrainer.ts) picks up stale rows on restart.

const BATCH_SIZE = 1000;
const MAX_BATCHES = 10;
let isExecuting = false;

interface ClaimedMonitor {
  id: string;
  monitorId: string;
  url: string;
}

/**
 * Atomically claims a batch of due monitors using FOR UPDATE SKIP LOCKED,
 * bumps their nextCheckAt, and writes outbox rows — all in one transaction.
 * Returns the list of PendingCheck IDs + monitor data for draining.
 */
async function claimAndOutbox(): Promise<ClaimedMonitor[]> {
  const allClaimed: ClaimedMonitor[] = [];

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    // Single raw-SQL transaction: claim → update nextCheckAt → insert outbox
    const claimed = await prisma.$queryRaw<ClaimedMonitor[]>`
      WITH due AS (
        SELECT id, url, interval
        FROM "Monitor"
        WHERE "active" = true AND "nextCheckAt" <= NOW()
        ORDER BY "nextCheckAt" ASC
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      ),
      updated AS (
        UPDATE "Monitor" m
        SET "nextCheckAt" = NOW() + make_interval(secs => due.interval),
            "lastCheckedAt" = NOW()
        FROM due
        WHERE m.id = due.id
        RETURNING m.id AS "monitorId", m.url
      )
      INSERT INTO "PendingCheck" (id, "monitorId", url, "claimedAt")
      SELECT gen_random_uuid(), "monitorId", url, NOW()
      FROM updated
      RETURNING id, "monitorId", url;
    `;

    if (claimed.length === 0) {
      break; // No more monitors due
    }

    allClaimed.push(...claimed);
  }

  return allClaimed;
}

/**
 * Drains a list of outbox rows by enqueuing them to BullMQ, then deleting them.
 * Exported so outboxDrainer.ts can also call this for stale rows on startup.
 */
export async function drainOutbox(rows: ClaimedMonitor[]): Promise<number> {
  if (rows.length === 0) return 0;

  const payloads = rows.map((row) => ({
    monitorId: row.monitorId,
    url: row.url,
  }));

  // Enqueue to BullMQ
  await addCheckJobsBulk(payloads);

  // Delete outbox rows now that enqueue succeeded
  const ids = rows.map((r) => r.id);
  await prisma.pendingCheck.deleteMany({
    where: { id: { in: ids } },
  });

  return rows.length;
}

async function tick() {
  if (isExecuting) {
    console.warn(JSON.stringify({ event: 'tick_skipped', reason: 'Previous tick still running' }));
    return;
  }

  isExecuting = true;
  let totalFound = 0;
  let totalEnqueued = 0;

  try {
    //Atomic claim + outbox write (DB transaction)
    const claimed = await claimAndOutbox();
    totalFound = claimed.length;

    // Drain outbox → enqueue to BullMQ → delete outbox rows
    totalEnqueued = await drainOutbox(claimed);

    console.log(JSON.stringify({ event: 'tick_complete', found: totalFound, enqueued: totalEnqueued }));
  } catch (error) {
    console.error(JSON.stringify({ event: 'tick_error', error: (error as Error).message }));
  } finally {
    isExecuting = false;
  }
}

// Run every 30 seconds
cron.schedule('*/30 * * * * *', tick);

console.log(JSON.stringify({ event: 'scheduler_started' }));
