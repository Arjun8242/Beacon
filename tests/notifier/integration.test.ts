import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectIncident } from '../../apps/worker/src/processor/incidentDetect';
import { processAlertJob } from '../../apps/notifier/src/processors/alertProcessor';
import { CheckStatus, CONFIRM_DOWN_THRESHOLD, type AlertNotificationJob } from 'shared';
import { prisma } from 'database';
import { addAlertNotificationJob, redisConnection } from 'queue';
import { sendEmail } from '../../apps/notifier/src/channels/email';
import { incrementFailures, resetFailures } from '../../apps/worker/src/cache/failureCounter';
import { setStatusCache } from '../../apps/worker/src/cache/statusCache';

vi.mock('database', () => ({
  prisma: {
    incident: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    monitor: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('queue', () => ({
  addAlertNotificationJob: vi.fn(),
  redisConnection: {
    set: vi.fn(),
    on: vi.fn(),
    quit: vi.fn(),
    disconnect: vi.fn(),
  },
  QUEUE_NAMES: {
    ALERT_NOTIFICATIONS: 'alert-notifications',
  },
}));

vi.mock('../../apps/notifier/src/channels/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: 'msg-mock-1' }),
}));

vi.mock('../../apps/worker/src/cache/failureCounter', () => ({
  incrementFailures: vi.fn(),
  resetFailures: vi.fn(),
}));

vi.mock('../../apps/worker/src/cache/statusCache', () => ({
  setStatusCache: vi.fn(),
}));

describe('End-to-End Incident Alert Flow (Integration)', () => {
  const monitorId = 'mon-e2e-1';
  const incidentId = 'inc-e2e-1';
  const startedAt = new Date();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock DB queries for monitor and recipient lookup
    vi.mocked(prisma.monitor.findUnique).mockResolvedValue({
      id: monitorId,
      name: 'Payment Service',
      url: 'https://payment.example.com',
      userId: 'user-1',
      user: { email: 'devops@example.com' },
    } as any);

    // Mock Redis idempotency store to simulate key set behavior
    const setKeys = new Set<string>();
    vi.mocked(redisConnection.set).mockImplementation(async (key: any) => {
      if (setKeys.has(key)) return null;
      setKeys.add(key);
      return 'OK';
    });
  });

  it('should trigger exactly 2 emails total for a complete Incident OPEN -> Duplicate -> RESOLVED lifecycle', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // ─── Step 1: Transition HEALTHY -> DETECTING (Failures 1 and 2 below threshold = 3) ───
    vi.mocked(incrementFailures).mockResolvedValueOnce(1);
    await detectIncident({ monitorId, checkStatus: CheckStatus.DOWN, failureReason: 'Connection refused' });
    expect(addAlertNotificationJob).not.toHaveBeenCalled();

    vi.mocked(incrementFailures).mockResolvedValueOnce(2);
    await detectIncident({ monitorId, checkStatus: CheckStatus.DOWN, failureReason: 'Connection refused' });
    expect(addAlertNotificationJob).not.toHaveBeenCalled();

    // ─── Step 2: DETECTING -> INCIDENT OPEN (Failure 3 reaches threshold) ───
    vi.mocked(incrementFailures).mockResolvedValueOnce(CONFIRM_DOWN_THRESHOLD);
    vi.mocked(prisma.incident.findFirst).mockResolvedValueOnce(null); // No open incident yet
    vi.mocked(prisma.incident.create).mockResolvedValueOnce({
      id: incidentId,
      monitorId,
      startedAt,
      monitor: { name: 'Payment Service', url: 'https://payment.example.com' },
    } as any);

    await detectIncident({ monitorId, checkStatus: CheckStatus.DOWN, failureReason: 'Connection refused' });

    // Verify producer enqueued OPEN notification job
    expect(addAlertNotificationJob).toHaveBeenCalledTimes(1);
    expect(addAlertNotificationJob).toHaveBeenLastCalledWith({
      incidentId,
      monitorId,
      monitorName: 'Payment Service',
      url: 'https://payment.example.com',
      eventType: 'OPEN',
      startedAt,
    });

    const openJobPayload = vi.mocked(addAlertNotificationJob).mock.calls[0][0] as AlertNotificationJob;

    // Notifier processes the OPEN alert job
    await processAlertJob(openJobPayload);

    // Verify 1st email sent for OPEN
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenLastCalledWith(expect.objectContaining({
      to: 'devops@example.com',
      subject: expect.stringContaining('[DOWN] Alert: Payment Service is down'),
      idempotencyKey: `alert-${incidentId}-OPEN`,
    }));

    // ─── Step 3: Duplicate OPEN job received (e.g. Queue redelivery or blip) ───
    await processAlertJob(openJobPayload);

    // Verify idempotency blocked duplicate execution; still 1 email total
    expect(sendEmail).toHaveBeenCalledTimes(1);

    // ─── Step 4: Subsequent failure checks while incident is already open ───
    vi.mocked(incrementFailures).mockResolvedValueOnce(4);
    vi.mocked(prisma.incident.findFirst).mockResolvedValueOnce({ id: incidentId } as any); // Incident open

    await detectIncident({ monitorId, checkStatus: CheckStatus.DOWN, failureReason: 'Connection refused' });

    // No additional job enqueued
    expect(addAlertNotificationJob).toHaveBeenCalledTimes(1);

    // ─── Step 5: Service recovers (UP check) -> INCIDENT RESOLVED ───
    vi.mocked(prisma.incident.findFirst).mockResolvedValueOnce({
      id: incidentId,
      monitorId,
      startedAt,
      monitor: { name: 'Payment Service', url: 'https://payment.example.com' },
    } as any);

    await detectIncident({ monitorId, checkStatus: CheckStatus.UP, failureReason: null });

    // Verify producer enqueued RESOLVED notification job
    expect(addAlertNotificationJob).toHaveBeenCalledTimes(2);
    expect(addAlertNotificationJob).toHaveBeenLastCalledWith(expect.objectContaining({
      incidentId,
      monitorId,
      eventType: 'RESOLVED',
    }));

    const resolvedJobPayload = vi.mocked(addAlertNotificationJob).mock.calls[1][0] as AlertNotificationJob;

    // Notifier processes the RESOLVED alert job
    await processAlertJob(resolvedJobPayload);

    // Verify 2nd email sent for RESOLVED
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenLastCalledWith(expect.objectContaining({
      to: 'devops@example.com',
      subject: expect.stringContaining('[RESOLVED] Alert: Payment Service is back up'),
      idempotencyKey: `alert-${incidentId}-RESOLVED`,
    }));


    consoleSpy.mockRestore();
  });
});
