const BACKUP_VERSION = '6.1.0';
const MAX_BACKUP_BYTES = 5_000_000;

function checksum(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createBackupPayload(data) {
  const exportedAt = new Date().toISOString();
  const body = { version: BACKUP_VERSION, exportedAt, data };
  const raw = JSON.stringify(body);
  return { ...body, checksum: checksum(raw) };
}

export function downloadBackup(data) {
  const payload = createBackupPayload(data);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mobdea-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.rel = 'noopener';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readBackupFile(file) {
  if (!file || file.size > MAX_BACKUP_BYTES) throw new Error('ملف النسخة الاحتياطية كبير جدًا أو غير صالح');
  const text = await file.text();
  const payload = JSON.parse(text);
  if (!payload?.data || !payload.version || !payload.checksum) throw new Error('ملف النسخة الاحتياطية غير صالح');
  const expected = checksum(JSON.stringify({ version: payload.version, exportedAt: payload.exportedAt, data: payload.data }));
  if (expected !== payload.checksum) throw new Error('فشل التحقق من سلامة النسخة الاحتياطية');
  return payload.data;
}
