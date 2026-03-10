const { SMTPServer } = require('smtp-server');
const { simpleParser } = require('mailparser');
const Email = require('../models/Email');
const User = require('../models/User');

function boolFromEnv(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const v = String(value).toLowerCase().trim();
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false;
  return defaultValue;
}

function extractEnvelopeFromText(text) {
  if (!text) return null;
  const marker = 'QDK-ENVELOPE-JSON';
  const idx = text.indexOf(marker);
  if (idx === -1) return null;
  const jsonPart = text.slice(idx + marker.length).trim();
  try {
    return JSON.parse(jsonPart);
  } catch {
    return null;
  }
}

async function storeInboundMessage({ parsed, smtpSession }) {
  const rcptTo = smtpSession?.envelope?.rcptTo || [];
  const toAddr = rcptTo[0]?.address?.toLowerCase?.() || null;
  if (!toAddr) return;

  const receiver = await User.findOne({ email: toAddr });
  if (!receiver) return;

  const fromAddr = parsed?.from?.value?.[0]?.address?.toLowerCase?.() || null;
  const sender = fromAddr ? await User.findOne({ email: fromAddr }) : null;

  const text = parsed?.text || '';
  const envelope = extractEnvelopeFromText(text);
  const level = envelope?.level ?? (parsed?.headers?.get?.('x-qdk-level') ? Number(parsed.headers.get('x-qdk-level')) : null);

  await Email.create({
    sender: sender?._id || receiver._id,
    receiver: receiver._id,
    envelope: envelope || (level === 1 ? {
      v: 1,
      level: 1,
      createdAt: new Date().toISOString(),
      from: fromAddr || '(unknown)',
      to: toAddr,
      content: { subject: parsed?.subject || '', body: text },
    } : null),
    securityLevel: level,
    transport: 'smtp',
    smtpMessageId: parsed?.messageId || null,
    nonce: Date.now().toString(),
    timestamp: new Date(),
    isDraft: false,
    isDeleted: false,
  });
}

function startInboundSmtpServer() {
  const enabled = boolFromEnv(process.env.SMTP_IN_ENABLED, false);
  if (!enabled) return null;

  const port = Number(process.env.SMTP_IN_PORT || 2525);
  const host = process.env.SMTP_IN_HOST || '0.0.0.0';

  const server = new SMTPServer({
    disabledCommands: ['AUTH'],
    onData(stream, session, callback) {
      simpleParser(stream)
        .then((parsed) => storeInboundMessage({ parsed, smtpSession: session }))
        .then(() => callback())
        .catch((err) => {
          console.error('SMTP inbound parse/store error:', err);
          callback(err);
        });
    },
  });

  server.listen(port, host, () => {
    console.log(`Inbound SMTP server listening on ${host}:${port}`);
  });

  return server;
}

module.exports = { startInboundSmtpServer };

