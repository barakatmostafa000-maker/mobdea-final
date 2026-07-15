import { Preferences } from '@capacitor/preferences';
import { seedData } from '../data/seed';

const KEY = 'mobdea_mobile_v3';

const clone = (value) => JSON.parse(JSON.stringify(value));

function migrate(source) {
  const data = source || clone(seedData);
  return {
    ...clone(seedData),
    ...data,
    students: (data.students || []).map((student, index) => ({
      permissions: { games: true, grades: true, content: true },
      parentPermissions: { attendance: true, grades: true, dues: true },
      ...student,
      code: Number(student.code) || index + 1
    })),
    notifications: Array.isArray(data.notifications) ? data.notifications : [],
    customQuestionBank: Array.isArray(data.customQuestionBank) ? data.customQuestionBank : [],
    exams: Array.isArray(data.exams) && data.exams.length ? data.exams : clone(seedData.exams),
    detailedResults: Array.isArray(data.detailedResults) ? data.detailedResults : [],
    auditLog: Array.isArray(data.auditLog) ? data.auditLog : [],
    contentLibrary: Array.isArray(data.contentLibrary) ? data.contentLibrary : clone(seedData.contentLibrary),
    updateHistory: Array.isArray(data.updateHistory) ? data.updateHistory : [],
    settings: {
      ...clone(seedData.settings),
      ...(data.settings || {}),
      visibleModules: {
        ...clone(seedData.settings.visibleModules),
        ...(data.settings?.visibleModules || {})
      },
      update: { ...clone(seedData.settings.update), ...(data.settings?.update || {}) },
      cloudSync: {
        ...clone(seedData.settings.cloudSync),
        ...(data.settings?.cloudSync || {})
      }
    }
  };
}

export async function loadAppData() {
  try {
    const result = await Preferences.get({ key: KEY });
    if (result && result.value) {
      try { return migrate(JSON.parse(result.value)); } catch { /* fall through */ }
    }
  } catch { /* use local fallback */ }

  try {
    const local = window.localStorage ? window.localStorage.getItem(KEY) : null;
    if (local) {
      try { return migrate(JSON.parse(local)); } catch { /* reset damaged data */ }
    }
  } catch { /* storage can be blocked on old WebView */ }

  return migrate(clone(seedData));
}

export async function saveAppData(data) {
  const value = JSON.stringify(data);
  try {
    await Preferences.set({ key: KEY, value });
  } catch {
    localStorage.setItem(KEY, value);
  }
}

export async function resetAppData() {
  try {
    await Preferences.remove({ key: KEY });
  } catch {
    localStorage.removeItem(KEY);
  }
  return clone(seedData);
}
