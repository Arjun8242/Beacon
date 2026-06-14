import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('database', () => ({
  prisma: {
    monitor: {
      findUnique: vi.fn(),
    },
    check: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    incident: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (args) => Promise.all(args)),
  },
}));

vi.mock('../../apps/api/src/config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret',
  },
}));

import { prisma } from 'database';

let server: any;
let port: number;

describe('metrics routes', () => {
  beforeAll(async () => {
    const express = (await import('express')).default;
    const { default: metricsRouter } = await import('../../apps/api/src/routes/metrics');
    const { errorHandler } = await import('../../apps/api/src/errorHandler');

    const app = express();
    app.use(express.json());
    // Attach router to the proper nested path
    app.use('/api/v1/monitors/:id', metricsRouter);
    app.use(errorHandler);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (typeof address === 'object' && address !== null) {
          port = address.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server.close((err: Error | undefined) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validToken = jwt.sign({ userId: 'user-1' }, 'test-secret', { expiresIn: '7d' });

  async function request(path: string, init?: RequestInit) {
    return fetch(`http://127.0.0.1:${port}${path}`, {
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${validToken}`,
        ...(init?.headers ?? {}),
      },
      ...init,
    });
  }

  it('gets stats and asserts ownership', async () => {
    vi.mocked(prisma.monitor.findUnique).mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{
      total: 100n,
      up_count: 99n,
      avg_response_time: 150.5
    }] as never);

    const response = await request('/api/v1/monitors/mon-1/stats?window=24h');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.totalChecks).toBe(100);
    expect(body.uptimePercent).toBe(99);
    expect(body.avgResponseTime).toBe(151);
  });

  it('gets checks history', async () => {
    vi.mocked(prisma.monitor.findUnique).mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(prisma.check.findMany).mockResolvedValue([{ id: 'check-1', responseTime: 120 }] as never);
    vi.mocked(prisma.check.count).mockResolvedValue(1 as never);

    const response = await request('/api/v1/monitors/mon-1/checks');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.checks).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it('gets incidents history', async () => {
    vi.mocked(prisma.monitor.findUnique).mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(prisma.incident.findMany).mockResolvedValue([{ id: 'inc-1', durationSeconds: 600 }] as never);
    vi.mocked(prisma.incident.count).mockResolvedValue(1 as never);

    const response = await request('/api/v1/monitors/mon-1/incidents');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.incidents).toHaveLength(1);
  });

  it('gets bucketed latency', async () => {
    vi.mocked(prisma.monitor.findUnique).mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { bucket: new Date('2026-06-13T10:00:00.000Z'), avg: 100, min: 90, max: 200 }
    ] as never);

    const response = await request('/api/v1/monitors/mon-1/latency?window=7d');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body[0].avg).toBe(100);
  });

  it('fails if user does not own monitor', async () => {
    vi.mocked(prisma.monitor.findUnique).mockResolvedValue({ userId: 'wrong-user' } as never);

    const response = await request('/api/v1/monitors/mon-1/stats');
    expect(response.status).toBe(404);
  });
});