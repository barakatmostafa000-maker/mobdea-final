const textEncoder = new TextEncoder();

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomSalt(length = 16) {
  if (!globalThis.crypto?.getRandomValues) {
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  }
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function sha256Hex(text) {
  const data = textEncoder.encode(String(text ?? ''));
  if (globalThis.crypto?.subtle?.digest) {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    return bytesToHex(new Uint8Array(hashBuffer));
  }

  // Fallback for very limited environments.
  let hash = 0;
  for (const char of String(text ?? '')) {
    hash = (hash << 5) - hash + char.charCodeAt(0);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export async function createPinSecret(pin, prefix = 'admin') {
  const normalizedPin = String(pin ?? '').replace(/\D/g, '').slice(0, 6);
  const salt = randomSalt();
  const hash = await sha256Hex(`${salt}:${normalizedPin}`);
  return {
    [`${prefix}PinHash`]: hash,
    [`${prefix}PinSalt`]: salt,
  };
}

export async function verifyPinSecret(pin, settings = {}, prefix = 'admin') {
  const normalizedPin = String(pin ?? '').replace(/\D/g, '').slice(0, 6);
  const hash = String(settings[`${prefix}PinHash`] || '').trim();
  const salt = String(settings[`${prefix}PinSalt`] || '').trim();

  if (hash && salt) {
    const candidate = await sha256Hex(`${salt}:${normalizedPin}`);
    return candidate === hash;
  }

  const legacyPin = String(settings[`${prefix}Pin`] || '').replace(/\D/g, '').slice(0, 6);
  return Boolean(legacyPin) && normalizedPin === legacyPin;
}

// Shared recovery question/answer used to reset the teacher/admin PIN
// directly from the lock screen when it has been forgotten.
export async function createRecoverySecret(answer) {
  const normalized = String(answer ?? '').trim().toLowerCase();
  const salt = randomSalt();
  const hash = await sha256Hex(`${salt}:${normalized}`);
  return {
    staffRecoveryAnswerHash: hash,
    staffRecoveryAnswerSalt: salt,
  };
}

export async function verifyRecoverySecret(answer, settings = {}) {
  const normalized = String(answer ?? '').trim().toLowerCase();
  const hash = String(settings.staffRecoveryAnswerHash || '').trim();
  const salt = String(settings.staffRecoveryAnswerSalt || '').trim();
  if (!hash || !salt || !normalized) return false;
  const candidate = await sha256Hex(`${salt}:${normalized}`);
  return candidate === hash;
}
