import { createMlKem768 } from 'mlkem';

let mlkem768Promise = null;

async function getMlKem768() {
  if (!mlkem768Promise) {
    mlkem768Promise = createMlKem768();
  }
  return mlkem768Promise;
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
  const kem = await getMlKem768();
  const [pk, sk] = kem.generateKeyPair();
  return { publicKeyB64: u8ToB64(pk), secretKeyB64: u8ToB64(sk) };
}

export async function mlkemEncapBase64(recipientPublicKeyB64) {
  const kem = await getMlKem768();
  const pk = b64ToU8(recipientPublicKeyB64);
  const [ct, ss] = kem.encap(pk);
  return { ciphertextB64: u8ToB64(ct), sharedSecretB64: u8ToB64(ss) };
}

export async function mlkemDecapBase64(ciphertextB64, recipientSecretKeyB64) {
  const kem = await getMlKem768();
  const ct = b64ToU8(ciphertextB64);
  const sk = b64ToU8(recipientSecretKeyB64);
  const ss = kem.decap(ct, sk);
  return { sharedSecretB64: u8ToB64(ss) };
}

