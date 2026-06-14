import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('../../apps/api/src/config/env', () => ({
  env: {
    DATABASE_URL: 'postgresql://localhost:5432/test',
    JWT_SECRET: 'test-secret',
    BCRYPT_COST: 1,
    API_PORT: 3001,
  },
}));

import { prisma } from 'database';

let server: any;
let port: number;

describe('auth routes', () => {
  beforeAll(async () => {
    const express = (await import('express')).default;
    const { default: authRouter } = await import('../../apps/api/src/routes/auth');
    const { errorHandler } = await import('../../apps/api/src/errorHandler');

    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', authRouter);
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
    if (!server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error: Error | undefined) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function request(path: string, init?: RequestInit) {
    return fetch(`http://127.0.0.1:${port}${path}`, {
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
    });
  }

  it('registers a user and returns a token', async () => {
    const createdAt = new Date('2026-06-13T12:00:00.000Z');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'user-1',
      email: 'arjun@example.com',
      createdAt,
    } as never);

    const response = await request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'arjun@example.com',
        password: 'password123',
      }),
    });

    expect(response.status).toBe(201);

    const body = (await response.json()) as {
      token: string;
      user: { id: string; email: string; createdAt: string };
    };

    expect(body.user).toEqual({
      id: 'user-1',
      email: 'arjun@example.com',
      createdAt: createdAt.toISOString(),
    });
    expect(body.token).toBeTruthy();

    const tokenPayload = jwt.verify(body.token, 'test-secret') as { userId: string };
    expect(tokenPayload.userId).toBe('user-1');

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'arjun@example.com',
          passwordHash: expect.any(String),
        }),
      }),
    );
  });

  it('rejects invalid registration payloads', async () => {
    const response = await request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'not-an-email',
        password: 'short',
      }),
    });

    expect(response.status).toBe(400);

    const body = (await response.json()) as {
      error: string;
      details: Record<string, string[]>;
    };

    expect(body.error).toBe('Validation error');
    expect(body.details.email).toContain('Invalid email');
    expect(body.details.password).toContain('String must contain at least 8 character(s)');
  });

  it('rejects duplicate registrations with a conflict error', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-4',
      email: 'arjun@example.com',
      passwordHash: 'existing-hash',
      createdAt: new Date('2026-06-13T12:00:00.000Z'),
    } as never);

    const response = await request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'arjun@example.com',
        password: 'password123',
      }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Email already in use' });
  });

  it('logs in an existing user', async () => {
    const passwordHash = await bcrypt.hash('password123', 1);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-2',
      email: 'arjun@example.com',
      passwordHash,
      createdAt: new Date('2026-06-13T12:00:00.000Z'),
    } as never);

    const response = await request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'arjun@example.com',
        password: 'password123',
      }),
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      token: string;
      user: { id: string; email: string; createdAt: string };
    };

    expect(body.user.email).toBe('arjun@example.com');
    expect(jwt.verify(body.token, 'test-secret')).toMatchObject({ userId: 'user-2' });
  });

  it('rejects invalid login credentials', async () => {
    const passwordHash = await bcrypt.hash('password123', 1);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-5',
      email: 'arjun@example.com',
      passwordHash,
      createdAt: new Date('2026-06-13T12:00:00.000Z'),
    } as never);

    const response = await request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'arjun@example.com',
        password: 'wrong-password',
      }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Invalid credentials' });
  });

  it('returns the current user for a valid session token', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-3',
      email: 'arjun@example.com',
      createdAt: new Date('2026-06-13T12:00:00.000Z'),
    } as never);

    const token = jwt.sign({ userId: 'user-3' }, 'test-secret', { expiresIn: '7d' });

    const response = await request('/api/v1/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      user: { id: string; email: string; createdAt: string };
    };

    expect(body.user).toEqual({
      id: 'user-3',
      email: 'arjun@example.com',
      createdAt: '2026-06-13T12:00:00.000Z',
    });
  });

  it('rejects requests without an authorization token', async () => {
    const response = await request('/api/v1/auth/me', {
      method: 'GET',
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: 'Missing or invalid Authorization header',
    });
  });

  it('rejects malformed tokens on /me', async () => {
    const response = await request('/api/v1/auth/me', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer not-a-valid-token',
      },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Invalid or expired token' });
  });
});