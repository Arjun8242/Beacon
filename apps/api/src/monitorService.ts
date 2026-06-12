import { prisma } from 'database';
import { CreateMonitorSchema, CreateMonitorDTO, slugify, MonitorStatus } from 'shared';

// ── helpers ────────────────────────────────────────────────────────────────

function notFound() {
  return Object.assign(new Error('Monitor not found'), { statusCode: 404 });
}

/** Fetch a monitor and verify it belongs to the requesting user. */
async function findOwned(monitorId: string, userId: string) {
  const monitor = await prisma.monitor.findUnique({ where: { id: monitorId } });
  if (!monitor || monitor.userId !== userId) throw notFound();
  return monitor;
}

// ── service functions ──────────────────────────────────────────────────────

export async function create(userId: string, data: CreateMonitorDTO) {
  // Validate input (CreateMonitorSchema already applied by validate middleware,
  // but we parse again here so the service is self-contained)
  const parsed = CreateMonitorSchema.parse(data);
  const slug = slugify(parsed.name); // generated but not yet persisted (schema pending)

  const monitor = await prisma.monitor.create({
    data: {
      userId,
      name: parsed.name,
      slug,
      url: parsed.url,
      interval: parsed.interval,
    },
  });

  return monitor;
}

export async function listByUser(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;

  const [monitors, total] = await prisma.$transaction([
    prisma.monitor.findMany({
      where: { userId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.monitor.count({ where: { userId } }),
  ]);

  return { monitors, total, page, limit };
}

export async function getById(monitorId: string, userId: string) {
  return findOwned(monitorId, userId);
}

export async function update(monitorId: string, userId: string, data: Partial<CreateMonitorDTO>) {
  await findOwned(monitorId, userId);

  // Only allow updating name, url, interval
  const allowedFields: Partial<CreateMonitorDTO> = {};
  if (data.name !== undefined) allowedFields.name = data.name;
  if (data.url !== undefined) allowedFields.url = data.url;
  if (data.interval !== undefined) allowedFields.interval = data.interval;

  return prisma.monitor.update({
    where: { id: monitorId },
    data: allowedFields,
  });
}

export async function remove(monitorId: string, userId: string) {
  await findOwned(monitorId, userId);
  await prisma.monitor.delete({ where: { id: monitorId } });
}

export async function pause(monitorId: string, userId: string) {
  await findOwned(monitorId, userId);
  return prisma.monitor.update({
    where: { id: monitorId },
    data: { active: false, status: MonitorStatus.PAUSED },
  });
}

export async function resume(monitorId: string, userId: string) {
  await findOwned(monitorId, userId);
  return prisma.monitor.update({
    where: { id: monitorId },
    data: { active: true, status: MonitorStatus.PENDING },
  });
}
