import { Resend } from 'resend';
import { env } from '../config/env';

const resend = new Resend(env.RESEND_API_KEY);

export type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
};

export async function sendEmail(options: SendEmailOptions) {
  const { to, subject, html, text, idempotencyKey } = options;

  const headers: Record<string, string> = {};
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const result = await resend.emails.send({
    from: env.SENDER_ADDRESS,
    to,
    subject,
    html,
    text,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });

  if (result.error) {
    throw new Error(`Resend email dispatch error: ${result.error.message}`);
  }

  return result.data;
}
