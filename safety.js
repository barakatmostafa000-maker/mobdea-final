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
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function clampNumber(value, min, max, fallback = min) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

export function isHttpUrl(value) {
  try {
    const url = new URL(String(value ?? '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeHttpUrl(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (!isHttpUrl(text)) return '';
  return new URL(text).toString().replace(/\/$/, '');
}

export function limitArray(items, maxLength = 500) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, maxLength);
}
