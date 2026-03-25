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
        keywords: ['level 4', 'kyber', 'ml-kem', 'pqc', 'crystals', '1024'],
        answer:
          'Level 4 uses NIST ML-KEM-1024 (CRYSTALS-Kyber) for key encapsulation: the sender runs encapsulation against the recipient’s public key, derives an AES-256-GCM key with HKDF-SHA256, and encrypts subject/body. Old mail may show ML-KEM-768 in metadata; new traffic uses 1024-bit parameters.',
      },
      {
        keywords: ['level 2', 'quantum', 'qrng'],
        answer:
          'Level 2 is “quantum-aided” channel hardening: a random seed from the QRNG endpoint is used as HKDF salt while the IKM comes from an ML-KEM-1024 shared secret. RSA-OAEP wrapping is legacy only; new envelopes use Kyber + HKDF + AES-GCM.',
      },
      {
        keywords: ['smtp', 'level 1'],
        answer:
          'Level 1 relays cleartext (or server-processed) payloads over SMTP. Configure SMTP_OUT_HOST / PORT (and auth if needed). Do not use Level 1 for classified content.',
      },
      {
        keywords: ['dilithium', 'mldsa', 'signature'],
        answer:
          'NIST ML-DSA (formerly CRYSTALS-Dilithium) provides post-quantum signatures. This client’s envelopes use authenticated encryption (AES-GCM) after Kyber encapsulation; binding Dilithium-3 signatures to headers/bodies is on the roadmap for non-repudiation.',
      },
      {
        keywords: ['keys', 'public key', 'private key', 'bundle'],
        answer:
          'Your device generates an RSA-OAEP-2048 keypair (legacy compatibility) plus ML-KEM-1024. Public keys are published to the user directory / KMS; private material lives in encryptedKeyBundleV1, unlocked with your login passphrase. TOFU warns on fingerprint changes.',
      },
      {
        keywords: ['otp', 'one-time pad', 'level 3'],
        answer:
          'A true one-time pad needs a physically or QKD-distributed pad, equal to message length, never reused, and destruction after use. Without that infrastructure, Level 3 stays disabled.',
      },
    ];

    const match = faq.find((x) => x.keywords.some((k) => message.includes(k)));
    res.json({
      answer:
        match?.answer ||
        'Ask about Kyber / ML-KEM-1024, Level 2 QRNG, SMTP Level 1, Dilithium / ML-DSA, or your local key bundle.',
      provider: 'faq',
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ message: 'Server error answering question' });
  }
};

module.exports = { compose, chat };
