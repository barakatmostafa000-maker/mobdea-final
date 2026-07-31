import {
  buildCloudUrl,
  cloudHeaders,
  timeoutFetch,
  validateCloudConfig,
} from './cloudSync';
import { encodeSharePayload } from '../utils/shareCodec';
import { safeTrim } from '../utils/safety';

const LIVE_TOKEN_HEADER = 'X-Mobdea-Live-Token';
const LIVE_WORKSPACE_HEADER = 'X-Mobdea-Workspace';
const LIVE_CLIENT_HEADER = 'X-Mobdea-Client';
const MAX_EVENT_BYTES = 180_000;
const DEFAULT_POLL_MS = 1400;

function readErrorBody(response, fallback) {
  return response.json()
    .then((body) => body?.message || body?.error || fallback)
    .catch(() => fallback);
}

function publicConfig(configLike = {}) {
  const endpoint = String(configLike.endpoint || '').replace(/\/$/, '');
  const workspaceId = safeTrim(configLike.workspaceId || '', 80)
    .replace(/[^a-zA-Z0-9_-]/g, '');
  if (!/^https:\/\//i.test(endpoint)) {
    throw new Error('رابط خادم الحصة الأونلاين يجب أن يبدأ بـ HTTPS.');
  }
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(workspaceId)) {
    throw new Error('مساحة العمل غير صالحة للحصة الأونلاين.');
  }
  return { endpoint, workspaceId };
}

function liveHeaders(config, token = '', extra = {}) {
  return {
    'Content-Type': 'application/json',
    [LIVE_WORKSPACE_HEADER]: config.workspaceId,
    [LIVE_CLIENT_HEADER]: 'mobdea-live/1',
    ...(token ? { [LIVE_TOKEN_HEADER]: token } : {}),
    ...extra,
  };
}

function bodySize(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function liveClassSupported() {
  return Boolean(
    globalThis.RTCPeerConnection
      && globalThis.navigator?.mediaDevices
      && globalThis.isSecureContext,
  );
}

export function buildLiveStudentLink(payload, path = globalThis.location?.pathname || '/') {
  const base = new URL(globalThis.location?.href || 'https://localhost/');
  base.pathname = path;
  base.search = '';
  base.hash = '';
  base.searchParams.set('shareKind', 'live');
  base.searchParams.set('shareData', encodeSharePayload(payload));
  return base.toString();
}

export async function createLiveRoom(settings, metadata = {}) {
  const config = validateCloudConfig(settings);
  const response = await timeoutFetch(buildCloudUrl(config.endpoint, '/live/rooms'), {
    method: 'POST',
    headers: cloudHeaders(config),
    body: JSON.stringify({
      title: safeTrim(metadata.title || 'حصة مباشرة', 140),
      grade: safeTrim(metadata.grade || '', 80),
      lesson: safeTrim(metadata.lesson || '', 140),
      sessionId: metadata.sessionId ?? null,
      lessonId: metadata.lessonId ?? null,
      ttlSeconds: Number(metadata.ttlSeconds || 6 * 60 * 60),
    }),
  }, 20000);
  if (!response.ok) {
    throw new Error(await readErrorBody(response, `تعذر إنشاء الحصة المباشرة (${response.status}).`));
  }
  return { ...(await response.json()), endpoint: config.endpoint, workspaceId: config.workspaceId };
}

export async function joinLiveRoom(configLike, roomId, joinCode, profile = {}) {
  const config = publicConfig(configLike);
  const response = await timeoutFetch(
    buildCloudUrl(config.endpoint, `/live/rooms/${encodeURIComponent(roomId)}/join`),
    {
      method: 'POST',
      headers: liveHeaders(config),
      body: JSON.stringify({
        joinCode: safeTrim(joinCode || '', 20),
        name: safeTrim(profile.name || '', 100),
        studentCode: safeTrim(profile.studentCode || '', 40),
      }),
    },
    20000,
  );
  if (!response.ok) {
    throw new Error(await readErrorBody(response, `تعذر دخول الحصة (${response.status}).`));
  }
  return { ...(await response.json()), ...config };
}

export async function postLiveEvent(configLike, roomId, token, event) {
  const config = publicConfig(configLike);
  const payload = {
    type: safeTrim(event?.type || '', 40),
    targetId: safeTrim(event?.targetId || '', 100),
    data: event?.data && typeof event.data === 'object' ? event.data : {},
    clientEventId: safeTrim(event?.clientEventId || '', 120),
  };
  if (!payload.type) throw new Error('نوع حدث الحصة غير صالح.');
  if (bodySize(payload) > MAX_EVENT_BYTES) throw new Error('بيانات الحدث أكبر من المسموح.');
  const response = await timeoutFetch(
    buildCloudUrl(config.endpoint, `/live/rooms/${encodeURIComponent(roomId)}/events`),
    {
      method: 'POST',
      headers: liveHeaders(config, token),
      body: JSON.stringify(payload),
    },
    15000,
  );
  if (!response.ok) {
    throw new Error(await readErrorBody(response, `تعذر إرسال حدث الحصة (${response.status}).`));
  }
  return response.json();
}

export async function fetchLiveEvents(configLike, roomId, token, after = 0) {
  const config = publicConfig(configLike);
  const url = new URL(buildCloudUrl(config.endpoint, `/live/rooms/${encodeURIComponent(roomId)}/events`));
  url.searchParams.set('after', String(Math.max(0, Number(after || 0))));
  const response = await timeoutFetch(url.toString(), {
    method: 'GET',
    headers: liveHeaders(config, token, { Accept: 'application/json' }),
  }, 15000);
  if (!response.ok) {
    throw new Error(await readErrorBody(response, `تعذر استقبال أحداث الحصة (${response.status}).`));
  }
  return response.json();
}

export async function listLiveParticipants(configLike, roomId, teacherToken) {
  const config = publicConfig(configLike);
  const response = await timeoutFetch(
    buildCloudUrl(config.endpoint, `/live/rooms/${encodeURIComponent(roomId)}/participants`),
    {
      method: 'GET',
      headers: liveHeaders(config, teacherToken, { Accept: 'application/json' }),
    },
    15000,
  );
  if (!response.ok) {
    throw new Error(await readErrorBody(response, `تعذر قراءة قائمة الطلاب (${response.status}).`));
  }
  return response.json();
}

export async function updateLiveParticipant(
  configLike,
  roomId,
  teacherToken,
  participantId,
  patch,
) {
  const config = publicConfig(configLike);
  const response = await timeoutFetch(
    buildCloudUrl(
      config.endpoint,
      `/live/rooms/${encodeURIComponent(roomId)}/participants/${encodeURIComponent(participantId)}`,
    ),
    {
      method: 'PATCH',
      headers: liveHeaders(config, teacherToken),
      body: JSON.stringify({
        micState: safeTrim(patch?.micState || '', 30),
        muted: patch?.muted === true,
        removed: patch?.removed === true,
      }),
    },
    15000,
  );
  if (!response.ok) {
    throw new Error(await readErrorBody(response, `تعذر تحديث الطالب (${response.status}).`));
  }
  return response.json();
}

export async function closeLiveRoom(configLike, roomId, teacherToken) {
  const config = publicConfig(configLike);
  const response = await timeoutFetch(
    buildCloudUrl(config.endpoint, `/live/rooms/${encodeURIComponent(roomId)}`),
    {
      method: 'DELETE',
      headers: liveHeaders(config, teacherToken),
    },
    15000,
  );
  if (!response.ok) {
    throw new Error(await readErrorBody(response, `تعذر إنهاء الحصة (${response.status}).`));
  }
  return response.json();
}

export function createLivePoller({
  poll,
  onData,
  onError,
  intervalMs = DEFAULT_POLL_MS,
}) {
  let stopped = false;
  let timer = null;
  let running = false;

  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const data = await poll();
      if (!stopped) onData?.(data);
    } catch (error) {
      if (!stopped) onError?.(error);
    } finally {
      running = false;
      if (!stopped) timer = setTimeout(tick, intervalMs);
    }
  };

  void tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

export function defaultIceServers() {
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
}
