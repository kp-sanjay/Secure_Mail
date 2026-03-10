function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

const STORE_KEY = 'qdk.trust.v1';

export function getTrustedFingerprints(email) {
  const store = readJson(STORE_KEY, {});
  return store[email.toLowerCase()] || null;
}

export function setTrustedFingerprints(email, fp) {
  const store = readJson(STORE_KEY, {});
  store[email.toLowerCase()] = fp;
  writeJson(STORE_KEY, store);
}

