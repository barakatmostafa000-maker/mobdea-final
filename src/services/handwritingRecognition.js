import { Capacitor, registerPlugin } from '@capacitor/core';

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const NativeDigitalInk = registerPlugin('MobdeaDigitalInk');
let tesseractPromise = null;

function normalizeRecognizedText(value) {
  return String(value || '')
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function serializeDigitalInkStrokes(strokes = []) {
  return strokes
    .filter((stroke) => stroke?.kind === 'stroke' && Array.isArray(stroke.points) && stroke.points.length > 1)
    .map((stroke) => ({
      points: stroke.points.map((point, index) => ({
        x: Number(point.x || 0),
        y: Number(point.y || 0),
        t: Math.max(1, Math.round(Number(point.t ?? index + 1))),
      })),
    }));
}

async function detectWithNativeDigitalInk(strokes, { preContext = '' } = {}) {
  if (!Capacitor.isNativePlatform()) return null;
  const payloadStrokes = serializeDigitalInkStrokes(strokes);
  if (!payloadStrokes.length) return null;
  try {
    const result = await NativeDigitalInk.recognize({
      languageTag: 'ar',
      strokes: payloadStrokes,
      preContext: String(preContext || '').slice(-20),
    });
    const text = normalizeRecognizedText(result?.text || '');
    if (!text) return null;
    return {
      text,
      confidence: result?.confidence == null ? null : Number(result.confidence),
      score: result?.score == null ? null : Number(result.score),
      candidates: Array.isArray(result?.candidates) ? result.candidates.map(normalizeRecognizedText).filter(Boolean) : [],
      engine: result?.engine || 'mlkit-digital-ink',
    };
  } catch {
    // Browser-compatible OCR below remains a safe fallback if the native model
    // has not finished downloading or a vendor Android build rejects the plugin.
    return null;
  }
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

async function loadBundledTesseract() {
  try {
    const module = await import('tesseract.js');
    const value = module?.default || module;
    if (value?.createWorker) return value;
  } catch {
    // Older project installs may not contain the local package yet. The CDN
    // fallback keeps browser testing available until dependencies are installed.
  }
  return null;
}

function loadCdnTesseract() {
  if (globalThis.Tesseract?.createWorker) return Promise.resolve(globalThis.Tesseract);
  return new Promise((resolve, reject) => {
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
}

async function loadTesseract() {
  if (globalThis.Tesseract?.createWorker) return globalThis.Tesseract;
  if (!tesseractPromise) {
    tesseractPromise = (async () => {
      const bundled = await loadBundledTesseract();
      if (bundled) return bundled;
      return loadCdnTesseract();
    })().catch((error) => {
      tesseractPromise = null;
      throw error;
    });
  }
  return tesseractPromise;
}

async function detectWithTesseract(dataUrl, onProgress) {
  const Tesseract = await loadTesseract();
  let worker;
  try {
    const options = { logger: (message) => onProgress?.(message) };
    try {
      worker = await Tesseract.createWorker(['ara', 'eng'], undefined, options);
    } catch {
      worker = await Tesseract.createWorker('ara+eng', undefined, options);
    }
    try {
      await worker.setParameters?.({
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
        user_defined_dpi: '220',
      });
    } catch { /* Some worker builds do not expose parameter updates. */ }
    const result = await worker.recognize(dataUrl);
    return {
      text: normalizeRecognizedText(result?.data?.text || ''),
      confidence: Number(result?.data?.confidence ?? 0),
    };
  } finally {
    try { await worker?.terminate?.(); } catch { /* ignore cleanup failures */ }
  }
}

export async function recognizeHandwritingDataUrl(dataUrl, { onProgress } = {}) {
  if (!dataUrl) throw new Error('لا توجد كتابة يدوية لتحويلها.');
  try {
    const browserText = await detectWithBrowserApi(dataUrl);
    if (browserText) return { text: browserText, confidence: null, engine: 'browser' };
  } catch {
    // Fall through to OCR.
  }
  const result = await detectWithTesseract(dataUrl, onProgress);
  if (!result?.text) throw new Error('لم يتعرف المحرك على نص واضح. اكتب بحجم أكبر وحاول مرة أخرى.');
  return { ...result, engine: 'tesseract' };
}

export async function recognizeHandwritingStrokes(strokes, dataUrl, options = {}) {
  const nativeResult = await detectWithNativeDigitalInk(strokes, options);
  if (nativeResult?.text) return nativeResult;
  return recognizeHandwritingDataUrl(dataUrl, options);
}
