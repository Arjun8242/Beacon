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

export enum FailureReason {
  TIMEOUT = 'TIMEOUT',
  DNS_FAILURE = 'DNS_FAILURE',
  SSL_ERROR = 'SSL_ERROR',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  CONNECTION_RESET = 'CONNECTION_RESET',
  HTTP_400 = 'HTTP_400',
  HTTP_401 = 'HTTP_401',
  HTTP_403 = 'HTTP_403',
  HTTP_404 = 'HTTP_404',
  HTTP_500 = 'HTTP_500',
  HTTP_502 = 'HTTP_502',
  HTTP_503 = 'HTTP_503',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export function httpFailureReason(statusCode: number): FailureReason {
  const map: Partial<Record<number, FailureReason>> = {
    400: FailureReason.HTTP_400,
    401: FailureReason.HTTP_401,
    403: FailureReason.HTTP_403,
    404: FailureReason.HTTP_404,
    500: FailureReason.HTTP_500,
    502: FailureReason.HTTP_502,
    503: FailureReason.HTTP_503,
  };
  return map[statusCode] ?? (statusCode >= 500 ? FailureReason.HTTP_500 : FailureReason.HTTP_400);
}

export function failureReasonToMessage(reason: string): string {
  const messages: Record<string, string> = {
    TIMEOUT: 'Request timed out after 10 seconds',
    DNS_FAILURE: 'DNS lookup failed',
    SSL_ERROR: 'SSL certificate validation failed',
    CONNECTION_REFUSED: 'Connection refused by server',
    CONNECTION_RESET: 'Connection reset by server',
    UNKNOWN_ERROR: 'An unknown error occurred',
  };

  if (messages[reason]) return messages[reason];

  if (reason.startsWith('HTTP_')) {
    const code = reason.replace('HTTP_', '');
    return `Server returned HTTP ${code}`;
  }

  return reason;
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

export type StatusResult = {
  checkStatus: CheckStatus;
  failureReason: FailureReason | null;
};

export function determineStatus(statusCode?: number, error?: Error, responseTime?: number): StatusResult {
  if (error || !statusCode || statusCode >= 500) {
    return { checkStatus: CheckStatus.DOWN, failureReason: statusCode ? httpFailureReason(statusCode) : FailureReason.UNKNOWN_ERROR };
  }
  if (statusCode >= 400) {
    return { checkStatus: CheckStatus.DOWN, failureReason: httpFailureReason(statusCode) };
  }
  if (responseTime !== undefined && responseTime > 5000) {
    return { checkStatus: CheckStatus.DEGRADED, failureReason: null };
  }
  return { checkStatus: CheckStatus.UP, failureReason: null };
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
