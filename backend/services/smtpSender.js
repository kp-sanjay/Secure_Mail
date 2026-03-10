const nodemailer = require('nodemailer');

function boolFromEnv(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const v = String(value).toLowerCase().trim();
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false;
  return defaultValue;
}

function envelopeToMail(envelope) {
  const level = envelope?.level ?? null;
  const subject =
    level === 1
      ? (envelope?.content?.subject || '(no subject)')
      : `QDK Secure Mail (Encrypted, L${level ?? '?'})`;

  const text =
    level === 1
      ? (envelope?.content?.body || '')
      : `QDK-ENVELOPE-JSON\n${JSON.stringify(envelope, null, 2)}`;

  return { subject, text, level };
}

async function getTransport() {
  const host = process.env.SMTP_OUT_HOST;
  const port = Number(process.env.SMTP_OUT_PORT || 587);
  const secure = boolFromEnv(process.env.SMTP_OUT_SECURE, port === 465);

  if (!host) {
    throw new Error('SMTP_OUT_HOST is not set');
  }

  const user = process.env.SMTP_OUT_USER;
  const pass = process.env.SMTP_OUT_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  });
}

async function sendSmtpMail({ from, to, envelope }) {
  const transport = await getTransport();
  const { subject, text, level } = envelopeToMail(envelope);

  const info = await transport.sendMail({
    from,
    to,
    subject,
    text,
    headers: {
      'X-QDK-Level': level != null ? String(level) : '',
      'X-QDK-Envelope-Version': envelope?.v != null ? String(envelope.v) : '',
      'X-QDK-Format': 'qdk-envelope-json',
    },
  });

  return { messageId: info.messageId || null, response: info.response || null };
}

module.exports = { sendSmtpMail };

