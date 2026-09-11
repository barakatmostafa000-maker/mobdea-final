// PROJECT12_STUDENT_CLOUD_PORTAL_V1
import { buildCloudUrl, timeoutFetch } from './cloudSync';

const WORKSPACE = 'X-Mobdea-Workspace';
const STUDENT_TOKEN = 'X-Mobdea-Student-Token';

function config(settings = {}) {
  const cloud = settings.cloudSync || settings;
  const endpoint = String(cloud.endpoint || '').replace(/\/$/, '');
  const workspaceId = String(cloud.workspaceId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!/^https:\/\//i.test(endpoint) || !/^[a-zA-Z0-9_-]{3,80}$/.test(workspaceId)) throw new Error('خادم منصة المُبدع غير مضبوط على هذا الجهاز.');
  return { endpoint, workspaceId };
}

async function parse(response, fallback) {
  if (response.ok) return response.json();
  let body = {};
  try { body = await response.json(); } catch {}
  const error = new Error(body.message || body.error || fallback);
  error.status = response.status;
  error.code = body.error || '';
  throw error;
}

export async function bootstrapTeacherCloud(settings, teacherPassword) {
  const current = config(settings);
  const response = await timeoutFetch(buildCloudUrl(current.endpoint, '/bootstrap/workspace'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [WORKSPACE]: current.workspaceId, 'X-Mobdea-Client': 'mobdea-bootstrap/12' },
    body: JSON.stringify({ workspaceId: current.workspaceId, teacherPassword: String(teacherPassword || '') }),
  }, 22000);
  const payload = await parse(response, 'تعذر تفعيل المزامنة تلقائيًا.');
  if (String(payload.token || '').length < 24) throw new Error('الخادم لم يُرجع رمز مزامنة صالحًا.');
  return { ...current, token: payload.token, revision: String(payload.revision || '') };
}

export async function loginStudentCloud(settings, studentCode, pin) {
  const current = config(settings);
  const response = await timeoutFetch(buildCloudUrl(current.endpoint, '/student/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [WORKSPACE]: current.workspaceId, 'X-Mobdea-Client': 'mobdea-student/12' },
    body: JSON.stringify({ studentCode: String(studentCode || ''), pin: String(pin || '') }),
  }, 22000);
  return { ...(await parse(response, 'تعذر تسجيل دخول الطالب من السحابة.')), ...current };
}

export async function refreshStudentCloud(settings, token) {
  const current = config(settings);
  const response = await timeoutFetch(buildCloudUrl(current.endpoint, '/student/refresh'), {
    headers: { Accept: 'application/json', [WORKSPACE]: current.workspaceId, [STUDENT_TOKEN]: String(token || ''), 'X-Mobdea-Client': 'mobdea-student/12' },
  }, 18000);
  return parse(response, 'تعذر تحديث بيانات الطالب.');
}

export async function changeStudentCloudPin(settings, token, newPin) {
  const current = config(settings);
  const response = await timeoutFetch(buildCloudUrl(current.endpoint, '/student/change-pin'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [WORKSPACE]: current.workspaceId, [STUDENT_TOKEN]: String(token || ''), 'X-Mobdea-Client': 'mobdea-student/12' },
    body: JSON.stringify({ newPin: String(newPin || '') }),
  }, 24000);
  return parse(response, 'تعذر تغيير الرقم السري.');
}
