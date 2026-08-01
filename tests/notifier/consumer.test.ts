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
    status: 'ready',
  },
  QUEUE_NAMES: {
    ALERT_NOTIFICATIONS: 'alert-notifications',
  },
}));

vi.mock('../../apps/notifier/src/channels/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: 'msg-1' }),
}));

const mockOn = vi.fn().mockReturnThis();

vi.mock('bullmq', () => {
  return {
    Worker: vi.fn().mockImplementation(function (name: string, processor: any, opts: any) {
      return {
        name,
        processor,
        opts,
        on: mockOn,
        close: vi.fn().mockResolvedValue(undefined),
      };
    }),
  };
});

import { processAlertJob, createAlertConsumer } from '../../apps/notifier/src/consumer';
import { sendEmail } from '../../apps/notifier/src/channels/email';
import type { Job } from 'bullmq';
import type { AlertNotificationJob } from 'shared';

describe('processAlertJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process alert job successfully without throwing', async () => {
    const mockJob: Partial<Job<AlertNotificationJob>> = {
      id: 'job-123',
      data: {
        incidentId: 'inc-456',
        monitorId: 'mon-789',
        monitorName: 'API Service',
        url: 'https://api.example.com',
        eventType: 'OPEN',
        startedAt: new Date().toISOString(),
      },
    };

    const spyLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(processAlertJob(mockJob.data!)).resolves.not.toThrow();

    expect(spyLog).toHaveBeenCalledWith(
      expect.stringContaining('"event":"alert_email_sent"')
    );

    spyLog.mockRestore();
  });

  it('should log structured JSON and re-throw error when sendEmail fails', async () => {
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('Resend rate limit exceeded'));
    const spyError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const jobData: AlertNotificationJob = {
      incidentId: 'inc-456',
      monitorId: 'mon-789',
      monitorName: 'API Service',
      url: 'https://api.example.com',
      eventType: 'OPEN',
      startedAt: new Date().toISOString(),
    };

    await expect(processAlertJob(jobData)).rejects.toThrow('Resend rate limit exceeded');
    expect(spyError).toHaveBeenCalledWith(
      expect.stringContaining('"outcome":"failed"')
    );

    spyError.mockRestore();
  });
});

describe('createAlertConsumer Dead Letter Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize BullMQ Worker instance on ALERT_NOTIFICATIONS queue', () => {
    const worker = createAlertConsumer();
    expect(worker).toBeDefined();
    expect(worker.name).toBe('alert-notifications');
  });

  it('should persist row to FailedJob when attemptsMade >= attempts on worker failed event', async () => {
    const worker = createAlertConsumer();
    console.log('worker:', worker, 'worker.on:', worker.on, 'isMock:', (worker.on as any)._isMockFunction);
    console.log('mockOn calls length:', mockOn.mock.calls.length, 'calls:', mockOn.mock.calls);
    const failedHandlerCall = mockOn.mock.calls.find((call) => call[0] === 'failed');
    expect(failedHandlerCall).toBeDefined();
    const failedHandler = failedHandlerCall[1];

    const mockJob = {
      id: 'job-dead-letter-1',
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
    const mockError = new Error('DNS lookup failure');

    const spyError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await failedHandler(mockJob, mockError);

    expect(mockFailedJobCreate).toHaveBeenCalledWith({
      data: {
        jobType: 'EMAIL_NOTIFICATION',
        monitorId: 'mon-789',
        jobId: 'job-dead-letter-1',
        payload: mockJob.data,
        errorMessage: 'DNS lookup failure',
        attemptsMade: 3,
        failedAt: expect.any(Date),
      },
    });

    spyError.mockRestore();
  });
});

