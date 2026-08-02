import { assetToDataUrl } from './assetStore';
import { buildCloudUrl, cloudHeaders, timeoutFetch, validateCloudConfig } from './cloudSync';
import { normalizeHttpUrl, safeTrim, byteLength } from '../utils/safety';
import { decodeSharePayload, encodeSharePayload, sanitizePayloadForSharing } from '../utils/shareCodec';
import { buildPublicAppUrl } from './publicAppUrl';
const STORAGE_PREFIX = 'mobdea_share_payload_v1:';
const INLINE_LIMIT = 6000;
const MAX_INLINE_BYTES = 12_000;
const MAX_REMOTE_SHARE_BYTES = 6_000_000;

function storageKey(kind, token) {
  return `${STORAGE_PREFIX}${kind}:${token}`;
}

function tryParseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
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

function baseShareUrl(path = globalThis.location?.pathname || '/') {
  return buildPublicAppUrl(path);
}

async function hydrateResourceAsset(resource) {
  if (!resource || typeof resource !== 'object' || !resource.assetId) return resource;
  const url = await assetToDataUrl(resource.assetId);
  return { ...resource, url, assetId: '' };
}

async function hydratePayloadAssets(payload) {
  const clone = globalThis.structuredClone ? globalThis.structuredClone(payload) : JSON.parse(JSON.stringify(payload));
  if (clone.resource) clone.resource = await hydrateResourceAsset(clone.resource);
  if (clone.selectedResource) clone.selectedResource = await hydrateResourceAsset(clone.selectedResource);
  return clone;
}

async function createRemoteShare(kind, payload, cloudSync) {
  const config = validateCloudConfig(cloudSync || {});
  const body = JSON.stringify({ kind: safeTrim(kind, 30), payload, expiresInSeconds: 7 * 24 * 60 * 60 });
  if (byteLength(body) > MAX_REMOTE_SHARE_BYTES) throw new Error('حجم رابط المشاركة أكبر من 6 ميجابايت. قلّل حجم المورد أو السبورة ثم أعد المحاولة.');
  const response = await timeoutFetch(buildCloudUrl(config.endpoint, '/share'), {
    method: 'POST',
    headers: cloudHeaders(config),
    body,
  }, 30000);
  if (!response.ok) {
    let message = `فشل إنشاء رابط المشاركة (${response.status})`;
    try { message = (await response.json())?.message || message; } catch { /* no-op */ }
    throw new Error(message);
  }
  const result = await response.json();
  if (!result?.token) throw new Error('الخادم لم يُرجع رمز مشاركة صالحًا.');
  return { ...result, endpoint: config.endpoint, workspaceId: config.workspaceId };
}

export async function buildShareLink(kind, payload, { path = globalThis.location?.pathname || '/', inlineLimit = INLINE_LIMIT, cloudSync = null } = {}) {
  const sanitized = sanitizePayloadForSharing(payload);
  const hydrated = await hydratePayloadAssets(sanitized);
  const encoded = encodeSharePayload(hydrated);
  const base = baseShareUrl(path);
  base.searchParams.set('shareKind', safeTrim(kind, 30));

  if (encoded.length <= inlineLimit && byteLength(encoded) <= MAX_INLINE_BYTES) {
    base.searchParams.set('shareData', encoded);
    return { url: base.toString(), mode: 'inline', token: null };
  }

  if (!cloudSync) throw new Error('هذا المحتوى كبير للرابط المباشر. فعّل المزامنة السحابية أولًا لإنشاء رابط يعمل على الأجهزة الأخرى.');
  const remote = await createRemoteShare(kind, hydrated, cloudSync);
  base.searchParams.set('shareToken', remote.token);
  base.searchParams.set('shareServer', remote.endpoint);
  base.searchParams.set('shareWorkspace', remote.workspaceId);
  return { url: base.toString(), mode: 'remote', token: remote.token, expiresAt: remote.expiresAt };
}

export function readShareFromLocation(locationLike = globalThis.location) {
  if (!locationLike) return { kind: '', payload: null, token: null, mode: 'none' };
  const params = new URLSearchParams(locationLike.search || '');
  const kind = safeTrim(params.get('shareKind') || '', 30);
  const encoded = params.get('shareData');
  const token = safeTrim(params.get('shareToken') || '', 180);
  const server = normalizeHttpUrl(params.get('shareServer'));
  const workspace = safeTrim(params.get('shareWorkspace') || '', 80).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!kind) return { kind: '', payload: null, token: null, mode: 'none' };
  if (encoded) return { kind, payload: decodeSharePayload(encoded), token: null, mode: 'inline' };
  if (token && server && workspace) return { kind, payload: null, token, server, workspace, mode: 'remote', loading: true };
  if (token) return { kind, payload: readSharePayload(kind, token), token, mode: 'legacy-local' };
  return { kind, payload: null, token: null, mode: 'none' };
}

export async function resolveShareFromLocation(locationLike = globalThis.location) {
  const initial = readShareFromLocation(locationLike);
  if (initial.mode !== 'remote') return initial;
  try {
    const url = new URL(buildCloudUrl(initial.server, `/share/${encodeURIComponent(initial.token)}`));
    url.searchParams.set('workspace', initial.workspace);
    const response = await timeoutFetch(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } }, 20000);
    if (!response.ok) throw new Error(response.status === 404 ? 'انتهت صلاحية رابط المشاركة أو تم حذفه.' : `تعذر فتح رابط المشاركة (${response.status}).`);
    const body = await response.json();
    if (!body?.payload || body.kind !== initial.kind) throw new Error('محتوى رابط المشاركة غير صالح.');
    return { ...initial, payload: body.payload, loading: false, expiresAt: body.expiresAt };
  } catch (error) {
    return { ...initial, payload: null, loading: false, error: error?.message || 'تعذر فتح رابط المشاركة.' };
  }
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
    const copied = document.execCommand('copy');
    input.remove();
    return copied;
  } catch {
    return false;
  }
}
