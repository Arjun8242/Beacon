export * from './redis';
export * from './producer';
export type { MonitorCheckJob } from 'shared';

export const QUEUE_NAMES = {
  MONITOR_CHECKS: 'monitor-checks',
};
