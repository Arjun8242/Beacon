import { prisma } from 'database';
import { CheckStatus } from 'shared';

type PersistParams = {
  monitorId: string;
  checkStatus: CheckStatus;
  statusCode: number | null;
  responseTime: number;
  error: string | null;
};

export async function persistResult(params: PersistParams) {
  const { monitorId, checkStatus, statusCode, responseTime, error } = params;

  await prisma.check.create({
    data: {
      monitorId,
      status: checkStatus,
      statusCode,
      responseTime,
      error,
    },
  });

  await prisma.monitor.update({
    where: { id: monitorId },
    data: { status: checkStatus, lastCheckedAt: new Date() },
  });
}
