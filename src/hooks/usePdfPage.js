import { useEffect, useState } from 'react';
import { renderNativePdfBlob, renderNativePdfPage } from '../services/pdfRenderer';
import { renderWebPdfBlob, renderWebPdfPage } from '../services/webPdfRenderer';

const initialState = { dataUrl: '', pageCount: 0, loading: false, error: '' };

export function usePdfPage(source, page = 1) {
  const [state, setState] = useState(initialState);
  const url = typeof source === 'string' ? source : source?.url || '';
  const blob = typeof source === 'object' ? source?.blob || null : null;
  const cacheKey = typeof source === 'object' ? source?.cacheKey || '' : url;

  useEffect(() => {
    let cancelled = false;

    if (!blob && !url) {
      setState(initialState);
      return () => { cancelled = true; };
    }

    setState((current) => ({ ...current, loading: true, error: '' }));

    const isNative = Boolean(globalThis.Capacitor?.isNativePlatform?.());
    const task = isNative
      ? (blob
        ? renderNativePdfBlob(blob, page, 1800, cacheKey)
        : renderNativePdfPage(url, page, 1800))
      : (blob
        ? renderWebPdfBlob(blob, page, 1800, cacheKey)
        : renderWebPdfPage(url, page, 1800, cacheKey || url));

    task
      .then((result) => {
        if (cancelled) return;
        setState({
          dataUrl: result?.dataUrl || '',
          pageCount: Number(result?.pageCount || 0),
          loading: false,
          error: '',
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          dataUrl: '',
          pageCount: 0,
          loading: false,
          error: error?.message || 'تعذر عرض صفحة PDF.',
        });
      });

    return () => { cancelled = true; };
  }, [blob, cacheKey, page, url]);

  return state;
}
