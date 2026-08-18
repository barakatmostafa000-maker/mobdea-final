import { registerPlugin } from '@capacitor/core';
import { getAssetBlob } from './assetStore';
import { normalizeOcrText, structureOcrQuestions } from './ocrQuestionParser';
import { selectQuestionPageWindow } from './ocrQuestionDiscovery';
import { releaseNativeAsset, stageBlobForNative } from './nativeAssetBridge';

const NativePdfOcr = registerPlugin('MobdeaPdfOcr');
export const OCR_MAX_PAGES = 80;
export const OCR_BATCH_PAGES = 4;
export const OCR_AUTO_SCAN_PAGES = 30;

export { normalizeOcrText, structureOcrQuestions } from './ocrQuestionParser';

function ensureNativeOcr() {
  if (!globalThis.Capacitor?.isNativePlatform?.()) {
    throw new Error('استخراج OCR يعمل داخل تطبيق Android على الموبايل أو التابلت.');
  }
}

async function loadPdfAsset(assetId) {
  if (!assetId) throw new Error('ارفع كتاب الشرح الأساسي أو ملف الامتحانات لهذا الصف أولًا.');
  ensureNativeOcr();
  const blob = await getAssetBlob(assetId);
  if (!(blob instanceof Blob)) throw new Error('تعذر قراءة ملف PDF من ذاكرة المنصة.');
  if (blob.size > 500 * 1024 * 1024) throw new Error('حجم ملف PDF أكبر من الحد المدعوم لاستخراج الأسئلة (500 ميجابايت).');
  return blob;
}

async function recognizePdfRange({ assetPath, startPage, endPage, onProgress, signal }) {
  const firstPage = Math.max(1, Number(startPage || 1));
  const lastPage = Math.max(firstPage, Number(endPage || firstPage));
  if (lastPage - firstPage + 1 > OCR_BATCH_PAGES) {
    throw new Error(`دفعة OCR الداخلية أكبر من الحد الآمن (${OCR_BATCH_PAGES} صفحات).`);
  }

  let listener;
  const taskId = globalThis.crypto?.randomUUID?.() || `ocr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const cancel = () => NativePdfOcr.cancel({ taskId }).catch(() => {});
  try {
    if (signal?.aborted) throw new DOMException('تم إلغاء عملية OCR.', 'AbortError');
    signal?.addEventListener('abort', cancel, { once: true });
    listener = await NativePdfOcr.addListener('progress', (event) => {
      onProgress?.({
        page: Number(event?.page || firstPage),
        totalPages: Number(event?.totalPages || lastPage - firstPage + 1),
        stage: String(event?.stage || 'recognizing'),
      });
    });
    return await NativePdfOcr.recognizePdfPages({
      assetPath,
      taskId,
      startPage: firstPage,
      endPage: lastPage,
      language: 'ara+eng',
      maxWidth: 1600,
    });
  } finally {
    signal?.removeEventListener('abort', cancel);
    await listener?.remove?.().catch?.(() => {});
  }
}

export async function extractQuestionsFromPdfAsset({
  assetId,
  startPage = 1,
  endPage = startPage,
  onProgress,
  signal,
} = {}) {
  const blob = await loadPdfAsset(assetId);
  const firstPage = Math.max(1, Number(startPage || 1));
  const lastPage = Math.max(firstPage, Number(endPage || firstPage));
  const selectedPageCount = lastPage - firstPage + 1;
  if (selectedPageCount > OCR_MAX_PAGES) {
    throw new Error(`يمكن اختيار ${OCR_MAX_PAGES} صفحة كحد أقصى في عملية OCR الواحدة.`);
  }
  const assetPath = await stageBlobForNative(blob, {
    signal,
    onProgress: ({ uploaded, total }) => onProgress?.({ stage: 'staging-file', uploaded, total }),
  });
  try {
    const pages = [];
    const textParts = [];
    let pageCount = 0;
    let processedPages = 0;
    let modelDownloaded = false;
    for (let batchStart = firstPage; batchStart <= lastPage; batchStart += OCR_BATCH_PAGES) {
      if (signal?.aborted) throw new DOMException('تم إلغاء عملية OCR.', 'AbortError');
      const batchEnd = Math.min(lastPage, batchStart + OCR_BATCH_PAGES - 1);
      const result = await recognizePdfRange({
        assetPath,
        startPage: batchStart,
        endPage: batchEnd,
        signal,
        onProgress: (progress) => onProgress?.({
          ...progress,
          totalPages: selectedPageCount,
          processedPages,
        }),
      });
      if (String(result?.text || '').trim()) textParts.push(String(result.text));
      pages.push(...(Array.isArray(result?.pages) ? result.pages : []));
      pageCount = Math.max(pageCount, Number(result?.pageCount || 0));
      processedPages += Number(result?.processedPages || 0);
      modelDownloaded ||= Boolean(result?.modelDownloaded);
    }
    const structured = structureOcrQuestions(textParts.join('\n\n'));
    return {
      ...structured,
      pages,
      pageCount,
      processedPages,
      startPage: firstPage,
      endPage: lastPage,
      modelDownloaded,
    };
  } finally {
    await releaseNativeAsset(assetPath);
  }
}

/**
 * Finds the exercise/question pages automatically near the end of a lesson.
 * The scan is intentionally bounded because Arabic OCR is CPU intensive.
 */
export async function autoDetectQuestionsFromPdfAsset({
  assetId,
  lessonStartPage = 1,
  lessonEndPage = lessonStartPage,
  onProgress,
  signal,
} = {}) {
  const blob = await loadPdfAsset(assetId);
  const declaredStart = Math.max(1, Number(lessonStartPage || 1));
  const declaredEnd = Math.max(declaredStart, Number(lessonEndPage || declaredStart));
  const scanStart = Math.max(declaredStart, declaredEnd - OCR_AUTO_SCAN_PAGES + 1);
  const collectedPages = [];
  let pageCount = 0;
  let modelDownloaded = false;

  const assetPath = await stageBlobForNative(blob, {
    signal,
    onProgress: ({ uploaded, total }) => onProgress?.({ stage: 'staging-file', uploaded, total }),
  });
  try {
    for (let chunkStart = scanStart; chunkStart <= declaredEnd; chunkStart += OCR_BATCH_PAGES) {
      if (signal?.aborted) throw new DOMException('تم إلغاء عملية OCR.', 'AbortError');
      const chunkEnd = Math.min(declaredEnd, chunkStart + OCR_BATCH_PAGES - 1);
      const result = await recognizePdfRange({
        assetPath,
        startPage: chunkStart,
        endPage: chunkEnd,
        signal,
        onProgress: (progress) => onProgress?.({ ...progress, stage: progress.stage === 'recognizing' ? 'detecting-questions' : progress.stage }),
      });
      pageCount = Math.max(pageCount, Number(result?.pageCount || 0));
      modelDownloaded ||= Boolean(result?.modelDownloaded);
      for (const page of Array.isArray(result?.pages) ? result.pages : []) collectedPages.push(page);
    }
  } finally {
    await releaseNativeAsset(assetPath);
  }

  const { pages: selectedPages, scored } = selectQuestionPageWindow(collectedPages);
  if (!selectedPages.length) {
    return {
      ...structureOcrQuestions(''),
      pageCount,
      processedPages: collectedPages.length,
      startPage: 0,
      endPage: 0,
      detected: false,
      modelDownloaded,
      scannedStartPage: scanStart,
      scannedEndPage: declaredEnd,
      pageScores: scored.map(({ page, score, parsed }) => ({ page, score: Number(score.toFixed(2)), parsed })),
    };
  }

  const combined = selectedPages
    .map((page) => `--- صفحة ${page.page} ---\n${page.text || ''}`)
    .join('\n\n');
  const structured = structureOcrQuestions(combined);
  return {
    ...structured,
    pageCount,
    processedPages: collectedPages.length,
    startPage: Number(selectedPages[0]?.page || 0),
    endPage: Number(selectedPages[selectedPages.length - 1]?.page || 0),
    detected: true,
    modelDownloaded,
    scannedStartPage: scanStart,
    scannedEndPage: declaredEnd,
    detectedPages: selectedPages.map((page) => Number(page.page)),
    pageScores: scored.map(({ page, score, parsed }) => ({ page, score: Number(score.toFixed(2)), parsed })),
  };
}
