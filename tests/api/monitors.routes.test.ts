import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('database', () => ({
  prisma: {
    monitor: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
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

describe('monitor routes', () => {
  beforeAll(async () => {
    const express = (await import('express')).default;
    const { default: monitorsRouter } = await import('../../apps/api/src/routes/monitors');
    const { errorHandler } = await import('../../apps/api/src/errorHandler');

    const app = express();
    app.use(express.json());
    app.use('/api/v1/monitors', monitorsRouter);
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

  it('creates a monitor', async () => {
    vi.mocked(prisma.monitor.create).mockResolvedValue({
      id: 'mon-1',
      userId: 'user-1',
      name: 'Test Monitor',
      slug: 'test-monitor-123',
      url: 'https://example.com',
      interval: 60,
      active: true,
      status: 'PENDING',
    } as never);

    const response = await request('/api/v1/monitors', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Monitor',
        url: 'https://example.com',
        interval: 60,
      }),
    });

    expect(response.status).toBe(201);
    const body = await response.json() as any;
    expect(body.monitor.id).toBe('mon-1');
  });

  it('lists monitors for current user', async () => {
    vi.mocked(prisma.monitor.findMany).mockResolvedValue([{ id: 'mon-1' }] as never);
    vi.mocked(prisma.monitor.count).mockResolvedValue(1 as never);

    const response = await request('/api/v1/monitors?page=1&limit=10');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.monitors).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it('gets a single monitor', async () => {
    vi.mocked(prisma.monitor.findUnique).mockResolvedValue({ id: 'mon-1', userId: 'user-1' } as never);

    const response = await request('/api/v1/monitors/mon-1');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.monitor.id).toBe('mon-1');
  });

  it('returns 404 if monitor not owned by user', async () => {
    vi.mocked(prisma.monitor.findUnique).mockResolvedValue({ id: 'mon-2', userId: 'some-other-user' } as never);

    const response = await request('/api/v1/monitors/mon-2');
    expect(response.status).toBe(404);
  });

  it('updates a monitor', async () => {
    vi.mocked(prisma.monitor.findUnique).mockResolvedValue({ id: 'mon-1', userId: 'user-1' } as never);
    vi.mocked(prisma.monitor.update).mockResolvedValue({ id: 'mon-1', interval: 120 } as never);

    const response = await request('/api/v1/monitors/mon-1', {
      method: 'PATCH',
      body: JSON.stringify({ interval: 120 }),
    });

    expect(response.status).toBe(200);
    expect(prisma.monitor.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { interval: 120 } })
    );
  });

  it('deletes a monitor', async () => {
    vi.mocked(prisma.monitor.findUnique).mockResolvedValue({ id: 'mon-1', userId: 'user-1' } as never);
    vi.mocked(prisma.monitor.delete).mockResolvedValue({} as never);

    const response = await request('/api/v1/monitors/mon-1', {
      method: 'DELETE',
    });

    expect(response.status).toBe(204);
  });

  it('pauses a monitor', async () => {
    vi.mocked(prisma.monitor.findUnique).mockResolvedValue({ id: 'mon-1', userId: 'user-1' } as never);
    vi.mocked(prisma.monitor.update).mockResolvedValue({ id: 'mon-1', active: false } as never);

    const response = await request('/api/v1/monitors/mon-1/pause', {
      method: 'POST',
    });

    expect(response.status).toBe(200);
    expect(prisma.monitor.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ active: false, status: 'PAUSED' }) })
    );
  });
});