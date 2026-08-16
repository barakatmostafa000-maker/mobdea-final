import { secureGet, secureRemove, secureSet } from './secureVault.js';

const DATA_KEY_NAME = 'mobdea_local_data_key_v1';
const FORMAT = 'mobdea-local-encrypted-v1';

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunk, bytes.length)));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(String(value || ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function getOrCreateKey() {
  if (!globalThis.crypto?.subtle) throw new Error('التشفير المحلي غير مدعوم على هذا الجهاز.');
  let encoded = await secureGet(DATA_KEY_NAME);
  if (!encoded) {
    const keyBytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
    encoded = bytesToBase64(keyBytes);
    await secureSet(DATA_KEY_NAME, encoded);
  }
  const keyBytes = base64ToBytes(encoded);
  if (keyBytes.length !== 32) throw new Error('مفتاح تشفير البيانات المحلية غير صالح.');
  return globalThis.crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptBytes(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await getOrCreateKey();
  const encrypted = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return {
    format: FORMAT,
    iv: bytesToBase64(iv),
    ciphertext: new Uint8Array(encrypted),
  };
}

export async function decryptBytes(envelope) {
  if (!envelope || envelope.format !== FORMAT || !envelope.iv || !envelope.ciphertext) {
    throw new Error('صيغة البيانات المشفرة غير صالحة.');
  }
  const key = await getOrCreateKey();
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = envelope.ciphertext instanceof Uint8Array
    ? envelope.ciphertext
    : new Uint8Array(envelope.ciphertext);
  try {
    const plain = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new Uint8Array(plain);
  } catch {
    throw new Error('تعذر فك تشفير البيانات المحلية. قد يكون ملف التخزين تالفًا أو نُقل من جهاز آخر.');
  }
}

export async function encryptText(text) {
  const encoded = new TextEncoder().encode(String(text ?? ''));
  const encrypted = await encryptBytes(encoded);
  return JSON.stringify({
    format: encrypted.format,
    iv: encrypted.iv,
    ciphertext: bytesToBase64(encrypted.ciphertext),
  });
}

export async function decryptText(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!parsed || parsed.format !== FORMAT) throw new Error('صيغة التخزين المشفر غير معروفة.');
  const plain = await decryptBytes({
    format: parsed.format,
    iv: parsed.iv,
    ciphertext: base64ToBytes(parsed.ciphertext),
  });
  return new TextDecoder().decode(plain);
}

export function isEncryptedEnvelope(value) {
  if (!value) return false;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed?.format === FORMAT && typeof parsed.iv === 'string' && typeof parsed.ciphertext === 'string';
  } catch {
    return false;
  }
}

export async function resetLocalCryptoKey() {
  await secureRemove(DATA_KEY_NAME);
}

export const LOCAL_CRYPTO_FORMAT = FORMAT;
