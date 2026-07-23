import { Preferences } from '@capacitor/preferences';
import { seedData } from '../data/seed';
import { clampNumber, limitArray, normalizeHttpUrl, safeParseJson, safeTrim } from '../utils/safety';

const KEY = 'mobdea_mobile_v3';
const MAX_STUDENTS = 300;
const MAX_HISTORY = 300;
const MAX_LIBRARY = 200;
const MAX_PAYLOAD_BYTES = 2_500_000;

const clone = (value) => JSON.parse(JSON.stringify(value));

const normalizeSequence = (sequence) => {
  if (Array.isArray(sequence) && sequence.length) return sequence.filter(Boolean).slice(0, 10);
  if (typeof sequence === 'string') return sequence.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 10);
  return ['preview', 'board', 'practice'];
};

const normalizeTags = (tags) => {
  if (Array.isArray(tags)) return tags.filter(Boolean).map((tag) => safeTrim(tag, 40)).slice(0, 12);
  if (typeof tags === 'string') return tags.split(',').map((item) => safeTrim(item, 40)).filter(Boolean).slice(0, 12);
  return [];
};

const normalizeResource = (item = {}) => ({
  ...item,
  title: safeTrim(item.title, 120),
  grade: safeTrim(item.grade, 80),
  term: safeTrim(item.term, 80),
  unit: safeTrim(item.unit, 80),
  lesson: safeTrim(item.lesson, 120),
  type: safeTrim(item.type, 30),
  url: safeTrim(item.url, 300),
  notes: safeTrim(item.notes, 500),
  pageStart: item.pageStart ?? '',
  pageEnd: item.pageEnd ?? '',
  tags: normalizeTags(item.tags),
  sequence: normalizeSequence(item.sequence),
});

const normalizeStudent = (student = {}, index = 0) => ({
  permissions: { games: true, grades: true, content: true },
  parentPermissions: { attendance: true, grades: true, dues: true },
  ...student,
  id: Number(student.id) || index + 1,
  code: Number(student.code) || index + 1,
  name: safeTrim(student.name, 100),
  grade: safeTrim(student.grade, 80),
  group: safeTrim(student.group, 80),
  guardianPhone: safeTrim(student.guardianPhone, 20),
  sessionPrice: clampNumber(student.sessionPrice ?? 50, 0, 5000, 50)
});

const normalizeSettings = (settings = {}) => {
  const seedSettings = clone(seedData.settings);
  return {
    ...seedSettings,
    ...settings,
    adminPin: safeTrim(settings.adminPin ?? seedSettings.adminPin, 6).replace(/\D/g, '').slice(0, 6),
    lockAfterMinutes: clampNumber(settings.lockAfterMinutes ?? seedSettings.lockAfterMinutes, 1, 120, seedSettings.lockAfterMinutes),
    voiceVolume: clampNumber(settings.voiceVolume ?? seedSettings.voiceVolume, 0, 1, seedSettings.voiceVolume),
    voiceRate: clampNumber(settings.voiceRate ?? seedSettings.voiceRate, 0.5, 1.5, seedSettings.voiceRate),
    voiceGender: safeTrim(settings.voiceGender ?? seedSettings.voiceGender, 20),
    cloudSync: {
      ...seedSettings.cloudSync,
      ...(settings.cloudSync || {}),
      endpoint: normalizeHttpUrl(settings.cloudSync?.endpoint),
      workspaceId: safeTrim(settings.cloudSync?.workspaceId, 80),
      token: safeTrim(settings.cloudSync?.token, 160),
      lastPushAt: safeTrim(settings.cloudSync?.lastPushAt, 40),
      lastPullAt: safeTrim(settings.cloudSync?.lastPullAt, 40)
    },
    update: {
      ...seedSettings.update,
      ...(settings.update || {}),
      manifestUrl: normalizeHttpUrl(settings.update?.manifestUrl),
      autoCheck: settings.update?.autoCheck !== false
    },
    classResourceId: settings.classResourceId ?? seedSettings.classResourceId,
    classResourceTitle: safeTrim(settings.classResourceTitle ?? seedSettings.classResourceTitle, 140),
    visibleModules: {
      ...seedSettings.visibleModules,
      ...(settings.visibleModules || {})
    }
  };
};

function migrate(source) {
  const data = source || clone(seedData);
  const students = limitArray(data.students, MAX_STUDENTS).map((student, index) => normalizeStudent(student, index));
  const contentLibrary = limitArray(data.contentLibrary, MAX_LIBRARY).map(normalizeResource);
  return {
    ...clone(seedData),
    ...data,
    students,
    notifications: limitArray(Array.isArray(data.notifications) ? data.notifications : [], MAX_HISTORY),
    customQuestionBank: limitArray(Array.isArray(data.customQuestionBank) ? data.customQuestionBank : [], MAX_LIBRARY),
    exams: Array.isArray(data.exams) && data.exams.length ? data.exams : clone(seedData.exams),
    detailedResults: limitArray(Array.isArray(data.detailedResults) ? data.detailedResults : [], MAX_HISTORY),
    auditLog: limitArray(Array.isArray(data.auditLog) ? data.auditLog : [], MAX_HISTORY),
    gameResults: limitArray(Array.isArray(data.gameResults) ? data.gameResults : [], MAX_HISTORY),
    updateHistory: limitArray(Array.isArray(data.updateHistory) ? data.updateHistory : [], 50),
    contentLibrary: contentLibrary.length ? contentLibrary : clone(seedData.contentLibrary).map(normalizeResource),
    settings: normalizeSettings(data.settings),
    sessions: Array.isArray(data.sessions) ? data.sessions.slice(0, 50).map((session) => ({
      ...session,
      title: safeTrim(session.title, 120),
      group: safeTrim(session.group, 80),
      day: safeTrim(session.day, 40),
      time: safeTrim(session.time, 20)
    })) : clone(seedData.sessions)
  };
}

export async function loadAppData() {
  const parse = (value) => migrate(safeParseJson(value, clone(seedData)) || clone(seedData));
  try {
    const { value } = await Preferences.get({ key: KEY });
    return parse(value);
  } catch {
    const local = globalThis.localStorage?.getItem(KEY);
    return parse(local);
  }
}

export async function saveAppData(data) {
  const value = JSON.stringify(data);
  if (value.length > MAX_PAYLOAD_BYTES) {
    throw new Error('حجم البيانات كبير جدًا؛ احذف بعض السجلات القديمة ثم أعد المحاولة.');
  }
  try {
    await Preferences.set({ key: KEY, value });
  } catch {
    globalThis.localStorage?.setItem(KEY, value);
  }
}

export async function resetAppData() {
  try {
    await Preferences.remove({ key: KEY });
  } catch {
    globalThis.localStorage?.removeItem(KEY);
  }
  return clone(seedData);
}
