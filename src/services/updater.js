import { isHttpUrl, normalizeHttpUrl } from '../utils/safety';

const compareVersions = (left, right) => {
  const a = String(left || '0').replace(/^v/i, '').split('.').map(Number);
  const b = String(right || '0').replace(/^v/i, '').split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
};

export async function checkForUpdate(settings, currentVersion) {
  const endpoint = normalizeHttpUrl(settings?.update?.manifestUrl) || '/update.manifest.json';
  if (!endpoint) throw new Error('أضف رابط ملف التحديث من الإعدادات أولًا.');
  const response = await fetch(`${endpoint}${endpoint.includes('?') ? '&' : '?'}t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`تعذر فحص التحديث (${response.status})`);
  const manifest = await response.json();
  const version = String(manifest?.version || '').trim();
  const apkUrl = normalizeHttpUrl(manifest?.apkUrl);
  if (!version || !apkUrl) throw new Error('ملف التحديث ناقص version أو apkUrl.');
  return {
    ...manifest,
    version,
    apkUrl,
    available: compareVersions(version, currentVersion) > 0
  };
}

export function openApkDownload(url) {
  const safeUrl = normalizeHttpUrl(url);
  if (!safeUrl || !isHttpUrl(safeUrl)) throw new Error('رابط APK غير صالح.');
  window.location.href = safeUrl;
}
