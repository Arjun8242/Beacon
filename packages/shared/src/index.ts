import { z } from 'zod';

export enum CheckStatus {
  UP = 'UP',
  DOWN = 'DOWN',
  DEGRADED = 'DEGRADED',
}

export enum MonitorStatus {
  PENDING = 'PENDING',
  UP = 'UP',
  DOWN = 'DOWN',
  DEGRADED = 'DEGRADED',
  PAUSED = 'PAUSED',
}

export const ALLOWED_INTERVALS = [30, 60, 120, 300, 600] as const;
export const DEFAULT_TIMEOUT = 10000;
export const CONFIRM_DOWN_THRESHOLD = 3;//site must be down for 3 consecutive checks to be marked as down

export const CreateMonitorSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  interval: z.number().refine((val) => (ALLOWED_INTERVALS as readonly number[]).includes(val), {
    message: `Interval must be one of: ${ALLOWED_INTERVALS.join(', ')}`,
  }).default(60),
});

export type CreateMonitorDTO = z.infer<typeof CreateMonitorSchema>;//reads the CreateMonitorSchema and generates the CreateMonitorDTO interference type from it

export type MonitorCheckJob = {
  monitorId: string;
  url: string;
};

export function determineStatus(statusCode?: number, error?: Error, responseTime?: number): CheckStatus {
  if (error || !statusCode || statusCode >= 500) {
    return CheckStatus.DOWN;
  }
  if (statusCode >= 400 || (responseTime !== undefined && responseTime > 5000)) {
    return CheckStatus.DEGRADED;
  }
  return CheckStatus.UP;
}

export function slugify(name: string): string {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${baseSlug}-${randomSuffix}`;
}

export function calculateUptimePercent(upCount: number, totalCount: number): number {
  if (totalCount === 0) return 100;
  const percent = (upCount / totalCount) * 100;
  return Math.round(percent * 100) / 100;
}

export function getWindowStart(window: '24h' | '7d' | '30d'): Date {
  const now = new Date();
  switch (window) {
    case '24h':
      now.setHours(now.getHours() - 24);
      break;
    case '7d':
      now.setDate(now.getDate() - 7);
      break;
    case '30d':
      now.setDate(now.getDate() - 30);
      break;
  }
  return now;
}
