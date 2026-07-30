import { APP_VERSION, DATA_SCHEMA_VERSION } from '../config/version';
import { exportAssets, importAssets } from './assetStore';
import { byteLength } from '../utils/safety';
import {
  BACKUP_CRYPTO_FORMAT,
  decryptBackupEnvelope,
  encryptBackupBody,
} from '../utils/backupCrypto';

const MAX_BACKUP_BYTES = 60 * 1024 * 1024;

export async function createBackupPayload(data, passphrase, { includeAssets = true } = {}) {
  const exportedAt = new Date().toISOString();
  const assets = includeAssets ? await exportAssets() : [];
  const body = { appVersion: APP_VERSION, schemaVersion: DATA_SCHEMA_VERSION, exportedAt, data, assets };
  const plaintextBytes = new TextEncoder().encode(JSON.stringify(body)).byteLength;
  if (plaintextBytes > MAX_BACKUP_BYTES) throw new Error('النسخة الاحتياطية أكبر من 60 ميجابايت. احذف الملفات الكبيرة أو صدّر بدونها.');
  return {
    ...(await encryptBackupBody(body, passphrase, { exportedAt })),
    appVersion: APP_VERSION,
    schemaVersion: DATA_SCHEMA_VERSION,
  };
}

export async function downloadBackup(data, passphrase, options = {}) {
  const payload = await createBackupPayload(data, passphrase, options);
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mobdea-backup-${APP_VERSION}-${new Date().toISOString().slice(0, 10)}.mobdea.json`;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function legacyChecksum(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function readLegacyBackup(payload) {
  if (!payload?.data || !payload.version || !payload.checksum) throw new Error('ملف النسخة الاحتياطية غير صالح.');
  const expected = legacyChecksum(JSON.stringify({ version: payload.version, exportedAt: payload.exportedAt, data: payload.data }));
  if (expected !== payload.checksum) throw new Error('فشل التحقق من سلامة النسخة القديمة.');
  return { data: payload.data, assets: [], legacy: true };
}

export async function readBackupFile(file, passphrase) {
  if (!file || file.size <= 0 || file.size > MAX_BACKUP_BYTES * 1.5) throw new Error('ملف النسخة الاحتياطية كبير جدًا أو غير صالح.');
  const text = await file.text();
  if (byteLength(text) > MAX_BACKUP_BYTES * 1.5) throw new Error('ملف النسخة الاحتياطية يتجاوز الحد المسموح.');
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error('ملف النسخة الاحتياطية ليس JSON صالحًا.'); }
  if (payload?.format !== BACKUP_CRYPTO_FORMAT) return readLegacyBackup(payload);
  const body = await decryptBackupEnvelope(payload, passphrase);
  if (!body?.data || !Array.isArray(body.assets)) throw new Error('محتوى النسخة غير صالح.');
  return { data: body.data, assets: body.assets, legacy: false };
}

export async function restoreBackupAssets(assets) {
  await importAssets(assets);
}
