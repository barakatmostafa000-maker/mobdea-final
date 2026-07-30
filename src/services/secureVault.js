import { Capacitor, registerPlugin } from '@capacitor/core';

const SecureStore = registerPlugin('MobdeaSecureStore');
const LEGACY_WEB_PREFIX = 'mobdea_secure_vault_v1:';
const WEB_DB_NAME = 'mobdea_secure_vault_v2';
const WEB_DB_VERSION = 1;
const WEB_KEY_STORE = 'keys';
const WEB_VALUE_STORE = 'values';
const WEB_MASTER_KEY_ID = 'master';

function canUseNativeVault() {
  return Capacitor.isNativePlatform?.() && Capacitor.getPlatform?.() === 'android';
}

function legacyWebKey(key) {
  return `${LEGACY_WEB_PREFIX}${key}`;
}

function openWebVaultDb() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB || !globalThis.crypto?.subtle) {
      reject(new Error('Encrypted web storage is not available.'));
      return;
    }
    const request = globalThis.indexedDB.open(WEB_DB_NAME, WEB_DB_VERSION);
    request.onerror = () => reject(request.error || new Error('Unable to open encrypted web storage.'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WEB_KEY_STORE)) db.createObjectStore(WEB_KEY_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(WEB_VALUE_STORE)) db.createObjectStore(WEB_VALUE_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error || new Error('Encrypted web storage request failed.'));
  });
}

let webMasterKeyPromise;

async function loadWebMasterKey() {
  const db = await openWebVaultDb();
  try {
    const readTransaction = db.transaction(WEB_KEY_STORE, 'readonly');
    const existing = await requestResult(readTransaction.objectStore(WEB_KEY_STORE).get(WEB_MASTER_KEY_ID));
    if (existing?.key) return existing.key;

    const key = await globalThis.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(WEB_KEY_STORE, 'readwrite');
      transaction.objectStore(WEB_KEY_STORE).put({ id: WEB_MASTER_KEY_ID, key });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Unable to save the web encryption key.'));
      transaction.onabort = () => reject(transaction.error || new Error('Saving the web encryption key was cancelled.'));
    });
    return key;
  } finally {
    db.close();
  }
}

function getWebMasterKey() {
  if (!webMasterKeyPromise) {
    webMasterKeyPromise = loadWebMasterKey().catch((error) => {
      webMasterKeyPromise = null;
      throw error;
    });
  }
  return webMasterKeyPromise;
}

async function webVaultGet(key) {
  const encryptionKey = await getWebMasterKey();
  const db = await openWebVaultDb();
  try {
    const transaction = db.transaction(WEB_VALUE_STORE, 'readonly');
    const record = await requestResult(transaction.objectStore(WEB_VALUE_STORE).get(key));
    if (!record?.iv || !record?.ciphertext) return null;
    const plain = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(record.iv) },
      encryptionKey,
      record.ciphertext,
    );
    return new TextDecoder().decode(plain);
  } finally {
    db.close();
  }
}

async function webVaultSet(key, value) {
  const encryptionKey = await getWebMasterKey();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    new TextEncoder().encode(value),
  );
  const db = await openWebVaultDb();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(WEB_VALUE_STORE, 'readwrite');
      transaction.objectStore(WEB_VALUE_STORE).put({
        id: key,
        iv: iv.buffer.slice(0),
        ciphertext,
        updatedAt: new Date().toISOString(),
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Unable to save encrypted web data.'));
      transaction.onabort = () => reject(transaction.error || new Error('Saving encrypted web data was cancelled.'));
    });
  } finally {
    db.close();
  }
}

async function webVaultRemove(key) {
  const db = await openWebVaultDb();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(WEB_VALUE_STORE, 'readwrite');
      transaction.objectStore(WEB_VALUE_STORE).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Unable to remove encrypted web data.'));
      transaction.onabort = () => reject(transaction.error || new Error('Removing encrypted web data was cancelled.'));
    });
  } finally {
    db.close();
  }
}

async function webVaultClear() {
  const db = await openWebVaultDb();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(WEB_VALUE_STORE, 'readwrite');
      transaction.objectStore(WEB_VALUE_STORE).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Unable to clear encrypted web data.'));
      transaction.onabort = () => reject(transaction.error || new Error('Clearing encrypted web data was cancelled.'));
    });
  } finally {
    db.close();
  }
}

function fallbackGet(key) {
  try {
    return globalThis.localStorage?.getItem(legacyWebKey(key)) ?? null;
  } catch {
    return null;
  }
}

function fallbackRemove(key) {
  globalThis.localStorage?.removeItem(legacyWebKey(key));
}

export async function secureGet(key) {
  const normalized = String(key || '').trim();
  if (!normalized) return null;
  if (canUseNativeVault()) {
    const result = await SecureStore.get({ key: normalized });
    return typeof result?.value === 'string' ? result.value : null;
  }
  try {
    const encryptedValue = await webVaultGet(normalized);
    if (encryptedValue !== null) return encryptedValue;
    const legacyValue = fallbackGet(normalized);
    if (legacyValue !== null) {
      await webVaultSet(normalized, legacyValue);
      fallbackRemove(normalized);
    }
    return legacyValue;
  } catch {
    return fallbackGet(normalized);
  }
}

export async function secureSet(key, value) {
  const normalized = String(key || '').trim();
  if (!normalized) throw new Error('Secure storage key is required.');
  const text = String(value ?? '');
  if (canUseNativeVault()) {
    await SecureStore.set({ key: normalized, value: text });
    return;
  }
  await webVaultSet(normalized, text);
  fallbackRemove(normalized);
}

export async function secureRemove(key) {
  const normalized = String(key || '').trim();
  if (!normalized) return;
  if (canUseNativeVault()) {
    await SecureStore.remove({ key: normalized });
    return;
  }
  try {
    await webVaultRemove(normalized);
  } catch {
    // Continue with legacy cleanup when IndexedDB is unavailable.
  }
  fallbackRemove(normalized);
}

export async function secureClear() {
  if (canUseNativeVault()) {
    await SecureStore.clear();
    return;
  }
  try {
    await webVaultClear();
  } catch {
    // Continue with legacy cleanup when IndexedDB is unavailable.
  }
  try {
    const keys = [];
    for (let index = 0; index < (globalThis.localStorage?.length || 0); index += 1) {
      const key = globalThis.localStorage?.key(index);
      if (key?.startsWith(LEGACY_WEB_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => globalThis.localStorage?.removeItem(key));
  } catch {
    // Ignore unavailable legacy web storage.
  }
}

export function secureVaultLevel() {
  if (canUseNativeVault()) return 'android-keystore';
  if (globalThis.indexedDB && globalThis.crypto?.subtle) return 'web-crypto-indexeddb';
  return 'unavailable';
}
