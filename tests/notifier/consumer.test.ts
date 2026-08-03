import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFailedJobCreate = vi.fn().mockResolvedValue({ id: 'fj-1' });

vi.mock('database', () => ({
  prisma: {
    monitor: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'mon-789',
        userId: 'u1',
        user: { email: 'test@example.com' },
      }),
    },
    failedJob: {
      create: (args: any) => mockFailedJobCreate(args),
    },
  },
}));

vi.mock('queue', () => ({
  redisConnection: {
    set: vi.fn().mockResolvedValue('OK'),
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

vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation((name: string) => ({
    name,
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { processAlertJob, handleFailedJob, createAlertConsumer } from '../../apps/notifier/src/consumer';
import { sendEmail } from '../../apps/notifier/src/channels/email';
import type { AlertNotificationJob } from 'shared';

describe('processAlertJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process alert job and send email successfully', async () => {
    const jobData: AlertNotificationJob = {
      incidentId: 'inc-456',
      monitorId: 'mon-789',
      monitorName: 'API Service',
      url: 'https://api.example.com',
      eventType: 'OPEN',
      startedAt: new Date().toISOString(),
    };

    const spyLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    await processAlertJob(jobData);

    expect(sendEmail).toHaveBeenCalled();
    expect(spyLog).toHaveBeenCalledWith(
      expect.stringContaining('"outcome":"sent"')
    );

    spyLog.mockRestore();
  });

  it('should let Resend API errors throw so BullMQ can retry', async () => {
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('Resend rate limit exceeded'));

    const jobData: AlertNotificationJob = {
      incidentId: 'inc-456',
      monitorId: 'mon-789',
      monitorName: 'API Service',
      url: 'https://api.example.com',
      eventType: 'OPEN',
      startedAt: new Date().toISOString(),
    };

    await expect(processAlertJob(jobData)).rejects.toThrow('Resend rate limit exceeded');
  });
});

describe('createAlertConsumer', () => {
  it('should initialize BullMQ Worker on ALERT_NOTIFICATIONS queue', () => {
    const worker = createAlertConsumer();
    expect(worker).toBeDefined();
    expect(worker.name).toBe('alert-notifications');
  });
});

describe('handleFailedJob', () => {
  beforeEach(() => {
    mockFailedJobCreate.mockClear();
  });

  it('should persist FailedJob row on final retry exhaustion', async () => {
    const mockJob = {
      id: 'job-dead-1',
      attemptsMade: 3,
      opts: { attempts: 3 },
      data: {
        incidentId: 'inc-999',
        monitorId: 'mon-789',
        monitorName: 'API Service',
        url: 'https://api.example.com',
        eventType: 'OPEN',
        startedAt: '2026-08-01T12:00:00Z',
      },
    };

    const spyError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await handleFailedJob(mockJob, new Error('DNS lookup failure'));

    expect(mockFailedJobCreate).toHaveBeenCalledWith({
      data: {
        jobType: 'EMAIL_NOTIFICATION',
        monitorId: 'mon-789',
        jobId: 'job-dead-1',
        payload: mockJob.data,
        errorMessage: 'DNS lookup failure',
        attemptsMade: 3,
        failedAt: expect.any(Date),
      },
    });

    spyError.mockRestore();
  });

  it('should log retry info on intermediate failures without persisting FailedJob', async () => {
    const mockJob = {
      id: 'job-retry-1',
      attemptsMade: 1,
      opts: { attempts: 3 },
      data: {
        incidentId: 'inc-888',
        monitorId: 'mon-789',
        eventType: 'OPEN',
      },
    };

    const spyError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await handleFailedJob(mockJob, new Error('Resend timeout'));

    expect(mockFailedJobCreate).not.toHaveBeenCalled();
    expect(spyError).toHaveBeenCalledWith(
      expect.stringContaining('"event":"alert_job_retry"')
    );

    spyError.mockRestore();
  });

  it('should do nothing if job is null', async () => {
    const spyError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await handleFailedJob(null, new Error('some error'));

    expect(mockFailedJobCreate).not.toHaveBeenCalled();
    expect(spyError).not.toHaveBeenCalled();

    spyError.mockRestore();
  });
});
