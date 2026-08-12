import { identity } from '../config/identity';

const DEFAULT_PUBLIC_APP_URL = 'https://mobdea-live-barakatmostafa000.pages.dev/';

function normalizedBase(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    url.search = '';
    url.hash = '';
    if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`;
    return url;
  } catch {
    return null;
  }
}

function currentLocationIsPublic(locationLike = globalThis.location) {
  if (!locationLike) return false;
  const protocol = String(locationLike.protocol || '').toLowerCase();
  const hostname = String(locationLike.hostname || '').toLowerCase();
  if (!['http:', 'https:'].includes(protocol)) return false;
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') return false;
  if (hostname.endsWith('.github.dev') || hostname.endsWith('.app.github.dev')) return false;
  return true;
}

export function resolvePublicAppBase(locationLike = globalThis.location, override = '') {
  const configured = normalizedBase(
    override
      || globalThis.__MOBDEA_PUBLIC_APP_URL__
      || globalThis.localStorage?.getItem?.('mobdea_public_app_url')
      || identity.publicAppUrl
      || DEFAULT_PUBLIC_APP_URL,
  );

  if (currentLocationIsPublic(locationLike)) {
    try {
      const current = new URL(locationLike.href);
      current.search = '';
      current.hash = '';
      // Keep the deployment directory. This matters on GitHub Pages where the
      // app can live under /repository-name/ rather than the domain root.
      return new URL('./', current);
    } catch {
      // Fall through to the configured public URL.
    }
  }

  return configured || new URL(DEFAULT_PUBLIC_APP_URL);
}

export function buildPublicAppUrl(path = '/', locationLike = globalThis.location, override = '') {
  const base = resolvePublicAppBase(locationLike, override);
  const cleanPath = String(path || '/').trim();
  const relativePath = cleanPath && cleanPath !== '/'
    ? cleanPath.replace(/^\/+/, '')
    : '';
  const target = relativePath ? new URL(relativePath, base) : new URL(base);
  target.search = '';
  target.hash = '';
  return target;
}
