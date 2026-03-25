import { createMlKem768, createMlKem1024 } from 'mlkem';

/** Primary KEM: ML-KEM-1024 (CRYSTALS-Kyber parameter set). Legacy: ML-KEM-768. */
const KEM_CACHE = {};

async function getKem(kemName) {
  const name = kemName === 'ML-KEM-768' ? 'ML-KEM-768' : 'ML-KEM-1024';
  if (!KEM_CACHE[name]) {
    KEM_CACHE[name] = name === 'ML-KEM-768' ? await createMlKem768() : await createMlKem1024();
  }
  return KEM_CACHE[name];
}

function u8ToB64(u8) {
  let binary = '';
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
  return btoa(binary);
}

function b64ToU8(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function mlkemGenerateKeyPairBase64() {
  const kem = await getKem('ML-KEM-1024');
  const [pk, sk] = kem.generateKeyPair();
  return { publicKeyB64: u8ToB64(pk), secretKeyB64: u8ToB64(sk) };
}

export async function mlkemEncapBase64(recipientPublicKeyB64, kemVariant = 'ML-KEM-1024') {
  const kem = await getKem(kemVariant);
  const pk = b64ToU8(recipientPublicKeyB64);
  const [ct, ss] = kem.encap(pk);
  return { ciphertextB64: u8ToB64(ct), sharedSecretB64: u8ToB64(ss) };
}

export async function mlkemDecapBase64(ciphertextB64, recipientSecretKeyB64, kemVariant = 'ML-KEM-1024') {
  const kem = await getKem(kemVariant);
  const ct = b64ToU8(ciphertextB64);
  const sk = b64ToU8(recipientSecretKeyB64);
  const ss = kem.decap(ct, sk);
  return { sharedSecretB64: u8ToB64(ss) };
}

/** Detect variant from raw ML-KEM secret key length (library layout). */
export function inferMlKemVariantFromSecretKeyB64(secretKeyB64) {
  if (!secretKeyB64 || typeof secretKeyB64 !== 'string') return null;
  try {
    const len = b64ToU8(secretKeyB64).length;
    if (len === 2400) return 'ML-KEM-768';
    if (len === 3168) return 'ML-KEM-1024';
  } catch {
    /* ignore */
  }
  return null;
}
