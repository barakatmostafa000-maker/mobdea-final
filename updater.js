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
  const endpoint = settings?.update?.manifestUrl?.trim();
  if (!endpoint) throw new Error('أضف رابط ملف التحديث من الإعدادات أولًا.');
  const response = await fetch(`${endpoint}${endpoint.includes('?') ? '&' : '?'}t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`تعذر فحص التحديث (${response.status})`);
  const manifest = await response.json();
  if (!manifest.version || !manifest.apkUrl) throw new Error('ملف التحديث ناقص version أو apkUrl.');
  return {
    ...manifest,
    available: compareVersions(manifest.version, currentVersion) > 0
  };
}

export function openApkDownload(url) {
  if (!url) throw new Error('رابط APK غير موجود.');
  window.location.href = url;
}
