const textEncoder = new TextEncoder();
const PBKDF2_ITERATIONS = 310_000;
const HASH_BYTES = 32;
const THROTTLE_KEY = 'mobdea_auth_throttle_v2';
const MAX_PIN_LENGTH = 10;

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunk, bytes.length)));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(String(value || ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomBytes(length = 16) {
  if (!globalThis.crypto?.getRandomValues) throw new Error('مصدر التشفير الآمن غير متاح على هذا الجهاز.');
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

async function sha256Hex(text) {
  if (!globalThis.crypto?.subtle?.digest) throw new Error('التشفير الآمن غير مدعوم على هذا الجهاز.');
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', textEncoder.encode(String(text ?? '')));
  return bytesToHex(new Uint8Array(hashBuffer));
}

async function deriveSecret(value, saltBytes, iterations = PBKDF2_ITERATIONS) {
  if (!globalThis.crypto?.subtle) throw new Error('التشفير الآمن غير مدعوم على هذا الجهاز.');
  const key = await globalThis.crypto.subtle.importKey('raw', textEncoder.encode(String(value ?? '')), 'PBKDF2', false, ['deriveBits']);
  const bits = await globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations }, key, HASH_BYTES * 8);
  return new Uint8Array(bits);
}

function timingSafeEqual(left, right) {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array) || left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left[index] ^ right[index];
  return diff === 0;
}

export function normalizePin(pin) {
  return String(pin ?? '').replace(/\D/g, '').slice(0, MAX_PIN_LENGTH);
}

function normalizeRecovery(answer) {
  return String(answer ?? '').normalize('NFKC').trim().toLocaleLowerCase('ar-EG');
}

async function createSecret(value, { minLength = 6 } = {}) {
  const normalized = String(value ?? '');
  if (normalized.length < minLength) throw new Error(`يجب ألا تقل القيمة السرية عن ${minLength} خانات.`);
  const salt = randomBytes(16);
  const hash = await deriveSecret(normalized, salt, PBKDF2_ITERATIONS);
  return {
    hash: bytesToBase64(hash),
    salt: bytesToBase64(salt),
    iterations: PBKDF2_ITERATIONS,
    algorithm: 'PBKDF2-SHA256',
  };
}

async function verifySecret(value, secret = {}) {
  const hash = String(secret.hash || '').trim();
  const salt = String(secret.salt || '').trim();
  const iterations = Number(secret.iterations || PBKDF2_ITERATIONS);
  if (!hash || !salt || !value || !Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return false;
  try {
    const expected = base64ToBytes(hash);
    const candidate = await deriveSecret(String(value), base64ToBytes(salt), iterations);
    return timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

export async function createPinSecret(pin, prefix = 'admin') {
  const normalizedPin = normalizePin(pin);
  if (!/^\d{6,10}$/.test(normalizedPin)) throw new Error('الرقم السري يجب أن يكون من 6 إلى 10 أرقام.');
  const secret = await createSecret(normalizedPin, { minLength: 6 });
  return {
    [`${prefix}PinHash`]: secret.hash,
    [`${prefix}PinSalt`]: secret.salt,
    [`${prefix}PinIterations`]: secret.iterations,
    [`${prefix}PinAlgorithm`]: secret.algorithm,
  };
}

export async function verifyPinSecret(pin, settings = {}, prefix = 'admin') {
  const normalizedPin = normalizePin(pin);
  if (!normalizedPin) return false;
  const modern = await verifySecret(normalizedPin, {
    hash: settings[`${prefix}PinHash`],
    salt: settings[`${prefix}PinSalt`],
    iterations: settings[`${prefix}PinIterations`],
  });
  if (modern) return true;

  // One-time compatibility with versions <= 9.0.0. A successful legacy login
  // should immediately be re-saved by the caller using createPinSecret().
  const legacyHash = String(settings[`${prefix}PinHash`] || '').trim();
  const legacySalt = String(settings[`${prefix}PinSalt`] || '').trim();
  if (legacyHash && legacySalt && /^[a-f0-9]{64}$/i.test(legacyHash)) {
    return (await sha256Hex(`${legacySalt}:${normalizedPin}`)) === legacyHash.toLowerCase();
  }
  const legacyPin = normalizePin(settings[`${prefix}Pin`]);
  return Boolean(legacyPin) && normalizedPin === legacyPin;
}

export async function createCredentialSecret(pin, prefix) {
  return createPinSecret(pin, prefix);
}

export async function verifyCredentialSecret(pin, record = {}, prefix) {
  return verifyPinSecret(pin, record, prefix);
}

export function hasCredentialSecret(record = {}, prefix) {
  return Boolean(record?.[`${prefix}PinHash`] && record?.[`${prefix}PinSalt`]);
}

export async function createRecoverySecret(answer) {
  const normalized = normalizeRecovery(answer);
  if (normalized.length < 10) throw new Error('عبارة الاسترجاع يجب ألا تقل عن 10 أحرف.');
  const secret = await createSecret(normalized, { minLength: 10 });
  return {
    staffRecoveryAnswerHash: secret.hash,
    staffRecoveryAnswerSalt: secret.salt,
    staffRecoveryAnswerIterations: secret.iterations,
    staffRecoveryAnswerAlgorithm: secret.algorithm,
  };
}

export async function verifyRecoverySecret(answer, settings = {}) {
  const normalized = normalizeRecovery(answer);
  const modern = await verifySecret(normalized, {
    hash: settings.staffRecoveryAnswerHash,
    salt: settings.staffRecoveryAnswerSalt,
    iterations: settings.staffRecoveryAnswerIterations,
  });
  if (modern) return true;
  const legacyHash = String(settings.staffRecoveryAnswerHash || '').trim();
  const legacySalt = String(settings.staffRecoveryAnswerSalt || '').trim();
  return Boolean(normalized && legacyHash && legacySalt && /^[a-f0-9]{64}$/i.test(legacyHash))
    && (await sha256Hex(`${legacySalt}:${normalized}`)) === legacyHash.toLowerCase();
}

function readThrottleMap() {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(THROTTLE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeThrottleMap(map) {
  try {
    globalThis.localStorage?.setItem(THROTTLE_KEY, JSON.stringify(map));
  } catch {
    // A missing throttle store must not break login; PBKDF2 still protects secrets.
  }
}

function throttleId(scope) {
  return String(scope || 'unknown').replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 120) || 'unknown';
}

export function getLoginThrottle(scope, now = Date.now()) {
  const id = throttleId(scope);
  const map = readThrottleMap();
  const state = map[id] || { failures: 0, blockedUntil: 0 };
  const remainingMs = Math.max(0, Number(state.blockedUntil || 0) - now);
  return { failures: Number(state.failures || 0), blocked: remainingMs > 0, remainingMs };
}

export function assertLoginAllowed(scope, now = Date.now()) {
  const state = getLoginThrottle(scope, now);
  if (!state.blocked) return state;
  const seconds = Math.ceil(state.remainingMs / 1000);
  throw new Error(`تم إيقاف المحاولات مؤقتًا. أعد المحاولة بعد ${seconds} ثانية.`);
}

export function recordLoginFailure(scope, now = Date.now()) {
  const id = throttleId(scope);
  const map = readThrottleMap();
  const previous = map[id] || { failures: 0, blockedUntil: 0 };
  const failures = Number(previous.failures || 0) + 1;
  const lockDurations = [0, 0, 0, 0, 30_000, 120_000, 600_000, 1_800_000];
  const duration = lockDurations[Math.min(failures, lockDurations.length - 1)] || 0;
  map[id] = { failures, blockedUntil: duration ? now + duration : 0, updatedAt: now };
  writeThrottleMap(map);
  return getLoginThrottle(scope, now);
}

export function clearLoginFailures(scope) {
  const id = throttleId(scope);
  const map = readThrottleMap();
  delete map[id];
  writeThrottleMap(map);
}

export function clearAllLoginFailures() {
  try { globalThis.localStorage?.removeItem(THROTTLE_KEY); } catch { /* no-op */ }
}
