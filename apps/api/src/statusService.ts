import { prisma } from 'database';
import { getWindowStart, calculateUptimePercent } from 'shared';

export async function getBySlug(slug: string) {
  // 1. Fetch monitor by slug (only select public fields)
  const monitor = await prisma.monitor.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  if (!monitor) {
    throw Object.assign(new Error('Monitor not found'), { statusCode: 404 });
  }

  // 2. Fetch 7d uptime % using Postgres aggregation
  const since = getWindowStart('7d');
  
  const statsRows = await prisma.$queryRaw<
    { total: bigint; up_count: bigint }[]
  >`
    SELECT
      COUNT(*)                                              AS total,
      COUNT(*) FILTER (WHERE status = 'UP')               AS up_count
    FROM "Check"
    WHERE "monitorId" = ${monitor.id}
      AND "checkedAt" >= ${since}
  `;

  let uptimePercent7d = 100;
  if (statsRows.length > 0) {
    const total = Number(statsRows[0].total);
    const upCount = Number(statsRows[0].up_count);
    uptimePercent7d = calculateUptimePercent(upCount, total);
  }

  // 3. Fetch last 10 incidents
  const incidents = await prisma.incident.findMany({
    where: { monitorId: monitor.id },
    orderBy: { startedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      startedAt: true,
      resolvedAt: true,
      durationSeconds: true,
    },
  });

  return {
    id: monitor.id,
    name: monitor.name,
    slug,
    status: monitor.status,
    uptimePercent7d,
    incidents,
  };
}
