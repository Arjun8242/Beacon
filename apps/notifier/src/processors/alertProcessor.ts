import type { AlertNotificationJob } from 'shared';
import { checkAndSetIdempotency } from '../cache/idempotency';
import { getRecipientEmailForMonitor } from '../services/recipientService';
import { buildIncidentEmailTemplate } from '../templates/incidentEmail';
import { sendEmail } from '../channels/email';

export async function processAlertJob(data: AlertNotificationJob): Promise<void> {
  const { incidentId, eventType, monitorId } = data;

  const isFirstAttempt = await checkAndSetIdempotency(incidentId, eventType);
  if (!isFirstAttempt) {
    console.log(
      JSON.stringify({
        event: 'alert_skipped_duplicate',
        incidentId,
        eventType,
        monitorId,
        channel: 'email',
        outcome: 'skipped_duplicate',
        reason: 'Idempotency key already exists in Redis',
      })
    );
    return;
  }

  const recipientEmail = await getRecipientEmailForMonitor(monitorId);
  if (!recipientEmail) {
    console.warn(
      JSON.stringify({
        event: 'alert_skipped_missing_recipient',
        incidentId,
        eventType,
        monitorId,
        channel: 'email',
        outcome: 'skipped_missing_recipient',
        reason: 'No user/email associated with monitor',
      })
    );
    return;
  }

  const { subject, html, text } = buildIncidentEmailTemplate(data);

  const idempotencyKey = `alert-${incidentId}-${eventType}`;
  try {
    await sendEmail({
      to: recipientEmail,
      subject,
      html,
      text,
      idempotencyKey,
    });

    console.log(
      JSON.stringify({
        event: 'alert_email_sent',
        incidentId,
        eventType,
        monitorId,
        channel: 'email',
        outcome: 'success',
        recipient: recipientEmail,
        idempotencyKey,
      })
    );
  } catch (err: any) {
    console.error(
      JSON.stringify({
        event: 'alert_email_send_failed',
        incidentId,
        eventType,
        monitorId,
        channel: 'email',
        outcome: 'failed',
        error: err?.message || String(err),
      })
    );
    throw err;
  }
}
