const MAX_SYNC_BYTES = 8_000_000;
const MAX_SHARE_BYTES = 6_000_000;
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const MAX_ASSET_COUNT = 500;
const MAX_READS_PER_MINUTE = 90;
const MAX_WRITES_PER_MINUTE = 25;
const MAX_ASSET_READS_PER_MINUTE = 600;
const MAX_ASSET_WRITES_PER_MINUTE = 550;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function allowedOrigins(env) {
  return String(env.MOBDEA_ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = allowedOrigins(env);
  const headers = {
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Mobdea-Workspace,X-Mobdea-Client,If-Match,X-Mobdea-Asset-Name,X-Mobdea-Asset-Kind,X-Mobdea-Asset-Sha256,X-Mobdea-Asset-Size',
    'Access-Control-Expose-Headers': 'ETag,X-Mobdea-Asset-Sha256,X-Mobdea-Asset-Size,X-Mobdea-Asset-Name,X-Mobdea-Asset-Kind',
    'Access-Control-Allow-Methods': 'GET,HEAD,PUT,POST,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
  if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function securityHeaders() {
  return {
    'Content-Type': 'application/json;charset=UTF-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  };
}

function json(request, env, body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...securityHeaders(), ...corsHeaders(request, env), ...extraHeaders },
  });
}

function validWorkspace(value) {
  const workspace = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{3,80}$/.test(workspace) ? workspace : '';
}

function workspaceTokens(env) {
  try {
    const parsed = JSON.parse(env.MOBDEA_WORKSPACE_TOKENS || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function tokenDigest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(String(value || ''))));
}

async function tokenEquals(left, right) {
  const a = await tokenDigest(left);
  const b = await tokenDigest(right);
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
}

async function authenticate(request, env) {
  const workspace = validWorkspace(request.headers.get('X-Mobdea-Workspace'));
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const expected = workspaceTokens(env)[workspace];
  if (!workspace || !token || typeof expected !== 'string' || expected.length < 24 || !(await tokenEquals(token, expected))) return null;
  return { workspace };
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + 0x8000)));
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(String(value || ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function encryptionKey(env) {
  const secret = String(env.MOBDEA_ENCRYPTION_KEY || '');
  if (secret.length < 32) throw new Error('MOBDEA_ENCRYPTION_KEY must contain at least 32 characters.');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptJson(value, env, aad) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(env);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(aad), tagLength: 128 }, key, encoder.encode(JSON.stringify(value)));
  return JSON.stringify({ version: 1, iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) });
}

async function decryptJson(value, env, aad) {
  if (!value) return null;
  const envelope = JSON.parse(value);
  if (envelope.version !== 1 || !envelope.iv || !envelope.ciphertext) throw new Error('Invalid encrypted envelope.');
  const key = await encryptionKey(env);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(envelope.iv), additionalData: encoder.encode(aad), tagLength: 128 }, key, base64ToBytes(envelope.ciphertext));
  return JSON.parse(decoder.decode(plaintext));
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function encryptBinary(bytes, env, aad) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(env);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(aad), tagLength: 128 }, key, bytes);
  return { iv: bytesToBase64(iv), ciphertext };
}

async function decryptBinary(bytes, iv, env, aad) {
  const key = await encryptionKey(env);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(iv), additionalData: encoder.encode(aad), tagLength: 128 }, key, bytes);
}

async function parseJsonBody(request, maxBytes) {
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared && declared > maxBytes) throw Object.assign(new Error('payload_too_large'), { status: 413 });
  const text = await request.text();
  if (encoder.encode(text).byteLength > maxBytes) throw Object.assign(new Error('payload_too_large'), { status: 413 });
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('invalid_json'), { status: 400 }); }
}

function validateSyncPayload(payload, workspace) {
  if (!payload || typeof payload !== 'object' || payload.workspaceId !== workspace || !payload.data || typeof payload.data !== 'object') return false;
  if (!Number.isInteger(Number(payload.schemaVersion)) || Number(payload.schemaVersion) < 1 || Number(payload.schemaVersion) > 100) return false;
  if (!Array.isArray(payload.data.students) || !Array.isArray(payload.data.sessions)) return false;
  if (!payload.data.settings || typeof payload.data.settings !== 'object') return false;
  if (payload.assetManifest !== undefined) {
    if (!Array.isArray(payload.assetManifest) || payload.assetManifest.length > MAX_ASSET_COUNT) return false;
    for (const asset of payload.assetManifest) {
      if (!asset || !/^[a-zA-Z0-9._-]{1,100}$/.test(String(asset.id || ''))) return false;
      if (!/^[a-f0-9]{64}$/.test(String(asset.sha256 || ''))) return false;
      if (!Number.isInteger(Number(asset.size)) || Number(asset.size) <= 0 || Number(asset.size) > MAX_ASSET_BYTES) return false;
    }
  }
  return true;
}

function validateSharePayload(payload) {
  return payload && typeof payload === 'object'
    && /^[a-zA-Z0-9_-]{1,30}$/.test(String(payload.kind || ''))
    && payload.payload && typeof payload.payload === 'object';
}

async function rateLimit(request, env, workspace, write = false, overrideLimit = 0, category = '') {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const minute = Math.floor(Date.now() / 60000);
  const scope = workspace || 'public';
  const key = `rate:${scope}:${ip}:${minute}:${category || (write ? 'w' : 'r')}`;
  const limit = overrideLimit || (write ? MAX_WRITES_PER_MINUTE : MAX_READS_PER_MINUTE);
  const count = Number(await env.MOBDEA_DATA.get(key) || 0) + 1;
  await env.MOBDEA_DATA.put(key, String(count), { expirationTtl: 120 });
  return count <= limit;
}

function randomToken() {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(24))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function safeAssetMetadata(value, maxLength = 180) {
  try { return decodeURIComponent(String(value || '')).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength); } catch { return ''; }
}

function assetResponseHeaders(request, env, metadata = {}) {
  return {
    ...corsHeaders(request, env),
    ...securityHeaders(),
    'Content-Type': metadata.type || 'application/octet-stream',
    'X-Mobdea-Asset-Sha256': metadata.sha256 || '',
    'X-Mobdea-Asset-Size': String(metadata.size || 0),
    'X-Mobdea-Asset-Name': encodeURIComponent(metadata.name || 'file'),
    'X-Mobdea-Asset-Kind': encodeURIComponent(metadata.kind || 'resource'),
  };
}

async function handleAssetStatus(request, env, auth) {
  if (!env.MOBDEA_ASSETS) return json(request, env, { error: 'asset_storage_not_configured', message: 'مخزن الملفات السحابي غير مفعّل.' }, 503);
  if (!(await rateLimit(request, env, auth.workspace, false))) return json(request, env, { error: 'rate_limited' }, 429, { 'Retry-After': '60' });
  const body = await parseJsonBody(request, 80_000);
  const ids = Array.isArray(body?.ids) ? [...new Set(body.ids.map((id) => String(id || '')))] : [];
  if (!ids.length || ids.length > MAX_ASSET_COUNT || ids.some((id) => !/^[a-zA-Z0-9._-]{1,100}$/.test(id))) {
    return json(request, env, { error: 'invalid_asset_list' }, 400);
  }
  const assets = {};
  for (let offset = 0; offset < ids.length; offset += 25) {
    const chunk = ids.slice(offset, offset + 25);
    const records = await Promise.all(chunk.map(async (id) => ({
      id,
      object: await env.MOBDEA_ASSETS.head(`workspace/${auth.workspace}/${id}`),
    })));
    for (const { id, object } of records) {
      const hash = String(object?.customMetadata?.sha256 || '').toLowerCase();
      if (/^[a-f0-9]{64}$/.test(hash)) assets[id] = hash;
    }
  }
  return json(request, env, { assets });
}

async function pruneWorkspaceAssets(env, workspace, manifest = [], previousManifest = []) {
  if (!env.MOBDEA_ASSETS) return;
  const retained = new Set(manifest.map((asset) => String(asset.id || '')).filter(Boolean));
  const prefix = `workspace/${workspace}/`;
  const obsolete = new Set(previousManifest
    .map((asset) => String(asset.id || ''))
    .filter((id) => id && !retained.has(id))
    .map((id) => `${prefix}${id}`));

  if (typeof env.MOBDEA_ASSETS.list === 'function') {
    let cursor;
    do {
      const page = await env.MOBDEA_ASSETS.list({ prefix, cursor, limit: 1000 });
      for (const object of page?.objects || []) if (!retained.has(String(object.key || '').slice(prefix.length))) obsolete.add(object.key);
      cursor = page?.truncated ? page.cursor : undefined;
    } while (cursor);
  }
  await Promise.allSettled([...obsolete].map((key) => env.MOBDEA_ASSETS.delete(key)));
}

async function handleAsset(request, env, auth, assetId) {
  if (!env.MOBDEA_ASSETS) return json(request, env, { error: 'asset_storage_not_configured', message: 'مخزن الملفات السحابي غير مفعّل.' }, 503);
  if (!/^[a-zA-Z0-9._-]{1,100}$/.test(assetId)) return json(request, env, { error: 'not_found' }, 404);
  const write = request.method === 'PUT' || request.method === 'DELETE';
  if (!(await rateLimit(
    request,
    env,
    auth.workspace,
    write,
    write ? MAX_ASSET_WRITES_PER_MINUTE : MAX_ASSET_READS_PER_MINUTE,
    write ? 'asset-w' : 'asset-r',
  ))) return json(request, env, { error: 'rate_limited' }, 429, { 'Retry-After': '60' });
  const key = `workspace/${auth.workspace}/${assetId}`;
  const aad = `asset:${auth.workspace}:${assetId}`;

  if (request.method === 'HEAD') {
    const object = await env.MOBDEA_ASSETS.head(key);
    if (!object) return new Response(null, { status: 404, headers: assetResponseHeaders(request, env) });
    return new Response(null, { status: 200, headers: assetResponseHeaders(request, env, object.customMetadata || {}) });
  }

  if (request.method === 'GET') {
    const object = await env.MOBDEA_ASSETS.get(key);
    if (!object) return json(request, env, { error: 'not_found' }, 404);
    const metadata = object.customMetadata || {};
    const encrypted = await object.arrayBuffer();
    const plaintext = await decryptBinary(encrypted, metadata.iv, env, aad);
    if (Number(metadata.size || 0) !== plaintext.byteLength || await sha256Hex(plaintext) !== metadata.sha256) throw new Error('Stored asset integrity check failed.');
    const headers = assetResponseHeaders(request, env, metadata);
    headers['Content-Length'] = String(plaintext.byteLength);
    headers['Content-Disposition'] = `inline; filename*=UTF-8''${encodeURIComponent(metadata.name || 'file')}`;
    return new Response(plaintext, { status: 200, headers });
  }

  if (request.method === 'PUT') {
    const declared = Number(request.headers.get('Content-Length') || request.headers.get('X-Mobdea-Asset-Size') || 0);
    if (declared <= 0 || declared > MAX_ASSET_BYTES) return json(request, env, { error: 'payload_too_large' }, 413);
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength <= 0 || bytes.byteLength > MAX_ASSET_BYTES || bytes.byteLength !== declared) return json(request, env, { error: 'invalid_asset_size' }, 400);
    const expectedHash = String(request.headers.get('X-Mobdea-Asset-Sha256') || '').toLowerCase();
    const actualHash = await sha256Hex(bytes);
    if (!/^[a-f0-9]{64}$/.test(expectedHash) || expectedHash !== actualHash) return json(request, env, { error: 'asset_hash_mismatch' }, 400);
    const name = safeAssetMetadata(request.headers.get('X-Mobdea-Asset-Name')) || 'file';
    const kind = safeAssetMetadata(request.headers.get('X-Mobdea-Asset-Kind'), 40) || 'resource';
    const type = String(request.headers.get('Content-Type') || 'application/octet-stream').split(';')[0].trim().slice(0, 120);
    const encrypted = await encryptBinary(bytes, env, aad);
    const metadata = { iv: encrypted.iv, sha256: actualHash, size: String(bytes.byteLength), name, kind, type, updatedAt: new Date().toISOString() };
    await env.MOBDEA_ASSETS.put(key, encrypted.ciphertext, { customMetadata: metadata, httpMetadata: { contentType: 'application/octet-stream' } });
    return json(request, env, { ok: true, id: assetId, sha256: actualHash, size: bytes.byteLength }, 200);
  }

  if (request.method === 'DELETE') {
    await env.MOBDEA_ASSETS.delete(key);
    return json(request, env, { ok: true });
  }

  return json(request, env, { error: 'method_not_allowed' }, 405);
}

async function handleSync(request, env, auth) {
  if (!(await rateLimit(request, env, auth.workspace, request.method === 'PUT'))) return json(request, env, { error: 'rate_limited' }, 429, { 'Retry-After': '60' });
  const key = `workspace:${auth.workspace}`;
  const aad = `sync:${auth.workspace}`;
  if (request.method === 'GET') {
    const encrypted = await env.MOBDEA_DATA.get(key);
    if (!encrypted) return json(request, env, { error: 'not_found' }, 404);
    const value = await decryptJson(encrypted, env, aad);
    return json(request, env, value, 200, { ETag: value.revision });
  }
  if (request.method === 'PUT') {
    const payload = await parseJsonBody(request, MAX_SYNC_BYTES);
    if (!validateSyncPayload(payload, auth.workspace)) return json(request, env, { error: 'invalid_payload' }, 400);
    const existingEncrypted = await env.MOBDEA_DATA.get(key);
    const existing = existingEncrypted ? await decryptJson(existingEncrypted, env, aad) : null;
    const suppliedRevision = String(request.headers.get('If-Match') || payload.baseRevision || '').trim();
    if (existing?.revision && suppliedRevision !== existing.revision) {
      return json(request, env, { error: 'revision_conflict', currentRevision: existing.revision, updatedAt: existing.updatedAt }, 409);
    }
    const revision = crypto.randomUUID();
    const stored = { ...payload, revision, updatedAt: new Date().toISOString() };
    await env.MOBDEA_DATA.put(key, await encryptJson(stored, env, aad));
    try {
      await pruneWorkspaceAssets(env, auth.workspace, stored.assetManifest || [], existing?.assetManifest || []);
    } catch {
      // Synchronization data is already committed; orphan cleanup can retry on the next successful push.
    }
    return json(request, env, { ok: true, workspace: auth.workspace, revision, updatedAt: stored.updatedAt }, 200, { ETag: revision });
  }
  return json(request, env, { error: 'method_not_allowed' }, 405);
}

async function handleCreateShare(request, env, auth) {
  if (!(await rateLimit(request, env, auth.workspace, true))) return json(request, env, { error: 'rate_limited' }, 429, { 'Retry-After': '60' });
  const body = await parseJsonBody(request, MAX_SHARE_BYTES);
  if (!validateSharePayload(body)) return json(request, env, { error: 'invalid_payload', message: 'محتوى المشاركة غير صالح.' }, 400);
  const ttl = Math.max(3600, Math.min(7 * 24 * 60 * 60, Number(body.expiresInSeconds || 7 * 24 * 60 * 60)));
  const token = randomToken();
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  const record = { kind: body.kind, payload: body.payload, workspace: auth.workspace, createdAt: new Date().toISOString(), expiresAt };
  const key = `share:${auth.workspace}:${token}`;
  await env.MOBDEA_DATA.put(key, await encryptJson(record, env, `share:${auth.workspace}:${token}`), { expirationTtl: ttl });
  return json(request, env, { ok: true, token, expiresAt }, 201);
}

async function handleReadShare(request, env, token, workspace) {
  if (!(await rateLimit(request, env, 'public', false))) return json(request, env, { error: 'rate_limited' }, 429, { 'Retry-After': '60' });
  if (!/^[a-zA-Z0-9_-]{20,80}$/.test(token) || !workspace) return json(request, env, { error: 'not_found' }, 404);
  const key = `share:${workspace}:${token}`;
  const encrypted = await env.MOBDEA_DATA.get(key);
  if (!encrypted) return json(request, env, { error: 'not_found' }, 404);
  const record = await decryptJson(encrypted, env, `share:${workspace}:${token}`);
  if (!record || Date.parse(record.expiresAt) <= Date.now()) return json(request, env, { error: 'not_found' }, 404);
  return json(request, env, { kind: record.kind, payload: record.payload, expiresAt: record.expiresAt });
}

export default {
  async fetch(request, env) {
    try {
      const origin = request.headers.get('Origin');
      if (request.method === 'OPTIONS') {
        if (origin && !allowedOrigins(env).includes(origin)) return json(request, env, { error: 'origin_not_allowed' }, 403);
        return new Response(null, { status: 204, headers: corsHeaders(request, env) });
      }
      const url = new URL(request.url);
      const shareMatch = /^\/share\/([a-zA-Z0-9_-]+)$/.exec(url.pathname);
      if (request.method === 'GET' && shareMatch) return handleReadShare(request, env, shareMatch[1], validWorkspace(url.searchParams.get('workspace')));

      const auth = await authenticate(request, env);
      if (!auth) {
        const allowed = await rateLimit(request, env, 'auth', true);
        return allowed
          ? json(request, env, { error: 'unauthorized' }, 401)
          : json(request, env, { error: 'rate_limited' }, 429, { 'Retry-After': '60' });
      }
      if (url.pathname === '/assets/status' && request.method === 'POST') return handleAssetStatus(request, env, auth);
      const assetMatch = /^\/assets\/([a-zA-Z0-9._-]+)$/.exec(url.pathname);
      if (assetMatch && ['GET', 'HEAD', 'PUT', 'DELETE'].includes(request.method)) return handleAsset(request, env, auth, assetMatch[1]);
      if (url.pathname === '/health' && request.method === 'GET') {
        if (!(await rateLimit(request, env, auth.workspace, false))) return json(request, env, { error: 'rate_limited' }, 429);
        return json(request, env, { ok: true, service: 'mobdea-sync', workspace: auth.workspace, time: new Date().toISOString(), version: 2 });
      }
      if (url.pathname === '/sync') return handleSync(request, env, auth);
      if (url.pathname === '/share' && request.method === 'POST') return handleCreateShare(request, env, auth);
      return json(request, env, { error: 'not_found' }, 404);
    } catch (error) {
      const status = Number(error?.status || 500);
      const message = status >= 500 ? 'internal_error' : error?.message || 'bad_request';
      return json(request, env, { error: message }, status);
    }
  },
};
