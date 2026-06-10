import { redisConnection } from 'queue';

// TTL in seconds — counter auto-expires after 10 minutes of inactivity
const FAILURE_TTL = 600;

function key(monitorId: string): string {
  return `failures:${monitorId}`;
}

/** Increment failure count for a monitor. Returns the new count. */
export async function incrementFailures(monitorId: string): Promise<number> {
  const k = key(monitorId);
  const count = await redisConnection.incr(k);
  await redisConnection.expire(k, FAILURE_TTL);
  return count;
}

/** Reset failure count for a monitor (on recovery). */
export async function resetFailures(monitorId: string): Promise<void> {
  await redisConnection.del(key(monitorId));
}

/** Get the current failure count for a monitor. */
export async function getFailureCount(monitorId: string): Promise<number> {
  const val = await redisConnection.get(key(monitorId));
  return val ? parseInt(val, 10) : 0;
}
