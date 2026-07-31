export function shouldRunAutoBackup(settings = {}, now = Date.now()) {
  const cloud = settings.cloudSync || {};
  if (cloud.autoBackup !== true) return false;
  if (!/^https:\/\//i.test(String(cloud.endpoint || ''))) return false;
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(String(cloud.workspaceId || ''))) return false;
  if (String(cloud.token || '').length < 24) return false;
  const hours = Math.max(1, Math.min(168, Number(cloud.autoBackupIntervalHours || 24)));
  const last = Date.parse(cloud.lastAutoBackupAt || cloud.lastPushAt || '');
  return !Number.isFinite(last) || now - last >= hours * 60 * 60 * 1000;
}
