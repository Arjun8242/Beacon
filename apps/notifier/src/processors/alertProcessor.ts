import type { AlertNotificationJob } from 'shared';
import { checkAndSetIdempotency } from '../cache/idempotency';
import { getRecipientEmailForMonitor } from '../services/recipientService';
import { buildIncidentEmailTemplate } from '../templates/incidentEmail';
import { sendEmail } from '../channels/email';

export async function processAlertJob(data: AlertNotificationJob): Promise<void> {
  const { incidentId, eventType, monitorId, monitorName } = data;

  const isFirstAttempt = await checkAndSetIdempotency(incidentId, eventType);
  if (!isFirstAttempt) {
    console.log(
      JSON.stringify({
        event: 'alert_send_attempt',
        incidentId,
        eventType,
        monitorId,
        channel: 'email',
        outcome: 'skipped_duplicate',
      })
    );
    return;
  }

  const recipientEmail = await getRecipientEmailForMonitor(monitorId);
  if (!recipientEmail) {
    console.warn(
      JSON.stringify({
        event: 'alert_send_attempt',
        incidentId,
        eventType,
        monitorId,
        channel: 'email',
        outcome: 'skipped_no_recipient',
      })
    );
    return;
  }

  const { subject, html, text } = buildIncidentEmailTemplate(data);
  const idempotencyKey = `alert-${incidentId}-${eventType}`;

  await sendEmail({
    to: recipientEmail,
    subject,
    html,
    text,
    idempotencyKey,
  });

  console.log(
    JSON.stringify({
      event: 'alert_send_attempt',
      incidentId,
      eventType,
      monitorId,
      monitorName,
      channel: 'email',
      outcome: 'sent',
      recipient: recipientEmail,
    })
  );
}
