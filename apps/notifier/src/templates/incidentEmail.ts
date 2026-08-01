import type { AlertNotificationJob } from 'shared';

export function formatDowntimeDuration(startedAt: Date | string, resolvedAt?: Date | string): string {
  const start = new Date(startedAt).getTime();
  const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function buildIncidentEmailTemplate(job: AlertNotificationJob): {
  subject: string;
  html: string;
  text: string;
} {
  const { monitorName, url, eventType, startedAt, resolvedAt } = job;
  const startedDateStr = new Date(startedAt).toUTCString();

  if (eventType === 'OPEN') {
    const subject = `🚨 [DOWN] Alert: ${monitorName} is down`;
    const html = `
      <div style="font-family: 'Inter', system-ui, sans-serif; background-color: #091624; color: #f3e8cb; padding: 24px; border-radius: 8px;">
        <h2 style="color: #bf3b2c; margin-top: 0;">🚨 Outage Detected — Beacon Watchtower</h2>
        <p style="font-size: 16px;">An outage has been confirmed for <strong>${monitorName}</strong>.</p>
        <div style="background-color: #0d2236; border-left: 4px solid #bf3b2c; padding: 16px; margin: 16px 0; border-radius: 4px;">
          <p style="margin: 4px 0;"><strong>Monitor:</strong> ${monitorName}</p>
          <p style="margin: 4px 0;"><strong>URL:</strong> <a href="${url}" style="color: #c9a35c; text-decoration: underline;">${url}</a></p>
          <p style="margin: 4px 0;"><strong>Detected At:</strong> ${startedDateStr}</p>
          <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: #bf3b2c; font-weight: bold;">DOWN</span></p>
        </div>
        <p style="color: #a9bbcd; font-size: 12px; margin-bottom: 0;">Beacon Distributed Uptime Monitoring Platform</p>
      </div>
    `;
    const text = `🚨 OUTAGE DETECTED: ${monitorName}\n\nMonitor: ${monitorName}\nURL: ${url}\nDetected At: ${startedDateStr}\nStatus: DOWN\n\nBeacon Distributed Uptime Monitoring`;
    return { subject, html, text };
  }

  // eventType === 'RESOLVED'
  const duration = formatDowntimeDuration(startedAt, resolvedAt);
  const resolvedDateStr = resolvedAt ? new Date(resolvedAt).toUTCString() : new Date().toUTCString();
  const subject = `✅ [RESOLVED] Alert: ${monitorName} is back up`;
  const html = `
    <div style="font-family: 'Inter', system-ui, sans-serif; background-color: #091624; color: #f3e8cb; padding: 24px; border-radius: 8px;">
      <h2 style="color: #5fae6e; margin-top: 0;">✅ Incident Resolved — Beacon Watchtower</h2>
      <p style="font-size: 16px;"><strong>${monitorName}</strong> has recovered and is operational.</p>
      <div style="background-color: #0d2236; border-left: 4px solid #5fae6e; padding: 16px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 4px 0;"><strong>Monitor:</strong> ${monitorName}</p>
        <p style="margin: 4px 0;"><strong>URL:</strong> <a href="${url}" style="color: #c9a35c; text-decoration: underline;">${url}</a></p>
        <p style="margin: 4px 0;"><strong>Started At:</strong> ${startedDateStr}</p>
        <p style="margin: 4px 0;"><strong>Resolved At:</strong> ${resolvedDateStr}</p>
        <p style="margin: 4px 0;"><strong>Downtime Duration:</strong> <span style="color: #5fae6e; font-weight: bold;">${duration}</span></p>
      </div>
      <p style="color: #a9bbcd; font-size: 12px; margin-bottom: 0;">Beacon Distributed Uptime Monitoring Platform</p>
    </div>
  `;
  const text = `✅ INCIDENT RESOLVED: ${monitorName}\n\nMonitor: ${monitorName}\nURL: ${url}\nStarted At: ${startedDateStr}\nResolved At: ${resolvedDateStr}\nDowntime Duration: ${duration}\n\nBeacon Distributed Uptime Monitoring`;
  return { subject, html, text };
}
