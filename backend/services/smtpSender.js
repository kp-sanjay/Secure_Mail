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

let etherealAccount = null;

async function getTransport() {
  const host = process.env.SMTP_OUT_HOST;
  const port = Number(process.env.SMTP_OUT_PORT || 587);
  const secure = boolFromEnv(process.env.SMTP_OUT_SECURE, port === 465);

  if (!host) {
    if (!etherealAccount) {
      console.log('⚠️ No SMTP keys configured. Generating an Ethereal test account...');
      etherealAccount = await nodemailer.createTestAccount();
    }
    return nodemailer.createTransport({
      host: etherealAccount.smtp.host,
      port: etherealAccount.smtp.port,
      secure: etherealAccount.smtp.secure,
      auth: {
        user: etherealAccount.user,
        pass: etherealAccount.pass,
      },
    });
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
    from: from || '"Test QDK Sender" <sender@test.com>',
    to,
    subject,
    text,
    headers: {
      'X-QDK-Level': level != null ? String(level) : '',
      'X-QDK-Envelope-Version': envelope?.v != null ? String(envelope.v) : '',
      'X-QDK-Format': 'qdk-envelope-json',
    },
  });

  if (!process.env.SMTP_OUT_HOST) {
    console.log(`\n📧 Envelope Email sent! Preview URL: ${nodemailer.getTestMessageUrl(info)}\n`);
  }

  return { messageId: info.messageId || null, response: info.response || null };
}

async function sendOtpMail({ from, to, otp }) {
  const transport = await getTransport();
  const subject = "Secure Mail Unlock: Action Required";
  const text = `You've received a Level 3 Secure Mail.\n\nYour One-Time Password (OTP) unlock code is: ${otp}\n\nPlease enter this code to decrypt and view the contents of the message.\n\n-- QDK Mail Client`;

  const info = await transport.sendMail({
    from: from || '"Test QDK Sender" <sender@test.com>',
    to,
    subject,
    text,
    headers: {
      'X-QDK-Level': '3',
      'X-QDK-Action': 'OTP-Unlock',
    },
  });

  if (!process.env.SMTP_OUT_HOST) {
    console.log(`\n📧 OTP Email sent! Preview URL: ${nodemailer.getTestMessageUrl(info)}\n`);
  }

  return { messageId: info.messageId || null, response: info.response || null };
}

module.exports = { sendSmtpMail, sendOtpMail };

