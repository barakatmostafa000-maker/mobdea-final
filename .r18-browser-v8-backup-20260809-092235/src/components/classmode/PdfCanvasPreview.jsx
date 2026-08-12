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

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('تعذر تحويل صفحة PDF إلى صورة للعرض.'));
    }, 'image/png', 0.94);
  });
}

export default function PdfCanvasPreview({ source, page = 1, resourceId = '', title = '', onStateChange }) {
  const hostRef = useRef(null);
  const objectUrlRef = useRef('');
  const [renderedUrl, setRenderedUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resizeVersion, setResizeVersion] = useState(0);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = '';
  }, []);

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

    const publish = async () => {
      const host = hostRef.current;
      if (!host || (!source?.blob && !source?.url)) {
        const message = 'ملف PDF غير متاح داخل مكتبة الدرس.';
        setError(message);
        onStateChange?.({ dataUrl: '', pageCount: 0, loading: false, error: message });
        return;
      }

      const hostWidth = Math.floor(host.clientWidth || host.getBoundingClientRect().width || 0);
      const hostHeight = Math.floor(host.clientHeight || host.getBoundingClientRect().height || 0);
      if (hostWidth < 80 || hostHeight < 80) return;

      setLoading(true);
      setError('');
      onStateChange?.({ dataUrl: '', pageCount: 0, loading: true, error: '' });

      try {
        const pdfDocument = await openPdf(source, resourceId);
        if (cancelled) return;
        const safePage = Math.max(1, Math.min(Number(page || 1), Number(pdfDocument.numPages || 1)));
        const pdfPage = await pdfDocument.getPage(safePage);
        if (cancelled) return;

        const base = pdfPage.getViewport({ scale: 1 });
        const fitScale = Math.max(0.15, Math.min(hostWidth / base.width, hostHeight / base.height));
        const pixelRatio = Math.max(1, Math.min(2, Number(window.devicePixelRatio || 1)));
        const viewport = pdfPage.getViewport({ scale: fitScale * pixelRatio });
        const canvas = globalThis.document.createElement('canvas');
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('تعذر إنشاء مساحة عرض صفحة PDF.');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        renderTask = pdfPage.render({ canvasContext: context, viewport });
        await renderTask.promise;
        if (cancelled) return;

        const blob = await canvasBlob(canvas);
        if (cancelled) return;
        const nextUrl = URL.createObjectURL(blob);
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = nextUrl;
        setRenderedUrl(nextUrl);
        setLoading(false);
        setError('');
        onStateChange?.({ dataUrl: nextUrl, pageCount: Number(pdfDocument.numPages || 0), loading: false, error: '' });
      } catch (reason) {
        if (cancelled || reason?.name === 'RenderingCancelledException') return;
        const message = reason?.message || 'تعذر عرض صفحة PDF.';
        setRenderedUrl('');
        setLoading(false);
        setError(message);
        onStateChange?.({ dataUrl: '', pageCount: 0, loading: false, error: message });
      }
    };

    void publish();
    return () => {
      cancelled = true;
      try { renderTask?.cancel?.(); } catch { /* render completed */ }
    };
  }, [source?.blob, source?.url, page, resourceId, resizeVersion, onStateChange]);

  return (
    <div ref={hostRef} className="classmode-pdf-canvas-host" role="img" aria-label={`${title || 'ملف PDF'} — صفحة ${page || 1}`}>
      {renderedUrl && <img className="classmode-pdf-rendered-image" src={renderedUrl} alt={`${title || 'ملف PDF'} — صفحة ${page || 1}`} />}
      {loading && <div className="classmode-pdf-render-status">جارٍ تجهيز صفحة {page || 1}…</div>}
      {error && <div className="classmode-pdf-render-error"><strong>تعذر رسم صفحة PDF داخل مساحة الشرح</strong><small>{error}</small></div>}
    </div>
  );
}
