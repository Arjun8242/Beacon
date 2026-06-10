import { determineStatus } from 'shared';
import { env } from '../config/env';

export type CheckResult = {
  statusCode: number | null;
  responseTime: number;
  error: string | null;
  checkStatus: ReturnType<typeof determineStatus>;
};

export async function runCheck(url: string): Promise<CheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.DEFAULT_TIMEOUT);
  const startTime = Date.now();

  let statusCode: number | null = null;
  let error: string | null = null;

  try {
    const response = await fetch(url, { signal: controller.signal });
    statusCode = response.status;
  } catch (err) {
    error = (err as Error).name === 'AbortError' ? 'Request timeout' : (err as Error).message;
  } finally {
    clearTimeout(timeout);
  }

  const responseTime = Date.now() - startTime;
  const checkStatus = determineStatus(statusCode ?? undefined, error ? new Error(error) : undefined);

  return { statusCode, responseTime, error, checkStatus };
}
