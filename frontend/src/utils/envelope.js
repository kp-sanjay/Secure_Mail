import { decryptAES, decryptRSA, encryptAES, importAESKey } from './crypto';
import {
  inferMlKemVariantFromPublicKeyB64,
  inferMlKemVariantFromSecretKeyB64,
  mlkemDecapBase64,
  mlkemEncapBase64,
} from './pqc';

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
  // Metadata sometimes drifts in older envelopes. Infer variant from ciphertext length:
  // - ML-KEM-768 ciphertext: 1088 bytes
  // - ML-KEM-1024 ciphertext: 1568 bytes
  const ctB64 = envelope?.key?.mlkem?.ctB64 || envelope?.key?.ctB64 || envelope?.ciphertextB64;
  if (ctB64 && typeof ctB64 === 'string') {
    try {
      const bin = atob(ctB64);
      const len = bin.length;
      if (len === 1088) return 'ML-KEM-768';
      if (len === 1568) return 'ML-KEM-1024';
    } catch {
      /* ignore */
    }
  }

  return 'ML-KEM-1024';
}

function pickCipherFields(node) {
  if (!node || typeof node !== 'object') return null;
  // Support both current and legacy field names.
  const ctB64 = node.ctB64 || node.ciphertextB64 || node.encrypted || null;
  const ivB64 = node.ivB64 || node.iv || node.nonceB64 || null;
  if (!ctB64 || !ivB64) return null;
  return { ctB64, ivB64 };
}

async function tryDecapWithFallback(ctB64, preferredKem, mlkemSecretKeyB64, mlkem768SecretKeyB64) {
  const attempts = [];
  console.log(`[DECAP] Preferred KEM requested: ${preferredKem}`);

  const skVariant = (skB64) => inferMlKemVariantFromSecretKeyB64(skB64);

  const addIfAvailable = (kem, sk) => {
    if (!sk) {
      console.log(`[DECAP] Secret key for ${kem} not provided.`);
      return;
    }
    const v = skVariant(sk);
    console.log(`[DECAP] Supplied key for ${kem} actual variant inferred: ${v}`);
    if (v !== kem) return; // Never attempt decap with the wrong secret-key parameter set.
    attempts.push({ kem, sk });
  };

  if (preferredKem === 'ML-KEM-768') {
    addIfAvailable('ML-KEM-768', mlkem768SecretKeyB64);
    addIfAvailable('ML-KEM-1024', mlkemSecretKeyB64);
  } else {
    addIfAvailable('ML-KEM-1024', mlkemSecretKeyB64);
    addIfAvailable('ML-KEM-768', mlkem768SecretKeyB64);
  }

  if (attempts.length === 0) {
    throw new Error(`No matching ML-KEM secret key loaded for ${preferredKem}`);
  }

  let lastErr = null;
  for (const a of attempts) {
    try {
      console.log(`[DECAP] Trying decap with ${a.kem}`);
      return await mlkemDecapBase64(ctB64, a.sk, a.kem);
    } catch (e) {
      console.log(`[DECAP] Decap failed for ${a.kem}:`, e);
      lastErr = e;
    }
  }

  throw lastErr || new Error('Failed to decapsulate ML-KEM ciphertext');
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
  password,
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

    const kemVariant = inferMlKemVariantFromPublicKeyB64(receiverMlKemPublicKeyB64) || 'ML-KEM-1024';
    const { ciphertextB64, sharedSecretB64 } = await mlkemEncapBase64(receiverMlKemPublicKeyB64, kemVariant);

    const info =
      kemVariant === 'ML-KEM-768' ? 'QDK-L2-QuantumAided-Kyber768-v2' : 'QDK-L2-QuantumAided-Kyber-v2';
    const aesKey = await hkdfAesGcmKeyFromSecretB64(sharedSecretB64, { saltB64, info });

    // DEBUG LOGS (Level 2 Encrypt)
    const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
    const debugAESKeyHash = await sha256B64(rawAesKey);
    console.log('--- ENCRYPT L2 DEBUG ---');
    console.log(`Variant: ${kemVariant}`);
    console.log(`HKDF Salt: ${saltB64}`);
    console.log(`HKDF Info: ${info}`);
    console.log(`Shared Secret (trim): ${sharedSecretB64.substring(0, 20)}`);
    console.log(`AES Key Hash: ${debugAESKeyHash}`);
    console.log('------------------------');

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
        kem: kemVariant,
        kdf: 'HKDF-SHA256',
        mode: 'quantum-aided-kyber',
      },
      kdf: { saltB64, info },
      debugAESKeyHash, // TEMP DEBUG
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

    const kemVariant = inferMlKemVariantFromPublicKeyB64(receiverMlKemPublicKeyB64) || 'ML-KEM-1024';
    const { ciphertextB64, sharedSecretB64 } = await mlkemEncapBase64(receiverMlKemPublicKeyB64, kemVariant);

    const saltB64 = newSaltB64(16);
    const info = kemVariant === 'ML-KEM-768' ? 'QDK-L4-MLKEM768-v1' : 'QDK-L4-MLKEM1024-v1';
    const aesKey = await hkdfAesGcmKeyFromSecretB64(sharedSecretB64, { saltB64, info });

    // DEBUG LOGS (Level 4 Encrypt)
    const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
    const debugAESKeyHash = await sha256B64(rawAesKey);
    console.log('--- ENCRYPT L4 DEBUG ---');
    console.log(`Variant: ${kemVariant}`);
    console.log(`HKDF Salt: ${saltB64}`);
    console.log(`HKDF Info: ${info}`);
    console.log(`Shared Secret (trim): ${sharedSecretB64.substring(0, 20)}`);
    console.log(`AES Key Hash: ${debugAESKeyHash}`);
    console.log('------------------------');

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
        kem: kemVariant,
        kdf: 'HKDF-SHA256',
        signingNote: 'ML-DSA (Dilithium) identity signatures planned; message auth via AES-GCM',
      },
      kdf: { saltB64, info },
      debugAESKeyHash, // TEMP DEBUG
      key: { mlkem: { ctB64: ciphertextB64 } },
      content: {
        subject: { ctB64: encSubject.encrypted, ivB64: encSubject.iv },
        body: { ctB64: encBody.encrypted, ivB64: encBody.iv },
      },
    };
  }

  if (level === 3) {
    if (!password) {
      throw new Error('Password required for Level 3');
    }
    const saltB64 = newSaltB64(16);

    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
    const aesKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b64ToU8(saltB64), iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    const encSubject = await encryptAES(aesKey, subject);
    const encBody = await encryptAES(aesKey, body);

    return {
      v: 1,
      level: 3,
      createdAt,
      from: senderEmail,
      to: receiverEmail,
      alg: {
        content: 'AES-256-GCM',
        logistics: 'PASSWORD-PBKDF2-SHA256',
      },
      kdf: { saltB64, iterations: 100000 },
      content: {
        subject: { ctB64: encSubject.encrypted, ivB64: encSubject.iv },
        body: { ctB64: encBody.encrypted, ivB64: encBody.iv },
      },
    };
  }

  throw new Error(`Unsupported security level: ${level}`);
}

export async function decryptEnvelope({
  envelope,
  rsaPrivateKey,
  mlkemSecretKeyB64,
  mlkem768SecretKeyB64,
  password,
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
      const subj = pickCipherFields(envelope.content?.subject);
      const bod = pickCipherFields(envelope.content?.body);
      if (!subj || !bod) throw new Error('Missing ciphertext fields');
      const subject = await decryptAES(aesKey, subj.ctB64, subj.ivB64);
      const body = await decryptAES(aesKey, bod.ctB64, bod.ivB64);
      return { subject, body };
    }

    const ctB64 = envelope.key?.mlkem?.ctB64;
    if (!ctB64) throw new Error('Missing Kyber ciphertext in Level 2 envelope');
    const kem = resolveKemName(envelope);
    const { sharedSecretB64 } = await tryDecapWithFallback(
      ctB64,
      kem,
      mlkemSecretKeyB64,
      mlkem768SecretKeyB64
    );
    const saltB64 = envelope.kdf?.saltB64;
    const info = envelope.kdf?.info || 'QDK-L2-QuantumAided-Kyber-v2';
    if (!saltB64) throw new Error('Missing KDF salt in envelope');
    const aesKey = await hkdfAesGcmKeyFromSecretB64(sharedSecretB64, { saltB64, info });

    // DEBUG LOGS (Level 2 Decrypt)
    const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
    const debugAESKeyHash = await sha256B64(rawAesKey);
    console.log('--- DECRYPT L2 DEBUG ---');
    console.log(`Resolved KEM: ${kem}`);
    console.log(`HKDF Salt: ${saltB64}`);
    console.log(`HKDF Info: ${info}`);
    console.log(`Shared Secret (trim): ${sharedSecretB64.substring(0, 20)}`);
    console.log(`AES Key Hash: ${debugAESKeyHash}`);
    console.log(`Expected Hash: ${envelope.debugAESKeyHash || '(none provided)'}`);
    console.log(`MATCH? ${envelope.debugAESKeyHash === debugAESKeyHash}`);
    console.log('------------------------');

    const subj = pickCipherFields(envelope.content?.subject);
    const bod = pickCipherFields(envelope.content?.body);
    if (!subj || !bod) throw new Error('Missing ciphertext fields');
    const subject = await decryptAES(aesKey, subj.ctB64, subj.ivB64);
    const body = await decryptAES(aesKey, bod.ctB64, bod.ivB64);
    return { subject, body };
  }

  if (envelope.level === 4) {
    const ctB64 = envelope.key?.mlkem?.ctB64;
    if (!ctB64) throw new Error('Missing ML-KEM ciphertext in envelope');
    const kem = resolveKemName(envelope);
    const { sharedSecretB64 } = await tryDecapWithFallback(
      ctB64,
      kem,
      mlkemSecretKeyB64,
      mlkem768SecretKeyB64
    );
    const saltB64 = envelope.kdf?.saltB64;
    const info = envelope.kdf?.info || 'QDK-L4-MLKEM1024-v1';
    if (!saltB64) throw new Error('Missing KDF salt in envelope');

    const aesKey = await hkdfAesGcmKeyFromSecretB64(sharedSecretB64, { saltB64, info });

    // DEBUG LOGS (Level 4 Decrypt)
    const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
    const debugAESKeyHash = await sha256B64(rawAesKey);
    console.log('--- DECRYPT L4 DEBUG ---');
    console.log(`Resolved KEM: ${kem}`);
    console.log(`HKDF Salt: ${saltB64}`);
    console.log(`HKDF Info: ${info}`);
    console.log(`Shared Secret (trim): ${sharedSecretB64.substring(0, 20)}`);
    console.log(`AES Key Hash: ${debugAESKeyHash}`);
    console.log(`Expected Hash: ${envelope.debugAESKeyHash || '(none provided)'}`);
    console.log(`MATCH? ${envelope.debugAESKeyHash === debugAESKeyHash}`);
    console.log('------------------------');

    const subj = pickCipherFields(envelope.content?.subject);
    const bod = pickCipherFields(envelope.content?.body);
    if (!subj || !bod) throw new Error('Missing ciphertext fields');

    const subject = await decryptAES(aesKey, subj.ctB64, subj.ivB64);
    const body = await decryptAES(aesKey, bod.ctB64, bod.ivB64);
    return { subject, body };
  }

  if (envelope.level === 3) {
    if (!password) {
      throw new Error('Password Required');
    }

    const saltB64 = envelope.kdf?.saltB64;
    const iters = envelope.kdf?.iterations || 100000;
    if (!saltB64) throw new Error('Missing KDF salt in Level 3 envelope');

    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
    let aesKey;
    try {
      aesKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: b64ToU8(saltB64), iterations: iters, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    } catch (e) {
      throw new Error('Invalid OTP Code');
    }

    const subj = pickCipherFields(envelope.content?.subject);
    const bod = pickCipherFields(envelope.content?.body);
    if (!subj || !bod) throw new Error('Missing ciphertext fields');

    try {
      const subject = await decryptAES(aesKey, subj.ctB64, subj.ivB64);
      const body = await decryptAES(aesKey, bod.ctB64, bod.ivB64);
      return { subject, body };
    } catch (e) {
      throw new Error('Failed to decrypt email. Incorrect password or corrupted message.');
    }
  }

  throw new Error(`Unsupported envelope level for decryption: ${envelope.level}`);
}
