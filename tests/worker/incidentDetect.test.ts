import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectIncident } from '../../apps/worker/src/processor/incidentDetect';
import { CheckStatus, CONFIRM_DOWN_THRESHOLD } from 'shared';
import { prisma } from 'database';
import { addAlertNotificationJob } from 'queue';
import { incrementFailures, resetFailures } from '../../apps/worker/src/cache/failureCounter';
import { setStatusCache } from '../../apps/worker/src/cache/statusCache';

vi.mock('database', () => ({
  prisma: {
    incident: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('queue', () => ({
  addAlertNotificationJob: vi.fn(),
}));

vi.mock('../../apps/worker/src/cache/failureCounter', () => ({
  incrementFailures: vi.fn(),
  resetFailures: vi.fn(),
}));

vi.mock('../../apps/worker/src/cache/statusCache', () => ({
  setStatusCache: vi.fn(),
}));

describe('detectIncident', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should always update the status cache', async () => {
    await detectIncident({ monitorId: 'm1', checkStatus: CheckStatus.UP, failureReason: null });
    expect(setStatusCache).toHaveBeenCalledWith('m1', CheckStatus.UP);

    await detectIncident({ monitorId: 'm1', checkStatus: CheckStatus.DOWN, failureReason: null });
    expect(setStatusCache).toHaveBeenCalledWith('m1', CheckStatus.DOWN);
  });

  describe('when status is UP', () => {
    it('should reset failure counter', async () => {
      vi.mocked(prisma.incident.findFirst).mockResolvedValue(null);
      await detectIncident({ monitorId: 'm1', checkStatus: CheckStatus.UP, failureReason: null });
      expect(resetFailures).toHaveBeenCalledWith('m1');
    });

    it('should not update database if no open incident exists', async () => {
      vi.mocked(prisma.incident.findFirst).mockResolvedValue(null);
      await detectIncident({ monitorId: 'm1', checkStatus: CheckStatus.UP, failureReason: null });
      expect(prisma.incident.findFirst).toHaveBeenCalledWith({
        where: { monitorId: 'm1', resolvedAt: null },
        include: { monitor: true },
      });
      expect(prisma.incident.update).not.toHaveBeenCalled();
      expect(addAlertNotificationJob).not.toHaveBeenCalled();
    });

    it('should resolve open incident if one exists and enqueue RESOLVED notification', async () => {
      const now = Date.now();
      const startedAt = new Date(now - 60000); // 60 seconds ago
      vi.mocked(prisma.incident.findFirst).mockResolvedValue({
        id: 'inc1',
        monitorId: 'm1',
        startedAt,
        monitor: { name: 'My Service', url: 'https://example.com' },
      } as any);

      await detectIncident({ monitorId: 'm1', checkStatus: CheckStatus.UP, failureReason: null });
      
      expect(prisma.incident.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'inc1' },
        data: expect.objectContaining({
          durationSeconds: 60,
        }),
      }));

      expect(addAlertNotificationJob).toHaveBeenCalledWith(expect.objectContaining({
        incidentId: 'inc1',
        monitorId: 'm1',
        monitorName: 'My Service',
        url: 'https://example.com',
        eventType: 'RESOLVED',
        startedAt,
      }));
    });
  });

  describe('when status is non-UP', () => {
    it('should not enqueue notification on HEALTHY -> DETECTING transition (failure count 1 below threshold)', async () => {
      vi.mocked(incrementFailures).mockResolvedValue(1);
      await detectIncident({ monitorId: 'm1', checkStatus: CheckStatus.DOWN, failureReason: null });
      expect(incrementFailures).toHaveBeenCalledWith('m1');
      expect(prisma.incident.findFirst).not.toHaveBeenCalled();
      expect(addAlertNotificationJob).not.toHaveBeenCalled();
    });

    it('should not enqueue notification on intermediate DETECTING -> DETECTING transition (failure count below threshold)', async () => {
      vi.mocked(incrementFailures).mockResolvedValue(CONFIRM_DOWN_THRESHOLD - 1);
      await detectIncident({ monitorId: 'm1', checkStatus: CheckStatus.DOWN, failureReason: null });
      expect(prisma.incident.create).not.toHaveBeenCalled();
      expect(addAlertNotificationJob).not.toHaveBeenCalled();
    });


    it('should create incident and enqueue OPEN notification if threshold reached and no open incident', async () => {
      const startedAt = new Date();
      vi.mocked(incrementFailures).mockResolvedValue(CONFIRM_DOWN_THRESHOLD);
      vi.mocked(prisma.incident.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.incident.create).mockResolvedValue({
        id: 'new-inc',
        monitorId: 'm1',
        startedAt,
        monitor: { name: 'My Service', url: 'https://example.com' },
      } as any);

      await detectIncident({ monitorId: 'm1', checkStatus: CheckStatus.DOWN, failureReason: null });

      expect(prisma.incident.findFirst).toHaveBeenCalledWith({
        where: { monitorId: 'm1', resolvedAt: null },
      });
      expect(prisma.incident.create).toHaveBeenCalledWith({
        data: { monitorId: 'm1', failureReason: null },
        include: { monitor: true },
      });
      expect(addAlertNotificationJob).toHaveBeenCalledWith({
        incidentId: 'new-inc',
        monitorId: 'm1',
        monitorName: 'My Service',
        url: 'https://example.com',
        eventType: 'OPEN',
        startedAt,
      });
    });

    it('should not create incident or enqueue notification if threshold reached but incident is already open', async () => {
      vi.mocked(incrementFailures).mockResolvedValue(CONFIRM_DOWN_THRESHOLD + 1);
      vi.mocked(prisma.incident.findFirst).mockResolvedValue({ id: 'inc1' } as any);

      await detectIncident({ monitorId: 'm1', checkStatus: CheckStatus.DOWN, failureReason: null });

      expect(prisma.incident.findFirst).toHaveBeenCalled();
      expect(prisma.incident.create).not.toHaveBeenCalled();
      expect(addAlertNotificationJob).not.toHaveBeenCalled();
    });
  });
});