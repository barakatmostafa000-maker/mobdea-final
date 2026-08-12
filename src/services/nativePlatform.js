import { Capacitor, registerPlugin } from '@capacitor/core';
import { getAssetBlob } from './assetStore';

const NativeDocumentViewer = registerPlugin('MobdeaDocumentViewer');
const NativePrinter = registerPlugin('MobdeaPrint');

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر تجهيز الملف للفتح.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

async function resolveResourceBlob(resource = {}, url = '') {
  if (resource.assetId) {
    const stored = await getAssetBlob(resource.assetId);
    if (stored) return stored;
  }

  const source = url || resource.url || '';
  if (!source || source === '#') return null;
  const response = await fetch(source);
  if (!response.ok) throw new Error('تعذر قراءة الملف المختار.');
  return response.blob();
}

export async function openResourceDocument(resource = {}, url = '') {
  const blob = await resolveResourceBlob(resource, url);
  if (!blob) throw new Error('الملف غير موجود أو لم يكتمل رفعه.');
  const fileName = resource.fileName || resource.title || 'mobdea-document';
  const mimeType = resource.mimeType || blob.type || 'application/octet-stream';

  if (Capacitor.isNativePlatform()) {
    const base64 = await blobToBase64(blob);
    await NativeDocumentViewer.open({ base64, fileName, mimeType });
    return true;
  }

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
  return true;
}

export async function printCurrentView(title = 'المُبدع', options = {}) {
  const duplexMode = options?.duplexMode || 'none';
  if (Capacitor.isNativePlatform()) {
    await NativePrinter.printCurrentView({ title, duplexMode });
    return true;
  }
  window.print();
  return true;
}
