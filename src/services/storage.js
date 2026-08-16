import { Preferences } from '@capacitor/preferences';
import { seedData } from '../data/seed';
import { APP_VERSION, DATA_SCHEMA_VERSION } from '../config/version';
import { clampNumber, limitArray, normalizeHttpUrl, normalizeSecureUrl, safeParseJson, safeTrim, byteLength } from '../utils/safety';
import { secureGet, secureRemove, secureSet } from './secureVault';
import { clearAssets, ensureAssetMigration, importLegacyDataUrl } from './assetStore';
import { decryptText, encryptText, isEncryptedEnvelope, resetLocalCryptoKey } from './localCrypto';
import { migrateLibraryItems } from './libraryModel';
import { normalizeStudentCodes } from './dataMerge';

const KEY = 'mobdea_mobile_v4';
const LEGACY_KEYS = ['mobdea_mobile_v3'];
const SECRETS_KEY = 'mobdea_app_secrets_v1';
const MAX_STUDENTS = 500;
const MAX_HISTORY = 500;
const MAX_LIBRARY = 2000;
const MAX_RECORDINGS = 120;
const MAX_ROOMS = 80;
const MAX_PAYLOAD_BYTES = 8_000_000;

const STAFF_SECRET_FIELDS = [
  'adminPin', 'adminPinHash', 'adminPinSalt', 'adminPinIterations', 'adminPinAlgorithm',
  'teacherPin', 'teacherPinHash', 'teacherPinSalt', 'teacherPinIterations', 'teacherPinAlgorithm',
  'staffRecoveryAnswerHash', 'staffRecoveryAnswerSalt', 'staffRecoveryAnswerIterations', 'staffRecoveryAnswerAlgorithm',
];
const STUDENT_SECRET_FIELDS = [
  'studentPin', 'studentPinHash', 'studentPinSalt', 'studentPinIterations', 'studentPinAlgorithm',
  'guardianPin', 'guardianPinHash', 'guardianPinSalt', 'guardianPinIterations', 'guardianPinAlgorithm',
];

const clone = (value) => JSON.parse(JSON.stringify(value));

const normalizeSequence = (sequence) => {
  if (Array.isArray(sequence) && sequence.length) return sequence.filter(Boolean).map((item) => safeTrim(item, 30)).slice(0, 10);
  if (typeof sequence === 'string') return sequence.split(',').map((item) => safeTrim(item, 30)).filter(Boolean).slice(0, 10);
  return ['preview', 'board', 'practice'];
};

const normalizeTags = (tags) => {
  if (Array.isArray(tags)) return tags.filter(Boolean).map((tag) => safeTrim(tag, 40)).slice(0, 20);
  if (typeof tags === 'string') return tags.split(',').map((item) => safeTrim(item, 40)).filter(Boolean).slice(0, 20);
  return [];
};

const normalizeTextList = (value, limit = 20) => {
  if (Array.isArray(value)) return value.map((item) => safeTrim(item, 120)).filter(Boolean).slice(0, limit);
  if (typeof value === 'string') return value.split(/[,\n،]/g).map((item) => safeTrim(item, 120)).filter(Boolean).slice(0, limit);
  return [];
};

const normalizeOcrReviewQuestions = (value) => (Array.isArray(value) ? value : [])
  .slice(0, 240)
  .map((item, index) => ({
    id: safeTrim(item.id || `ocr-review-${index}`, 120),
    question: safeTrim(item.question || item.text || '', 500),
    options: normalizeTextList(item.options, 8),
    answer: safeTrim(item.answer || '', 300),
    page: clampNumber(item.page ?? 0, 0, 100_000, 0) || null,
    sourceKind: item.sourceKind === 'exams' ? 'exams' : 'textbook',
    sourceAssetId: safeTrim(item.sourceAssetId || '', 100),
    approved: Boolean(item.approved && String(item.answer || '').trim()),
  }))
  .filter((item) => item.question);

const normalizeMultilineText = (value, maxLength = 50_000) => String(value ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
  .replace(/\r\n?/g, '\n')
  .split('\n')
  .map((line) => line.replace(/[\t ]+/g, ' ').trimEnd())
  .join('\n')
  .trim()
  .slice(0, maxLength);

const normalizeSecretFields = (source = {}, fields = []) => Object.fromEntries(fields.map((field) => {
  const value = source[field];
  if (/Iterations$/.test(field)) return [field, clampNumber(value ?? 0, 0, 1_000_000, 0)];
  if (/Pin$/.test(field)) return [field, String(value ?? '').replace(/\D/g, '').slice(0, 10)];
  return [field, safeTrim(value ?? '', 260)];
}));

const normalizeVoiceClips = (clips = []) => {
  const list = Array.isArray(clips) ? clips : [];
  return list.map((clip, index) => {
    if (typeof clip === 'string') {
      return { id: `voice-${index}`, title: safeTrim(clip, 80), phraseType: 'excellent', text: safeTrim(clip, 160), url: '', assetId: '', mimeType: '', fileName: '', fileSize: 0, createdAt: new Date().toISOString() };
    }
    return {
      id: clip.id || `voice-${index}`,
      title: safeTrim(clip.title || clip.label || clip.name || 'صوت مخصص', 80),
      phraseType: safeTrim(clip.phraseType || clip.type || 'excellent', 20) || 'excellent',
      text: safeTrim(clip.text || clip.caption || '', 160),
      url: normalizeSecureUrl(clip.url || clip.src, { allowRelative: true }),
      assetId: safeTrim(clip.assetId || '', 100),
      mimeType: safeTrim(clip.mimeType || '', 120),
      fileName: safeTrim(clip.fileName || clip.name || '', 180),
      fileSize: clampNumber(clip.fileSize ?? 0, 0, 200 * 1024 * 1024, 0),
      createdAt: clip.createdAt || new Date().toISOString(),
    };
  }).filter((item) => item.assetId || item.url || item.text || item.title).slice(0, 100);
};


const normalizeMapPlacement = (placement = {}, index = 0) => ({
  id: safeTrim(placement.id || `placement-${index}`, 120),
  type: safeTrim(placement.type || placement.id || '', 60),
  label: safeTrim(placement.label || '', 100),
  hint: safeTrim(placement.hint || '', 160),
  symbol: safeTrim(placement.symbol || '', 10),
  color: safeTrim(placement.color || '#d7ad35', 20),
  x: clampNumber(placement.x ?? 0, 0, 100, 0),
  y: clampNumber(placement.y ?? 0, 0, 100, 0),
});

const normalizeMapStroke = (stroke = {}, index = 0) => ({
  id: safeTrim(stroke.id || `stroke-${index}`, 120),
  tool: safeTrim(stroke.tool || 'pen', 20),
  color: safeTrim(stroke.color || '#ef4444', 20),
  width: clampNumber(stroke.width ?? 5, 1, 40, 5),
  points: Array.isArray(stroke.points)
    ? stroke.points.slice(0, 3000).map((point) => ({
      x: clampNumber(point.x ?? 0, 0, 1000, 0),
      y: clampNumber(point.y ?? 0, 0, 620, 0),
    }))
    : [],
});

const normalizeMapRegionState = (state = {}) => ({
  labels: state.labels !== false,
  selectedCountryId: safeTrim(state.selectedCountryId || '', 20),
  selectedPlaceId: safeTrim(state.selectedPlaceId || '', 100),
  zoom: clampNumber(state.zoom ?? 1, 1, 2.5, 1),
  placements: Array.isArray(state.placements) ? state.placements.slice(0, 200).map(normalizeMapPlacement) : [],
  strokes: Array.isArray(state.strokes) ? state.strokes.slice(0, 500).map(normalizeMapStroke) : [],
});

const normalizeMapState = (state) => {
  if (!state || typeof state !== 'object') return null;
  const normalized = normalizeMapRegionState(state);
  const regions = Object.fromEntries(
    Object.entries(state.regions || {})
      .slice(0, 12)
      .map(([key, value]) => [safeTrim(key, 40), normalizeMapRegionState(value)])
      .filter(([key]) => Boolean(key)),
  );
  return { regionKey: safeTrim(state.regionKey || '', 40), regions, ...normalized };
};

const normalizeResource = (item = {}) => ({
  ...item,
  id: item.id ?? Date.now(),
  title: safeTrim(item.title, 120),
  grade: safeTrim(item.grade, 80),
  term: safeTrim(item.term, 80),
  unit: safeTrim(item.unit, 80),
  lesson: safeTrim(item.lesson, 120),
  kind: safeTrim(item.kind || '', 40),
  lessonId: safeTrim(item.lessonId || item.parentLessonId || '', 160),
  parentLessonId: safeTrim(item.parentLessonId || item.lessonId || '', 160),
  lessonDate: safeTrim(item.lessonDate || item.date || '', 40),
  type: safeTrim(item.type, 30),
  url: normalizeSecureUrl(item.url, { allowRelative: true }),
  assetId: safeTrim(item.assetId || '', 100),
  examUrl: normalizeSecureUrl(item.examUrl, { allowRelative: true }),
  examAssetId: safeTrim(item.examAssetId || '', 100),
  thumbnailUrl: normalizeSecureUrl(item.thumbnailUrl, { allowRelative: true }),
  thumbnailAssetId: safeTrim(item.thumbnailAssetId || '', 100),
  thumbnailFileName: safeTrim(item.thumbnailFileName || '', 180),
  recordingUrl: normalizeSecureUrl(item.recordingUrl, { allowRelative: true }),
  recordingAssetId: safeTrim(item.recordingAssetId || '', 100),
  recordingFileName: safeTrim(item.recordingFileName || '', 180),
  notes: safeTrim(item.notes, 4000),
  homework: safeTrim(item.homework || '', 2000),
  questionText: normalizeMultilineText(item.questionText || item.extractedText || '', 50_000),
  extractedText: normalizeMultilineText(item.extractedText || '', 50_000),
  ocrSourceKind: item.ocrSourceKind === 'exams' ? 'exams' : 'textbook',
  ocrSourceAssetId: safeTrim(item.ocrSourceAssetId || '', 100),
  ocrExtractedAt: safeTrim(item.ocrExtractedAt || '', 40),
  ocrQuestionCount: clampNumber(item.ocrQuestionCount ?? 0, 0, 10000, 0),
  ocrAnsweredCount: clampNumber(item.ocrAnsweredCount ?? 0, 0, 10000, 0),
  ocrReviewQuestions: normalizeOcrReviewQuestions(item.ocrReviewQuestions),
  pageStart: item.pageStart ?? '',
  pageEnd: item.pageEnd ?? '',
  questionPageStart: item.questionPageStart ?? item.pageStart ?? '',
  questionPageEnd: item.questionPageEnd ?? item.pageEnd ?? '',
  tags: normalizeTags(item.tags),
  sequence: normalizeSequence(item.sequence),
  fileName: safeTrim(item.fileName || item.name || '', 180),
  examFileName: safeTrim(item.examFileName || '', 180),
  mimeType: safeTrim(item.mimeType || '', 120),
  fileSize: clampNumber(item.fileSize ?? 0, 0, 200 * 1024 * 1024, 0),
  relatedQuestionIds: normalizeTextList(item.relatedQuestionIds, 100),
  order: clampNumber(item.order ?? 0, 0, 10000, 0),
  permanent: Boolean(item.permanent),
  mapState: normalizeMapState(item.mapState),
  annotations: Array.isArray(item.annotations) ? item.annotations.map((annotation, index) => ({
    id: safeTrim(annotation.id || `anno-${index}`, 100),
    text: safeTrim(annotation.text || annotation.label || '', 200),
    color: safeTrim(annotation.color || '#d7ad35', 20),
    x: clampNumber(annotation.x ?? 0, 0, 1000, 0),
    y: clampNumber(annotation.y ?? 0, 0, 1000, 0),
    createdAt: annotation.createdAt || new Date().toISOString(),
  })).filter((annotation) => annotation.text).slice(0, 100) : [],
  pinnedAt: safeTrim(item.pinnedAt || '', 40),
});

const normalizeLessonRecording = (recording = {}) => ({
  ...recording,
  id: recording.id || Date.now(),
  sessionId: recording.sessionId ?? null,
  sessionTitle: safeTrim(recording.sessionTitle || recording.title || '', 120),
  group: safeTrim(recording.group || '', 80),
  grade: safeTrim(recording.grade || '', 80),
  resourceId: recording.resourceId ?? null,
  resourceTitle: safeTrim(recording.resourceTitle || '', 140),
  summary: safeTrim(recording.summary || recording.notes || '', 1000),
  notes: safeTrim(recording.notes || '', 1000),
  flow: normalizeSequence(recording.flow || []),
  boardActions: Array.isArray(recording.boardActions) ? recording.boardActions.slice(0, 300) : [],
  boardImage: '',
  boardAssetId: safeTrim(recording.boardAssetId || '', 100),
  videoUrl: normalizeSecureUrl(recording.videoUrl, { allowRelative: true }),
  videoAssetId: safeTrim(recording.videoAssetId || '', 100),
  videoFileName: safeTrim(recording.videoFileName || '', 180),
  videoMimeType: safeTrim(recording.videoMimeType || '', 120),
  videoSize: clampNumber(recording.videoSize ?? 0, 0, 200 * 1024 * 1024, 0),
  durationSeconds: clampNumber(recording.durationSeconds ?? 0, 0, 24 * 60 * 60, 0),
  timeline: Array.isArray(recording.timeline)
    ? recording.timeline.slice(0, 1000).map((entry) => ({
      atSeconds: clampNumber(entry?.atSeconds ?? 0, 0, 24 * 60 * 60, 0),
      type: safeTrim(entry?.type || 'event', 40),
      contentMode: safeTrim(entry?.contentMode || '', 30),
      resourceId: safeTrim(entry?.resourceId || '', 160),
      resourceTitle: safeTrim(entry?.resourceTitle || '', 140),
      page: clampNumber(entry?.page ?? 0, 0, 100000, 0),
      createdAt: safeTrim(entry?.createdAt || '', 40),
    }))
    : [],
  selectedStudentId: recording.selectedStudentId ?? null,
  selectedStudentName: safeTrim(recording.selectedStudentName || '', 100),
  attendance: Array.isArray(recording.attendance) ? recording.attendance.slice(0, 500) : [],
  points: recording.points && typeof recording.points === 'object' ? recording.points : {},
  questions: Array.isArray(recording.questions) ? recording.questions.slice(0, 60) : [],
  players: Array.isArray(recording.players) ? recording.players.slice(0, 30) : [],
  shareToken: safeTrim(recording.shareToken || '', 160),
  shareUrl: normalizeSecureUrl(recording.shareUrl, { allowRelative: true }),
  visibleToStudents: recording.visibleToStudents !== false,
  studentIds: Array.isArray(recording.studentIds) ? recording.studentIds.slice(0, 500).map((value) => Number(value)).filter(Number.isFinite) : [],
  publishedAt: safeTrim(recording.publishedAt || recording.createdAt || '', 40),
  createdAt: recording.createdAt || new Date().toISOString(),
});

const normalizeGameRoom = (room = {}) => ({
  ...room,
  id: safeTrim(room.id || room.roomId || '', 100),
  mode: safeTrim(room.mode || 'battle', 20),
  gradeKey: safeTrim(room.gradeKey || '', 20),
  unit: safeTrim(room.unit || 'all', 80),
  focusResourceId: room.focusResourceId ?? null,
  selectedStudentId: room.selectedStudentId ?? null,
  secondStudentId: room.secondStudentId ?? null,
  state: room.state && typeof room.state === 'object' ? room.state : {},
  inviteCode: safeTrim(room.inviteCode || '', 160),
  inviteUrl: normalizeSecureUrl(room.inviteUrl, { allowRelative: true }),
  status: safeTrim(room.status || 'open', 20),
  createdAt: room.createdAt || new Date().toISOString(),
  updatedAt: room.updatedAt || new Date().toISOString(),
});

const normalizeStudent = (student = {}, index = 0) => ({
  permissions: { games: true, grades: true, content: true },
  parentPermissions: { attendance: true, grades: true, dues: true },
  ...student,
  ...normalizeSecretFields(student, STUDENT_SECRET_FIELDS),
  id: Number(student.id) || index + 1,
  code: Number(student.code) || index + 1,
  name: safeTrim(student.name, 100),
  grade: safeTrim(student.grade, 80),
  group: safeTrim(student.group, 80),
  guardianPhone: String(student.guardianPhone || '').replace(/\D/g, '').slice(0, 15),
  studentPhone: String(student.studentPhone || '').replace(/\D/g, '').slice(0, 15),
  sessionPrice: clampNumber(student.sessionPrice ?? 50, 0, 5000, 50),
});

const normalizeSettings = (settings = {}) => {
  const seedSettings = clone(seedData.settings);
  return {
    ...seedSettings,
    ...settings,
    ...normalizeSecretFields(settings, STAFF_SECRET_FIELDS),
    staffRecoveryQuestion: safeTrim(settings.staffRecoveryQuestion ?? seedSettings.staffRecoveryQuestion ?? '', 160),
    lockAfterMinutes: clampNumber(settings.lockAfterMinutes ?? seedSettings.lockAfterMinutes, 1, 120, seedSettings.lockAfterMinutes),
    voiceVolume: clampNumber(settings.voiceVolume ?? seedSettings.voiceVolume, 0, 1, seedSettings.voiceVolume),
    voiceRate: clampNumber(settings.voiceRate ?? seedSettings.voiceRate, 0.5, 1.5, seedSettings.voiceRate),
    voiceGender: safeTrim(settings.voiceGender ?? seedSettings.voiceGender, 20),
    voiceClips: normalizeVoiceClips(settings.voiceClips || seedSettings.voiceClips || []),
    cloudSync: {
      ...seedSettings.cloudSync,
      ...(settings.cloudSync || {}),
      endpoint: normalizeHttpUrl(settings.cloudSync?.endpoint),
      workspaceId: safeTrim(settings.cloudSync?.workspaceId, 80).replace(/[^a-zA-Z0-9_-]/g, ''),
      token: safeTrim(settings.cloudSync?.token, 260),
      publicAppUrl: normalizeHttpUrl(settings.cloudSync?.publicAppUrl),
      revision: safeTrim(settings.cloudSync?.revision, 120),
      lastPushAt: safeTrim(settings.cloudSync?.lastPushAt, 40),
      lastPullAt: safeTrim(settings.cloudSync?.lastPullAt, 40),
      autoSync: settings.cloudSync?.autoSync !== false,
      autoSyncIntervalMinutes: clampNumber(settings.cloudSync?.autoSyncIntervalMinutes, 1, 60, 2),
      lastAutoSyncAt: safeTrim(settings.cloudSync?.lastAutoSyncAt, 40),
      localChangedAt: safeTrim(settings.cloudSync?.localChangedAt, 40),
      autoSyncError: safeTrim(settings.cloudSync?.autoSyncError, 240),
      autoBackup: settings.cloudSync?.autoBackup === true,
      autoBackupIntervalHours: clampNumber(settings.cloudSync?.autoBackupIntervalHours, 1, 168, 24),
      lastAutoBackupAt: safeTrim(settings.cloudSync?.lastAutoBackupAt, 40),
      autoBackupError: safeTrim(settings.cloudSync?.autoBackupError, 240),
    },
    studentPortalSession: {
      endpoint: normalizeHttpUrl(settings.studentPortalSession?.endpoint),
      workspaceId: safeTrim(settings.studentPortalSession?.workspaceId, 80).replace(/[^a-zA-Z0-9_-]/g, ''),
      studentToken: safeTrim(settings.studentPortalSession?.studentToken, 260),
      expiresAt: safeTrim(settings.studentPortalSession?.expiresAt, 40),
      studentId: settings.studentPortalSession?.studentId ?? null,
      studentCode: safeTrim(settings.studentPortalSession?.studentCode, 24),
      lastPullAt: safeTrim(settings.studentPortalSession?.lastPullAt, 40),
      lastError: safeTrim(settings.studentPortalSession?.lastError, 240),
    },
    update: {
      ...seedSettings.update,
      ...(settings.update || {}),
      manifestUrl: normalizeHttpUrl(settings.update?.manifestUrl),
      trustedSha256: safeTrim(settings.update?.trustedSha256, 64).toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 64),
      autoCheck: settings.update?.autoCheck !== false,
    },
    classLessonId: settings.classLessonId ?? seedSettings.classLessonId ?? '',
    classResourceId: settings.classResourceId ?? seedSettings.classResourceId,
    classResourceTitle: safeTrim(settings.classResourceTitle ?? seedSettings.classResourceTitle, 140),
    classResourceType: safeTrim(settings.classResourceType ?? seedSettings.classResourceType, 30),
    classResourceFileName: safeTrim(settings.classResourceFileName ?? seedSettings.classResourceFileName, 180),
    classResourcePinnedAt: safeTrim(settings.classResourcePinnedAt ?? seedSettings.classResourcePinnedAt, 40),
    classResourceQueue: Array.isArray(settings.classResourceQueue ?? seedSettings.classResourceQueue)
      ? (settings.classResourceQueue ?? seedSettings.classResourceQueue).filter((item) => item && item.id !== undefined && item.id !== null).slice(0, 80).map((item) => ({
        id: item.id,
        title: safeTrim(item.title, 140),
        type: safeTrim(item.type, 30),
        fileName: safeTrim(item.fileName, 180),
      })) : [],
    encouragementPhrases: Array.isArray(settings.encouragementPhrases ?? seedSettings.encouragementPhrases)
      ? (settings.encouragementPhrases ?? seedSettings.encouragementPhrases).map((phrase) => safeTrim(phrase, 80)).filter(Boolean).slice(0, 60) : [],
    visibleModules: { ...seedSettings.visibleModules, ...(settings.visibleModules || {}) },
  };
};

export function normalizeAppData(source) {
  const data = source && typeof source === 'object' ? source : clone(seedData);
  const students = normalizeStudentCodes(limitArray(data.students, MAX_STUDENTS).map((student, index) => normalizeStudent(student, index)));
  const migratedLibrary = migrateLibraryItems(limitArray(data.contentLibrary, MAX_LIBRARY));
  const contentLibrary = limitArray(migratedLibrary, MAX_LIBRARY).map(normalizeResource);
  return {
    ...clone(seedData),
    ...data,
    schemaVersion: DATA_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    students,
    notifications: limitArray(Array.isArray(data.notifications) ? data.notifications : [], MAX_HISTORY),
    customQuestionBank: limitArray(Array.isArray(data.customQuestionBank) ? data.customQuestionBank : [], MAX_LIBRARY),
    exams: Array.isArray(data.exams) && data.exams.length ? data.exams : clone(seedData.exams),
    detailedResults: limitArray(Array.isArray(data.detailedResults) ? data.detailedResults : [], MAX_HISTORY),
    auditLog: limitArray(Array.isArray(data.auditLog) ? data.auditLog : [], MAX_HISTORY),
    gameResults: limitArray(Array.isArray(data.gameResults) ? data.gameResults : [], MAX_HISTORY),
    achievements: limitArray(Array.isArray(data.achievements) ? data.achievements : [], MAX_HISTORY),
    rewardCatalog: limitArray(Array.isArray(data.rewardCatalog) ? data.rewardCatalog : [], 100),
    rewardRedemptions: limitArray(Array.isArray(data.rewardRedemptions) ? data.rewardRedemptions : [], 500),
    lessonRecordings: limitArray(Array.isArray(data.lessonRecordings) ? data.lessonRecordings : [], MAX_RECORDINGS).map(normalizeLessonRecording),
    gameRooms: limitArray(Array.isArray(data.gameRooms) ? data.gameRooms : [], MAX_ROOMS).map(normalizeGameRoom),
    updateHistory: limitArray(Array.isArray(data.updateHistory) ? data.updateHistory : [], 50),
    contentLibrary: contentLibrary.length ? contentLibrary : clone(seedData.contentLibrary).map(normalizeResource),
    settings: normalizeSettings(data.settings),
    sessions: Array.isArray(data.sessions) ? data.sessions.slice(0, 100).map((session) => ({
      ...session,
      title: safeTrim(session.title, 120),
      group: safeTrim(session.group, 80),
      day: safeTrim(session.day, 40),
      time: safeTrim(session.time, 20),
    })) : clone(seedData.sessions),
  };
}

function extractSecrets(data) {
  const settings = Object.fromEntries(STAFF_SECRET_FIELDS.map((field) => [field, data.settings?.[field] ?? '']));
  settings.cloudToken = data.settings?.cloudSync?.token || '';
  const students = Object.fromEntries((data.students || []).map((student) => [String(student.id), Object.fromEntries(STUDENT_SECRET_FIELDS.map((field) => [field, student[field] ?? '']))]));
  return { version: 1, settings, students, updatedAt: new Date().toISOString() };
}

function mergeSecrets(data, secrets = {}) {
  const settingsSecrets = secrets.settings || {};
  return {
    ...data,
    settings: {
      ...data.settings,
      ...Object.fromEntries(STAFF_SECRET_FIELDS.map((field) => [field, settingsSecrets[field] ?? data.settings?.[field] ?? ''])),
      cloudSync: { ...data.settings.cloudSync, token: settingsSecrets.cloudToken ?? data.settings.cloudSync?.token ?? '' },
    },
    students: (data.students || []).map((student) => ({
      ...student,
      ...(secrets.students?.[String(student.id)] || {}),
    })),
  };
}

function scrubSecrets(data) {
  const next = clone(data);
  for (const field of STAFF_SECRET_FIELDS) delete next.settings[field];
  if (next.settings?.cloudSync) next.settings.cloudSync.token = '';
  next.students = (next.students || []).map((student) => {
    const clean = { ...student };
    for (const field of STUDENT_SECRET_FIELDS) delete clean[field];
    return clean;
  });
  return next;
}

async function migrateLegacyAssets(source) {
  const next = clone(source || seedData);
  let changed = false;
  for (const resource of next.contentLibrary || []) {
    if (String(resource.url || '').startsWith('data:')) {
      const asset = await importLegacyDataUrl(resource.url, { name: resource.fileName || resource.title || 'resource', kind: 'resource' });
      resource.assetId = asset.id;
      resource.fileSize = asset.size;
      resource.mimeType = resource.mimeType || asset.type;
      resource.url = '';
      changed = true;
    }
    if (String(resource.examUrl || '').startsWith('data:')) {
      const asset = await importLegacyDataUrl(resource.examUrl, { name: resource.examFileName || `${resource.title || 'resource'}-exams`, kind: 'exam' });
      resource.examAssetId = asset.id;
      resource.examUrl = '';
      changed = true;
    }
    if (String(resource.thumbnailUrl || '').startsWith('data:')) {
      const asset = await importLegacyDataUrl(resource.thumbnailUrl, { name: resource.thumbnailFileName || `${resource.title || 'lesson'}-thumbnail`, kind: 'thumbnail' });
      resource.thumbnailAssetId = asset.id;
      resource.thumbnailFileName = resource.thumbnailFileName || asset.name;
      resource.thumbnailUrl = '';
      changed = true;
    }
    if (String(resource.recordingUrl || '').startsWith('data:')) {
      const asset = await importLegacyDataUrl(resource.recordingUrl, { name: resource.recordingFileName || `${resource.title || 'lesson'}-recording`, kind: 'recording' });
      resource.recordingAssetId = asset.id;
      resource.recordingFileName = resource.recordingFileName || asset.name;
      resource.recordingUrl = '';
      changed = true;
    }
  }
  for (const clip of next.settings?.voiceClips || []) {
    if (String(clip.url || '').startsWith('data:')) {
      const asset = await importLegacyDataUrl(clip.url, { name: clip.fileName || clip.title || 'voice', kind: 'voice' });
      clip.assetId = asset.id;
      clip.fileSize = asset.size;
      clip.mimeType = clip.mimeType || asset.type;
      clip.url = '';
      changed = true;
    }
  }
  for (const recording of next.lessonRecordings || []) {
    if (String(recording.boardImage || '').startsWith('data:')) {
      const asset = await importLegacyDataUrl(recording.boardImage, { name: `board-${recording.id || Date.now()}.png`, kind: 'board' });
      recording.boardAssetId = asset.id;
      recording.boardImage = '';
      changed = true;
    }
    if (String(recording.videoUrl || '').startsWith('data:')) {
      const asset = await importLegacyDataUrl(recording.videoUrl, {
        name: recording.videoFileName || `recording-${recording.id || Date.now()}.webm`,
        kind: 'lesson-recording',
      });
      recording.videoAssetId = asset.id;
      recording.videoFileName = recording.videoFileName || asset.name;
      recording.videoMimeType = recording.videoMimeType || asset.type;
      recording.videoSize = asset.size;
      recording.videoUrl = '';
      changed = true;
    }
  }
  return { data: next, changed };
}

async function readStoredValue() {
  try {
    const current = await Preferences.get({ key: KEY });
    if (current.value) return current.value;
    for (const legacyKey of LEGACY_KEYS) {
      const legacy = await Preferences.get({ key: legacyKey });
      if (legacy.value) return legacy.value;
    }
  } catch {
    // Continue to the encrypted web fallback below.
  }
  try {
    const current = globalThis.localStorage?.getItem(KEY);
    if (current) return current;
    for (const legacyKey of LEGACY_KEYS) {
      const legacy = globalThis.localStorage?.getItem(legacyKey);
      if (legacy) return legacy;
    }
  } catch {
    // Storage is unavailable on this device.
  }
  return '';
}

export async function loadAppData() {
  await ensureAssetMigration();
  const storedValue = await readStoredValue();
  let raw = clone(seedData);
  if (storedValue) {
    let decodedValue = storedValue;
    if (isEncryptedEnvelope(storedValue)) decodedValue = await decryptText(storedValue);
    raw = safeParseJson(decodedValue, null);
    if (!raw || typeof raw !== 'object') {
      throw new Error('بيانات المنصة المحلية تالفة. استعد نسخة احتياطية بدل الكتابة فوق البيانات الحالية.');
    }
  }
  const migratedAssets = await migrateLegacyAssets(raw);
  const normalized = normalizeAppData(migratedAssets.data);
  const secrets = safeParseJson(await secureGet(SECRETS_KEY), {}) || {};
  const merged = mergeSecrets(normalized, secrets);
  if (migratedAssets.changed || !raw.schemaVersion || raw.schemaVersion !== DATA_SCHEMA_VERSION) await saveAppData(merged);
  return merged;
}

export async function saveAppData(data) {
  const normalized = normalizeAppData(data);
  const persisted = scrubSecrets(normalized);
  const plainValue = JSON.stringify(persisted);
  if (/data:[^,]+,/i.test(plainValue)) throw new Error('تعذر الحفظ لأن ملفًا مضمّنًا لم يُنقل إلى مخزن الملفات الآمن. أعد رفع الملف.');
  if (byteLength(plainValue) > MAX_PAYLOAD_BYTES) throw new Error('حجم بيانات السجلات كبير جدًا. صدّر نسخة احتياطية ثم احذف السجلات القديمة غير المطلوبة.');
  const value = await encryptText(plainValue);
  const nextSecrets = JSON.stringify(extractSecrets(normalized));
  const previousSecrets = await secureGet(SECRETS_KEY);
  await secureSet(SECRETS_KEY, nextSecrets);
  try {
    let stored = false;
    try {
      await Preferences.set({ key: KEY, value });
      stored = true;
    } catch {
      // Use the encrypted browser fallback only when Preferences is unavailable.
    }
    if (!stored) {
      if (!globalThis.localStorage) throw new Error('التخزين المحلي غير متاح على هذا الجهاز.');
      globalThis.localStorage.setItem(KEY, value);
    }
    try {
      for (const legacyKey of LEGACY_KEYS) await Preferences.remove({ key: legacyKey });
    } catch {
      // Legacy Preferences can be removed on a later successful save.
    }
    try {
      for (const legacyKey of LEGACY_KEYS) globalThis.localStorage?.removeItem(legacyKey);
    } catch {
      // Ignore unavailable legacy web storage.
    }
  } catch (error) {
    if (previousSecrets === null) await secureRemove(SECRETS_KEY).catch(() => {});
    else await secureSet(SECRETS_KEY, previousSecrets).catch(() => {});
    throw error;
  }
  return normalized;
}

export async function resetAppData() {
  try {
    await Preferences.remove({ key: KEY });
    for (const legacyKey of LEGACY_KEYS) await Preferences.remove({ key: legacyKey });
  } catch {
    // Continue with web storage cleanup.
  }
  try {
    globalThis.localStorage?.removeItem(KEY);
    for (const legacyKey of LEGACY_KEYS) globalThis.localStorage?.removeItem(legacyKey);
  } catch {
    // Ignore unavailable web storage.
  }
  await secureRemove(SECRETS_KEY);
  await clearAssets();
  await resetLocalCryptoKey();
  return normalizeAppData(clone(seedData));
}

export function prepareDataForTransfer(data) {
  return normalizeAppData(data);
}
