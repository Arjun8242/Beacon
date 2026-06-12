import { prisma } from 'database';
import { getWindowStart, calculateUptimePercent } from 'shared';

type Window = '24h' | '7d' | '30d';

/** Verify monitor exists and belongs to user. Throws 404 otherwise. */
async function assertOwnership(monitorId: string, userId: string) {
  const monitor = await prisma.monitor.findUnique({ where: { id: monitorId }, select: { userId: true } });
  if (!monitor || monitor.userId !== userId) {
    throw Object.assign(new Error('Monitor not found'), { statusCode: 404 });
  }
}

/** Uptime %, total checks, avg response time — all computed in Postgres. */
export async function getStats(monitorId: string, userId: string, window: Window) {
  await assertOwnership(monitorId, userId);
  const since = getWindowStart(window);

  const result = await prisma.$queryRaw<
    { total: bigint; up_count: bigint; avg_response_time: number | null }[]
  >`
    SELECT
      COUNT(*)                                              AS total,
      COUNT(*) FILTER (WHERE status = 'UP')               AS up_count,
      AVG("responseTime")                                  AS avg_response_time
    FROM "Check"
    WHERE "monitorId" = ${monitorId}
      AND "checkedAt" >= ${since}
  `;

  const { total, up_count, avg_response_time } = result[0];
  const totalNum = Number(total);
  const upNum = Number(up_count);

  return {
    totalChecks: totalNum,
    uptimePercent: calculateUptimePercent(upNum, totalNum),
    avgResponseTime: avg_response_time != null ? Math.round(avg_response_time) : null,
  };
}

/** Paginated check history. */
export async function getChecks(monitorId: string, userId: string, window: Window, page: number, limit: number) {
  await assertOwnership(monitorId, userId);
  const since = getWindowStart(window);
  const skip = (page - 1) * limit;

  const [checks, total] = await prisma.$transaction([
    prisma.check.findMany({
      where: { monitorId, checkedAt: { gte: since } },
      orderBy: { checkedAt: 'desc' },
      skip,
      take: limit,
      select: { id: true, status: true, statusCode: true, responseTime: true, checkedAt: true },
    }),
    prisma.check.count({ where: { monitorId, checkedAt: { gte: since } } }),
  ]);

  return { checks, total, page, limit };
}

/** Paginated incident history. */
export async function getIncidents(monitorId: string, userId: string, page: number, limit: number) {
  await assertOwnership(monitorId, userId);
  const skip = (page - 1) * limit;

  const [incidents, total] = await prisma.$transaction([
    prisma.incident.findMany({
      where: { monitorId },
      orderBy: { startedAt: 'desc' },
      skip,
      take: limit,
      select: { id: true, startedAt: true, resolvedAt: true, durationSeconds: true },
    }),
    prisma.incident.count({ where: { monitorId } }),
  ]);

  return { incidents, total, page, limit };
}

/** Bucketed avg/min/max latency by time window, computed in Postgres. */
export async function getLatency(monitorId: string, userId: string, window: Window) {
  await assertOwnership(monitorId, userId);
  const since = getWindowStart(window);

  // For 7d: bucket by 6h using epoch math; for others use date_trunc
  let rows: { bucket: Date; avg: number; min: number; max: number }[];

  if (window === '7d') {
    rows = await prisma.$queryRaw`
      SELECT
        to_timestamp(floor(extract(epoch FROM "checkedAt") / 21600) * 21600) AS bucket,
        AVG("responseTime")::int  AS avg,
        MIN("responseTime")       AS min,
        MAX("responseTime")       AS max
      FROM "Check"
      WHERE "monitorId" = ${monitorId}
        AND "checkedAt" >= ${since}
        AND "responseTime" IS NOT NULL
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
  } else {
    const truncUnit = window === '24h' ? 'hour' : 'day';
    rows = await prisma.$queryRaw`
      SELECT
        date_trunc(${truncUnit}, "checkedAt")  AS bucket,
        AVG("responseTime")::int               AS avg,
        MIN("responseTime")                    AS min,
        MAX("responseTime")                    AS max
      FROM "Check"
      WHERE "monitorId" = ${monitorId}
        AND "checkedAt" >= ${since}
        AND "responseTime" IS NOT NULL
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
  }

  return rows;
}
