import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const pdfCache = new Map();

function cacheKeyFor(source, resourceId = '') {
  if (resourceId) return String(resourceId);
  if (source?.blob) return `blob:${source.blob.size}:${source.blob.type || 'application/pdf'}`;
  return String(source?.url || '');
}

async function openPdf(source, resourceId) {
  const key = cacheKeyFor(source, resourceId);
  if (key && pdfCache.has(key)) return pdfCache.get(key);
  if (!source?.blob && !source?.url) throw new Error('ملف PDF غير موجود في ذاكرة المنصة.');

  const input = source?.blob
    ? { data: new Uint8Array(await source.blob.arrayBuffer()), isEvalSupported: false }
    : { url: source.url, withCredentials: false, isEvalSupported: false };

  const loadingTask = pdfjs.getDocument(input);
  const document = await loadingTask.promise;
  if (key) {
    pdfCache.set(key, document);
    while (pdfCache.size > 4) {
      const staleKey = pdfCache.keys().next().value;
      if (!staleKey || staleKey === key) break;
      const stale = pdfCache.get(staleKey);
      pdfCache.delete(staleKey);
      try { stale?.destroy?.(); } catch { /* best effort */ }
    }
  }
  return document;
}

export default function PdfCanvasPreview({ source, page = 1, resourceId = '', title = '', onStateChange }) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const [resizeVersion, setResizeVersion] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return undefined;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setResizeVersion((value) => value + 1));
    });
    observer.observe(host);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let renderTask = null;
    const render = async () => {
      const host = hostRef.current;
      const canvas = canvasRef.current;
      if (!host || !canvas || (!source?.blob && !source?.url)) {
        onStateChange?.({ dataUrl: '', pageCount: 0, loading: false, error: 'ملف PDF غير متاح داخل مكتبة الدرس.' });
        return;
      }

      onStateChange?.((current) => ({ ...(typeof current === 'object' ? current : {}), dataUrl: '', loading: true, error: '' }));
      try {
        const document = await openPdf(source, resourceId);
        if (cancelled) return;
        const safePage = Math.max(1, Math.min(Number(page || 1), Number(document.numPages || 1)));
        const pdfPage = await document.getPage(safePage);
        if (cancelled) return;

        const base = pdfPage.getViewport({ scale: 1 });
        const hostWidth = Math.max(120, host.clientWidth || 0);
        const hostHeight = Math.max(120, host.clientHeight || 0);
        const fitScale = Math.max(0.1, Math.min(hostWidth / base.width, hostHeight / base.height));
        const pixelRatio = Math.max(1, Math.min(2, Number(window.devicePixelRatio || 1)));
        const renderViewport = pdfPage.getViewport({ scale: fitScale * pixelRatio });
        const cssWidth = Math.max(1, Math.floor(base.width * fitScale));
        const cssHeight = Math.max(1, Math.floor(base.height * fitScale));

        canvas.width = Math.max(1, Math.ceil(renderViewport.width));
        canvas.height = Math.max(1, Math.ceil(renderViewport.height));
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;

        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('تعذر إنشاء مساحة عرض صفحة PDF.');
        context.save();
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.restore();

        renderTask = pdfPage.render({ canvasContext: context, viewport: renderViewport });
        await renderTask.promise;
        if (cancelled) return;
        onStateChange?.({ dataUrl: 'canvas', pageCount: Number(document.numPages || 0), loading: false, error: '' });
      } catch (error) {
        if (cancelled || error?.name === 'RenderingCancelledException') return;
        onStateChange?.({ dataUrl: '', pageCount: 0, loading: false, error: error?.message || 'تعذر عرض صفحة PDF.' });
      }
    };

    void render();
    return () => {
      cancelled = true;
      try { renderTask?.cancel?.(); } catch { /* already completed */ }
    };
  }, [source?.blob, source?.url, page, resourceId, resizeVersion, onStateChange]);

  return (
    <div ref={hostRef} className="classmode-pdf-canvas-host" role="img" aria-label={`${title || 'ملف PDF'} — صفحة ${page || 1}`}>
      <canvas ref={canvasRef} className="classmode-pdf-live-canvas" />
    </div>
  );
}
