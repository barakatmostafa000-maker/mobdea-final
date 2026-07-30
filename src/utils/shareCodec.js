const SENSITIVE_KEY = /(pin|password|secret|token|hash|salt|phone|mobile|recovery|authorization|code)/i;

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + 0x8000)));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(text) {
  const normalized = String(text || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function sanitizeShareValue(value, key = '') {
  if (SENSITIVE_KEY.test(key) || key === 'attendance') return undefined;
  if (Array.isArray(value)) {
    return value.slice(0, 300).map((item) => sanitizeShareValue(item)).filter((item) => item !== undefined);
  }
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    const sanitized = sanitizeShareValue(entryValue, entryKey);
    if (sanitized !== undefined) output[entryKey] = sanitized;
  }
  if (['players', 'challengePlayers', 'teamGold', 'teamBlack'].includes(key)) {
    return { id: output.id, name: output.name || output.label || 'طالب', label: output.label };
  }
  return output;
}

export function sanitizePayloadForSharing(payload) {
  return sanitizeShareValue(payload) || {};
}

export function encodeSharePayload(payload) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

export function decodeSharePayload(encoded) {
  if (!encoded) return null;
  try {
    const decoded = new TextDecoder().decode(base64UrlToBytes(encoded));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
