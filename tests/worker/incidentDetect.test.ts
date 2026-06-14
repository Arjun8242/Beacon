import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectIncident } from '../../apps/worker/src/processor/incidentDetect';
import { CheckStatus, CONFIRM_DOWN_THRESHOLD } from 'shared';
import { prisma } from 'database';
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
    await detectIncident({ monitorId: 'm1', checkStatus: CheckStatus.UP });
    expect(setStatusCache).toHaveBeenCalledWith('m1', CheckStatus.UP);

    await detectIncident({ monitorId: 'm1', checkStatus: CheckStatus.DOWN });
    expect(setStatusCache).toHaveBeenCalledWith('m1', CheckStatus.DOWN);
  });

  describe('when status is UP', () => {
    it('should reset failure counter', async () => {
      vi.mocked(prisma.incident.findFirst).mockResolvedValue(null);
      await detectIncident({ monitorId: 'm1', checkStatus: CheckStatus.UP });
      expect(resetFailures).toHaveBeenCalledWith('m1');
    });

    it('should not update database if no open incident exists', async () => {
      vi.mocked(prisma.incident.findFirst).mockResolvedValue(null);
      await detectIncident({ monitorId: 'm1', checkStatus: CheckStatus.UP });
      expect(prisma.incident.findFirst).toHaveBeenCalledWith({
        where: { monitorId: 'm1', resolvedAt: null },
      });
      expect(prisma.incident.update).not.toHaveBeenCalled();
    });

    it('should resolve open incident if one exists', async () => {
      const now = Date.now();
      const startedAt = new Date(now - 60000); // 60 seconds ago
      vi.mocked(prisma.incident.findFirst).mockResolvedValue({
        id: 'inc1',
        monitorId: 'm1',
        startedAt,
      } as any);

      await detectIncident({ monitorId: 'm1', checkStatus: CheckStatus.UP });
      
      expect(prisma.incident.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'inc1' },
        data: expect.objectContaining({
          durationSeconds: 60,
        }),
      }));
    });
  });

  describe('when status is non-UP', () => {
    it('should increment failure counter', async () => {
      vi.mocked(incrementFailures).mockResolvedValue(1);
      await detectIncident({ monitorId: 'm1', checkStatus: CheckStatus.DOWN });
      expect(incrementFailures).toHaveBeenCalledWith('m1');
      expect(prisma.incident.findFirst).not.toHaveBeenCalled();
    });

    it('should not create incident if failure count is below threshold', async () => {
      vi.mocked(incrementFailures).mockResolvedValue(CONFIRM_DOWN_THRESHOLD - 1);
      await detectIncident({ monitorId: 'm1', checkStatus: CheckStatus.DOWN });
      expect(prisma.incident.create).not.toHaveBeenCalled();
    });

    it('should create incident if failure count reaches threshold and no open incident exists', async () => {
      vi.mocked(incrementFailures).mockResolvedValue(CONFIRM_DOWN_THRESHOLD);
      vi.mocked(prisma.incident.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.incident.create).mockResolvedValue({ id: 'new-inc' } as any);

      await detectIncident({ monitorId: 'm1', checkStatus: CheckStatus.DOWN });

      expect(prisma.incident.findFirst).toHaveBeenCalledWith({
        where: { monitorId: 'm1', resolvedAt: null },
      });
      expect(prisma.incident.create).toHaveBeenCalledWith({
        data: { monitorId: 'm1' },
      });
    });

    it('should not create incident if threshold reached but an incident is already open', async () => {
      vi.mocked(incrementFailures).mockResolvedValue(CONFIRM_DOWN_THRESHOLD + 1);
      vi.mocked(prisma.incident.findFirst).mockResolvedValue({ id: 'inc1' } as any);

      await detectIncident({ monitorId: 'm1', checkStatus: CheckStatus.DOWN });

      expect(prisma.incident.findFirst).toHaveBeenCalled();
      expect(prisma.incident.create).not.toHaveBeenCalled();
    });
  });
});