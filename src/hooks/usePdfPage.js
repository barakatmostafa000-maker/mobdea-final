import { useEffect, useState } from 'react';
import { renderNativePdfBlob, renderNativePdfPage } from '../services/pdfRenderer';

const initialState = { dataUrl: '', pageCount: 0, loading: false, error: '' };

export function usePdfPage(source, page = 1) {
  const [state, setState] = useState(initialState);
  const url = typeof source === 'string' ? source : source?.url || '';
  const blob = typeof source === 'object' ? source?.blob || null : null;
  const cacheKey = typeof source === 'object' ? source?.cacheKey || '' : url;

  useEffect(() => {
    let cancelled = false;
    if (!globalThis.Capacitor?.isNativePlatform?.()) {
      setState(initialState);
      return () => { cancelled = true; };
    }
    if (!blob && !url) {
      setState(initialState);
      return () => { cancelled = true; };
    }

    setState((current) => ({ ...current, loading: true, error: '' }));
    const task = blob
      ? renderNativePdfBlob(blob, page, 1800, cacheKey)
      : renderNativePdfPage(url, page, 1800);
    task
      .then((result) => {
        if (!cancelled) {
          setState({
            dataUrl: result?.dataUrl || '',
            pageCount: Number(result?.pageCount || 0),
            loading: false,
            error: '',
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            dataUrl: '',
            pageCount: 0,
            loading: false,
            error: error?.message || 'تعذر عرض صفحة PDF.',
          });
        }
      });
    return () => { cancelled = true; };
  }, [blob, cacheKey, page, url]);

  return state;
}
