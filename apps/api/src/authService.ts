import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from 'database';
import { env } from './config/env';

function signToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '7d' });
}

export async function register(email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw Object.assign(new Error('Email already in use'), { statusCode: 409 });
  }

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_COST);
  const user = await prisma.user.create({
    data: { email, passwordHash },
    select: { id: true, email: true, createdAt: true },
  });

  return { token: signToken(user.id), user };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always hash even on miss to prevent timing attacks
  const hash = user?.passwordHash ?? '$2a$10$invalidhashfortimingsafety000000000000000000000';
  const valid = await bcrypt.compare(password, hash);

  if (!user || !valid) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  return {
    token: signToken(user.id),
    user: { id: user.id, email: user.email, createdAt: user.createdAt },
  };
}
