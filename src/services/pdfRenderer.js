import { registerPlugin } from "@capacitor/core";
import { releaseNativeAsset, stageBlobForNative } from "./nativeAssetBridge";

const NativePdfRenderer = registerPlugin("MobdeaPdfRenderer");
const cache = new Map();
const nativePaths = new Map();
const MAX_CACHED_PDF_ASSETS = 3;
const MAX_CACHED_PDF_PAGES = 18;

function trimNativePdfCache(activeAssetKey) {
  while (nativePaths.size > MAX_CACHED_PDF_ASSETS) {
    const staleKey = nativePaths.keys().next().value;
    if (staleKey === activeAssetKey) break;
    const stalePath = nativePaths.get(staleKey);
    nativePaths.delete(staleKey);
    stalePath?.then(releaseNativeAsset).catch(() => {});
    for (const [key, entry] of cache.entries()) {
      if (entry.assetKey === staleKey) cache.delete(key);
    }
  }
  while (cache.size > MAX_CACHED_PDF_PAGES)
    cache.delete(cache.keys().next().value);
}

async function renderBlob(blob, page = 1, maxWidth = 1600, cacheKey = "") {
  if (!(blob instanceof Blob) || !globalThis.Capacitor?.isNativePlatform?.())
    return null;
  if (blob.size > 500 * 1024 * 1024) {
    throw new Error(
      "حجم ملف PDF أكبر من الحد المدعوم للعرض داخل السبورة (500 ميجابايت).",
    );
  }
  const normalizedPage = Math.max(1, Number(page) || 1);
  const assetKey = cacheKey || `${blob.type}:${blob.size}`;
  const key = `${assetKey}:${normalizedPage}:${maxWidth}`;
  if (cache.has(key)) return cache.get(key).task;
  if (nativePaths.has(assetKey)) {
    const path = nativePaths.get(assetKey);
    nativePaths.delete(assetKey);
    nativePaths.set(assetKey, path);
  } else {
    nativePaths.set(assetKey, stageBlobForNative(blob));
  }
  trimNativePdfCache(assetKey);
  const assetPath = await nativePaths.get(assetKey);
  const task = NativePdfRenderer.renderPage({
    assetPath,
    page: normalizedPage,
    maxWidth,
  });
  cache.set(key, { assetKey, task });
  trimNativePdfCache(assetKey);
  try {
    return await task;
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}

export async function renderNativePdfBlob(
  blob,
  page = 1,
  maxWidth = 1600,
  cacheKey = "",
) {
  if (!(blob instanceof Blob))
    throw new Error("ملف PDF غير متاح داخل ذاكرة المنصة.");
  return renderBlob(
    blob,
    page,
    maxWidth,
    cacheKey || `${blob.type}:${blob.size}`,
  );
}

export async function renderNativePdfPage(url, page = 1, maxWidth = 1600) {
  if (!url || !globalThis.Capacitor?.isNativePlatform?.()) return null;
  const response = await fetch(url);
  if (!response.ok) throw new Error("تعذر قراءة ملف PDF.");
  return renderBlob(await response.blob(), page, maxWidth, url);
}

export function clearPdfRenderCache() {
  cache.clear();
  for (const pathPromise of nativePaths.values())
    pathPromise.then(releaseNativeAsset).catch(() => {});
  nativePaths.clear();
}
