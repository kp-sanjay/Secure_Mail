import { decryptAES, decryptRSA, encryptAES, importAESKey } from './crypto';
import { mlkemDecapBase64, mlkemEncapBase64 } from './pqc';

function b64ToU8(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function u8ToB64(u8) {
  let binary = '';
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
  return btoa(binary);
}

async function sha256B64(dataU8) {
  const hash = await crypto.subtle.digest('SHA-256', dataU8);
  return u8ToB64(new Uint8Array(hash));
}

async function hkdfAesGcmKeyFromSecretB64(sharedSecretB64, { saltB64, info }) {
  const secretBytes = b64ToU8(sharedSecretB64);
  const salt = b64ToU8(saltB64);
  const infoBytes = new TextEncoder().encode(info);

  const keyMaterial = await crypto.subtle.importKey('raw', secretBytes, 'HKDF', false, ['deriveKey']);
  return await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: infoBytes },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

function newSaltB64(bytes = 16) {
  const salt = crypto.getRandomValues(new Uint8Array(bytes));
  return u8ToB64(salt);
}

function resolveKemName(envelope) {
  const kem = envelope?.alg?.kem;
  if (kem === 'ML-KEM-768' || kem === 'MLKEM768') return 'ML-KEM-768';
  const info = envelope?.kdf?.info || '';
  if (String(info).includes('MLKEM768') || String(info).includes('768')) return 'ML-KEM-768';
  return 'ML-KEM-1024';
}

export async function encryptEnvelope({
  level,
  senderEmail,
  receiverEmail,
  receiverPublicKeyPem: _receiverPublicKeyPem,
  receiverMlKemPublicKeyB64,
  subject,
  body,
  quantumSeedB64,
}) {
  const createdAt = new Date().toISOString();

  if (level === 1) {
    return {
      v: 1,
      level: 1,
      createdAt,
      from: senderEmail,
      to: receiverEmail,
      content: { subject, body },
    };
  }

  if (level === 2) {
    if (!receiverMlKemPublicKeyB64) {
      throw new Error('Receiver ML-KEM public key missing (required for Level 2 Kyber transport)');
    }

    const seedBytes = quantumSeedB64 ? b64ToU8(quantumSeedB64) : crypto.getRandomValues(new Uint8Array(32));
    const seedHashB64 = await sha256B64(seedBytes);
    const saltB64 = u8ToB64(seedBytes);

    const { ciphertextB64, sharedSecretB64 } = await mlkemEncapBase64(
      receiverMlKemPublicKeyB64,
      'ML-KEM-1024'
    );

    const info = 'QDK-L2-QuantumAided-Kyber-v2';
    const aesKey = await hkdfAesGcmKeyFromSecretB64(sharedSecretB64, { saltB64, info });

    const encSubject = await encryptAES(aesKey, subject);
    const encBody = await encryptAES(aesKey, body);

    return {
      v: 1,
      level: 2,
      createdAt,
      from: senderEmail,
      to: receiverEmail,
      alg: {
        content: 'AES-256-GCM',
        kem: 'ML-KEM-1024',
        kdf: 'HKDF-SHA256',
        mode: 'quantum-aided-kyber',
      },
      kdf: { saltB64, info },
      quantum: {
        seedSource: quantumSeedB64 ? 'qrng-endpoint' : 'local-csprng',
        seedHashB64,
      },
      key: { mlkem: { ctB64: ciphertextB64 } },
      content: {
        subject: { ctB64: encSubject.encrypted, ivB64: encSubject.iv },
        body: { ctB64: encBody.encrypted, ivB64: encBody.iv },
      },
    };
  }

  if (level === 4) {
    if (!receiverMlKemPublicKeyB64) throw new Error('Receiver ML-KEM public key missing (required for Level 4)');

    const { ciphertextB64, sharedSecretB64 } = await mlkemEncapBase64(
      receiverMlKemPublicKeyB64,
      'ML-KEM-1024'
    );

    const saltB64 = newSaltB64(16);
    const info = 'QDK-L4-MLKEM1024-v1';
    const aesKey = await hkdfAesGcmKeyFromSecretB64(sharedSecretB64, { saltB64, info });

    const encSubject = await encryptAES(aesKey, subject);
    const encBody = await encryptAES(aesKey, body);

    return {
      v: 1,
      level: 4,
      createdAt,
      from: senderEmail,
      to: receiverEmail,
      alg: {
        content: 'AES-256-GCM',
        kem: 'ML-KEM-1024',
        kdf: 'HKDF-SHA256',
        signingNote: 'ML-DSA (Dilithium) identity signatures planned; message auth via AES-GCM',
      },
      kdf: { saltB64, info },
      key: { mlkem: { ctB64: ciphertextB64 } },
      content: {
        subject: { ctB64: encSubject.encrypted, ivB64: encSubject.iv },
        body: { ctB64: encBody.encrypted, ivB64: encBody.iv },
      },
    };
  }

  if (level === 3) {
    throw new Error('Level 3 (One-Time Pad) requires a shared pad/key distribution setup and is not enabled yet.');
  }

  throw new Error(`Unsupported security level: ${level}`);
}

export async function decryptEnvelope({
  envelope,
  rsaPrivateKey,
  mlkemSecretKeyB64,
  mlkem768SecretKeyB64,
}) {
  if (!envelope || typeof envelope !== 'object') throw new Error('Missing envelope');

  if (envelope.level === 1) {
    return { subject: envelope.content?.subject ?? '', body: envelope.content?.body ?? '' };
  }

  if (envelope.level === 2) {
    const rsaWrapped = envelope.key?.rsaOaepAesKeyB64;
    if (rsaWrapped) {
      if (!rsaPrivateKey) throw new Error('RSA private key not loaded');
      const aesKeyB64 = await decryptRSA(rsaPrivateKey, rsaWrapped);
      const aesKey = await importAESKey(aesKeyB64);
      const subj = envelope.content?.subject;
      const bod = envelope.content?.body;
      if (!subj?.ctB64 || !subj?.ivB64 || !bod?.ctB64 || !bod?.ivB64) throw new Error('Missing ciphertext fields');
      const subject = await decryptAES(aesKey, subj.ctB64, subj.ivB64);
      const body = await decryptAES(aesKey, bod.ctB64, bod.ivB64);
      return { subject, body };
    }

    const ctB64 = envelope.key?.mlkem?.ctB64;
    if (!ctB64) throw new Error('Missing Kyber ciphertext in Level 2 envelope');
    const kem = resolveKemName(envelope);
    const sk =
      kem === 'ML-KEM-768'
        ? mlkem768SecretKeyB64 || mlkemSecretKeyB64
        : mlkemSecretKeyB64;
    if (!sk) throw new Error('ML-KEM secret key not loaded');

    const { sharedSecretB64 } = await mlkemDecapBase64(ctB64, sk, kem);
    const saltB64 = envelope.kdf?.saltB64;
    const info = envelope.kdf?.info || 'QDK-L2-QuantumAided-Kyber-v2';
    if (!saltB64) throw new Error('Missing KDF salt in envelope');
    const aesKey = await hkdfAesGcmKeyFromSecretB64(sharedSecretB64, { saltB64, info });

    const subj = envelope.content?.subject;
    const bod = envelope.content?.body;
    if (!subj?.ctB64 || !subj?.ivB64 || !bod?.ctB64 || !bod?.ivB64) throw new Error('Missing ciphertext fields');
    const subject = await decryptAES(aesKey, subj.ctB64, subj.ivB64);
    const body = await decryptAES(aesKey, bod.ctB64, bod.ivB64);
    return { subject, body };
  }

  if (envelope.level === 4) {
    const ctB64 = envelope.key?.mlkem?.ctB64;
    if (!ctB64) throw new Error('Missing ML-KEM ciphertext in envelope');
    const kem = resolveKemName(envelope);
    const sk =
      kem === 'ML-KEM-768'
        ? mlkem768SecretKeyB64 || mlkemSecretKeyB64
        : mlkemSecretKeyB64;
    if (!sk) throw new Error('ML-KEM secret key not loaded');

    const { sharedSecretB64 } = await mlkemDecapBase64(ctB64, sk, kem);
    const saltB64 = envelope.kdf?.saltB64;
    const info = envelope.kdf?.info || 'QDK-L4-MLKEM1024-v1';
    if (!saltB64) throw new Error('Missing KDF salt in envelope');

    const aesKey = await hkdfAesGcmKeyFromSecretB64(sharedSecretB64, { saltB64, info });

    const subj = envelope.content?.subject;
    const bod = envelope.content?.body;
    if (!subj?.ctB64 || !subj?.ivB64 || !bod?.ctB64 || !bod?.ivB64) throw new Error('Missing ciphertext fields');

    const subject = await decryptAES(aesKey, subj.ctB64, subj.ivB64);
    const body = await decryptAES(aesKey, bod.ctB64, bod.ivB64);
    return { subject, body };
  }

  throw new Error(`Unsupported envelope level for decryption: ${envelope.level}`);
}
