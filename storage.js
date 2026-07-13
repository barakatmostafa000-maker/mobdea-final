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
    exams: Array.isArray(data.exams) && data.exams.length ? data.exams : clone(seedData.exams),
    detailedResults: Array.isArray(data.detailedResults) ? data.detailedResults : [],
    auditLog: Array.isArray(data.auditLog) ? data.auditLog : [],
    settings: {
      ...clone(seedData.settings),
      ...(data.settings || {}),
      visibleModules: {
        ...clone(seedData.settings.visibleModules),
        ...(data.settings?.visibleModules || {})
      },
      cloudSync: {
        ...clone(seedData.settings.cloudSync),
        ...(data.settings?.cloudSync || {})
      }
    }
  };
}

export async function loadAppData() {
  try {
    const { value } = await Preferences.get({ key: KEY });
    return migrate(value ? JSON.parse(value) : clone(seedData));
  } catch {
    const local = localStorage.getItem(KEY);
    return migrate(local ? JSON.parse(local) : clone(seedData));
  }
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
