const MAX_SYNC_BYTES = 8_000_000;
const MAX_SHARE_BYTES = 6_000_000;
const MAX_ASSET_BYTES = 200 * 1024 * 1024;
const MAX_ASSET_COUNT = 500;
const MAX_READS_PER_MINUTE = 90;
const MAX_WRITES_PER_MINUTE = 25;
const MAX_ASSET_READS_PER_MINUTE = 600;
const MAX_ASSET_WRITES_PER_MINUTE = 550;
const MAX_LIVE_EVENT_BYTES = 180_000;
const LIVE_ROOM_TTL_MIN = 60 * 60;
const LIVE_ROOM_TTL_MAX = 12 * 60 * 60;
const LIVE_EVENT_TYPES = new Set([
  'student-ready', 'participant-joined', 'participant-left', 'participant-removed',
  'class-state', 'screen-started', 'screen-stopped', 'room-closed',
  'mic-request', 'mic-approved', 'mic-revoked', 'mic-started', 'mic-stopped', 'hand-raised',
  'reaction', 'chat', 'teacher-message', 'heartbeat', 'game-state',
  'game-ready', 'game-start', 'game-question', 'game-answer', 'game-score', 'game-finished',
  'webrtc-offer', 'webrtc-answer', 'webrtc-ice',
]);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function allowedOrigins(env) {
  const builtIn = [
    'http://localhost',
    'https://localhost',
    'capacitor://localhost',
    'https://mobdea-live-barakatmostafa000.pages.dev',
    'https://barakatmostafa000-maker.github.io',
  ];
  const configured = String(env.MOBDEA_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set([...builtIn, ...configured])];
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = allowedOrigins(env);
  const headers = {
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Mobdea-Workspace,X-Mobdea-Client,X-Mobdea-Live-Token,X-Mobdea-Game-Token,X-Mobdea-Student-Token,If-Match,X-Mobdea-Asset-Name,X-Mobdea-Asset-Kind,X-Mobdea-Asset-Sha256,X-Mobdea-Asset-Size',
    'Access-Control-Expose-Headers': 'ETag,X-Mobdea-Asset-Sha256,X-Mobdea-Asset-Size,X-Mobdea-Asset-Name,X-Mobdea-Asset-Kind',
    'Access-Control-Allow-Methods': 'GET,HEAD,PUT,POST,PATCH,DELETE,OPTIONS',
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
  const studentCodes = new Set();
  for (const student of payload.data.students) {
    const code = Number(student?.code);
    // Legacy clients may omit the code; current clients normalize it before
    // upload. Whenever a positive code is present, enforce workspace-wide
    // uniqueness at the server boundary.
    if (!Number.isSafeInteger(code) || code <= 0) continue;
    if (studentCodes.has(code)) return false;
    studentCodes.add(code);
  }
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

const STUDENT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function normalizeArabicDigits(value = '') {
  const map = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
  return String(value || '').replace(/[٠-٩]/g, (digit) => map[digit]).replace(/\D/g, '');
}

function studentSessionKey(workspace, tokenHash) {
  return `student-session:${workspace}:${tokenHash}`;
}

async function verifyPbkdf2Secret(value, hashBase64, saltBase64, iterationsValue) {
  const iterations = Number(iterationsValue || 310000);
  if (!value || !hashBase64 || !saltBase64 || !Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) return false;
  try {
    const key = await crypto.subtle.importKey('raw', encoder.encode(String(value)), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: base64ToBytes(saltBase64), iterations }, key, 256);
    const candidate = new Uint8Array(bits);
    const expected = base64ToBytes(hashBase64);
    if (candidate.length !== expected.length) return false;
    let diff = 0;
    for (let index = 0; index < candidate.length; index += 1) diff |= candidate[index] ^ expected[index];
    return diff === 0;
  } catch {
    return false;
  }
}

async function readWorkspacePayload(env, workspace) {
  const encrypted = await env.MOBDEA_DATA.get(`workspace:${workspace}`);
  if (!encrypted) return null;
  return decryptJson(encrypted, env, `sync:${workspace}`);
}

function safeStudentRecord(student = {}) {
  return {
    id: student.id ?? null,
    code: student.code ?? '',
    name: safeLiveText(student.name || 'طالب', 100),
    grade: safeLiveText(student.grade || '', 80),
    group: safeLiveText(student.group || '', 80),
    points: Math.max(0, Number(student.points || 0)),
    permissions: student.permissions && typeof student.permissions === 'object' ? student.permissions : {},
    active: student.active !== false,
    updatedAt: safeLiveText(student.updatedAt || '', 40),
  };
}

function recordMatchesStudent(record = {}, student = {}) {
  const studentId = String(student.id ?? '');
  const studentCode = String(student.code ?? '').trim();
  const directIds = [record.studentId, record.selectedStudentId, record.playerOne, record.playerTwo, record.secondStudentId]
    .filter((value) => value !== undefined && value !== null)
    .map(String);
  const directCodes = [record.studentCode, record.selectedStudentCode]
    .filter((value) => value !== undefined && value !== null && String(value).trim())
    .map((value) => String(value).trim());
  const listIds = Array.isArray(record.studentIds) ? record.studentIds.map(String) : [];
  const listCodes = Array.isArray(record.studentCodes) ? record.studentCodes.map((value) => String(value).trim()) : [];
  const hasExplicitScope = directIds.length > 0 || directCodes.length > 0 || Array.isArray(record.studentIds) || Array.isArray(record.studentCodes);
  if (hasExplicitScope) {
    return directIds.includes(studentId)
      || listIds.includes(studentId)
      || Boolean(studentCode && (directCodes.includes(studentCode) || listCodes.includes(studentCode)));
  }
  const gradeMatches = !record.grade || !student.grade || String(record.grade).trim() === String(student.grade).trim();
  const groupMatches = !record.group || !student.group || String(record.group).trim() === String(student.group).trim();
  return gradeMatches && groupMatches;
}

function recordExplicitlyMatchesStudent(record = {}, student = {}) {
  const studentId = String(student.id ?? '');
  const studentCode = String(student.code ?? '').trim();
  const ids = [record.studentId, record.selectedStudentId, record.playerOne, record.playerTwo, record.secondStudentId]
    .filter((value) => value !== undefined && value !== null)
    .map(String);
  if (Array.isArray(record.studentIds)) ids.push(...record.studentIds.map(String));
  if (studentId && ids.includes(studentId)) return true;
  const codes = [record.studentCode, record.selectedStudentCode]
    .filter((value) => value !== undefined && value !== null && String(value).trim())
    .map((value) => String(value).trim());
  if (Array.isArray(record.studentCodes)) codes.push(...record.studentCodes.map((value) => String(value).trim()));
  return Boolean(studentCode && codes.includes(studentCode));
}

function collectStudentAssetIds(snapshot = {}) {
  const ids = new Set();
  const add = (value) => { if (value) ids.add(String(value)); };
  for (const item of snapshot.contentLibrary || []) {
    add(item.assetId); add(item.examAssetId); add(item.thumbnailAssetId); add(item.recordingAssetId);
  }
  for (const item of snapshot.lessonRecordings || []) {
    add(item.boardAssetId); add(item.videoAssetId);
  }
  return ids;
}

function buildStudentSnapshot(stored = {}, student = {}) {
  const data = stored.data || {};
  const sameGrade = (value) => !value || !student.grade || String(value).trim() === String(student.grade).trim();
  const own = (items = []) => (Array.isArray(items) ? items : []).filter((item) => recordExplicitlyMatchesStudent(item, student));
  const visibleRecordings = (Array.isArray(data.lessonRecordings) ? data.lessonRecordings : []).filter((item) => item.visibleToStudents !== false && recordMatchesStudent(item, student));
  const contentLibrary = (Array.isArray(data.contentLibrary) ? data.contentLibrary : []).filter((item) => sameGrade(item.grade));
  const sessions = (Array.isArray(data.sessions) ? data.sessions : []).filter((item) => recordMatchesStudent(item, student)).map((item) => ({
    id: item.id, title: safeLiveText(item.title || '', 140), grade: safeLiveText(item.grade || '', 80), group: safeLiveText(item.group || '', 80), date: safeLiveText(item.date || '', 40), startTime: safeLiveText(item.startTime || '', 20), lessonId: item.lessonId ?? null,
  }));
  const customQuestionBank = (Array.isArray(data.customQuestionBank) ? data.customQuestionBank : []).filter((item) => sameGrade(item.grade));
  return {
    students: [safeStudentRecord(student)],
    sessions,
    attendance: own(data.attendance),
    grades: own(data.grades),
    payments: own(data.payments),
    achievements: own(data.achievements),
    gameResults: own(data.gameResults),
    mapResults: own(data.mapResults),
    contentLibrary,
    lessonRecordings: visibleRecordings,
    customQuestionBank,
    settings: {
      visibleModules: data.settings?.visibleModules || {},
      cloudSync: { publicAppUrl: safeLiveText(data.settings?.cloudSync?.publicAppUrl || '', 260) },
    },
  };
}

async function authenticateStudentSession(request, env, workspace) {
  const token = String(request.headers.get('X-Mobdea-Student-Token') || '').trim();
  if (!workspace || token.length < 20) return null;
  const digest = await sha256Hex(encoder.encode(token));
  const key = studentSessionKey(workspace, digest);
  const encrypted = await env.MOBDEA_DATA.get(key);
  if (!encrypted) return null;
  const session = await decryptJson(encrypted, env, key);
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return null;
  return { ...session, token, key };
}

async function handleStudentLogin(request, env, workspace) {
  if (!workspace) return json(request, env, { error: 'workspace_required' }, 400);
  if (!(await rateLimit(request, env, workspace, true, 12, 'student-login'))) return json(request, env, { error: 'rate_limited' }, 429, { 'Retry-After': '60' });
  const body = await parseJsonBody(request, 20_000);
  const code = Number(normalizeArabicDigits(body.code));
  const pin = normalizeArabicDigits(body.pin).slice(0, 10);
  if (!Number.isSafeInteger(code) || code <= 0 || !/^\d{6,10}$/.test(pin)) return json(request, env, { error: 'invalid_credentials' }, 401);
  const stored = await readWorkspacePayload(env, workspace);
  if (!stored?.data) return json(request, env, { error: 'workspace_not_ready' }, 404);
  const student = (stored.data.students || []).find((item) => Number(item.code) === code);
  if (!student) return json(request, env, { error: 'student_not_found' }, 401);
  if (student.active === false || !student.studentPinHash || !student.studentPinSalt) return json(request, env, { error: 'student_not_active' }, 403);
  const verified = await verifyPbkdf2Secret(pin, student.studentPinHash, student.studentPinSalt, student.studentPinIterations);
  if (!verified) return json(request, env, { error: 'invalid_credentials' }, 401);
  const token = randomToken();
  const digest = await sha256Hex(encoder.encode(token));
  const key = studentSessionKey(workspace, digest);
  const expiresAt = new Date(Date.now() + STUDENT_SESSION_TTL_SECONDS * 1000).toISOString();
  const session = { workspace, studentId: student.id, studentCode: student.code, createdAt: new Date().toISOString(), expiresAt };
  await env.MOBDEA_DATA.put(key, await encryptJson(session, env, key), { expirationTtl: STUDENT_SESSION_TTL_SECONDS });
  return json(request, env, { ok: true, student: safeStudentRecord(student), studentToken: token, expiresAt, data: buildStudentSnapshot(stored, student) }, 200);
}

async function handleStudentSnapshot(request, env, workspace) {
  const session = await authenticateStudentSession(request, env, workspace);
  if (!session) return json(request, env, { error: 'unauthorized' }, 401);
  const stored = await readWorkspacePayload(env, workspace);
  if (!stored?.data) return json(request, env, { error: 'workspace_not_ready' }, 404);
  const student = (stored.data.students || []).find((item) => String(item.id) === String(session.studentId));
  if (!student) return json(request, env, { error: 'student_not_found' }, 404);
  return json(request, env, { ok: true, student: safeStudentRecord(student), data: buildStudentSnapshot(stored, student), expiresAt: session.expiresAt }, 200);
}

async function handleStudentAsset(request, env, workspace, assetId) {
  const session = await authenticateStudentSession(request, env, workspace);
  if (!session) return json(request, env, { error: 'unauthorized' }, 401);
  if (!env.MOBDEA_ASSETS || !/^[a-zA-Z0-9._-]{1,100}$/.test(assetId)) return json(request, env, { error: 'not_found' }, 404);
  const stored = await readWorkspacePayload(env, workspace);
  const student = (stored?.data?.students || []).find((item) => String(item.id) === String(session.studentId));
  if (!student) return json(request, env, { error: 'student_not_found' }, 404);
  const snapshot = buildStudentSnapshot(stored, student);
  if (!collectStudentAssetIds(snapshot).has(String(assetId))) return json(request, env, { error: 'forbidden' }, 403);
  if (!(await rateLimit(request, env, workspace, false, MAX_ASSET_READS_PER_MINUTE, 'student-asset-r'))) return json(request, env, { error: 'rate_limited' }, 429, { 'Retry-After': '60' });
  const key = `workspace/${workspace}/${assetId}`;
  const object = await env.MOBDEA_ASSETS.get(key);
  if (!object) return json(request, env, { error: 'not_found' }, 404);
  const metadata = object.customMetadata || {};
  const encrypted = await object.arrayBuffer();
  const plaintext = await decryptBinary(encrypted, metadata.iv, env, `asset:${workspace}:${assetId}`);
  if (Number(metadata.size || 0) !== plaintext.byteLength || await sha256Hex(plaintext) !== metadata.sha256) throw new Error('Stored asset integrity check failed.');
  const headers = assetResponseHeaders(request, env, metadata);
  headers['Content-Length'] = String(plaintext.byteLength);
  headers['Content-Disposition'] = `inline; filename*=UTF-8''${encodeURIComponent(metadata.name || 'file')}`;
  return new Response(plaintext, { status: 200, headers });
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


function liveRoomKey(workspace, roomId) {
  return `live-room:${workspace}:${roomId}`;
}

function liveParticipantPrefix(workspace, roomId) {
  return `live-participant:${workspace}:${roomId}:`;
}

function liveParticipantKey(workspace, roomId, participantId) {
  return `${liveParticipantPrefix(workspace, roomId)}${participantId}`;
}

function liveEventPrefix(workspace, roomId) {
  return `live-event:${workspace}:${roomId}:`;
}

function liveTokenIndexKey(workspace, roomId, tokenHash) {
  return `live-token:${workspace}:${roomId}:${tokenHash}`;
}

function safeLiveText(value, maxLength = 160) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function validLiveRoomId(value) {
  const roomId = String(value || '');
  return /^[a-zA-Z0-9_-]{8,80}$/.test(roomId) ? roomId : '';
}

function liveExpirationTtl(room) {
  return Math.max(60, Math.floor((Date.parse(room.expiresAt) - Date.now()) / 1000));
}

async function readLiveRoom(env, workspace, roomId) {
  const key = liveRoomKey(workspace, roomId);
  const encrypted = await env.MOBDEA_DATA.get(key);
  if (!encrypted) return null;
  const room = await decryptJson(encrypted, env, key);
  if (!room || Date.parse(room.expiresAt) <= Date.now()) return null;
  return room;
}

async function writeLiveRoom(env, room) {
  const key = liveRoomKey(room.workspace, room.id);
  await env.MOBDEA_DATA.put(
    key,
    await encryptJson(room, env, key),
    { expirationTtl: liveExpirationTtl(room) },
  );
}

async function readLiveParticipant(env, workspace, roomId, participantId) {
  const key = liveParticipantKey(workspace, roomId, participantId);
  const encrypted = await env.MOBDEA_DATA.get(key);
  if (!encrypted) return null;
  return decryptJson(encrypted, env, key);
}

async function writeLiveParticipant(env, room, participant) {
  const key = liveParticipantKey(room.workspace, room.id, participant.id);
  await env.MOBDEA_DATA.put(
    key,
    await encryptJson(participant, env, key),
    { expirationTtl: liveExpirationTtl(room) },
  );
}

async function tokenHash(value) {
  return sha256Hex(encoder.encode(String(value || '')));
}

async function authenticateLive(request, env, workspace, roomId) {
  const room = await readLiveRoom(env, workspace, roomId);
  if (!room) return null;
  const token = String(request.headers.get('X-Mobdea-Live-Token') || '').trim();
  if (!token) return null;
  if (await tokenEquals(token, room.teacherToken)) {
    return { room, role: 'teacher', participantId: 'teacher' };
  }
  const participantId = await env.MOBDEA_DATA.get(
    liveTokenIndexKey(workspace, roomId, await tokenHash(token)),
  );
  if (!participantId) return null;
  const participant = await readLiveParticipant(env, workspace, roomId, participantId);
  if (!participant || participant.status === 'removed') return null;
  return { room, role: 'participant', participantId, participant };
}

async function writeLiveEvent(env, room, event) {
  const createdAtMs = Number(event.createdAtMs || Date.now());
  const suffix = randomToken().slice(0, 8);
  const key = `${liveEventPrefix(room.workspace, room.id)}${String(createdAtMs).padStart(13, '0')}:${suffix}`;
  const record = {
    id: key.slice(liveEventPrefix(room.workspace, room.id).length),
    createdAtMs,
    createdAt: new Date(createdAtMs).toISOString(),
    ...event,
  };
  await env.MOBDEA_DATA.put(
    key,
    await encryptJson(record, env, key),
    { expirationTtl: liveExpirationTtl(room) },
  );
  return record;
}


/* MOBDEA_GAME_ROOMS_CORE_V1 */

function gameRoomKey(workspace, roomId) {
  return `game-room:${workspace}:${roomId}`;
}

function gameCodeKey(workspace, joinCode) {
  return `game-code:${workspace}:${joinCode}`;
}

function gameParticipantPrefix(workspace, roomId) {
  return `game-participant:${workspace}:${roomId}:`;
}

function gameParticipantKey(workspace, roomId, participantId) {
  return `${gameParticipantPrefix(workspace, roomId)}${participantId}`;
}

function gameEventPrefix(workspace, roomId) {
  return `game-event:${workspace}:${roomId}:`;
}

function gameTokenIndexKey(workspace, roomId, tokenHashValue) {
  return `game-token:${workspace}:${roomId}:${tokenHashValue}`;
}

function validGameJoinCode(value) {
  const code = String(value || '').trim();
  return /^[0-9]{6}$/.test(code) ? code : '';
}

function gameExpirationTtl(room) {
  return liveExpirationTtl(room);
}

async function readGameRoom(env, workspace, roomId) {
  const validRoomId = validLiveRoomId(roomId);
  if (!validRoomId) return null;

  const key = gameRoomKey(workspace, validRoomId);
  const encrypted = await env.MOBDEA_DATA.get(key);
  if (!encrypted) return null;

  const room = await decryptJson(encrypted, env, key);

  if (!room || Date.parse(room.expiresAt || '') <= Date.now()) {
    return null;
  }

  return room;
}

async function writeGameRoom(env, room) {
  const key = gameRoomKey(room.workspace, room.roomId);

  await env.MOBDEA_DATA.put(
    key,
    await encryptJson(room, env, key),
    { expirationTtl: gameExpirationTtl(room) },
  );
}

async function readGameParticipant(
  env,
  workspace,
  roomId,
  participantId,
) {
  const key = gameParticipantKey(
    workspace,
    roomId,
    participantId,
  );

  const encrypted = await env.MOBDEA_DATA.get(key);
  if (!encrypted) return null;

  return decryptJson(encrypted, env, key);
}

async function writeGameParticipant(env, room, participant) {
  const key = gameParticipantKey(
    room.workspace,
    room.roomId,
    participant.participantId,
  );

  await env.MOBDEA_DATA.put(
    key,
    await encryptJson(participant, env, key),
    { expirationTtl: gameExpirationTtl(room) },
  );
}

async function writeGameEvent(env, room, event = {}) {
  const createdAtMs = Number(event.createdAtMs || Date.now());
  const suffix = randomToken().slice(0, 8);

  const key = `${gameEventPrefix(
    room.workspace,
    room.roomId,
  )}${String(createdAtMs).padStart(13, '0')}:${suffix}`;

  const record = {
    id: key.slice(gameEventPrefix(
      room.workspace,
      room.roomId,
    ).length),
    createdAtMs,
    createdAt: new Date(createdAtMs).toISOString(),
    ...event,
  };

  await env.MOBDEA_DATA.put(
    key,
    await encryptJson(record, env, key),
    { expirationTtl: gameExpirationTtl(room) },
  );

  return record;
}

async function authenticateGame(
  request,
  env,
  workspace,
  roomId,
) {
  const room = await readGameRoom(
    env,
    workspace,
    roomId,
  );

  if (!room) return null;

  const token = String(
    request.headers.get('X-Mobdea-Game-Token') || '',
  ).trim();

  if (!token) return null;

  if (
    await tokenHash(token) ===
    await tokenHash(room.teacherToken)
  ) {
    return {
      room,
      role: 'teacher',
      participantId: 'teacher',
    };
  }

  const participantId = await env.MOBDEA_DATA.get(
    gameTokenIndexKey(
      workspace,
      roomId,
      await tokenHash(token),
    ),
  );

  if (!participantId) return null;

  const participant = await readGameParticipant(
    env,
    workspace,
    roomId,
    participantId,
  );

  if (!participant || participant.status === 'removed') {
    return null;
  }

  return {
    room,
    role: 'participant',
    participantId,
    participant,
  };
}


/* MOBDEA_GAME_ROOMS_HANDLERS_V1 */

function publicGameRoom(room = {}) {
  return {
    roomId: room.roomId,
    workspace: room.workspace,
    joinCode: room.joinCode,
    title: room.title,
    mode: room.mode,
    status: room.status,
    teacherName: room.teacherName,
    maxParticipants: room.maxParticipants,
    teamMode: Boolean(room.teamMode),
    teams: Array.isArray(room.teams) ? room.teams : [],
    state: room.state || {},
    createdAt: room.createdAt,
    startedAt: room.startedAt || null,
    closedAt: room.closedAt || null,
    expiresAt: room.expiresAt,
  };
}

async function createUniqueGameJoinCode(env, workspace) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const values = crypto.getRandomValues(new Uint32Array(1));
    const code = String(100000 + (values[0] % 900000));

    const existing = await env.MOBDEA_DATA.get(
      gameCodeKey(workspace, code),
    );

    if (!existing) return code;
  }

  throw new Error('Could not create a unique game code');
}

async function handleCreateGameRoom(request, env, auth) {
  if (!(
    await rateLimit(
      request,
      env,
      auth.workspace,
      true,
      20,
      'game-create',
    )
  )) {
    return json(
      request,
      env,
      { error: 'rate_limited' },
      429,
      { 'Retry-After': '60' },
    );
  }

  const body = await parseJsonBody(request, 100000);

  const ttlSeconds = Math.max(
    LIVE_ROOM_TTL_MIN,
    Math.min(
      LIVE_ROOM_TTL_MAX,
      Number(body.ttlSeconds || 21600),
    ),
  );

  const roomId = randomToken().slice(0, 18);
  const teacherToken = randomToken();
  const joinCode = await createUniqueGameJoinCode(
    env,
    auth.workspace,
  );

  const createdAt = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + ttlSeconds * 1000,
  ).toISOString();

  const teams = Array.isArray(body.teams)
    ? body.teams
        .map((team) => safeLiveText(team, 40))
        .filter(Boolean)
        .slice(0, 8)
    : [];

  const room = {
    roomId,
    workspace: auth.workspace,
    joinCode,
    teacherToken,
    teacherName: safeLiveText(
      body.teacherName || body.hostName || 'المعلم',
      80,
    ),
    title: safeLiveText(
      body.title || 'تحدي مباشر',
      140,
    ),
    mode: safeLiveText(
      body.mode || 'individual',
      30,
    ),
    teamMode: Boolean(body.teamMode || teams.length),
    teams,
    status: 'waiting',
    maxParticipants: Math.max(
      2,
      Math.min(100, Number(body.maxParticipants || 40)),
    ),
    state: {
      round: 0,
      questionIndex: 0,
      question: null,
      started: false,
      ...(body.state && typeof body.state === 'object'
        ? body.state
        : {}),
    },
    createdAt,
    expiresAt,
  };

  await writeGameRoom(env, room);

  await env.MOBDEA_DATA.put(
    gameCodeKey(auth.workspace, joinCode),
    roomId,
    { expirationTtl: ttlSeconds },
  );

  await writeGameEvent(env, room, {
    type: 'room-created',
    actorRole: 'teacher',
  });

  return json(
    request,
    env,
    {
      ok: true,
      room: publicGameRoom(room),
      teacherToken,
      joinCode,
    },
    201,
  );
}

async function handleJoinGameRoom(request, env, workspace) {
  if (!(
    await rateLimit(
      request,
      env,
      workspace,
      false,
      60,
      'game-join',
    )
  )) {
    return json(
      request,
      env,
      { error: 'rate_limited' },
      429,
      { 'Retry-After': '60' },
    );
  }

  const body = await parseJsonBody(request, 50000);
  const joinCode = validGameJoinCode(body.joinCode);

  if (!joinCode) {
    return json(
      request,
      env,
      { error: 'invalid_join_code' },
      400,
    );
  }

  const roomId = await env.MOBDEA_DATA.get(
    gameCodeKey(workspace, joinCode),
  );

  if (!roomId) {
    return json(
      request,
      env,
      { error: 'game_room_not_found' },
      404,
    );
  }

  const room = await readGameRoom(
    env,
    workspace,
    roomId,
  );

  if (!room) {
    return json(
      request,
      env,
      { error: 'game_room_not_found' },
      404,
    );
  }

  if (room.status === 'closed') {
    return json(
      request,
      env,
      { error: 'game_room_closed' },
      410,
    );
  }

  const displayName = safeLiveText(
    body.displayName || body.studentName || body.name,
    80,
  );

  if (!displayName) {
    return json(
      request,
      env,
      { error: 'display_name_required' },
      400,
    );
  }

  const participantId = randomToken().slice(0, 18);
  const participantToken = randomToken();
  const joinedAt = new Date().toISOString();

  const requestedTeam = safeLiveText(
    body.team || '',
    40,
  );

  const team =
    room.teamMode &&
    room.teams.includes(requestedTeam)
      ? requestedTeam
      : '';

  const participant = {
    participantId,
    roomId: room.roomId,
    workspace: room.workspace,
    studentId: safeLiveText(body.studentId || '', 80),
    displayName,
    team,
    score: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    answeredQuestions: 0,
    status: 'waiting',
    joinedAt,
    updatedAt: joinedAt,
  };

  await writeGameParticipant(
    env,
    room,
    participant,
  );

  await env.MOBDEA_DATA.put(
    gameTokenIndexKey(
      workspace,
      room.roomId,
      await tokenHash(participantToken),
    ),
    participantId,
    { expirationTtl: gameExpirationTtl(room) },
  );

  await writeGameEvent(env, room, {
    type: 'participant-joined',
    participantId,
    displayName,
    team,
  });

  return json(
    request,
    env,
    {
      ok: true,
      room: publicGameRoom(room),
      roomId: room.roomId,
      joinCode: room.joinCode,
      participant,
      participantId: participant.participantId,
      participantToken,
    },
    201,
  );
}


/* MOBDEA_GAME_CONTROL_V1 */

async function listGameParticipants(
  env,
  workspace,
  roomId,
) {
  const page = await env.MOBDEA_DATA.list({
    prefix: gameParticipantPrefix(workspace, roomId),
    limit: 250,
  });

  const participants = [];

  for (const item of page.keys || []) {
    const encrypted = await env.MOBDEA_DATA.get(item.name);
    if (!encrypted) continue;

    const participant = await decryptJson(
      encrypted,
      env,
      item.name,
    );

    if (
      participant &&
      participant.status !== 'removed'
    ) {
      participants.push(participant);
    }
  }

  participants.sort((left, right) => {
    const scoreDifference =
      Number(right.score || 0) - Number(left.score || 0);

    if (scoreDifference) return scoreDifference;

    return String(left.joinedAt || '').localeCompare(
      String(right.joinedAt || ''),
    );
  });

  return participants;
}

function buildGameLeaderboard(participants = []) {
  return participants.map((participant, index) => ({
    rank: index + 1,
    participantId: participant.participantId,
    displayName: participant.displayName,
    team: participant.team || '',
    score: Number(participant.score || 0),
    correctAnswers: Number(
      participant.correctAnswers || 0,
    ),
    wrongAnswers: Number(
      participant.wrongAnswers || 0,
    ),
    answeredQuestions: Number(
      participant.answeredQuestions || 0,
    ),
    status: participant.status,
  }));
}

function buildTeamLeaderboard(participants = []) {
  const teams = new Map();

  for (const participant of participants) {
    const team = String(participant.team || '').trim();
    if (!team) continue;

    const current = teams.get(team) || {
      team,
      score: 0,
      correctAnswers: 0,
      members: 0,
    };

    current.score += Number(participant.score || 0);
    current.correctAnswers += Number(
      participant.correctAnswers || 0,
    );
    current.members += 1;

    teams.set(team, current);
  }

  return Array.from(teams.values())
    .sort((left, right) => right.score - left.score)
    .map((team, index) => ({
      rank: index + 1,
      ...team,
    }));
}

async function handleGameParticipants(
  request,
  env,
  workspace,
  roomId,
) {
  const auth = await authenticateGame(
    request,
    env,
    workspace,
    roomId,
  );

  if (!auth) {
    return json(
      request,
      env,
      { error: 'unauthorized' },
      401,
    );
  }

  const participants = await listGameParticipants(
    env,
    workspace,
    roomId,
  );

  return json(request, env, {
    ok: true,
    room: publicGameRoom(auth.room),
    participants,
    leaderboard: buildGameLeaderboard(participants),
    teamLeaderboard: buildTeamLeaderboard(participants),
  });
}

async function handleGameRoomState(
  request,
  env,
  workspace,
  roomId,
) {
  const auth = await authenticateGame(
    request,
    env,
    workspace,
    roomId,
  );

  if (!auth) {
    return json(
      request,
      env,
      { error: 'unauthorized' },
      401,
    );
  }

  if (request.method === 'GET') {
    const participants = await listGameParticipants(
      env,
      workspace,
      roomId,
    );

    return json(request, env, {
      ok: true,
      room: publicGameRoom(auth.room),
      participant:
        auth.role === 'participant'
          ? auth.participant
          : null,
      leaderboard: buildGameLeaderboard(participants),
      teamLeaderboard: buildTeamLeaderboard(participants),
    });
  }

  if (auth.role !== 'teacher') {
    return json(
      request,
      env,
      { error: 'teacher_required' },
      403,
    );
  }

  const body = await parseJsonBody(request, 120000);
  const room = auth.room;
  const previousStatus = room.status;

  const allowedStatuses = new Set([
    'waiting',
    'active',
    'paused',
    'finished',
    'closed',
  ]);

  if (
    body.status &&
    allowedStatuses.has(String(body.status))
  ) {
    room.status = String(body.status);
  }

  if (
    body.state &&
    typeof body.state === 'object' &&
    !Array.isArray(body.state)
  ) {
    room.state = {
      ...(room.state || {}),
      ...body.state,
    };
  }

  if (body.questionId !== undefined) {
    room.state = {
      ...(room.state || {}),
      questionId: safeLiveText(body.questionId, 100),
    };
  }

  if (body.answerKey !== undefined) {
    room.answerKey = Array.isArray(body.answerKey)
      ? body.answerKey
          .map((answer) => safeLiveText(answer, 300))
          .filter(Boolean)
          .slice(0, 20)
      : safeLiveText(body.answerKey, 300);
  }

  if (body.pointsPerCorrect !== undefined) {
    room.pointsPerCorrect = Math.max(
      0,
      Math.min(
        1000,
        Number(body.pointsPerCorrect || 0),
      ),
    );
  }

  if (
    room.status === 'active' &&
    previousStatus !== 'active'
  ) {
    room.startedAt =
      room.startedAt || new Date().toISOString();

    room.state = {
      ...(room.state || {}),
      started: true,
    };
  }

  if (
    room.status === 'finished' ||
    room.status === 'closed'
  ) {
    room.finishedAt =
      room.finishedAt || new Date().toISOString();

    room.state = {
      ...(room.state || {}),
      started: false,
    };
  }

  room.updatedAt = new Date().toISOString();

  await writeGameRoom(env, room);

  await writeGameEvent(env, room, {
    type: 'room-state-updated',
    actorRole: 'teacher',
    status: room.status,
    questionId: room.state?.questionId || '',
  });

  const participants = await listGameParticipants(
    env,
    workspace,
    roomId,
  );

  return json(request, env, {
    ok: true,
    room: publicGameRoom(room),
    leaderboard: buildGameLeaderboard(participants),
    teamLeaderboard: buildTeamLeaderboard(participants),
  });
}


/* MOBDEA_GAME_PLAY_V1 */

function normalizeGameAnswer(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('ar');
}

function gameAnswerIsCorrect(answer, answerKey) {
  const submitted = normalizeGameAnswer(answer);

  if (!submitted) return false;

  const acceptedAnswers = Array.isArray(answerKey)
    ? answerKey
    : [answerKey];

  return acceptedAnswers.some(
    (accepted) =>
      normalizeGameAnswer(accepted) === submitted,
  );
}

async function handleGameAnswer(
  request,
  env,
  workspace,
  roomId,
) {
  const auth = await authenticateGame(
    request,
    env,
    workspace,
    roomId,
  );

  if (!auth) {
    return json(
      request,
      env,
      { error: 'unauthorized' },
      401,
    );
  }

  if (auth.role !== 'participant') {
    return json(
      request,
      env,
      { error: 'participant_required' },
      403,
    );
  }

  const room = auth.room;

  if (room.status !== 'active') {
    return json(
      request,
      env,
      { error: 'game_not_active' },
      409,
    );
  }

  const body = await parseJsonBody(request, 50000);

  const questionId = safeLiveText(
    body.questionId ||
      room.state?.questionId ||
      room.state?.questionIndex ||
      '',
    100,
  );

  if (!questionId) {
    return json(
      request,
      env,
      { error: 'question_not_ready' },
      409,
    );
  }

  if (
    !room.answerKey ||
    (
      Array.isArray(room.answerKey) &&
      room.answerKey.length === 0
    )
  ) {
    return json(
      request,
      env,
      { error: 'answer_key_not_ready' },
      409,
    );
  }

  const participant = await readGameParticipant(
    env,
    workspace,
    roomId,
    auth.participantId,
  );

  if (!participant) {
    return json(
      request,
      env,
      { error: 'participant_not_found' },
      404,
    );
  }

  if (
    String(participant.lastQuestionId || '') ===
    String(questionId)
  ) {
    return json(
      request,
      env,
      {
        error: 'answer_already_submitted',
        participant,
      },
      409,
    );
  }

  const answer = safeLiveText(
    body.answer ?? body.value ?? '',
    300,
  );

  if (!answer) {
    return json(
      request,
      env,
      { error: 'answer_required' },
      400,
    );
  }

  const correct = gameAnswerIsCorrect(
    answer,
    room.answerKey,
  );

  const basePoints = Math.max(
    0,
    Math.min(
      1000,
      Number(room.pointsPerCorrect ?? 100),
    ),
  );

  const elapsedMs = Math.max(
    0,
    Math.min(
      3600000,
      Number(body.elapsedMs || 0),
    ),
  );

  const timeLimitMs = Math.max(
    0,
    Number(room.state?.timeLimitMs || 0),
  );

  let awardedPoints = correct ? basePoints : 0;

  if (
    correct &&
    timeLimitMs > 0 &&
    elapsedMs > 0 &&
    elapsedMs < timeLimitMs
  ) {
    const speedRatio = Math.max(
      0,
      (timeLimitMs - elapsedMs) / timeLimitMs,
    );

    awardedPoints += Math.round(
      basePoints * 0.25 * speedRatio,
    );
  }

  const answeredAt = new Date().toISOString();

  participant.score =
    Number(participant.score || 0) + awardedPoints;

  participant.correctAnswers =
    Number(participant.correctAnswers || 0) +
    (correct ? 1 : 0);

  participant.wrongAnswers =
    Number(participant.wrongAnswers || 0) +
    (correct ? 0 : 1);

  participant.answeredQuestions =
    Number(participant.answeredQuestions || 0) + 1;

  participant.lastQuestionId = questionId;
  participant.lastAnswer = answer;
  participant.lastAnswerCorrect = correct;
  participant.lastAwardedPoints = awardedPoints;
  participant.lastAnsweredAt = answeredAt;
  participant.status = 'active';
  participant.updatedAt = answeredAt;

  await writeGameParticipant(
    env,
    room,
    participant,
  );

  await writeGameEvent(env, room, {
    type: 'answer-submitted',
    participantId: participant.participantId,
    displayName: participant.displayName,
    team: participant.team || '',
    questionId,
    correct,
    awardedPoints,
    elapsedMs,
  });

  const participants = await listGameParticipants(
    env,
    workspace,
    roomId,
  );

  return json(request, env, {
    ok: true,
    correct,
    awardedPoints,
    participant,
    leaderboard: buildGameLeaderboard(participants),
    teamLeaderboard: buildTeamLeaderboard(participants),
  });
}

async function handleGameEvents(
  request,
  env,
  workspace,
  roomId,
) {
  const auth = await authenticateGame(
    request,
    env,
    workspace,
    roomId,
  );

  if (!auth) {
    return json(
      request,
      env,
      { error: 'unauthorized' },
      401,
    );
  }

  const url = new URL(request.url);

  const after = Math.max(
    0,
    Number(url.searchParams.get('after') || 0),
  );

  const page = await env.MOBDEA_DATA.list({
    prefix: gameEventPrefix(workspace, roomId),
    limit: 250,
  });

  const events = [];

  for (const item of page.keys || []) {
    const encrypted = await env.MOBDEA_DATA.get(
      item.name,
    );

    if (!encrypted) continue;

    const event = await decryptJson(
      encrypted,
      env,
      item.name,
    );

    if (
      event &&
      Number(event.createdAtMs || 0) > after
    ) {
      events.push(event);
    }
  }

  events.sort(
    (left, right) =>
      Number(left.createdAtMs || 0) -
      Number(right.createdAtMs || 0),
  );

  return json(request, env, {
    ok: true,
    room: publicGameRoom(auth.room),
    events: events.slice(-100),
    serverTime: Date.now(),
  });
}

async function handleCloseGameRoom(
  request,
  env,
  workspace,
  roomId,
) {
  const auth = await authenticateGame(
    request,
    env,
    workspace,
    roomId,
  );

  if (!auth) {
    return json(
      request,
      env,
      { error: 'unauthorized' },
      401,
    );
  }

  if (auth.role !== 'teacher') {
    return json(
      request,
      env,
      { error: 'teacher_required' },
      403,
    );
  }

  const room = auth.room;
  room.status = 'closed';
  room.closedAt = new Date().toISOString();
  room.updatedAt = room.closedAt;
  room.state = {
    ...(room.state || {}),
    started: false,
  };

  await writeGameRoom(env, room);

  await writeGameEvent(env, room, {
    type: 'room-closed',
    actorRole: 'teacher',
  });

  const participants = await listGameParticipants(
    env,
    workspace,
    roomId,
  );

  return json(request, env, {
    ok: true,
    room: publicGameRoom(room),
    leaderboard: buildGameLeaderboard(participants),
    teamLeaderboard: buildTeamLeaderboard(participants),
  });
}


/* MOBDEA_GAME_POST_EVENTS_V1 */

async function handlePostGameEvent(
  request,
  env,
  workspace,
  roomId,
) {
  const auth = await authenticateGame(
    request,
    env,
    workspace,
    roomId,
  );

  if (!auth) {
    return json(
      request,
      env,
      { error: 'unauthorized' },
      401,
    );
  }

  const body = await parseJsonBody(request, 120000);

  const type = safeLiveText(body.type || '', 60);

  if (!type) {
    return json(
      request,
      env,
      { error: 'event_type_required' },
      400,
    );
  }

  const participantAllowed = new Set([
    'game-answer',
    'participant-ready',
    'participant-status',
    'microphone-request',
  ]);

  if (
    auth.role !== 'teacher' &&
    !participantAllowed.has(type)
  ) {
    return json(
      request,
      env,
      { error: 'teacher_required' },
      403,
    );
  }

  const data =
    body.data &&
    typeof body.data === 'object' &&
    !Array.isArray(body.data)
      ? body.data
      : {};

  const event = await writeGameEvent(
    env,
    auth.room,
    {
      type,
      targetId: safeLiveText(
        body.targetId || '',
        100,
      ),
      actorRole: auth.role,
      participantId:
        auth.role === 'participant'
          ? auth.participantId
          : 'teacher',
      data,
    },
  );

  return json(
    request,
    env,
    {
      ok: true,
      event,
    },
    201,
  );
}

async function handleCreateLiveRoom(request, env, auth) {
  if (!(await rateLimit(request, env, auth.workspace, true, 20, 'live-create'))) {
    return json(request, env, { error: 'rate_limited' }, 429, { 'Retry-After': '60' });
  }
  const body = await parseJsonBody(request, 80_000);
  const ttl = Math.max(
    LIVE_ROOM_TTL_MIN,
    Math.min(LIVE_ROOM_TTL_MAX, Number(body.ttlSeconds || 6 * 60 * 60)),
  );
  const roomId = randomToken().slice(0, 18);
  const teacherToken = randomToken();
  const joinCodeBytes = crypto.getRandomValues(new Uint32Array(1));
  const joinCode = String(100000 + (joinCodeBytes[0] % 900000));
  const now = Date.now();
  const room = {
    id: roomId,
    workspace: auth.workspace,
    title: safeLiveText(body.title || 'حصة مباشرة', 140),
    grade: safeLiveText(body.grade || '', 80),
    lesson: safeLiveText(body.lesson || '', 140),
    sessionId: body.sessionId ?? null,
    lessonId: body.lessonId ?? null,
    teacherToken,
    joinCode,
    status: 'open',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl * 1000).toISOString(),
  };
  await writeLiveRoom(env, room);
  return json(request, env, {
    ok: true,
    roomId,
    teacherToken,
    joinCode,
    title: room.title,
    grade: room.grade,
    lesson: room.lesson,
    expiresAt: room.expiresAt,
  }, 201);
}

async function handleJoinLiveRoom(request, env, workspace, roomId) {
  if (!(await rateLimit(request, env, workspace || 'public', true, 40, 'live-join'))) {
    return json(request, env, { error: 'rate_limited' }, 429, { 'Retry-After': '60' });
  }
  const room = await readLiveRoom(env, workspace, roomId);
  if (!room || room.status !== 'open') {
    return json(request, env, { error: 'room_not_found', message: 'الحصة غير متاحة أو انتهت.' }, 404);
  }
  const body = await parseJsonBody(request, 40_000);
  if (!(await tokenEquals(String(body.joinCode || '').trim(), room.joinCode))) {
    return json(request, env, { error: 'invalid_join_code', message: 'كود دخول الحصة غير صحيح.' }, 403);
  }
  const name = safeLiveText(body.name, 100);
  if (name.length < 2) {
    return json(request, env, { error: 'invalid_name', message: 'اكتب اسم الطالب قبل الدخول.' }, 400);
  }
  const participantId = randomToken().slice(0, 18);
  const participantToken = randomToken();
  const now = Date.now();
  const participant = {
    id: participantId,
    name,
    studentCode: safeLiveText(body.studentCode, 40),
    status: 'online',
    micState: 'muted',
    muted: true,
    joinedAt: new Date(now).toISOString(),
    lastSeenAt: new Date(now).toISOString(),
  };
  await writeLiveParticipant(env, room, participant);
  await env.MOBDEA_DATA.put(
    liveTokenIndexKey(workspace, roomId, await tokenHash(participantToken)),
    participantId,
    { expirationTtl: liveExpirationTtl(room) },
  );
  await writeLiveEvent(env, room, {
    type: 'participant-joined',
    sourceRole: 'system',
    sourceId: participantId,
    targetId: 'teacher',
    data: {
      participantId,
      name: participant.name,
      studentCode: participant.studentCode,
    },
  });
  return json(request, env, {
    ok: true,
    room: {
      id: room.id,
      title: room.title,
      grade: room.grade,
      lesson: room.lesson,
      status: room.status,
      expiresAt: room.expiresAt,
    },
    participantId,
    participantToken,
  }, 201);
}

function liveEventAllowedForParticipant(event, participantId) {
  if (!event) return false;
  if (event.targetId && !['all', participantId].includes(event.targetId)) return false;
  if (event.sourceRole === 'participant' && event.sourceId !== participantId) {
    return ['reaction', 'chat', 'game-state'].includes(event.type) && !event.targetId;
  }
  return true;
}

async function handleLiveEvents(request, env, workspace, roomId) {
  const auth = await authenticateLive(request, env, workspace, roomId);
  if (!auth) return json(request, env, { error: 'unauthorized' }, 401);
  if (!(await rateLimit(request, env, workspace, request.method === 'POST', request.method === 'POST' ? 180 : 600, `live-event-${request.method}`))) {
    return json(request, env, { error: 'rate_limited' }, 429, { 'Retry-After': '10' });
  }

  if (request.method === 'GET') {
    const after = Math.max(0, Number(new URL(request.url).searchParams.get('after') || 0));
    const page = await env.MOBDEA_DATA.list({ prefix: liveEventPrefix(workspace, roomId), limit: 250 });
    const events = [];
    for (const key of page.keys || []) {
      const encrypted = await env.MOBDEA_DATA.get(key.name);
      if (!encrypted) continue;
      const event = await decryptJson(encrypted, env, key.name);
      if (Number(event.createdAtMs || 0) <= after) continue;
      if (auth.role === 'participant' && !liveEventAllowedForParticipant(event, auth.participantId)) continue;
      events.push(event);
    }
    events.sort((left, right) => Number(left.createdAtMs || 0) - Number(right.createdAtMs || 0));
    return json(request, env, {
      roomStatus: auth.room.status,
      events: events.slice(-120),
      cursor: events.length ? Number(events[events.length - 1].createdAtMs || after) : after,
    });
  }

  if (request.method === 'POST') {
    const body = await parseJsonBody(request, MAX_LIVE_EVENT_BYTES);
    const type = safeLiveText(body.type, 40);
    if (!LIVE_EVENT_TYPES.has(type)) {
      return json(request, env, { error: 'invalid_event_type' }, 400);
    }
    const participantTypes = new Set([
      'student-ready', 'participant-left', 'mic-request', 'mic-started', 'mic-stopped', 'hand-raised', 'reaction', 'chat',
      'heartbeat', 'game-state', 'game-ready', 'game-answer',
      'webrtc-offer', 'webrtc-answer', 'webrtc-ice',
    ]);
    if (auth.role === 'participant' && !participantTypes.has(type)) {
      return json(request, env, { error: 'forbidden_event' }, 403);
    }
    let targetId = safeLiveText(body.targetId, 100);
    if (auth.role === 'participant' && targetId && targetId !== 'teacher') targetId = 'teacher';
    const dataText = JSON.stringify(body.data && typeof body.data === 'object' ? body.data : {});
    if (encoder.encode(dataText).byteLength > MAX_LIVE_EVENT_BYTES - 2000) {
      return json(request, env, { error: 'payload_too_large' }, 413);
    }
    const event = await writeLiveEvent(env, auth.room, {
      type,
      sourceRole: auth.role,
      sourceId: auth.participantId,
      targetId,
      clientEventId: safeLiveText(body.clientEventId, 120),
      data: JSON.parse(dataText),
    });
    if (auth.role === 'participant') {
      const participant = {
        ...auth.participant,
        lastSeenAt: new Date().toISOString(),
        status: type === 'participant-left' ? 'offline' : 'online',
        micState: type === 'mic-request'
          ? 'requested'
          : type === 'mic-started'
            ? 'speaking'
            : type === 'mic-stopped'
              ? 'muted'
              : type === 'participant-left'
                ? 'muted'
              : auth.participant.micState,
        muted: type === 'mic-started'
          ? false
          : type === 'mic-stopped'
            ? true
            : type === 'participant-left'
              ? true
            : auth.participant.muted,
      };
      await writeLiveParticipant(env, auth.room, participant);
    }
    return json(request, env, { ok: true, event }, 201);
  }

  return json(request, env, { error: 'method_not_allowed' }, 405);
}

async function handleLiveParticipants(request, env, workspace, roomId, participantId = '') {
  const auth = await authenticateLive(request, env, workspace, roomId);
  if (!auth || auth.role !== 'teacher') return json(request, env, { error: 'unauthorized' }, 401);
  if (!(await rateLimit(request, env, workspace, request.method === 'PATCH', 180, 'live-participants'))) {
    return json(request, env, { error: 'rate_limited' }, 429, { 'Retry-After': '10' });
  }
  if (request.method === 'GET' && !participantId) {
    const page = await env.MOBDEA_DATA.list({ prefix: liveParticipantPrefix(workspace, roomId), limit: 250 });
    const participants = [];
    for (const key of page.keys || []) {
      const encrypted = await env.MOBDEA_DATA.get(key.name);
      if (!encrypted) continue;
      const participant = await decryptJson(encrypted, env, key.name);
      if (participant.status === 'removed') continue;
      const lastSeen = Date.parse(participant.lastSeenAt || participant.joinedAt || 0);
      participants.push({
        ...participant,
        online: participant.status === 'online' && Number.isFinite(lastSeen) && Date.now() - lastSeen < 45_000,
      });
    }
    participants.sort((left, right) => String(left.joinedAt || '').localeCompare(String(right.joinedAt || '')));
    return json(request, env, { participants });
  }
  if (request.method === 'PATCH' && participantId) {
    const participant = await readLiveParticipant(env, workspace, roomId, participantId);
    if (!participant) return json(request, env, { error: 'not_found' }, 404);
    const body = await parseJsonBody(request, 20_000);
    const micState = safeLiveText(body.micState, 30);
    const allowedMicStates = new Set(['muted', 'requested', 'approved', 'speaking']);
    const next = {
      ...participant,
      micState: allowedMicStates.has(micState) ? micState : participant.micState,
      muted: body.muted === true,
      status: body.removed === true ? 'removed' : participant.status,
      updatedAt: new Date().toISOString(),
    };
    await writeLiveParticipant(env, auth.room, next);
    const eventType = body.removed === true
      ? 'participant-removed'
      : next.micState === 'approved'
        ? 'mic-approved'
        : 'mic-revoked';
    await writeLiveEvent(env, auth.room, {
      type: eventType,
      sourceRole: 'teacher',
      sourceId: 'teacher',
      targetId: participantId,
      data: { participantId, micState: next.micState, muted: next.muted },
    });
    return json(request, env, { ok: true, participant: next });
  }
  return json(request, env, { error: 'method_not_allowed' }, 405);
}

async function handleCloseLiveRoom(request, env, workspace, roomId) {
  const auth = await authenticateLive(request, env, workspace, roomId);
  if (!auth || auth.role !== 'teacher') return json(request, env, { error: 'unauthorized' }, 401);
  const room = { ...auth.room, status: 'closed', closedAt: new Date().toISOString() };
  await writeLiveEvent(env, room, {
    type: 'room-closed',
    sourceRole: 'teacher',
    sourceId: 'teacher',
    targetId: 'all',
    data: {},
  });
  await writeLiveRoom(env, room);
  return json(request, env, { ok: true });
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

      const publicWorkspace = validWorkspace(request.headers.get('X-Mobdea-Workspace'));
      if (url.pathname === '/student/login' && request.method === 'POST') return handleStudentLogin(request, env, publicWorkspace);
      if (url.pathname === '/student/snapshot' && request.method === 'GET') return handleStudentSnapshot(request, env, publicWorkspace);
      const studentAssetMatch = /^\/student\/assets\/([a-zA-Z0-9._-]+)$/.exec(url.pathname);
      if (studentAssetMatch && request.method === 'GET') return handleStudentAsset(request, env, publicWorkspace, studentAssetMatch[1]);

      const liveWorkspace = validWorkspace(request.headers.get('X-Mobdea-Workspace'));
      const liveJoinMatch = /^\/live\/rooms\/([a-zA-Z0-9_-]+)\/join$/.exec(url.pathname);
      if (request.method === 'POST' && liveJoinMatch) {
        return handleJoinLiveRoom(request, env, liveWorkspace, validLiveRoomId(liveJoinMatch[1]));
      }
      const liveEventsMatch = /^\/live\/rooms\/([a-zA-Z0-9_-]+)\/events$/.exec(url.pathname);
      if (liveEventsMatch && ['GET', 'POST'].includes(request.method)) {
        return handleLiveEvents(request, env, liveWorkspace, validLiveRoomId(liveEventsMatch[1]));
      }
      const liveParticipantMatch = /^\/live\/rooms\/([a-zA-Z0-9_-]+)\/participants(?:\/([a-zA-Z0-9_-]+))?$/.exec(url.pathname);
      if (liveParticipantMatch && ['GET', 'PATCH'].includes(request.method)) {
        return handleLiveParticipants(
          request,
          env,
          liveWorkspace,
          validLiveRoomId(liveParticipantMatch[1]),
          safeLiveText(liveParticipantMatch[2] || '', 100),
        );
      }
      const liveRoomMatch = /^\/live\/rooms\/([a-zA-Z0-9_-]+)$/.exec(url.pathname);
      if (liveRoomMatch && request.method === 'DELETE') {
        return handleCloseLiveRoom(request, env, liveWorkspace, validLiveRoomId(liveRoomMatch[1]));
      }


      /* MOBDEA_GAME_PUBLIC_ROUTES_V1 */
      const gameWorkspace = validWorkspace(
        request.headers.get('X-Mobdea-Workspace'),
      );

      if (
        url.pathname === '/game/rooms/join' &&
        request.method === 'POST'
      ) {
        return handleJoinGameRoom(
          request,
          env,
          gameWorkspace,
        );
      }

      const gameStateMatch =
        /^\/game\/rooms\/([a-zA-Z0-9_-]+)\/state$/.exec(
          url.pathname,
        );

      if (
        gameStateMatch &&
        ['GET', 'PATCH'].includes(request.method)
      ) {
        return handleGameRoomState(
          request,
          env,
          gameWorkspace,
          validLiveRoomId(gameStateMatch[1]),
        );
      }

      const gameParticipantsMatch =
        /^\/game\/rooms\/([a-zA-Z0-9_-]+)\/participants$/.exec(
          url.pathname,
        );

      if (
        gameParticipantsMatch &&
        request.method === 'GET'
      ) {
        return handleGameParticipants(
          request,
          env,
          gameWorkspace,
          validLiveRoomId(gameParticipantsMatch[1]),
        );
      }

      const gameAnswerMatch =
        /^\/game\/rooms\/([a-zA-Z0-9_-]+)\/answer$/.exec(
          url.pathname,
        );

      if (
        gameAnswerMatch &&
        request.method === 'POST'
      ) {
        return handleGameAnswer(
          request,
          env,
          gameWorkspace,
          validLiveRoomId(gameAnswerMatch[1]),
        );
      }

      const gameEventsMatch =
        /^\/game\/rooms\/([a-zA-Z0-9_-]+)\/events$/.exec(
          url.pathname,
        );

      if (
        gameEventsMatch &&
        ['GET', 'POST'].includes(request.method)
      ) {
        const gameEventRoomId = validLiveRoomId(
          gameEventsMatch[1],
        );

        if (request.method === 'POST') {
          return handlePostGameEvent(
            request,
            env,
            gameWorkspace,
            gameEventRoomId,
          );
        }

        return handleGameEvents(
          request,
          env,
          gameWorkspace,
          gameEventRoomId,
        );
      }

      const gameRoomMatch =
        /^\/game\/rooms\/([a-zA-Z0-9_-]+)$/.exec(
          url.pathname,
        );

      if (
        gameRoomMatch &&
        request.method === 'DELETE'
      ) {
        return handleCloseGameRoom(
          request,
          env,
          gameWorkspace,
          validLiveRoomId(gameRoomMatch[1]),
        );
      }

const auth = await authenticate(request, env);
      if (!auth) {
        const allowed = await rateLimit(request, env, 'auth', true);
        return allowed
          ? json(request, env, { error: 'unauthorized' }, 401)
          : json(request, env, { error: 'rate_limited' }, 429, { 'Retry-After': '60' });
      }
      if (url.pathname === '/live/rooms' && request.method === 'POST') return handleCreateLiveRoom(request, env, auth);

      /* MOBDEA_GAME_PRIVATE_ROUTES_V1 */
      if (
        url.pathname === '/game/rooms' &&
        request.method === 'POST'
      ) {
        return handleCreateGameRoom(
          request,
          env,
          auth,
        );
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
