import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processAlertJob } from '../../apps/notifier/src/processors/alertProcessor';
import { checkAndSetIdempotency } from '../../apps/notifier/src/cache/idempotency';
import { sendEmail } from '../../apps/notifier/src/channels/email';
import { prisma } from 'database';
import type { AlertNotificationJob } from 'shared';

vi.mock('database', () => ({
  prisma: {
    monitor: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../apps/notifier/src/cache/idempotency', () => ({
  checkAndSetIdempotency: vi.fn(),
}));

vi.mock('../../apps/notifier/src/channels/email', () => ({
  sendEmail: vi.fn(),
}));

describe('processAlertJob email sending flow', () => {
  const sampleJob: AlertNotificationJob = {
    incidentId: 'inc-555',
    monitorId: 'mon-777',
    monitorName: 'Payment Gateway',
    url: 'https://pay.example.com',
    eventType: 'OPEN',
    startedAt: '2026-08-01T15:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve recipient email via Monitor -> User lookup and dispatch email with Idempotency-Key header', async () => {
    vi.mocked(checkAndSetIdempotency).mockResolvedValue(true);
    vi.mocked(prisma.monitor.findUnique).mockResolvedValue({
      id: 'mon-777',
      userId: 'user-888',
      user: { email: 'admin@company.com' },
    } as any);
    vi.mocked(sendEmail).mockResolvedValue({ id: 'msg-123' });

    await processAlertJob(sampleJob);

    expect(prisma.monitor.findUnique).toHaveBeenCalledWith({
      where: { id: 'mon-777' },
      include: {
        user: { select: { email: true } },
      },
    });

    expect(sendEmail).toHaveBeenCalledWith({
      to: 'admin@company.com',
      subject: '🚨 [DOWN] Alert: Payment Gateway is down',
      html: expect.stringContaining('Payment Gateway'),
      text: expect.stringContaining('Payment Gateway'),
      idempotencyKey: 'alert-inc-555-OPEN',
    });
  });

  it('should skip email dispatch if monitor has no associated user email', async () => {
    vi.mocked(checkAndSetIdempotency).mockResolvedValue(true);
    vi.mocked(prisma.monitor.findUnique).mockResolvedValue(null);

    const spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await processAlertJob(sampleJob);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(spyWarn).toHaveBeenCalledWith(
      expect.stringContaining('"event":"alert_skipped_missing_recipient"')
    );

    spyWarn.mockRestore();
  });
});
