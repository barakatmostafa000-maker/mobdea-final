const STORAGE_PREFIX = 'mobdea_share_payload_v1:';
const INLINE_LIMIT = 1800;

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function safeBtoa(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

function safeAtob(text) {
  return decodeURIComponent(escape(atob(text)));
}

function storageKey(kind, token) {
  return `${STORAGE_PREFIX}${kind}:${token}`;
}

function createToken() {
  return globalThis.crypto?.randomUUID?.() || `share-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function encodeSharePayload(payload) {
  return safeBtoa(JSON.stringify(payload));
}

export function decodeSharePayload(encoded) {
  if (!encoded) return null;
  const decoded = safeAtob(String(encoded));
  return tryParseJson(decoded);
}

export function storeSharePayload(kind, payload, token = createToken()) {
  try {
    globalThis.localStorage?.setItem(storageKey(kind, token), JSON.stringify(payload));
  } catch {
    // ignore storage limits / privacy restrictions
  }
  return token;
}

export function readSharePayload(kind, token) {
  if (!token) return null;
  try {
    const raw = globalThis.localStorage?.getItem(storageKey(kind, token));
    return raw ? tryParseJson(raw) : null;
  } catch {
    return null;
  }
}

export function buildShareLink(kind, payload, { path = globalThis.location?.pathname || '/', inlineLimit = INLINE_LIMIT } = {}) {
  const encoded = encodeSharePayload(payload);
  const base = new URL(globalThis.location?.href || 'http://localhost/');
  base.pathname = path;
  base.search = '';
  base.hash = '';
  base.searchParams.set('shareKind', kind);

  if (encoded.length <= inlineLimit) {
    base.searchParams.set('shareData', encoded);
    return { url: base.toString(), mode: 'inline', token: null };
  }

  const token = storeSharePayload(kind, payload);
  base.searchParams.set('shareToken', token);
  return { url: base.toString(), mode: 'token', token };
}

export function readShareFromLocation(locationLike = globalThis.location) {
  if (!locationLike) return { kind: '', payload: null, token: null, mode: 'none' };
  const params = new URLSearchParams(locationLike.search || '');
  const kind = params.get('shareKind') || '';
  const encoded = params.get('shareData');
  const token = params.get('shareToken');
  if (!kind) return { kind: '', payload: null, token: null, mode: 'none' };

  if (encoded) {
    return { kind, payload: decodeSharePayload(encoded), token: null, mode: 'inline' };
  }

  if (token) {
    return { kind, payload: readSharePayload(kind, token), token, mode: 'token' };
  }

  return { kind, payload: null, token: null, mode: 'none' };
}

export async function copyToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', 'true');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    return true;
  } catch {
    return false;
  }
}
