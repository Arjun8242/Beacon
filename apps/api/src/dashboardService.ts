import { prisma } from 'database';
import { getWindowStart, calculateUptimePercent } from 'shared';

export async function getDashboardSummary(userId: string) {
  // 1. Fetch all monitors for the user
  const monitors = await prisma.monitor.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate monitor counts for summary
  const summary = {
    total: monitors.length,
    active: monitors.filter((m) => m.active).length,
    paused: monitors.filter((m) => !m.active).length,
    up: monitors.filter((m) => m.status === 'UP').length,
    down: monitors.filter((m) => m.status === 'DOWN').length,
    degraded: monitors.filter((m) => m.status === 'DEGRADED').length,
  };

  // 2. Fetch 24h stats using Postgres aggregation
  const since = getWindowStart('24h');
  
  const statsRows = await prisma.$queryRaw<
    { monitorId: string; total: bigint; up_count: bigint; avg_response_time: number | null }[]
  >`
    SELECT
      "monitorId",
      COUNT(*)                                              AS total,
      COUNT(*) FILTER (WHERE status = 'UP')               AS up_count,
      AVG("responseTime")                                  AS avg_response_time
    FROM "Check"
    WHERE "monitorId" IN (SELECT id FROM "Monitor" WHERE "userId" = ${userId})
      AND "checkedAt" >= ${since}
    GROUP BY "monitorId"
  `;

  // Map stats rows by monitorId for quick lookup
  const statsMap = new Map<string, { total: number; upCount: number; avgResponseTime: number | null }>();
  for (const row of statsRows) {
    statsMap.set(row.monitorId, {
      total: Number(row.total),
      upCount: Number(row.up_count),
      avgResponseTime: row.avg_response_time != null ? Math.round(row.avg_response_time) : null,
    });
  }

  // Combine monitors with their 24h stats
  const monitorList = monitors.map((monitor) => {
    const stats = statsMap.get(monitor.id);
    const uptimePercent = stats ? calculateUptimePercent(stats.upCount, stats.total) : 100;
    const avgResponseTime = stats ? stats.avgResponseTime : null;

    return {
      id: monitor.id,
      name: monitor.name,
      url: monitor.url,
      slug: monitor.slug,
      status: monitor.status,
      active: monitor.active,
      interval: monitor.interval,
      uptimePercent24h: uptimePercent,
      avgResponseTime24h: avgResponseTime,
    };
  });

  // 3. Fetch the 5 most recent incidents for monitors owned by the user
  const recentIncidents = await prisma.incident.findMany({
    where: {
      monitor: {
        userId,
      },
    },
    orderBy: {
      startedAt: 'desc',
    },
    take: 5,
    include: {
      monitor: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  // Format incidents for response
  const formattedIncidents = recentIncidents.map((incident) => ({
    id: incident.id,
    monitorId: incident.monitorId,
    monitorName: incident.monitor.name,
    monitorSlug: incident.monitor.slug,
    startedAt: incident.startedAt,
    resolvedAt: incident.resolvedAt,
    durationSeconds: incident.durationSeconds,
  }));

  return {
    summary,
    monitors: monitorList,
    recentIncidents: formattedIncidents,
  };
}
