import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_HOST: z.string().default('localhost').optional(),
  REDIS_PORT: z.coerce.number().int().positive().default(6379).optional(),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  DEFAULT_TIMEOUT: z.coerce.number().int().positive().default(10000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
