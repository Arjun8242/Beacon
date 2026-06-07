import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

// Prisma known error codes we care about
const PRISMA_UNIQUE_VIOLATION = 'P2002';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation error', details: err.flatten().fieldErrors });
    return;
  }

  // Prisma unique constraint
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === PRISMA_UNIQUE_VIOLATION
  ) {
    res.status(409).json({ error: 'Resource already exists' });
    return;
  }

  // Generic errors with an attached statusCode (thrown by services)
  if (err instanceof Error) {
    const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500;
    res.status(statusCode).json({ error: err.message });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
