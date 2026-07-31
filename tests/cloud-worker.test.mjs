import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloud-worker/worker.js';

class MemoryKV {
  constructor() { this.values = new Map(); }
  async get(key) { return this.values.get(key) ?? null; }
  async put(key, value) { this.values.set(key, String(value)); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = '', limit = 1000 } = {}) {
    return {
      keys: [...this.values.keys()]
        .filter((key) => key.startsWith(prefix))
        .sort()
        .slice(0, limit)
        .map((name) => ({ name })),
      list_complete: true,
    };
  }
}

class MemoryR2Object {
  constructor(record) { this.record = record; this.customMetadata = record.customMetadata || {}; }
  async arrayBuffer() { return this.record.bytes.slice(0); }
}

class MemoryR2 {
  constructor() { this.values = new Map(); }
  async put(key, value, options = {}) {
    const bytes = value instanceof ArrayBuffer ? value.slice(0) : await new Response(value).arrayBuffer();
    this.values.set(key, { bytes, customMetadata: options.customMetadata || {} });
  }
  async get(key) { const value = this.values.get(key); return value ? new MemoryR2Object(value) : null; }
  async head(key) { const value = this.values.get(key); return value ? { customMetadata: value.customMetadata || {} } : null; }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = '' } = {}) {
    return {
      objects: [...this.values.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })),
      truncated: false,
    };
  }
}

function makeEnv() {
  return {
    MOBDEA_DATA: new MemoryKV(),
    MOBDEA_ASSETS: new MemoryR2(),
    MOBDEA_ALLOWED_ORIGINS: 'https://app.example.com',
    MOBDEA_WORKSPACE_TOKENS: JSON.stringify({ school_one: '0123456789abcdef0123456789abcdef' }),
    MOBDEA_ENCRYPTION_KEY: 'a-strong-encryption-key-that-is-longer-than-32-characters',
  };
}

function authHeaders(extra = {}) {
  return {
    Authorization: 'Bearer 0123456789abcdef0123456789abcdef',
    'X-Mobdea-Workspace': 'school_one',
    Origin: 'https://app.example.com',
    ...extra,
  };
}

test('worker rejects unauthenticated access and disallowed preflight origins', async () => {
  const env = makeEnv();
  const unauthorized = await worker.fetch(new Request('https://sync.example.com/health'), env);
  assert.equal(unauthorized.status, 401);
  const preflight = await worker.fetch(new Request('https://sync.example.com/sync', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), env);
  assert.equal(preflight.status, 403);
  const allowedPreflight = await worker.fetch(new Request('https://sync.example.com/live/rooms/example01/participants/student01', {
    method: 'OPTIONS',
    headers: { Origin: 'https://app.example.com' },
  }), env);
  assert.equal(allowedPreflight.status, 204);
  assert.match(allowedPreflight.headers.get('Access-Control-Allow-Methods') || '', /PATCH/);
});

test('worker encrypts workspace data and prevents stale revision overwrite', async () => {
  const env = makeEnv();
  const payload = {
    schemaVersion: 9,
    appVersion: '9.2.0',
    workspaceId: 'school_one',
    data: { students: [{ id: 1, name: 'طالب سري' }], sessions: [], settings: {} },
  };
  const first = await worker.fetch(new Request('https://sync.example.com/sync', {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.1' }),
    body: JSON.stringify(payload),
  }), env);
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  const stored = await env.MOBDEA_DATA.get('workspace:school_one');
  assert.equal(stored.includes('طالب سري'), false);

  const conflict = await worker.fetch(new Request('https://sync.example.com/sync', {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json', 'If-Match': 'stale-revision', 'CF-Connecting-IP': '10.0.0.2' }),
    body: JSON.stringify(payload),
  }), env);
  assert.equal(conflict.status, 409);

  const read = await worker.fetch(new Request('https://sync.example.com/sync', { headers: authHeaders({ 'CF-Connecting-IP': '10.0.0.3' }) }), env);
  assert.equal(read.status, 200);
  const readBody = await read.json();
  assert.equal(readBody.revision, firstBody.revision);
  assert.equal(readBody.data.students[0].name, 'طالب سري');
});

test('remote shares are encrypted, expiring and readable without workspace token', async () => {
  const env = makeEnv();
  const created = await worker.fetch(new Request('https://sync.example.com/share', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.4' }),
    body: JSON.stringify({ kind: 'lesson', payload: { title: 'درس خاص' }, expiresInSeconds: 3600 }),
  }), env);
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  const stored = await env.MOBDEA_DATA.get(`share:school_one:${createdBody.token}`);
  assert.equal(stored.includes('درس خاص'), false);

  const read = await worker.fetch(new Request(`https://sync.example.com/share/${createdBody.token}?workspace=school_one`, { headers: { 'CF-Connecting-IP': '10.0.0.5' } }), env);
  assert.equal(read.status, 200);
  assert.deepEqual(await read.json(), { kind: 'lesson', payload: { title: 'درس خاص' }, expiresAt: createdBody.expiresAt });
});


test('worker encrypts cloud assets and verifies their SHA-256 before download', async () => {
  const env = makeEnv();
  const bytes = new TextEncoder().encode('ملف تعليمي سري');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const headers = authHeaders({
    'Content-Type': 'text/plain;charset=utf-8',
    'X-Mobdea-Asset-Name': encodeURIComponent('درس.txt'),
    'X-Mobdea-Asset-Kind': 'resource',
    'X-Mobdea-Asset-Sha256': hash,
    'X-Mobdea-Asset-Size': String(bytes.byteLength),
    'CF-Connecting-IP': '10.0.0.6',
  });
  const uploaded = await worker.fetch(new Request('https://sync.example.com/assets/asset-1', { method: 'PUT', headers, body: bytes }), env);
  assert.equal(uploaded.status, 200);
  const stored = env.MOBDEA_ASSETS.values.get('workspace/school_one/asset-1');
  assert.equal(new TextDecoder().decode(stored.bytes).includes('ملف تعليمي سري'), false);

  const head = await worker.fetch(new Request('https://sync.example.com/assets/asset-1', { method: 'HEAD', headers: authHeaders({ 'CF-Connecting-IP': '10.0.0.7' }) }), env);
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('X-Mobdea-Asset-Sha256'), hash);

  const downloaded = await worker.fetch(new Request('https://sync.example.com/assets/asset-1', { headers: authHeaders({ 'CF-Connecting-IP': '10.0.0.8' }) }), env);
  assert.equal(downloaded.status, 200);
  assert.equal(await downloaded.text(), 'ملف تعليمي سري');
});

test('asset status is batched and successful sync removes orphaned remote assets', async () => {
  const env = makeEnv();
  const upload = async (id, text, ip) => {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const response = await worker.fetch(new Request(`https://sync.example.com/assets/${id}`, {
      method: 'PUT',
      headers: authHeaders({
        'Content-Type': 'text/plain',
        'X-Mobdea-Asset-Name': encodeURIComponent(`${id}.txt`),
        'X-Mobdea-Asset-Kind': 'resource',
        'X-Mobdea-Asset-Sha256': hash,
        'X-Mobdea-Asset-Size': String(bytes.byteLength),
        'CF-Connecting-IP': ip,
      }),
      body: bytes,
    }), env);
    assert.equal(response.status, 200);
    return { id, sha256: hash, size: bytes.byteLength, name: `${id}.txt`, type: 'text/plain', kind: 'resource' };
  };

  const keep = await upload('asset-keep', 'keep', '10.0.1.1');
  await upload('asset-orphan', 'orphan', '10.0.1.2');

  const status = await worker.fetch(new Request('https://sync.example.com/assets/status', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.1.3' }),
    body: JSON.stringify({ ids: ['asset-keep', 'asset-orphan', 'asset-missing'] }),
  }), env);
  assert.equal(status.status, 200);
  const hashes = await status.json();
  assert.equal(hashes.assets['asset-keep'], keep.sha256);
  assert.equal(hashes.assets['asset-missing'], undefined);

  const synced = await worker.fetch(new Request('https://sync.example.com/sync', {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.1.4' }),
    body: JSON.stringify({
      schemaVersion: 9,
      appVersion: '9.2.0',
      workspaceId: 'school_one',
      assetManifest: [keep],
      data: { students: [], sessions: [], settings: {} },
    }),
  }), env);
  assert.equal(synced.status, 200);
  assert.equal(env.MOBDEA_ASSETS.values.has('workspace/school_one/asset-keep'), true);
  assert.equal(env.MOBDEA_ASSETS.values.has('workspace/school_one/asset-orphan'), false);
});

test('live classroom supports student join, microphone approval and encrypted signaling', async () => {
  const env = makeEnv();
  const created = await worker.fetch(new Request('https://sync.example.com/live/rooms', {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '10.0.2.1',
    }),
    body: JSON.stringify({ title: 'حصة التاريخ', grade: 'الصف السادس', lesson: 'مصر القديمة' }),
  }), env);
  assert.equal(created.status, 201);
  const room = await created.json();
  assert.match(room.roomId, /^[a-zA-Z0-9_-]{8,80}$/);
  assert.match(room.joinCode, /^\d{6}$/);

  const storedRoom = await env.MOBDEA_DATA.get(`live-room:school_one:${room.roomId}`);
  assert.equal(storedRoom.includes('حصة التاريخ'), false);
  assert.equal(storedRoom.includes(room.teacherToken), false);

  const joined = await worker.fetch(new Request(`https://sync.example.com/live/rooms/${room.roomId}/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Mobdea-Workspace': 'school_one',
      Origin: 'https://app.example.com',
      'CF-Connecting-IP': '10.0.2.2',
    },
    body: JSON.stringify({ joinCode: room.joinCode, name: 'أحمد محمد', studentCode: '25' }),
  }), env);
  assert.equal(joined.status, 201);
  const student = await joined.json();

  const liveHeaders = (token, ip) => ({
    'Content-Type': 'application/json',
    'X-Mobdea-Workspace': 'school_one',
    'X-Mobdea-Live-Token': token,
    Origin: 'https://app.example.com',
    'CF-Connecting-IP': ip,
  });

  const micRequest = await worker.fetch(new Request(`https://sync.example.com/live/rooms/${room.roomId}/events`, {
    method: 'POST',
    headers: liveHeaders(student.participantToken, '10.0.2.3'),
    body: JSON.stringify({ type: 'mic-request', targetId: 'teacher', data: { name: 'أحمد محمد' } }),
  }), env);
  assert.equal(micRequest.status, 201);

  const participantsResponse = await worker.fetch(new Request(`https://sync.example.com/live/rooms/${room.roomId}/participants`, {
    headers: liveHeaders(room.teacherToken, '10.0.2.4'),
  }), env);
  assert.equal(participantsResponse.status, 200);
  const participants = await participantsResponse.json();
  assert.equal(participants.participants[0].micState, 'requested');

  const approved = await worker.fetch(new Request(`https://sync.example.com/live/rooms/${room.roomId}/participants/${student.participantId}`, {
    method: 'PATCH',
    headers: liveHeaders(room.teacherToken, '10.0.2.5'),
    body: JSON.stringify({ micState: 'approved', muted: false }),
  }), env);
  assert.equal(approved.status, 200);

  const studentEvents = await worker.fetch(new Request(`https://sync.example.com/live/rooms/${room.roomId}/events?after=0`, {
    headers: liveHeaders(student.participantToken, '10.0.2.6'),
  }), env);
  assert.equal(studentEvents.status, 200);
  const eventBody = await studentEvents.json();
  assert.equal(eventBody.events.some((event) => event.type === 'mic-approved'), true);

  const micStarted = await worker.fetch(new Request(`https://sync.example.com/live/rooms/${room.roomId}/events`, {
    method: 'POST',
    headers: liveHeaders(student.participantToken, '10.0.2.7'),
    body: JSON.stringify({ type: 'mic-started', targetId: 'teacher', data: {} }),
  }), env);
  assert.equal(micStarted.status, 201);

  const speakingResponse = await worker.fetch(new Request(`https://sync.example.com/live/rooms/${room.roomId}/participants`, {
    headers: liveHeaders(room.teacherToken, '10.0.2.8'),
  }), env);
  const speaking = await speakingResponse.json();
  assert.equal(speaking.participants[0].micState, 'speaking');
  assert.equal(speaking.participants[0].muted, false);


  const gameReady = await worker.fetch(new Request(`https://sync.example.com/live/rooms/${room.roomId}/events`, {
    method: 'POST',
    headers: liveHeaders(student.participantToken, '10.0.2.9'),
    body: JSON.stringify({ type: 'game-ready', targetId: 'teacher', data: { name: 'أحمد محمد' } }),
  }), env);
  assert.equal(gameReady.status, 201);

  const gameAnswer = await worker.fetch(new Request(`https://sync.example.com/live/rooms/${room.roomId}/events`, {
    method: 'POST',
    headers: liveHeaders(student.participantToken, '10.0.2.10'),
    body: JSON.stringify({ type: 'game-answer', targetId: 'teacher', data: { questionId: 'q-1', choiceIndex: 1 } }),
  }), env);
  assert.equal(gameAnswer.status, 201);

  const forbiddenQuestion = await worker.fetch(new Request(`https://sync.example.com/live/rooms/${room.roomId}/events`, {
    method: 'POST',
    headers: liveHeaders(student.participantToken, '10.0.2.11'),
    body: JSON.stringify({ type: 'game-question', targetId: 'all', data: { question: {} } }),
  }), env);
  assert.equal(forbiddenQuestion.status, 403);

  const teacherEvents = await worker.fetch(new Request(`https://sync.example.com/live/rooms/${room.roomId}/events?after=0`, {
    headers: liveHeaders(room.teacherToken, '10.0.2.12'),
  }), env);
  const teacherEventBody = await teacherEvents.json();
  assert.equal(teacherEventBody.events.some((event) => event.type === 'game-answer'), true);
});
