import { Capacitor, registerPlugin } from '@capacitor/core';
import { isHttpsUrl, normalizeHttpUrl, safeTrim } from '../utils/safety';
import { release } from '../config/release';

const NativeUpdater = registerPlugin('MobdeaUpdater');
const MAX_APK_BYTES = 250 * 1024 * 1024;

export const compareVersions = (left, right) => {
  const parse = (value) => String(value || '0').replace(/^v/i, '').split('.').map((part) => Number.parseInt(part, 10) || 0).slice(0, 4);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) > (b[index] || 0)) return 1;
    if ((a[index] || 0) < (b[index] || 0)) return -1;
  }
  return 0;
};

function resolveManifestUrl(settings = {}) {
  const custom = normalizeHttpUrl(settings?.update?.manifestUrl);
  if (custom) return custom;
  return new URL(release.manifestPath, globalThis.document?.baseURI || globalThis.location?.href || 'https://localhost/').toString();
}

function validateManifest(manifest) {
  if (manifest?.enabled === false) {
    return { enabled: false, version: String(manifest.version || release.appVersion), notes: safeTrim(manifest.notes || '', 2000), mandatory: false, available: false };
  }
  const version = safeTrim(manifest?.version, 40);
  const apkUrl = normalizeHttpUrl(manifest?.apkUrl);
  const sha256 = safeTrim(manifest?.sha256, 64).toLowerCase().replace(/[^a-f0-9]/g, '');
  const packageName = safeTrim(manifest?.packageName, 120);
  const sizeBytes = Number(manifest?.sizeBytes || 0);
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new Error('رقم إصدار ملف التحديث غير صالح.');
  if (!apkUrl || !isHttpsUrl(apkUrl)) throw new Error('رابط APK يجب أن يكون HTTPS.');
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('ملف التحديث يجب أن يحتوي على SHA-256 صحيح.');
  if (packageName !== release.packageName) throw new Error('اسم حزمة التحديث لا يطابق التطبيق.');
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_APK_BYTES) throw new Error('حجم APK في ملف التحديث غير صالح.');
  return {
    ...manifest,
    enabled: true,
    version,
    apkUrl,
    sha256,
    packageName,
    sizeBytes,
    notes: safeTrim(manifest.notes || '', 4000),
    mandatory: manifest.mandatory === true,
  };
}

export async function checkForUpdate(settings, currentVersion) {
  const endpoint = resolveManifestUrl(settings);
  const url = new URL(endpoint);
  url.searchParams.set('t', String(Date.now()));
  const response = await fetch(url.toString(), { cache: 'no-store', credentials: 'omit', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`تعذر فحص التحديث (${response.status}).`);
  const validated = validateManifest(await response.json());
  if (!validated.enabled) return validated;
  return { ...validated, available: compareVersions(validated.version, currentVersion) > 0 };
}

export async function openApkDownload(update) {
  const manifest = validateManifest(update);
  if (!manifest.enabled) throw new Error('لا يوجد تحديث APK مفعّل.');
  if (Capacitor.isNativePlatform?.() && Capacitor.getPlatform?.() === 'android') {
    return NativeUpdater.downloadAndInstall({
      url: manifest.apkUrl,
      sha256: manifest.sha256,
      sizeBytes: manifest.sizeBytes,
      packageName: manifest.packageName,
    });
  }
  const opened = globalThis.open?.(manifest.apkUrl, '_blank', 'noopener,noreferrer');
  if (!opened) globalThis.location.assign(manifest.apkUrl);
  return { ok: true };
}
