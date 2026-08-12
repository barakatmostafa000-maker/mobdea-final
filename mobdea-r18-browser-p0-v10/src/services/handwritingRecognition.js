const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
let tesseractPromise = null;

function normalizeRecognizedText(value) {
  return String(value || '')
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function detectWithBrowserApi(dataUrl) {
  if (typeof globalThis.TextDetector !== 'function' || typeof globalThis.createImageBitmap !== 'function') return '';
  const blob = await fetch(dataUrl).then((response) => response.blob());
  const bitmap = await createImageBitmap(blob);
  try {
    const detector = new globalThis.TextDetector();
    const items = await detector.detect(bitmap);
    return normalizeRecognizedText(items.map((item) => item.rawValue || item.text || '').filter(Boolean).join(' '));
  } finally {
    bitmap.close?.();
  }
}

function loadTesseract() {
  if (globalThis.Tesseract?.createWorker) return Promise.resolve(globalThis.Tesseract);
  if (tesseractPromise) return tesseractPromise;
  tesseractPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-mobdea-tesseract]');
    if (existing) {
      existing.addEventListener('load', () => resolve(globalThis.Tesseract), { once: true });
      existing.addEventListener('error', () => reject(new Error('تعذر تحميل محرك التعرف على خط اليد.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = TESSERACT_CDN;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.mobdeaTesseract = 'true';
    script.onload = () => globalThis.Tesseract?.createWorker
      ? resolve(globalThis.Tesseract)
      : reject(new Error('محرك التعرف على خط اليد غير متاح.'));
    script.onerror = () => reject(new Error('تعذر تحميل محرك التعرف على خط اليد.'));
    document.head.appendChild(script);
  });
  return tesseractPromise;
}

async function detectWithTesseract(dataUrl, onProgress) {
  const Tesseract = await loadTesseract();
  let worker;
  try {
    try {
      worker = await Tesseract.createWorker(['ara', 'eng'], undefined, {
        logger: (message) => onProgress?.(message),
      });
    } catch {
      worker = await Tesseract.createWorker('ara+eng', undefined, {
        logger: (message) => onProgress?.(message),
      });
    }
    const result = await worker.recognize(dataUrl);
    return normalizeRecognizedText(result?.data?.text || '');
  } finally {
    await worker?.terminate?.().catch?.(() => {});
  }
}

export async function recognizeHandwritingDataUrl(dataUrl, { onProgress } = {}) {
  if (!dataUrl) throw new Error('لا توجد كتابة يدوية لتحويلها.');
  try {
    const browserText = await detectWithBrowserApi(dataUrl);
    if (browserText) return { text: browserText, engine: 'browser' };
  } catch {
    // Fall through to the local-in-page OCR engine.
  }
  const text = await detectWithTesseract(dataUrl, onProgress);
  return { text, engine: 'tesseract' };
}
