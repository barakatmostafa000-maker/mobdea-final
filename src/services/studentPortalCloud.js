import { buildCloudUrl, timeoutFetch } from './cloudTransport.js';
import { importAssetBlob } from './assetStore.js';
import { createCredentialSecret } from '../utils/security.js';
import { safeTrim } from '../utils/safety.js';
import { sha256Blob } from './incrementalSha256.js';

const STUDENT_TOKEN_HEADER = 'X-Mobdea-Student-Token';
const STUDENT_WORKSPACE_HEADER = 'X-Mobdea-Workspace';

function publicConfig(settings = {}) {
  const cloud = settings?.cloudSync || settings || {};
  const endpoint = String(cloud.endpoint || '').trim().replace(/\/$/, '');
  const workspaceId = safeTrim(cloud.workspaceId || '', 80).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!/^https:\/\//i.test(endpoint)) throw new Error('رابط خادم الطلاب غير مضبوط على هذا الجهاز.');
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(workspaceId)) throw new Error('مساحة العمل غير مضبوطة على هذا الجهاز.');
  return { endpoint, workspaceId };
}

async function readError(response, fallback) {
  try {
    const body = await response.json();
    if (body?.error === 'student_not_found' || body?.error === 'invalid_credentials') return 'كود الطالب أو PIN غير صحيح.';
    if (body?.error === 'student_not_active') return 'حساب الطالب غير مفعّل. تواصل مع المعلم.';
    if (body?.error === 'rate_limited') return 'محاولات كثيرة؛ انتظر قليلًا ثم أعد المحاولة.';
    if (body?.error === 'workspace_not_ready') return 'بيانات الطلاب لم تُرفع إلى المنصة السحابية بعد.';
    return body?.message || body?.error || fallback;
  } catch {
    return fallback;
  }
}

function authHeaders(config, token = '', extra = {}) {
  return {
    'Content-Type': 'application/json',
    [STUDENT_WORKSPACE_HEADER]: config.workspaceId,
    ...(token ? { [STUDENT_TOKEN_HEADER]: token } : {}),
    ...extra,
  };
}

function recordKey(record = {}) {
  const id = record.id ?? record.studentId ?? record.sessionId ?? record.roomId ?? record.token;
  return id == null ? JSON.stringify(record) : String(id);
}

function mergeRecords(local = [], remote = []) {
  const map = new Map();
  for (const item of Array.isArray(local) ? local : []) map.set(recordKey(item), item);
  for (const item of Array.isArray(remote) ? remote : []) map.set(recordKey(item), { ...(map.get(recordKey(item)) || {}), ...item });
  return [...map.values()];
}

export async function loginStudentFromCloud(settings, code, pin) {
  const config = publicConfig(settings);
  const response = await timeoutFetch(buildCloudUrl(config.endpoint, '/student/login'), {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify({ code: safeTrim(code, 24), pin: safeTrim(pin, 16) }),
  }, 25000);
  if (!response.ok) throw new Error(await readError(response, `تعذر دخول الطالب (${response.status}).`));
  const payload = await response.json();
  if (!payload?.student || !payload?.studentToken || !payload?.data) throw new Error('استجابة دخول الطالب غير مكتملة.');
  return { ...payload, endpoint: config.endpoint, workspaceId: config.workspaceId };
}

export async function refreshStudentPortalSnapshot(session = {}) {
  const config = publicConfig(session);
  const token = safeTrim(session.studentToken || session.token || '', 260);
  if (!token) throw new Error('جلسة الطالب غير موجودة. أعد تسجيل الدخول.');
  const response = await timeoutFetch(buildCloudUrl(config.endpoint, '/student/snapshot'), {
    method: 'GET',
    headers: authHeaders(config, token),
  }, 25000);
  if (!response.ok) throw new Error(await readError(response, `تعذر تحديث حساب الطالب (${response.status}).`));
  return response.json();
}

export async function fetchStudentAsset(session = {}, assetId = '') {
  const config = publicConfig(session);
  const token = safeTrim(session.studentToken || session.token || '', 260);
  const id = safeTrim(assetId, 100);
  if (!token || !id) throw new Error('بيانات تنزيل الملف غير مكتملة.');
  const response = await timeoutFetch(buildCloudUrl(config.endpoint, `/student/assets/${encodeURIComponent(id)}`), {
    method: 'GET',
    headers: authHeaders(config, token, { Accept: '*/*' }),
  }, 300000);
  if (!response.ok) throw new Error(await readError(response, `تعذر تنزيل الملف (${response.status}).`));
  const blob = await response.blob();
  const sha256 = safeTrim(response.headers.get('X-Mobdea-Asset-Sha256') || '', 64).toLowerCase();
  const size = Number(response.headers.get('X-Mobdea-Asset-Size') || response.headers.get('Content-Length') || 0);
  if (!/^[a-f0-9]{64}$/.test(sha256) || !Number.isSafeInteger(size) || size <= 0) {
    throw new Error('بيانات التحقق من ملف الطالب غير مكتملة. حدّث خادم المزامنة.');
  }
  if (blob.size !== size) throw new Error('حجم ملف الطالب لا يطابق النسخة المتزامنة.');
  if (await sha256Blob(blob) !== sha256) throw new Error('فشل التحقق من سلامة ملف الطالب.');
  let name = 'student-file';
  try { name = decodeURIComponent(response.headers.get('X-Mobdea-Asset-Name') || name); } catch { /* keep safe fallback */ }
  return {
    blob,
    metadata: {
      id,
      name: safeTrim(name, 180) || 'student-file',
      type: blob.type || response.headers.get('Content-Type') || 'application/octet-stream',
      kind: safeTrim(response.headers.get('X-Mobdea-Asset-Kind') || 'student-resource', 40),
      sha256,
      size,
    },
  };
}

export async function fetchStudentAssetBlob(session = {}, assetId = '') {
  return (await fetchStudentAsset(session, assetId)).blob;
}

export async function ensureStudentAssetLocal(session, asset = {}) {
  const id = safeTrim(asset?.id || asset?.assetId || '', 100);
  if (!id) return null;
  const downloaded = await fetchStudentAsset(session, id);
  const { blob } = downloaded;
  const expectedSize = Number(asset.size || 0);
  const expectedHash = safeTrim(asset.sha256 || '', 64).toLowerCase();
  if (expectedSize > 0 && blob.size !== expectedSize) throw new Error('حجم ملف الطالب لا يطابق النسخة المتزامنة.');
  if (expectedHash) {
    if (!/^[a-f0-9]{64}$/.test(expectedHash)) throw new Error('بصمة ملف الطالب غير صالحة.');
    if (await sha256Blob(blob) !== expectedHash) throw new Error('فشل التحقق من سلامة ملف الطالب.');
  }
  return importAssetBlob(blob, {
    ...downloaded.metadata,
    id,
    name: asset.name || asset.fileName || downloaded.metadata.name,
    type: asset.type || asset.mimeType || downloaded.metadata.type,
    kind: asset.kind || downloaded.metadata.kind || 'student-resource',
    sha256: expectedHash || downloaded.metadata.sha256,
    size: expectedSize || blob.size,
  });
}

export function mergeStudentPortalSnapshot(localData = {}, payload = {}, sessionOverride = null) {
  const snapshot = payload.data || payload || {};
  const cloudStudent = payload.student || snapshot.students?.[0];
  if (!cloudStudent) throw new Error('لم تُرجع المنصة بيانات الطالب.');
  const localStudents = Array.isArray(localData.students) ? localData.students : [];
  const existing = localStudents.find((item) => String(item.id) === String(cloudStudent.id) || String(item.code) === String(cloudStudent.code)) || {};
  const student = { ...existing, ...cloudStudent };
  const studentIndex = localStudents.findIndex((item) => String(item.id) === String(student.id) || String(item.code) === String(student.code));
  const students = studentIndex >= 0
    ? localStudents.map((item, index) => index === studentIndex ? student : item)
    : [...localStudents, student];
  const currentSession = sessionOverride || localData.settings?.studentPortalSession || {};
  const studentPortalSession = {
    ...currentSession,
    endpoint: payload.endpoint || currentSession.endpoint || localData.settings?.cloudSync?.endpoint || '',
    workspaceId: payload.workspaceId || currentSession.workspaceId || localData.settings?.cloudSync?.workspaceId || '',
    studentToken: payload.studentToken || currentSession.studentToken || '',
    expiresAt: payload.expiresAt || currentSession.expiresAt || '',
    studentId: student.id,
    studentCode: student.code,
    lastPullAt: new Date().toISOString(),
    lastError: '',
  };
  return {
    ...localData,
    students,
    attendance: mergeRecords(localData.attendance, snapshot.attendance),
    grades: mergeRecords(localData.grades, snapshot.grades),
    payments: mergeRecords(localData.payments, snapshot.payments),
    achievements: mergeRecords(localData.achievements, snapshot.achievements),
    gameResults: mergeRecords(localData.gameResults, snapshot.gameResults),
    mapResults: mergeRecords(localData.mapResults, snapshot.mapResults),
    contentLibrary: mergeRecords(localData.contentLibrary, snapshot.contentLibrary),
    lessonRecordings: mergeRecords(localData.lessonRecordings, snapshot.lessonRecordings),
    customQuestionBank: mergeRecords(localData.customQuestionBank, snapshot.customQuestionBank),
    settings: {
      ...localData.settings,
      ...(snapshot.settings || {}),
      cloudSync: {
        ...(localData.settings?.cloudSync || {}),
        endpoint: studentPortalSession.endpoint,
        workspaceId: studentPortalSession.workspaceId,
        publicAppUrl: snapshot.settings?.cloudSync?.publicAppUrl || localData.settings?.cloudSync?.publicAppUrl || '',
        token: localData.settings?.cloudSync?.token || '',
      },
      studentPortalSession,
    },
  };
}

export async function mergeStudentLoginSnapshot(localData = {}, payload = {}, pin = '') {
  const snapshot = payload.data || {};
  const cloudStudent = payload.student || snapshot.students?.[0];
  if (!cloudStudent) throw new Error('لم تُرجع المنصة بيانات الطالب.');
  const localSecret = await createCredentialSecret(pin, 'student');
  const preparedPayload = {
    ...payload,
    student: { ...cloudStudent, ...localSecret, studentPin: '' },
  };
  return mergeStudentPortalSnapshot(localData, preparedPayload, {
    endpoint: payload.endpoint,
    workspaceId: payload.workspaceId,
    studentToken: payload.studentToken,
    expiresAt: payload.expiresAt || '',
  });
}
