import { decryptBytes, encryptBytes } from './localCrypto';

const DB_NAME = 'mobdea_assets_v2';
const STORE_NAME = 'assets';
const DB_VERSION = 1;
const LEGACY_DB_NAME = 'mobdea_assets_v1';
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const objectUrlCache = new Map();

function openDb(name = DB_NAME) {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('التخزين المحلي للملفات غير مدعوم على هذا الجهاز.'));
      return;
    }
    const request = globalThis.indexedDB.open(name, DB_VERSION);
    request.onerror = () => reject(request.error || new Error('تعذر فتح مخزن الملفات.'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function withStore(mode, callback, databaseName = DB_NAME) {
  const db = await openDb(databaseName);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      let result;
      try {
        result = callback(store);
      } catch (error) {
        reject(error);
        return;
      }
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || new Error('فشل تخزين الملف.'));
      transaction.onabort = () => reject(transaction.error || new Error('تم إلغاء تخزين الملف.'));
    });
  } finally {
    db.close();
  }
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error || new Error('تعذر قراءة الملف.'));
  });
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto?.getRandomValues?.(new Uint8Array(16));
  if (!bytes) throw new Error('تعذر إنشاء معرّف آمن للملف.');
  return `asset-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function sha256Hex(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function writeEncryptedAsset(blob, metadata = {}) {
  if (!(blob instanceof Blob)) throw new Error('الملف غير صالح.');
  if (blob.size <= 0) throw new Error('الملف فارغ.');
  if (blob.size > MAX_ASSET_BYTES) throw new Error('الحد الأقصى للملف الواحد 25 ميجابايت.');
  const plainBytes = new Uint8Array(await blob.arrayBuffer());
  const encrypted = await encryptBytes(plainBytes);
  const id = String(metadata.id || createId());
  const sha256 = String(metadata.sha256 || await sha256Hex(plainBytes)).toLowerCase();
  const record = {
    id,
    format: encrypted.format,
    iv: encrypted.iv,
    ciphertext: new Blob([encrypted.ciphertext], { type: 'application/octet-stream' }),
    name: String(metadata.name || 'file').slice(0, 180),
    type: String(metadata.type || blob.type || 'application/octet-stream').slice(0, 120),
    size: blob.size,
    sha256,
    kind: String(metadata.kind || 'resource').slice(0, 40),
    createdAt: metadata.createdAt || new Date().toISOString(),
  };
  await withStore('readwrite', (store) => store.put(record));
  revokeAssetUrl(id);
  return { id, name: record.name, type: record.type, size: record.size, sha256: record.sha256, kind: record.kind, createdAt: record.createdAt };
}

export async function storeAsset(fileOrBlob, metadata = {}) {
  const blob = fileOrBlob instanceof Blob ? fileOrBlob : null;
  return writeEncryptedAsset(blob, {
    ...metadata,
    name: metadata.name || fileOrBlob?.name || 'file',
    type: metadata.type || blob?.type,
  });
}

export async function getAsset(id) {
  if (!id) return null;
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    return await requestResult(transaction.objectStore(STORE_NAME).get(String(id)));
  } finally {
    db.close();
  }
}

export async function getAssetMetadata(id) {
  const record = await getAsset(id);
  if (!record) return null;
  return {
    id: record.id,
    name: record.name || 'file',
    type: record.type || 'application/octet-stream',
    size: Number(record.size || 0),
    sha256: String(record.sha256 || ''),
    kind: record.kind || 'resource',
    createdAt: record.createdAt || '',
  };
}

export async function listAssetMetadata(ids = null) {
  const wanted = Array.isArray(ids) ? new Set(ids.filter(Boolean).map(String)) : null;
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const records = await requestResult(transaction.objectStore(STORE_NAME).getAll());
    return (records || [])
      .filter((record) => !wanted || wanted.has(String(record.id)))
      .map((record) => ({
        id: record.id,
        name: record.name || 'file',
        type: record.type || 'application/octet-stream',
        size: Number(record.size || 0),
        sha256: String(record.sha256 || ''),
        kind: record.kind || 'resource',
        createdAt: record.createdAt || '',
      }));
  } finally {
    db.close();
  }
}

export async function importAssetBlob(blob, metadata = {}) {
  return writeEncryptedAsset(blob, metadata);
}

export async function getAssetBlob(id) {
  const record = await getAsset(id);
  if (!record) return null;
  if (record.format && record.ciphertext) {
    const encryptedBuffer = await record.ciphertext.arrayBuffer();
    const plain = await decryptBytes({ format: record.format, iv: record.iv, ciphertext: new Uint8Array(encryptedBuffer) });
    return new Blob([plain], { type: record.type || 'application/octet-stream' });
  }
  if (record.blob instanceof Blob) return record.blob;
  return null;
}

export async function acquireAssetUrl(id) {
  if (!id) return '';
  const key = String(id);
  const cached = objectUrlCache.get(key);
  if (cached) {
    cached.references += 1;
    return cached.url;
  }
  const blob = await getAssetBlob(key);
  if (!blob) return '';
  const url = URL.createObjectURL(blob);
  objectUrlCache.set(key, { url, references: 1 });
  return url;
}

export async function getAssetUrl(id) {
  return acquireAssetUrl(id);
}

export function releaseAssetUrl(id) {
  const key = String(id || '');
  const cached = objectUrlCache.get(key);
  if (!cached) return;
  cached.references -= 1;
  if (cached.references <= 0) {
    URL.revokeObjectURL(cached.url);
    objectUrlCache.delete(key);
  }
}

export function revokeAssetUrl(id) {
  const key = String(id || '');
  const cached = objectUrlCache.get(key);
  if (cached?.url) URL.revokeObjectURL(cached.url);
  objectUrlCache.delete(key);
}

export async function deleteAsset(id) {
  if (!id) return;
  revokeAssetUrl(id);
  await withStore('readwrite', (store) => store.delete(String(id)));
}

function dataUrlToBlob(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(dataUrl || ''));
  if (!match) throw new Error('صيغة الملف القديمة غير صالحة.');
  const mime = match[1] || 'application/octet-stream';
  const binary = match[2] ? atob(match[3]) : decodeURIComponent(match[3]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

export async function importLegacyDataUrl(dataUrl, metadata = {}) {
  const blob = dataUrlToBlob(dataUrl);
  return storeAsset(blob, { ...metadata, type: metadata.type || blob.type });
}

export async function assetToDataUrl(id, maxBytes = 5 * 1024 * 1024) {
  const record = await getAsset(id);
  if (!record) return '';
  if (record.size > maxBytes) throw new Error('حجم الملف أكبر من الحد المسموح للمشاركة المباشرة (5 ميجابايت).');
  const blob = await getAssetBlob(id);
  if (!blob) return '';
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر تجهيز الملف للمشاركة.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

export async function exportAssets() {
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const records = await requestResult(transaction.objectStore(STORE_NAME).getAll());
    const output = [];
    for (const record of records || []) {
      const blob = await getAssetBlob(record.id);
      if (!blob) continue;
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error(`تعذر تصدير الملف ${record.name || record.id}.`));
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(blob);
      });
      output.push({ id: record.id, name: record.name, type: record.type, size: record.size, sha256: record.sha256 || '', kind: record.kind, createdAt: record.createdAt, data });
    }
    return output;
  } finally {
    db.close();
  }
}

export async function importAssets(records = []) {
  for (const record of Array.isArray(records) ? records : []) {
    if (!record?.id || !record?.data) continue;
    await importLegacyDataUrl(record.data, record);
  }
}

async function migrateLegacyAssetDatabase() {
  if (!globalThis.indexedDB) return;
  let legacyDb;
  try {
    legacyDb = await openDb(LEGACY_DB_NAME);
    const transaction = legacyDb.transaction(STORE_NAME, 'readonly');
    const records = await requestResult(transaction.objectStore(STORE_NAME).getAll());
    for (const record of records || []) {
      if (!record?.id || !(record.blob instanceof Blob)) continue;
      const existing = await getAsset(record.id);
      if (!existing) await writeEncryptedAsset(record.blob, record);
    }
  } catch {
    return;
  } finally {
    legacyDb?.close?.();
  }
  try {
    globalThis.indexedDB.deleteDatabase(LEGACY_DB_NAME);
  } catch {
    // Old database can be cleaned on a later launch.
  }
}

let migrationPromise;
export function ensureAssetMigration() {
  if (!migrationPromise) migrationPromise = migrateLegacyAssetDatabase();
  return migrationPromise;
}

export async function clearAssets() {
  for (const id of [...objectUrlCache.keys()]) revokeAssetUrl(id);
  await withStore('readwrite', (store) => store.clear());
  try {
    globalThis.indexedDB?.deleteDatabase?.(LEGACY_DB_NAME);
  } catch {
    // Ignore cleanup errors.
  }
}
