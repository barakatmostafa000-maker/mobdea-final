import { registerPlugin } from '@capacitor/core';

const NativePdfRenderer = registerPlugin('MobdeaPdfRenderer');
const cache = new Map();

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export async function renderNativePdfPage(url, page = 1, maxWidth = 1600) {
  if (!url || !globalThis.Capacitor?.isNativePlatform?.()) return null;
  const normalizedPage = Math.max(1, Number(page) || 1);
  const key = `${url}:${normalizedPage}:${maxWidth}`;
  if (cache.has(key)) return cache.get(key);
  const task = (async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('تعذر قراءة ملف PDF.');
    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength || buffer.byteLength > 80 * 1024 * 1024) throw new Error('حجم ملف PDF أكبر من الحد المدعوم للعرض داخل السبورة.');
    return NativePdfRenderer.renderPage({ base64: arrayBufferToBase64(buffer), page: normalizedPage, maxWidth });
  })();
  cache.set(key, task);
  try {
    return await task;
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}

export function clearPdfRenderCache() {
  cache.clear();
}
