export function safeParseJson(text, fallback = null) {
  try {
    if (typeof text !== 'string' || !text.trim()) return fallback;
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function safeTrim(value, maxLength = 500) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function clampNumber(value, min, max, fallback = min) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

export function isLocalDevelopmentHost(hostname = '') {
  const host = String(hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

export function isHttpsUrl(value, { allowLocalHttp = true } = {}) {
  try {
    const url = new URL(String(value ?? '').trim(), globalThis.location?.href || 'https://localhost/');
    if (url.protocol === 'https:') return true;
    return allowLocalHttp && url.protocol === 'http:' && isLocalDevelopmentHost(url.hostname);
  } catch {
    return false;
  }
}

export function isHttpUrl(value) {
  return isHttpsUrl(value, { allowLocalHttp: true });
}

export function normalizeHttpUrl(value, options = {}) {
  const text = String(value ?? '').trim();
  if (!text || !isHttpsUrl(text, options)) return '';
  const url = new URL(text, globalThis.location?.href || 'https://localhost/');
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function normalizeSecureUrl(value, { allowRelative = false, allowData = false, allowedDataTypes = /^(image|audio|video)\//i } = {}) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (allowData && text.startsWith('data:')) {
    const mime = text.slice(5, text.indexOf(';') > -1 ? text.indexOf(';') : text.indexOf(','));
    return allowedDataTypes.test(mime) ? text : '';
  }
  if (allowRelative && (/^(\.\/|\.\.\/|\/)/.test(text) || !/^[a-z][a-z0-9+.-]*:/i.test(text))) {
    try {
      const resolved = new URL(text, globalThis.location?.href || 'https://localhost/');
      return ['https:', 'http:'].includes(resolved.protocol) && (resolved.protocol === 'https:' || isLocalDevelopmentHost(resolved.hostname)) ? resolved.toString() : '';
    } catch {
      return '';
    }
  }
  return normalizeHttpUrl(text);
}

export function limitArray(items, maxLength = 500) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, maxLength);
}

export function byteLength(value) {
  return new TextEncoder().encode(String(value ?? '')).byteLength;
}
