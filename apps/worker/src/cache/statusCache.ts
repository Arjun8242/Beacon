import { redisConnection } from 'queue';
import { CheckStatus } from 'shared';

// TTL in seconds — cached status expires after 10 minutes
const STATUS_TTL = 600;

function key(monitorId: string): string {
  return `status:${monitorId}`;
}

/** Cache the latest check status for a monitor. */
export async function setStatusCache(monitorId: string, status: CheckStatus): Promise<void> {
  await redisConnection.set(key(monitorId), status, 'EX', STATUS_TTL);
}

/** Get the cached check status for a monitor. Returns null if not cached. */
export async function getStatusCache(monitorId: string): Promise<CheckStatus | null> {
  const val = await redisConnection.get(key(monitorId));
  return val as CheckStatus | null;
}
