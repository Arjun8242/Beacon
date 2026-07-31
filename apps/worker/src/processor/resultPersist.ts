import { prisma } from 'database';
import { CheckStatus, FailureReason } from 'shared';

type PersistParams = {
  monitorId: string;
  checkStatus: CheckStatus;
  statusCode: number | null;
  responseTime: number;
  error: string | null;
  failureReason: FailureReason | null;
};

export async function persistResult(params: PersistParams) {
  const { monitorId, checkStatus, statusCode, responseTime, error, failureReason } = params;

  await prisma.check.create({
    data: {
      monitorId,
      status: checkStatus,
      statusCode,
      responseTime,
      error,
      failureReason,
    },
  });

  await prisma.monitor.update({
    where: { id: monitorId },
    data: { status: checkStatus, lastCheckedAt: new Date(), latestResponseTime: responseTime },
  });
}
