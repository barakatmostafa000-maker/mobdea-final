// PROJECT11_CROSS_DEVICE_CLASS_SYNC_V1

const DEVICE_KEY = 'mobdea_project11_device_id_v1';
const VALID_CONTENT_MODES = new Set(['board', 'pdf', 'images', 'videos', 'audio', 'slides', 'files', 'maps', 'games']);

function safeString(value, max = 180) {
  return String(value ?? '').trim().slice(0, max);
}

function compactPoint(point = {}) {
  return {
    x: Number(point.x || 0),
    y: Number(point.y || 0),
    ...(Number.isFinite(Number(point.pressure)) ? { pressure: Number(point.pressure) } : {}),
    ...(Number.isFinite(Number(point.t)) ? { t: Number(point.t) } : {}),
  };
}

function samplePoints(points = [], limit = 650) {
  if (!Array.isArray(points) || points.length <= limit) return (points || []).map(compactPoint);
  const output = [];
  const step = (points.length - 1) / (limit - 1);
  for (let index = 0; index < limit; index += 1) {
    output.push(compactPoint(points[Math.round(index * step)]));
  }
  return output;
}

export function compactBoardActions(actions = [], limit = 300) {
  return (Array.isArray(actions) ? actions.slice(-limit) : []).map((action) => {
    if (!action || typeof action !== 'object') return action;
    if (action.kind !== 'stroke') return { ...action };
    return { ...action, points: samplePoints(action.points || []) };
  });
}

export function sanitizePoints(points = {}) {
  return Object.fromEntries(
    Object.entries(points && typeof points === 'object' ? points : {})
      .slice(0, 500)
      .map(([id, value]) => [String(id), Math.max(0, Number(value || 0))]),
  );
}

export function project11DeviceId() {
  try {
    let value = globalThis.localStorage?.getItem(DEVICE_KEY) || '';
    if (value) return value;
    value = globalThis.crypto?.randomUUID?.()
      || `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    globalThis.localStorage?.setItem(DEVICE_KEY, value);
    return value;
  } catch {
    return `memory-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export function buildProject11ClassState(input = {}, deviceId = '') {
  const mode = VALID_CONTENT_MODES.has(input.contentMode) ? input.contentMode : 'board';
  return {
    kind: 'mobdea-class-sync-v1',
    sourceDeviceId: safeString(deviceId || input.sourceDeviceId, 120),
    sessionId: safeString(input.sessionId, 120),
    group: safeString(input.group, 120),
    grade: safeString(input.grade, 120),
    lessonId: safeString(input.lessonId, 120),
    resourceId: safeString(input.resourceId, 160),
    contentMode: mode,
    page: Math.max(1, Math.floor(Number(input.page || 1))),
    boardTemplate: safeString(input.boardTemplate || 'history', 50),
    selectedStudentId: safeString(input.selectedStudentId, 120),
    boardActions: compactBoardActions(input.boardActions),
    points: sanitizePoints(input.points),
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
}

export function project11ClassFingerprint(state = {}) {
  return JSON.stringify({
    sessionId: state.sessionId || '',
    group: state.group || '',
    grade: state.grade || '',
    lessonId: state.lessonId || '',
    resourceId: state.resourceId || '',
    contentMode: state.contentMode || 'board',
    page: Number(state.page || 1),
    boardTemplate: state.boardTemplate || 'history',
    selectedStudentId: state.selectedStudentId || '',
    boardActions: state.boardActions || [],
    points: state.points || {},
  });
}

export function shouldApplyProject11State(remote = {}, options = {}) {
  if (!remote || remote.kind !== 'mobdea-class-sync-v1') return false;
  if (!remote.sessionId || String(remote.sessionId) !== String(options.sessionId || '')) return false;
  if (remote.sourceDeviceId && String(remote.sourceDeviceId) === String(options.deviceId || '')) return false;
  const updated = Date.parse(remote.updatedAt || '');
  if (!Number.isFinite(updated)) return false;
  const maxAgeMs = Number(options.maxAgeMs || 6 * 60 * 60 * 1000);
  if (Date.now() - updated > maxAgeMs) return false;
  if (updated <= Number(options.lastAppliedAt || 0)) return false;
  return true;
}
