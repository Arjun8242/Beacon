import { prisma } from 'database';
import { CheckStatus, CONFIRM_DOWN_THRESHOLD } from 'shared';
import { incrementFailures, resetFailures } from '../cache/failureCounter';
import { setStatusCache } from '../cache/statusCache';

type IncidentParams = {
  monitorId: string;
  checkStatus: CheckStatus;
};

export async function detectIncident(params: IncidentParams): Promise<void> {
  const { monitorId, checkStatus } = params;

  // Always update the fast-read status cache
  await setStatusCache(monitorId, checkStatus);

  if (checkStatus === CheckStatus.UP) {
    // Reset failure counter on recovery
    await resetFailures(monitorId);

    // Resolve any open incident
    const openIncident = await prisma.incident.findFirst({
      where: { monitorId, resolvedAt: null },
    });

    if (openIncident) {
      const durationSeconds = Math.floor(
        (Date.now() - openIncident.startedAt.getTime()) / 1000,
      );
      await prisma.incident.update({
        where: { id: openIncident.id },
        data: { resolvedAt: new Date(), durationSeconds },
      });

      console.log(JSON.stringify({
        event: 'incident_resolved',
        monitorId,
        incidentId: openIncident.id,
        durationSeconds,
      }));
    }
  } else {
    // Non-UP: increment failure counter
    const failureCount = await incrementFailures(monitorId);

    // Open a new incident only when the threshold is crossed and no incident is open
    if (failureCount >= CONFIRM_DOWN_THRESHOLD) {
      const existingIncident = await prisma.incident.findFirst({
        where: { monitorId, resolvedAt: null },
      });

      if (!existingIncident) {
        const incident = await prisma.incident.create({
          data: { monitorId },
        });

        console.log(JSON.stringify({
          event: 'incident_opened',
          monitorId,
          incidentId: incident.id,
          failureCount,
        }));
      }
    }
  }
}
