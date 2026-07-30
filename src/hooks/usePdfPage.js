import { useEffect, useState } from 'react';
import { renderNativePdfPage } from '../services/pdfRenderer';

export function usePdfPage(url, page = 1) {
  const [state, setState] = useState({ dataUrl: '', pageCount: 0, loading: false, error: '' });

  useEffect(() => {
    let cancelled = false;
    if (!url || !globalThis.Capacitor?.isNativePlatform?.()) {
      setState({ dataUrl: '', pageCount: 0, loading: false, error: '' });
      return () => { cancelled = true; };
    }
    setState((current) => ({ ...current, loading: true, error: '' }));
    renderNativePdfPage(url, page)
      .then((result) => {
        if (!cancelled) setState({ dataUrl: result?.dataUrl || '', pageCount: Number(result?.pageCount || 0), loading: false, error: '' });
      })
      .catch((error) => {
        if (!cancelled) setState({ dataUrl: '', pageCount: 0, loading: false, error: error?.message || 'تعذر عرض صفحة PDF.' });
      });
    return () => { cancelled = true; };
  }, [url, page]);

  return state;
}
