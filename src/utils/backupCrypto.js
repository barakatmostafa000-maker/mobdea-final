const FORMAT = 'mobdea-encrypted-backup';
const VERSION = 2;
const DEFAULT_ITERATIONS = 310_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + chunk)));
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(String(value || ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

async function deriveKey(passphrase, salt, iterations) {
  const material = await globalThis.crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return globalThis.crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export function validateBackupPassphrase(passphrase) {
  const value = String(passphrase || '');
  if (value.length < 10) throw new Error('كلمة مرور النسخة الاحتياطية يجب ألا تقل عن 10 أحرف.');
  return value;
}

export async function encryptBackupBody(body, passphrase, metadata = {}) {
  const password = validateBackupPassphrase(passphrase);
  if (!globalThis.crypto?.subtle) throw new Error('التشفير الآمن غير مدعوم على هذا الجهاز.');
  const exportedAt = metadata.exportedAt || new Date().toISOString();
  const iterations = Number(metadata.iterations || DEFAULT_ITERATIONS);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt, iterations);
  const additionalData = encoder.encode(`${FORMAT}:${VERSION}:${exportedAt}`);
  const plaintext = encoder.encode(JSON.stringify(body));
  const encrypted = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData, tagLength: 128 }, key, plaintext);
  return {
    format: FORMAT,
    version: VERSION,
    exportedAt,
    encryption: { algorithm: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iterations, salt: bytesToBase64(salt), iv: bytesToBase64(iv) },
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptBackupEnvelope(payload, passphrase) {
  const password = validateBackupPassphrase(passphrase);
  const encryption = payload?.encryption || {};
  if (payload?.format !== FORMAT || payload.version !== VERSION || encryption.algorithm !== 'AES-256-GCM' || encryption.kdf !== 'PBKDF2-SHA256') {
    throw new Error('صيغة النسخة الاحتياطية غير مدعومة.');
  }
  const iterations = Number(encryption.iterations);
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) throw new Error('إعدادات تشفير النسخة غير صالحة.');
  try {
    const salt = base64ToBytes(encryption.salt);
    const iv = base64ToBytes(encryption.iv);
    const key = await deriveKey(password, salt, iterations);
    const additionalData = encoder.encode(`${FORMAT}:${payload.version}:${payload.exportedAt}`);
    const decrypted = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData, tagLength: 128 }, key, base64ToBytes(payload.ciphertext));
    return JSON.parse(decoder.decode(decrypted));
  } catch {
    throw new Error('كلمة مرور النسخة غير صحيحة أو أن الملف تم تعديله.');
  }
}

export const BACKUP_CRYPTO_FORMAT = FORMAT;
export const BACKUP_CRYPTO_VERSION = VERSION;
export const BACKUP_CRYPTO_ITERATIONS = DEFAULT_ITERATIONS;
