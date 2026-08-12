const RECORD_ARRAYS = [
  'students',
  'sessions',
  'attendance',
  'grades',
  'detailedResults',
  'payments',
  'notifications',
  'achievements',
  'contentLibrary',
  'libraryLessons',
  'lessonRecordings',
  'gameResults',
  'mapResults',
  'messages',
  'questionBanks',
  'onlineGameResults',
];

function clone(value) {
  if (globalThis.structuredClone) return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function recordKey(record, index = 0) {
  if (!record || typeof record !== 'object') return `index:${index}`;
  const id = record.id ?? record.studentId ?? record.sessionId ?? record.roomId;
  if (id !== undefined && id !== null && String(id)) return `id:${String(id)}`;
  const createdAt = record.createdAt || record.date || '';
  return `fallback:${String(createdAt)}:${String(record.name || record.title || '')}:${index}`;
}

function timestamp(record) {
  const raw = record?.updatedAt || record?.modifiedAt || record?.createdAt || record?.date || '';
  const value = Date.parse(raw);
  return Number.isFinite(value) ? value : 0;
}

function richerRecord(left, right) {
  if (!left) return right;
  if (!right) return left;
  const leftTime = timestamp(left);
  const rightTime = timestamp(right);
  // The local candidate is merged second. On equal/missing timestamps, keep it
  // so a freshly entered tablet/mobile record is not silently replaced by a
  // legacy cloud record that has no updatedAt field.
  const newest = rightTime >= leftTime ? right : left;
  const older = newest === right ? left : right;
  return { ...older, ...newest };
}

export function mergeRecordArrays(localValue, remoteValue, limit = 5000) {
  const merged = new Map();
  safeArray(remoteValue).forEach((item, index) => merged.set(recordKey(item, index), clone(item)));
  safeArray(localValue).forEach((item, index) => {
    const key = recordKey(item, index);
    merged.set(key, richerRecord(merged.get(key), clone(item)));
  });
  return [...merged.values()]
    .sort((a, b) => timestamp(b) - timestamp(a))
    .slice(0, limit);
}

function normalizedStudentCode(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

function normalizedStudentName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ar');
}

function sameStudent(left, right) {
  if (!left || !right) return false;
  if (String(left.id || '') && String(left.id) === String(right.id || '')) return true;
  const leftName = normalizedStudentName(left.name);
  const rightName = normalizedStudentName(right.name);
  if (!leftName || leftName !== rightName) return false;
  return String(left.grade || '').trim() === String(right.grade || '').trim()
    && String(left.group || '').trim() === String(right.group || '').trim();
}

export function normalizeStudentCodes(students = []) {
  const source = safeArray(students).map((student) => ({ ...student }));
  const used = new Set();
  let next = Math.max(0, ...source.map((student) => normalizedStudentCode(student.code))) + 1;

  return source.map((student) => {
    let code = normalizedStudentCode(student.code);
    if (!code || used.has(code)) {
      while (used.has(next)) next += 1;
      code = next;
      next += 1;
    }
    used.add(code);
    return { ...student, code };
  });
}

export function mergeStudents(localStudents, remoteStudents) {
  const result = [];
  const candidates = [...safeArray(remoteStudents), ...safeArray(localStudents)];
  for (const student of candidates) {
    const existingIndex = result.findIndex((item) => sameStudent(item, student));
    if (existingIndex < 0) {
      result.push(clone(student));
      continue;
    }
    result[existingIndex] = richerRecord(result[existingIndex], clone(student));
  }
  return normalizeStudentCodes(result);
}

function mergeSettings(localSettings = {}, remoteSettings = {}) {
  const localCloud = localSettings.cloudSync || {};
  const remoteCloud = remoteSettings.cloudSync || {};
  return {
    ...remoteSettings,
    ...localSettings,
    cloudSync: {
      ...remoteCloud,
      ...localCloud,
      // Secrets and the device-selected endpoint never come from the cloud copy.
      endpoint: localCloud.endpoint || remoteCloud.endpoint || '',
      workspaceId: localCloud.workspaceId || remoteCloud.workspaceId || '',
      token: localCloud.token || '',
    },
  };
}

export function mergeAppData(localData = {}, remoteData = {}) {
  const local = localData && typeof localData === 'object' ? localData : {};
  const remote = remoteData && typeof remoteData === 'object' ? remoteData : {};
  const merged = { ...remote, ...local };

  for (const key of RECORD_ARRAYS) {
    if (key === 'students') continue;
    if (key in local || key in remote) merged[key] = mergeRecordArrays(local[key], remote[key]);
  }
  merged.students = mergeStudents(local.students, remote.students);
  merged.settings = mergeSettings(local.settings, remote.settings);
  return merged;
}

export function hasDuplicateStudentCodes(students = []) {
  const seen = new Set();
  return safeArray(students).some((student) => {
    const code = normalizedStudentCode(student.code);
    if (!code) return false;
    if (seen.has(code)) return true;
    seen.add(code);
    return false;
  });
}
