import { CheckStatus, FailureReason, httpFailureReason } from 'shared';
import { env } from '../config/env';

export type CheckResult = {
  statusCode: number | null;
  responseTime: number;
  error: string | null;
  checkStatus: CheckStatus;
  failureReason: FailureReason | null;
};


function classifyError(err: unknown): { reason: FailureReason; message: string } {
  const error = err as Error & { code?: string; cause?: { code?: string } };

  if (error.name === 'AbortError' || error.name === 'TimeoutError') {
    return { reason: FailureReason.TIMEOUT, message: 'Request timeout' };
  }

  // Node fetch wraps network errors in a TypeError with a .cause
  const code = error.code || (error.cause as any)?.code;

  if (code === 'ENOTFOUND') {
    return { reason: FailureReason.DNS_FAILURE, message: 'DNS lookup failed' };
  }
  if (code === 'ECONNREFUSED') {
    return { reason: FailureReason.CONNECTION_REFUSED, message: 'Connection refused' };
  }
  if (code === 'ECONNRESET') {
    return { reason: FailureReason.CONNECTION_RESET, message: 'Connection reset' };
  }
  if (
    code === 'CERT_HAS_EXPIRED' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
  ) {
    return { reason: FailureReason.SSL_ERROR, message: 'SSL certificate error' };
  }

  return { reason: FailureReason.UNKNOWN_ERROR, message: error.message || 'Unknown error' };
}

export async function runCheck(url: string): Promise<CheckResult> {
  const startTime = Date.now();

  let statusCode: number | null = null;
  let error: string | null = null;
  let checkStatus: CheckStatus = CheckStatus.DOWN;
  let failureReason: FailureReason | null = null;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(env.DEFAULT_TIMEOUT),
    });

    statusCode = response.status;

    if (statusCode >= 500) {
      checkStatus = CheckStatus.DOWN;
      failureReason = httpFailureReason(statusCode);
      error = `Server returned HTTP ${statusCode}`;
    } else if (statusCode >= 400) {
      checkStatus = CheckStatus.DOWN;
      failureReason = httpFailureReason(statusCode);
      error = `Server returned HTTP ${statusCode}`;
    } else {
      // 2xx and 3xx are successful
      checkStatus = CheckStatus.UP;
      failureReason = null;
    }
  } catch (err) {
    const classified = classifyError(err);
    checkStatus = CheckStatus.DOWN;
    failureReason = classified.reason;
    error = classified.message;
  }

  const responseTime = Date.now() - startTime;

  return { statusCode, responseTime, error, checkStatus, failureReason };
}
