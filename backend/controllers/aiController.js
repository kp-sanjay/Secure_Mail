function clampText(s, max = 8000) {
  const str = String(s || '');
  return str.length > max ? str.slice(0, max) : str;
}

function buildProfessionalEmail({ purpose, tone, recipientName, senderName, details }) {
  const safePurpose = clampText(purpose, 500).trim();
  const safeTone = (tone || 'professional').toLowerCase();
  const safeRecipient = clampText(recipientName, 120).trim();
  const safeSender = clampText(senderName, 120).trim();
  const safeDetails = clampText(details, 4000).trim();

  const subject = safePurpose
    ? safePurpose.length > 80
      ? `${safePurpose.slice(0, 77)}...`
      : safePurpose
    : 'Regarding our discussion';

  const greetingName = safeRecipient ? ` ${safeRecipient}` : '';

  const toneLine =
    safeTone === 'friendly'
      ? 'Hope you’re doing well.'
      : safeTone === 'formal'
        ? 'I hope this message finds you well.'
        : 'I hope you are doing well.';

  const bodyParts = [
    `Dear${greetingName},`,
    '',
    toneLine,
    '',
    safePurpose ? `I’m reaching out regarding: ${safePurpose}.` : `I’m reaching out regarding the following matter.`,
    safeDetails ? `\nDetails:\n${safeDetails}` : '',
    '',
    'Please let me know if you have any questions or would like to discuss next steps.',
    '',
    `Sincerely,`,
    safeSender || '—',
  ].filter(Boolean);

  return { subject, body: bodyParts.join('\n') };
}

const compose = async (req, res) => {
  try {
    const { purpose, tone, recipientName, senderName, details } = req.body || {};
    const result = buildProfessionalEmail({ purpose, tone, recipientName, senderName, details });
    res.json({ ...result, provider: 'template', model: null });
  } catch (error) {
    console.error('AI compose error:', error);
    res.status(500).json({ message: 'Server error generating draft' });
  }
};

const chat = async (req, res) => {
  try {
    const message = clampText(req.body?.message, 2000).toLowerCase();

    const faq = [
      {
        keywords: ['level 4', 'kyber', 'ml-kem', 'pqc'],
        answer:
          'Level 4 uses post-quantum key establishment (ML-KEM/Kyber) plus AES-GCM for message encryption. Make sure both users have published ML-KEM public keys, and you have your ML-KEM secret key loaded (login password decrypts your key bundle).',
      },
      {
        keywords: ['level 2', 'quantum', 'qrng'],
        answer:
          'Level 2 derives an AES key from a quantum-random seed (currently simulated QRNG on the server), then transports that AES key to the recipient using RSA-OAEP. Configure a real QRNG provider later by replacing the simulated seed endpoint.',
      },
      {
        keywords: ['smtp', 'level 1'],
        answer:
          'Level 1 sends basic mail via SMTP with no encryption. The server must be configured with SMTP_OUT_HOST/PORT (and optionally credentials).',
      },
      {
        keywords: ['keys', 'public key', 'private key', 'bundle'],
        answer:
          'Your app generates an RSA keypair and an ML-KEM keypair. Public keys are published to the server/KMS directory; private keys are stored locally encrypted with your password. If recipient keys change, the app warns you (TOFU) before sending.',
      },
      {
        keywords: ['otp', 'one-time pad', 'level 3'],
        answer:
          'Level 3 (One-Time Pad) requires a shared pad/key distribution setup (e.g., QKD or pre-shared pads) and strict non-reuse accounting. It’s not enabled by default because it needs a separate key distribution and synchronization module.',
      },
    ];

    const match = faq.find((x) => x.keywords.some((k) => message.includes(k)));
    res.json({
      answer:
        match?.answer ||
        'I can help with Levels 1/2/4, key setup, SMTP configuration, and troubleshooting. Ask about “Level 4”, “SMTP”, “keys”, or “QRNG”.',
      provider: 'faq',
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ message: 'Server error answering question' });
  }
};

module.exports = { compose, chat };

