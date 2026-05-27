import { z } from 'zod';

export const MonitorStatus = {
  UP: 'UP',
  DOWN: 'DOWN',
  PAUSED: 'PAUSED',
} as const;

export type MonitorStatus = typeof MonitorStatus[keyof typeof MonitorStatus];

export const CreateMonitorSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET'),
  interval: z.number().min(10).max(86400).default(60),
});

export type CreateMonitorDTO = z.infer<typeof CreateMonitorSchema>;
