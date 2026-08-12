const PDFJS_MODULE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

let pdfJsPromise = null;
const documentCache = new Map();

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import(/* @vite-ignore */ PDFJS_MODULE_URL).then((pdfjs) => {
      if (pdfjs?.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return pdfjs;
    });
  }
  return pdfJsPromise;
}

async function openDocument({ blob, url, cacheKey }) {
  const key = String(cacheKey || url || (blob ? `${blob.size}:${blob.type}` : ''));
  if (key && documentCache.has(key)) return documentCache.get(key);
  const pdfjs = await loadPdfJs();
  const input = blob ? { data: new Uint8Array(await blob.arrayBuffer()) } : { url };
  const task = pdfjs.getDocument(input);
  const doc = await task.promise;
  if (key) {
    documentCache.set(key, doc);
    if (documentCache.size > 5) {
      const firstKey = documentCache.keys().next().value;
      if (firstKey && firstKey !== key) documentCache.delete(firstKey);
    }
  }
  return doc;
}

async function renderDocumentPage(source, page = 1, targetWidth = 1800) {
  const doc = await openDocument(source);
  const safePage = Math.max(1, Math.min(Number(page || 1), Number(doc.numPages || 1)));
  const pdfPage = await doc.getPage(safePage);
  const baseViewport = pdfPage.getViewport({ scale: 1 });
  const scale = Math.max(0.5, Math.min(4, Number(targetWidth || 1800) / Math.max(1, baseViewport.width)));
  const viewport = pdfPage.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await pdfPage.render({ canvasContext: context, viewport }).promise;
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.94),
    pageCount: Number(doc.numPages || 0),
  };
}

export function renderWebPdfBlob(blob, page = 1, targetWidth = 1800, cacheKey = '') {
  return renderDocumentPage({ blob, cacheKey }, page, targetWidth);
}

export function renderWebPdfPage(url, page = 1, targetWidth = 1800, cacheKey = '') {
  return renderDocumentPage({ url, cacheKey: cacheKey || url }, page, targetWidth);
}
