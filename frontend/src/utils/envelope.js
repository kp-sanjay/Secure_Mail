import {
  decryptAES,
  decryptRSA,
  encryptAES,
  encryptRSA,
  exportAESKey,
  importAESKey,
  importPublicKey,
} from './crypto';
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

export async function encryptEnvelope({ level, senderEmail, receiverEmail, receiverPublicKeyPem, receiverMlKemPublicKeyB64, subject, body, quantumSeedB64 }) {
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
    if (!receiverPublicKeyPem) throw new Error('Receiver RSA public key missing (required for Level 2)');

    const receiverRsa = await importPublicKey(receiverPublicKeyPem);

    const seedBytes = quantumSeedB64 ? b64ToU8(quantumSeedB64) : crypto.getRandomValues(new Uint8Array(32));
    const seedHashB64 = await sha256B64(seedBytes);

    // Derive an AES key from the seed (HKDF-SHA256)
    const saltB64 = newSaltB64(16);
    const info = 'QDK-L2-QuantumAidedAES-v1';

    const seedMaterial = await crypto.subtle.importKey('raw', seedBytes, 'HKDF', false, ['deriveKey']);
    const aesKey = await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: b64ToU8(saltB64), info: new TextEncoder().encode(info) },
      seedMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    const encSubject = await encryptAES(aesKey, subject);
    const encBody = await encryptAES(aesKey, body);

    // Transport AES key via RSA-OAEP for the recipient
    const aesKeyB64 = await exportAESKey(aesKey);
    const encryptedAesKeyB64 = await encryptRSA(receiverRsa, aesKeyB64);

    return {
      v: 1,
      level: 2,
      createdAt,
      from: senderEmail,
      to: receiverEmail,
      alg: { content: 'AES-256-GCM', keyTransport: 'RSA-OAEP-2048', kdf: 'HKDF-SHA256' },
      kdf: { saltB64, info },
      quantum: { seedSource: quantumSeedB64 ? 'provided' : 'simulated-qrng', seedHashB64 },
      key: { rsaOaepAesKeyB64: encryptedAesKeyB64 },
      content: {
        subject: { ctB64: encSubject.encrypted, ivB64: encSubject.iv },
        body: { ctB64: encBody.encrypted, ivB64: encBody.iv },
      },
    };
  }

  if (level === 4) {
    if (!receiverMlKemPublicKeyB64) throw new Error('Receiver ML-KEM public key missing (required for Level 4)');

    const { ciphertextB64, sharedSecretB64 } = await mlkemEncapBase64(receiverMlKemPublicKeyB64);

    const saltB64 = newSaltB64(16);
    const info = 'QDK-L4-MLKEM768-v1';
    const aesKey = await hkdfAesGcmKeyFromSecretB64(sharedSecretB64, { saltB64, info });

    const encSubject = await encryptAES(aesKey, subject);
    const encBody = await encryptAES(aesKey, body);

    return {
      v: 1,
      level: 4,
      createdAt,
      from: senderEmail,
      to: receiverEmail,
      alg: { content: 'AES-256-GCM', kem: 'ML-KEM-768', kdf: 'HKDF-SHA256' },
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

export async function decryptEnvelope({ envelope, rsaPrivateKey, mlkemSecretKeyB64 }) {
  if (!envelope || typeof envelope !== 'object') throw new Error('Missing envelope');

  if (envelope.level === 1) {
    return { subject: envelope.content?.subject ?? '', body: envelope.content?.body ?? '' };
  }

  if (envelope.level === 2) {
    if (!rsaPrivateKey) throw new Error('RSA private key not loaded');
    const encryptedAesKeyB64 = envelope.key?.rsaOaepAesKeyB64;
    if (!encryptedAesKeyB64) throw new Error('Missing RSA-encrypted AES key in envelope');

    const aesKeyB64 = await decryptRSA(rsaPrivateKey, encryptedAesKeyB64);
    const aesKey = await importAESKey(aesKeyB64);

    const subj = envelope.content?.subject;
    const bod = envelope.content?.body;
    if (!subj?.ctB64 || !subj?.ivB64 || !bod?.ctB64 || !bod?.ivB64) throw new Error('Missing ciphertext fields');

    const subject = await decryptAES(aesKey, subj.ctB64, subj.ivB64);
    const body = await decryptAES(aesKey, bod.ctB64, bod.ivB64);
    return { subject, body };
  }

  if (envelope.level === 4) {
    if (!mlkemSecretKeyB64) throw new Error('ML-KEM secret key not loaded');
    const ctB64 = envelope.key?.mlkem?.ctB64;
    if (!ctB64) throw new Error('Missing ML-KEM ciphertext in envelope');

    const { sharedSecretB64 } = await mlkemDecapBase64(ctB64, mlkemSecretKeyB64);
    const saltB64 = envelope.kdf?.saltB64;
    const info = envelope.kdf?.info || 'QDK-L4-MLKEM768-v1';
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

