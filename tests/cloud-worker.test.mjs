import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloud-worker/worker.js';
import { createCredentialSecret } from '../src/utils/security.js';

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

  const left = await worker.fetch(new Request(`https://sync.example.com/live/rooms/${room.roomId}/events`, {
    method: 'POST',
    headers: liveHeaders(student.participantToken, '10.0.2.13'),
    body: JSON.stringify({ type: 'participant-left', targetId: 'teacher', data: { name: 'أحمد محمد' } }),
  }), env);
  assert.equal(left.status, 201);

  const offlineResponse = await worker.fetch(new Request(`https://sync.example.com/live/rooms/${room.roomId}/participants`, {
    headers: liveHeaders(room.teacherToken, '10.0.2.14'),
  }), env);
  const offline = await offlineResponse.json();
  assert.equal(offline.participants[0].status, 'offline');
  assert.equal(offline.participants[0].online, false);

  const reconnected = await worker.fetch(new Request(`https://sync.example.com/live/rooms/${room.roomId}/events`, {
    method: 'POST',
    headers: liveHeaders(student.participantToken, '10.0.2.15'),
    body: JSON.stringify({ type: 'student-ready', targetId: 'teacher', data: { name: 'أحمد محمد', reconnect: true } }),
  }), env);
  assert.equal(reconnected.status, 201);

  const onlineAgainResponse = await worker.fetch(new Request(`https://sync.example.com/live/rooms/${room.roomId}/participants`, {
    headers: liveHeaders(room.teacherToken, '10.0.2.16'),
  }), env);
  const onlineAgain = await onlineAgainResponse.json();
  assert.equal(onlineAgain.participants[0].status, 'online');
  assert.equal(onlineAgain.participants[0].online, true);
});

test('game preflight accepts native app and exposes game token header', async () => {
  const env = makeEnv();
  const preflight = await worker.fetch(new Request('https://sync.example.com/game/rooms/join', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost',
      'Access-Control-Request-Headers': 'content-type,x-mobdea-workspace,x-mobdea-game-token',
      'Access-Control-Request-Method': 'POST',
    },
  }), env);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'http://localhost');
  assert.match(preflight.headers.get('Access-Control-Allow-Headers') || '', /X-Mobdea-Game-Token/i);
});

test('sync rejects duplicate positive student codes at the server boundary', async () => {
  const env = makeEnv();
  const response = await worker.fetch(new Request('https://sync.example.com/sync', {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.3.1' }),
    body: JSON.stringify({
      schemaVersion: 10,
      appVersion: '10.6.0',
      workspaceId: 'school_one',
      data: {
        students: [
          { id: 1, code: 15, name: 'أحمد' },
          { id: 2, code: 15, name: 'سارة' },
        ],
        sessions: [],
        settings: {},
      },
    }),
  }), env);
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error, 'invalid_payload');
});

test('game room can be created, joined publicly and read with participant token', async () => {
  const env = makeEnv();
  const createdResponse = await worker.fetch(new Request('https://sync.example.com/game/rooms', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.4.1' }),
    body: JSON.stringify({
      title: 'تحدي خرائط مصر',
      teacherName: 'المبدع مصطفى بركات',
      mode: 'map-challenge',
      maxParticipants: 20,
    }),
  }), env);
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.ok(created.room?.roomId);
  assert.match(created.joinCode, /^\d{6}$/);
  assert.ok(created.teacherToken);

  const joinedResponse = await worker.fetch(new Request('https://sync.example.com/game/rooms/join', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Mobdea-Workspace': 'school_one',
      Origin: 'http://localhost',
      'CF-Connecting-IP': '10.0.4.2',
    },
    body: JSON.stringify({
      joinCode: created.joinCode,
      displayName: 'أحمد محمد',
      studentId: '25',
    }),
  }), env);
  assert.equal(joinedResponse.status, 201);
  const joined = await joinedResponse.json();
  assert.equal(joined.roomId, created.room.roomId);
  assert.equal(joined.participantId, joined.participant.participantId);
  assert.ok(joined.participantToken);

  const stateResponse = await worker.fetch(new Request(`https://sync.example.com/game/rooms/${created.room.roomId}/state`, {
    headers: {
      'X-Mobdea-Workspace': 'school_one',
      'X-Mobdea-Game-Token': joined.participantToken,
      Origin: 'http://localhost',
      'CF-Connecting-IP': '10.0.4.3',
    },
  }), env);
  assert.equal(stateResponse.status, 200);
  const state = await stateResponse.json();
  assert.equal(state.participant.displayName, 'أحمد محمد');
  assert.equal(state.room.title, 'تحدي خرائط مصر');
});

test('student can log in from a fresh device and receives only their synchronized portal data', async () => {
  const env = makeEnv();
  const pinSecret = await createCredentialSecret('123456', 'student');
  const payload = {
    schemaVersion: 9,
    appVersion: '10.8.0',
    workspaceId: 'school_one',
    data: {
      sessions: [],
      students: [
        { id: 101, code: 7001, name: 'أحمد محمد', grade: 'الصف السادس', group: 'أ', points: 47, active: true, ...pinSecret },
        { id: 102, code: 7002, name: 'سارة إيهاب', grade: 'الصف الخامس', group: 'ب', active: true, ...await createCredentialSecret('654321', 'student') },
      ],
      grades: [
        { id: 'g1', studentId: 101, score: 18 },
        { id: 'g2', studentId: 102, score: 20 },
      ],
      attendance: [
        { id: 'a1', studentId: 101, date: '2026-08-08', status: 'present' },
        { id: 'a2', studentId: 102, date: '2026-08-08', status: 'absent' },
      ],
      payments: [
        { id: 'p1', studentId: 101, amount: 100 },
        { id: 'p2', studentId: 102, amount: 80 },
      ],
      lessonRecordings: [
        { id: 'r1', grade: 'الصف السادس', group: 'أ', visibleToStudents: true, studentIds: [101], videoAssetId: 'recording-asset', title: 'حصة الحضارة' },
        { id: 'r2', grade: 'الصف الخامس', group: 'ب', visibleToStudents: true, studentIds: [102], title: 'حصة أخرى' },
        { id: 'r3', grade: 'الصف السادس', group: 'أ', visibleToStudents: true, studentIds: [102], title: 'تسجيل موجه لطالب آخر في نفس الصف والمجموعة' },
      ],
      contentLibrary: [
        { id: 'book-6', grade: 'الصف السادس', title: 'كتاب الصف السادس', assetId: 'book-asset' },
        { id: 'book-5', grade: 'الصف الخامس', title: 'كتاب الصف الخامس' },
      ],
      settings: { cloudSync: { publicAppUrl: 'https://students.example.com/' } },
    },
  };
  const synced = await worker.fetch(new Request('https://sync.example.com/sync', {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.5.1' }),
    body: JSON.stringify(payload),
  }), env);
  assert.equal(synced.status, 200);

  const login = await worker.fetch(new Request('https://sync.example.com/student/login', {
    method: 'POST',
    headers: {
      Origin: 'https://app.example.com',
      'X-Mobdea-Workspace': 'school_one',
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '10.0.5.2',
    },
    body: JSON.stringify({ code: '٧٠٠١', pin: '١٢٣٤٥٦' }),
  }), env);
  assert.equal(login.status, 200);
  const logged = await login.json();
  assert.equal(logged.student.id, 101);
  assert.equal(logged.student.points, 47);
  assert.equal(logged.data.students.length, 1);
  assert.deepEqual(logged.data.grades.map((item) => item.id), ['g1']);
  assert.deepEqual(logged.data.attendance.map((item) => item.id), ['a1']);
  assert.deepEqual(logged.data.payments.map((item) => item.id), ['p1']);
  assert.deepEqual(logged.data.lessonRecordings.map((item) => item.id), ['r1']);
  assert.deepEqual(logged.data.contentLibrary.map((item) => item.id), ['book-6']);
  assert.equal(logged.data.settings.cloudSync.publicAppUrl, 'https://students.example.com/');

  const snapshot = await worker.fetch(new Request('https://sync.example.com/student/snapshot', {
    headers: {
      Origin: 'https://app.example.com',
      'X-Mobdea-Workspace': 'school_one',
      'X-Mobdea-Student-Token': logged.studentToken,
      'CF-Connecting-IP': '10.0.5.3',
    },
  }), env);
  assert.equal(snapshot.status, 200);
  assert.equal((await snapshot.json()).student.code, 7001);

  const wrongPin = await worker.fetch(new Request('https://sync.example.com/student/login', {
    method: 'POST',
    headers: {
      Origin: 'https://app.example.com',
      'X-Mobdea-Workspace': 'school_one',
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '10.0.5.4',
    },
    body: JSON.stringify({ code: '7001', pin: '000000' }),
  }), env);
  assert.equal(wrongPin.status, 401);
});
