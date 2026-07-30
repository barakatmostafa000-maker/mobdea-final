import { useEffect, useState } from 'react';
import { acquireAssetUrl, releaseAssetUrl } from '../services/assetStore';
import { normalizeSecureUrl } from '../utils/safety';

export function useAssetUrl(assetId, fallbackUrl = '') {
  const [url, setUrl] = useState(() => normalizeSecureUrl(fallbackUrl, { allowRelative: true, allowData: true }));

  useEffect(() => {
    let cancelled = false;
    const fallback = normalizeSecureUrl(fallbackUrl, { allowRelative: true, allowData: true });
    if (!assetId) {
      setUrl(fallback);
      return undefined;
    }
    let acquired = false;
    acquireAssetUrl(assetId)
      .then((next) => {
        if (cancelled) {
          if (next) releaseAssetUrl(assetId);
          return;
        }
        acquired = Boolean(next);
        setUrl(next || fallback);
      })
      .catch(() => { if (!cancelled) setUrl(fallback); });
    return () => {
      cancelled = true;
      if (acquired) releaseAssetUrl(assetId);
    };
  }, [assetId, fallbackUrl]);

  return url;
}
