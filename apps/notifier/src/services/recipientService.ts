import { prisma } from 'database';

export async function getRecipientEmailForMonitor(monitorId: string): Promise<string | null> {
  const monitor = await prisma.monitor.findUnique({
    where: { id: monitorId },
    include: {
      user: {
        select: { email: true },
      },
    },
  });

  return monitor ? monitor.user.email : null;
}
