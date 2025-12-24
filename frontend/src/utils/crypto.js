/**
 * Crypto utilities for E2EE Email Client
 * Uses Web Crypto API for client-side encryption/decryption
 */

/**
 * Generate RSA key pair for encryption
 * @returns {Promise<CryptoKeyPair>}
 */
export async function generateRSAKeyPair() {
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );
    return keyPair;
  } catch (error) {
    console.error('Error generating RSA key pair:', error);
    throw new Error('Failed to generate RSA key pair');
  }
}

/**
 * Export public key to PEM format
 * @param {CryptoKey} publicKey
 * @returns {Promise<string>}
 */
export async function exportPublicKey(publicKey) {
  try {
    const exported = await window.crypto.subtle.exportKey('spki', publicKey);
    const exportedAsBase64 = arrayBufferToBase64(exported);
    const pemExported = `-----BEGIN PUBLIC KEY-----\n${exportedAsBase64}\n-----END PUBLIC KEY-----`;
    return pemExported;
  } catch (error) {
    console.error('Error exporting public key:', error);
    throw new Error('Failed to export public key');
  }
}

/**
 * Export private key to PEM format
 * @param {CryptoKey} privateKey
 * @returns {Promise<string>}
 */
export async function exportPrivateKey(privateKey) {
  try {
    const exported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
    const exportedAsBase64 = arrayBufferToBase64(exported);
    const pemExported = `-----BEGIN PRIVATE KEY-----\n${exportedAsBase64}\n-----END PRIVATE KEY-----`;
    return pemExported;
  } catch (error) {
    console.error('Error exporting private key:', error);
    throw new Error('Failed to export private key');
  }
}

/**
 * Import public key from PEM format
 * @param {string} pemKey
 * @returns {Promise<CryptoKey>}
 */
export async function importPublicKey(pemKey) {
  try {
    const pemHeader = '-----BEGIN PUBLIC KEY-----';
    const pemFooter = '-----END PUBLIC KEY-----';
    const pemContents = pemKey
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '');
    const binaryDer = base64ToArrayBuffer(pemContents);

    const publicKey = await window.crypto.subtle.importKey(
      'spki',
      binaryDer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      true,
      ['encrypt']
    );
    return publicKey;
  } catch (error) {
    console.error('Error importing public key:', error);
    throw new Error('Failed to import public key');
  }
}

/**
 * Import private key from PEM format
 * @param {string} pemKey
 * @returns {Promise<CryptoKey>}
 */
export async function importPrivateKey(pemKey) {
  try {
    const pemHeader = '-----BEGIN PRIVATE KEY-----';
    const pemFooter = '-----END PRIVATE KEY-----';
    const pemContents = pemKey
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '');
    const binaryDer = base64ToArrayBuffer(pemContents);

    const privateKey = await window.crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      true,
      ['decrypt']
    );
    return privateKey;
  } catch (error) {
    console.error('Error importing private key:', error);
    throw new Error('Failed to import private key');
  }
}

/**
 * Generate AES key for message encryption
 * @returns {Promise<CryptoKey>}
 */
export async function generateAESKey() {
  try {
    const key = await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
    return key;
  } catch (error) {
    console.error('Error generating AES key:', error);
    throw new Error('Failed to generate AES key');
  }
}

/**
 * Export AES key to base64 string
 * @param {CryptoKey} key
 * @returns {Promise<string>}
 */
export async function exportAESKey(key) {
  try {
    const exported = await window.crypto.subtle.exportKey('raw', key);
    return arrayBufferToBase64(exported);
  } catch (error) {
    console.error('Error exporting AES key:', error);
    throw new Error('Failed to export AES key');
  }
}

/**
 * Import AES key from base64 string
 * @param {string} keyData
 * @returns {Promise<CryptoKey>}
 */
export async function importAESKey(keyData) {
  try {
    const keyBuffer = base64ToArrayBuffer(keyData);
    const key = await window.crypto.subtle.importKey(
      'raw',
      keyBuffer,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
    return key;
  } catch (error) {
    console.error('Error importing AES key:', error);
    throw new Error('Failed to import AES key');
  }
}

/**
 * Encrypt data using AES-GCM
 * @param {CryptoKey} key
 * @param {string} plaintext
 * @returns {Promise<{encrypted: string, iv: string}>}
 */
export async function encryptAES(key, plaintext) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      data
    );

    return {
      encrypted: arrayBufferToBase64(encrypted),
      iv: arrayBufferToBase64(iv),
    };
  } catch (error) {
    console.error('Error encrypting with AES:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data using AES-GCM
 * @param {CryptoKey} key
 * @param {string} encryptedData
 * @param {string} iv
 * @returns {Promise<string>}
 */
export async function decryptAES(key, encryptedData, iv) {
  try {
    const encryptedBuffer = base64ToArrayBuffer(encryptedData);
    const ivBuffer = base64ToArrayBuffer(iv);

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer,
      },
      key,
      encryptedBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Error decrypting with AES:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Encrypt data using RSA-OAEP
 * @param {CryptoKey} publicKey
 * @param {string} plaintext
 * @returns {Promise<string>}
 */
export async function encryptRSA(publicKey, plaintext) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP',
      },
      publicKey,
      data
    );

    return arrayBufferToBase64(encrypted);
  } catch (error) {
    console.error('Error encrypting with RSA:', error);
    throw new Error('Failed to encrypt with RSA');
  }
}

/**
 * Decrypt data using RSA-OAEP
 * @param {CryptoKey} privateKey
 * @param {string} encryptedData
 * @returns {Promise<string>}
 */
export async function decryptRSA(privateKey, encryptedData) {
  try {
    const encryptedBuffer = base64ToArrayBuffer(encryptedData);

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'RSA-OAEP',
      },
      privateKey,
      encryptedBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Error decrypting with RSA:', error);
    throw new Error('Failed to decrypt with RSA');
  }
}

/**
 * Encrypt private key with password (PBKDF2 + AES-GCM)
 * @param {string} privateKeyPEM
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function encryptPrivateKeyWithPassword(privateKeyPEM, password) {
  try {
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    const salt = window.crypto.getRandomValues(new Uint8Array(16));

    // Derive key from password using PBKDF2
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      passwordData,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt']
    );

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const data = encoder.encode(privateKeyPEM);

    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      data
    );

    // Combine salt + iv + encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);

    return arrayBufferToBase64(combined);
  } catch (error) {
    console.error('Error encrypting private key with password:', error);
    throw new Error('Failed to encrypt private key');
  }
}

/**
 * Decrypt private key with password
 * @param {string} encryptedPrivateKey
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function decryptPrivateKeyWithPassword(encryptedPrivateKey, password) {
  try {
    const encoder = new TextEncoder();
    const combined = base64ToArrayBuffer(encryptedPrivateKey);
    const combinedArray = new Uint8Array(combined);

    const salt = combinedArray.slice(0, 16);
    const iv = combinedArray.slice(16, 28);
    const encrypted = combinedArray.slice(28);

    const passwordData = encoder.encode(password);

    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      passwordData,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['decrypt']
    );

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Error decrypting private key with password:', error);
    throw new Error('Failed to decrypt private key - incorrect password?');
  }
}

// Helper functions
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

