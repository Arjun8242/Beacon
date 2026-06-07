import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  BCRYPT_COST: z.coerce.number().int().min(1).max(20).default(10),
  API_PORT: z.coerce.number().int().positive().default(3001),//z.coerce converts string to number
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
