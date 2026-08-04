import { describe, it, expect } from 'vitest';
import { formatDowntimeDuration, buildIncidentEmailTemplate } from '../../apps/notifier/src/templates/incidentEmail';
import type { AlertNotificationJob } from 'shared';

describe('formatDowntimeDuration', () => {
  it('should format seconds when under 60 seconds', () => {
    const start = new Date(1000000).toISOString();
    const end = new Date(1045000).toISOString(); // 45 seconds
    expect(formatDowntimeDuration(start, end)).toBe('45s');
  });

  it('should format minutes and seconds when under 60 minutes', () => {
    const start = new Date(1000000).toISOString();
    const end = new Date(1155000).toISOString(); // 2m 35s
    expect(formatDowntimeDuration(start, end)).toBe('2m 35s');
  });

  it('should format hours and minutes when over 60 minutes', () => {
    const start = new Date(1000000).toISOString();
    const end = new Date(1000000 + 3600000 + 900000).toISOString(); // 1h 15m
    expect(formatDowntimeDuration(start, end)).toBe('1h 15m');
  });
});

describe('buildIncidentEmailTemplate', () => {
  it('should generate OPEN incident email template', () => {
    const job: AlertNotificationJob = {
      incidentId: 'inc-100',
      monitorId: 'mon-100',
      monitorName: 'Auth Service',
      url: 'https://auth.example.com',
      eventType: 'OPEN',
      startedAt: '2026-08-01T12:00:00Z',
    };

    const { subject, html, text } = buildIncidentEmailTemplate(job);

    expect(subject).toBe('🚨 [DOWN] Alert: Auth Service is down');
    expect(html).toContain('Auth Service');
    expect(html).toContain('https://auth.example.com');
    expect(html).toContain('DOWN');
    expect(text).toContain('🚨 OUTAGE DETECTED: Auth Service');
  });

  it('should generate RESOLVED incident email template with downtime duration', () => {
    const job: AlertNotificationJob = {
      incidentId: 'inc-101',
      monitorId: 'mon-100',
      monitorName: 'Auth Service',
      url: 'https://auth.example.com',
      eventType: 'RESOLVED',
      startedAt: '2026-08-01T12:00:00Z',
      resolvedAt: '2026-08-01T12:05:30Z',
    };

    const { subject, html, text } = buildIncidentEmailTemplate(job);

    expect(subject).toBe('✅ [RESOLVED] Alert: Auth Service is back up');
    expect(html).toContain('Auth Service');
    expect(html).toContain('https://auth.example.com');
    expect(html).toContain('5m 30s');
    expect(text).toContain('✅ INCIDENT RESOLVED: Auth Service');
    expect(text).toContain('5m 30s');
  });
});
