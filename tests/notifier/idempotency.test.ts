import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAndSetIdempotency, getIdempotencyKey } from '../../apps/notifier/src/cache/idempotency';
import { processAlertJob } from '../../apps/notifier/src/processors/alertProcessor';
import { redisConnection } from 'queue';
import { prisma } from 'database';
import { sendEmail } from '../../apps/notifier/src/channels/email';
import type { AlertNotificationJob } from 'shared';

vi.mock('database', () => ({
  prisma: {
    monitor: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'mon-111',
        userId: 'u1',
        user: { email: 'user@example.com' },
      }),
    },
  },
}));

vi.mock('queue', () => ({
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
  sendEmail: vi.fn().mockResolvedValue({ id: 'msg-1' }),
}));

describe('checkAndSetIdempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should format Redis idempotency key correctly', () => {
    expect(getIdempotencyKey('inc-123', 'OPEN')).toBe('alert-sent:inc-123:OPEN');
    expect(getIdempotencyKey('inc-123', 'RESOLVED')).toBe('alert-sent:inc-123:RESOLVED');
  });

  it('should return true when Redis key set succeeds (first attempt)', async () => {
    vi.mocked(redisConnection.set).mockResolvedValue('OK');

    const result = await checkAndSetIdempotency('inc-123', 'OPEN');

    expect(result).toBe(true);
    expect(redisConnection.set).toHaveBeenCalledWith(
      'alert-sent:inc-123:OPEN',
      '1',
      'EX',
      300,
      'NX'
    );
  });

  it('should return false when Redis key already exists (duplicate attempt)', async () => {
    vi.mocked(redisConnection.set).mockResolvedValue(null);

    const result = await checkAndSetIdempotency('inc-123', 'OPEN');

    expect(result).toBe(false);
    expect(redisConnection.set).toHaveBeenCalledWith(
      'alert-sent:inc-123:OPEN',
      '1',
      'EX',
      300,
      'NX'
    );
  });
});

describe('processAlertJob idempotency handling', () => {
  const sampleJobData: AlertNotificationJob = {
    incidentId: 'inc-999',
    monitorId: 'mon-111',
    monitorName: 'Production API',
    url: 'https://api.example.com',
    eventType: 'OPEN',
    startedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.monitor.findUnique).mockResolvedValue({
      id: 'mon-111',
      userId: 'u1',
      user: { email: 'user@example.com' },
    } as any);
  });

  it('should process job when idempotency key is acquired', async () => {
    vi.mocked(redisConnection.set).mockResolvedValue('OK');
    const spyLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    await processAlertJob(sampleJobData);

    expect(spyLog).toHaveBeenCalledWith(
      expect.stringContaining('"outcome":"sent"')
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'alert-inc-999-OPEN',
      })
    );

    spyLog.mockRestore();
  });

  it('should skip duplicate job with same incidentId + eventType without throwing', async () => {
    vi.mocked(redisConnection.set).mockResolvedValue(null);
    const spyLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    await processAlertJob(sampleJobData);

    expect(spyLog).toHaveBeenCalledWith(
      expect.stringContaining('"outcome":"skipped_duplicate"')
    );
    expect(sendEmail).not.toHaveBeenCalled();

    spyLog.mockRestore();
  });
});
