import { prisma } from 'database';
import { CheckStatus, FailureReason, CONFIRM_DOWN_THRESHOLD } from 'shared';
import { addAlertNotificationJob } from 'queue';
import { incrementFailures, resetFailures } from '../cache/failureCounter';
import { setStatusCache } from '../cache/statusCache';

type IncidentParams = {
  monitorId: string;
  checkStatus: CheckStatus;
  failureReason: FailureReason | null;
};

export async function detectIncident(params: IncidentParams): Promise<void> {
  const { monitorId, checkStatus, failureReason } = params;

  // Always update the fast-read status cache
  await setStatusCache(monitorId, checkStatus);

  if (checkStatus === CheckStatus.UP) {
    // Reset failure counter on recovery
    await resetFailures(monitorId);

    // Resolve any open incident
    const openIncident = await prisma.incident.findFirst({
      where: { monitorId, resolvedAt: null },
      include: { monitor: true },
    });

    if (openIncident) {
      const resolvedAt = new Date();
      const durationSeconds = Math.floor(
        (resolvedAt.getTime() - openIncident.startedAt.getTime()) / 1000,
      );
      await prisma.incident.update({
        where: { id: openIncident.id },
        data: { resolvedAt, durationSeconds },
      });

      console.log(JSON.stringify({
        event: 'incident_resolved',
        monitorId,
        incidentId: openIncident.id,
        durationSeconds,
      }));

      await addAlertNotificationJob({
        incidentId: openIncident.id,
        monitorId: openIncident.monitorId,
        monitorName: openIncident.monitor?.name ?? '',
        url: openIncident.monitor?.url ?? '',
        eventType: 'RESOLVED',
        startedAt: openIncident.startedAt,
        resolvedAt,
      });
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
          data: { monitorId, failureReason },
          include: { monitor: true },
        });

        console.log(JSON.stringify({
          event: 'incident_opened',
          monitorId,
          incidentId: incident.id,
          failureCount,
          failureReason,
        }));

        await addAlertNotificationJob({
          incidentId: incident.id,
          monitorId: incident.monitorId,
          monitorName: incident.monitor?.name ?? '',
          url: incident.monitor?.url ?? '',
          eventType: 'OPEN',
          startedAt: incident.startedAt,
        });
      }
    }
  }
}
