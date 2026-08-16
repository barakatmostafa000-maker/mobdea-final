import { registerPlugin } from '@capacitor/core';

const NativeAsset = registerPlugin('MobdeaNativeAsset');
const CHUNK_BYTES = 384 * 1024;

function bytesToBase64(bytes) {
  let binary = '';
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return btoa(binary);
}

export async function stageBlobForNative(blob, { signal, onProgress } = {}) {
  if (!(blob instanceof Blob) || blob.size <= 0) throw new Error('الملف غير متاح للنقل إلى Android.');
  if (!globalThis.Capacitor?.isNativePlatform?.()) throw new Error('النقل المباشر متاح داخل تطبيق Android فقط.');

  const started = await NativeAsset.begin({ size: blob.size });
  const token = String(started?.token || '');
  let path = String(started?.path || '');
  try {
    let uploaded = 0;
    while (uploaded < blob.size) {
      if (signal?.aborted) throw new DOMException('تم إلغاء العملية.', 'AbortError');
      const end = Math.min(blob.size, uploaded + CHUNK_BYTES);
      const bytes = new Uint8Array(await blob.slice(uploaded, end).arrayBuffer());
      await NativeAsset.append({ token, base64: bytesToBase64(bytes) });
      uploaded = end;
      onProgress?.({ uploaded, total: blob.size });
    }
    const finished = await NativeAsset.finish({ token, size: blob.size });
    path = String(finished?.path || path);
    if (!path) throw new Error('تعذر تجهيز الملف داخل Android.');
    return path;
  } catch (error) {
    if (path) await NativeAsset.release({ path }).catch(() => {});
    throw error;
  }
}

export async function releaseNativeAsset(path) {
  if (!path || !globalThis.Capacitor?.isNativePlatform?.()) return;
  await NativeAsset.release({ path }).catch(() => {});
}
