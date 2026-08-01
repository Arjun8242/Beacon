import { redisConnection } from 'queue';

const IDEMPOTENCY_TTL = 300;

export function getIdempotencyKey(incidentId: string, eventType: string): string {
  return `alert-sent:${incidentId}:${eventType}`;
}


export async function checkAndSetIdempotency(incidentId: string, eventType: string): Promise<boolean> {
  const key = getIdempotencyKey(incidentId, eventType);
  const result = await redisConnection.set(key, '1', 'EX', IDEMPOTENCY_TTL, 'NX');//creates key if it doesn't exist in redis and returns ok, but if key exists then returns false
  return result === 'OK';
}