import { gradeOptions } from '../data/questionBank.js';

export const EXTRA_LIBRARY_GRADES = ['الصف الثالث الإعدادي'];
export const LIBRARY_GRADES = [...new Set([...gradeOptions.map((item) => item.label), ...EXTRA_LIBRARY_GRADES])];

export const LIBRARY_KINDS = Object.freeze({
  GRADE_TEXTBOOK: 'grade-textbook',
  GRADE_EXAMS: 'grade-exams',
  LESSON: 'lesson',
  LESSON_MEDIA: 'lesson-media',
  LEGACY: 'legacy-resource',
});

const normalizeText = (value = '') => String(value ?? '').trim();

function stableHash(value = '') {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function gradeResourceId(kind, grade) {
  return `${kind}:${stableHash(grade)}:${grade}`;
}

export function legacyLessonId(resource = {}) {
  return `lesson:legacy:${stableHash([resource.grade, resource.term, resource.unit, resource.lesson].join('|'))}`;
}

export function resourceKind(resource = {}) {
  if (resource.kind) return resource.kind;
  if (resource.type === 'textbook') return LIBRARY_KINDS.GRADE_TEXTBOOK;
  if (resource.type === 'exams') return LIBRARY_KINDS.GRADE_EXAMS;
  if (resource.type === 'lesson') return LIBRARY_KINDS.LESSON;
  if (resource.lessonId || resource.parentLessonId) return LIBRARY_KINDS.LESSON_MEDIA;
  return LIBRARY_KINDS.LEGACY;
}

export function isGradeTextbook(resource) {
  return resourceKind(resource) === LIBRARY_KINDS.GRADE_TEXTBOOK;
}

export function isGradeExams(resource) {
  return resourceKind(resource) === LIBRARY_KINDS.GRADE_EXAMS;
}

export function isLesson(resource) {
  return resourceKind(resource) === LIBRARY_KINDS.LESSON;
}

export function isLessonMedia(resource) {
  return resourceKind(resource) === LIBRARY_KINDS.LESSON_MEDIA;
}

export function hasResourceSource(resource = {}) {
  return Boolean(resource.assetId || (resource.url && resource.url !== '#'));
}

export function inferMediaType(file = {}) {
  const mime = String(file.type || file.mimeType || '').toLowerCase();
  const name = String(file.name || file.fileName || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/.test(name)) return 'image';
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/.test(name)) return 'video';
  if (mime.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac)$/.test(name)) return 'audio';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  return 'file';
}

export function migrateLibraryItems(source = []) {
  const items = Array.isArray(source) ? source.map((item) => ({ ...item })) : [];
  const output = [];
  const legacyGroups = new Map();
  const explicitLessonIds = new Set(items.filter(isLesson).map((item) => String(item.id)));

  for (const original of items) {
    const item = { ...original };
    const kind = resourceKind(item);

    if (kind === LIBRARY_KINDS.GRADE_TEXTBOOK) {
      const textbook = {
        ...item,
        id: item.id || gradeResourceId(LIBRARY_KINDS.GRADE_TEXTBOOK, item.grade),
        kind: LIBRARY_KINDS.GRADE_TEXTBOOK,
        type: 'textbook',
        permanent: true,
        title: item.title || `كتاب المنهج الرئيسي — ${item.grade || 'الصف'}`,
        url: item.url === '#' ? '' : item.url,
      };
      output.push(textbook);
      if ((item.examAssetId || (item.examUrl && item.examUrl !== '#')) && item.grade) {
        output.push({
          id: gradeResourceId(LIBRARY_KINDS.GRADE_EXAMS, item.grade),
          kind: LIBRARY_KINDS.GRADE_EXAMS,
          type: 'exams',
          permanent: true,
          title: `ملف الامتحانات الرئيسي — ${item.grade}`,
          grade: item.grade,
          term: item.term || '',
          unit: '',
          lesson: '',
          assetId: item.examAssetId || '',
          url: item.examUrl === '#' ? '' : (item.examUrl || ''),
          fileName: item.examFileName || '',
          mimeType: item.examMimeType || 'application/pdf',
          fileSize: Number(item.examFileSize || 0),
          notes: 'تم ترحيله تلقائيًا من ملف الامتحانات المرتبط بالكتاب.',
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString(),
        });
      }
      continue;
    }

    if (kind === LIBRARY_KINDS.GRADE_EXAMS) {
      output.push({
        ...item,
        id: item.id || gradeResourceId(LIBRARY_KINDS.GRADE_EXAMS, item.grade),
        kind: LIBRARY_KINDS.GRADE_EXAMS,
        type: 'exams',
        permanent: true,
        title: item.title || `ملف الامتحانات الرئيسي — ${item.grade || 'الصف'}`,
        url: item.url === '#' ? '' : item.url,
      });
      continue;
    }

    if (kind === LIBRARY_KINDS.LESSON) {
      output.push({
        ...item,
        kind: LIBRARY_KINDS.LESSON,
        type: 'lesson',
        title: item.title || item.lesson || 'درس بدون عنوان',
        lesson: item.lesson || item.title || 'درس بدون عنوان',
      });
      continue;
    }

    if (kind === LIBRARY_KINDS.LESSON_MEDIA) {
      output.push({
        ...item,
        kind: LIBRARY_KINDS.LESSON_MEDIA,
        lessonId: item.lessonId || item.parentLessonId,
        parentLessonId: item.lessonId || item.parentLessonId,
        url: item.url === '#' ? '' : item.url,
      });
      continue;
    }

    if (item.grade && item.lesson) {
      const lessonId = item.lessonId || legacyLessonId(item);
      const groupKey = String(lessonId);
      if (!explicitLessonIds.has(groupKey) && !legacyGroups.has(groupKey)) {
        legacyGroups.set(groupKey, {
          id: lessonId,
          kind: LIBRARY_KINDS.LESSON,
          type: 'lesson',
          title: item.lesson,
          lesson: item.lesson,
          grade: item.grade,
          term: item.term || '',
          unit: item.unit || '',
          lessonDate: item.lessonDate || item.date || '',
          pageStart: item.pageStart || '',
          pageEnd: item.pageEnd || '',
          notes: item.notes || '',
          tags: Array.isArray(item.tags) ? item.tags : [],
          sequence: Array.isArray(item.sequence) ? item.sequence : ['preview', 'board', 'practice'],
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString(),
          migratedFromLegacy: true,
        });
      }
      output.push({
        ...item,
        kind: LIBRARY_KINDS.LESSON_MEDIA,
        lessonId,
        parentLessonId: lessonId,
        url: item.url === '#' ? '' : item.url,
      });
    } else {
      output.push({ ...item, kind: LIBRARY_KINDS.LEGACY, url: item.url === '#' ? '' : item.url });
    }
  }

  const existingIds = new Set(output.map((item) => String(item.id)));
  for (const lesson of legacyGroups.values()) if (!existingIds.has(String(lesson.id))) output.push(lesson);

  const deduped = new Map();
  for (const item of output) {
    const key = (isGradeTextbook(item) || isGradeExams(item))
      ? `${resourceKind(item)}:${item.grade}`
      : String(item.id);
    const previous = deduped.get(key);
    if (!previous || (!hasResourceSource(previous) && hasResourceSource(item))) deduped.set(key, item);
  }
  return [...deduped.values()];
}

export function getAllLibraryGrades(data = {}) {
  const dynamic = [
    ...(data.students || []).map((item) => item.grade),
    ...(data.contentLibrary || []).map((item) => item.grade),
    ...(data.sessions || []).map((item) => item.title),
  ].map(normalizeText).filter(Boolean);
  return [...new Set([...LIBRARY_GRADES, ...dynamic])];
}

export function getGradeTextbook(dataOrItems, grade) {
  const items = Array.isArray(dataOrItems) ? dataOrItems : (dataOrItems?.contentLibrary || []);
  return items.find((item) => isGradeTextbook(item) && item.grade === grade) || null;
}

export function getGradeExams(dataOrItems, grade) {
  const items = Array.isArray(dataOrItems) ? dataOrItems : (dataOrItems?.contentLibrary || []);
  return items.find((item) => isGradeExams(item) && item.grade === grade) || null;
}

export function getLessonsForGrade(dataOrItems, grade) {
  const items = Array.isArray(dataOrItems) ? dataOrItems : (dataOrItems?.contentLibrary || []);
  return items
    .filter((item) => isLesson(item) && (!grade || item.grade === grade))
    .sort((a, b) => {
      const dateCompare = String(a.lessonDate || a.date || '').localeCompare(String(b.lessonDate || b.date || ''));
      if (dateCompare) return dateCompare;
      return String(a.unit || '').localeCompare(String(b.unit || ''), 'ar') || String(a.title || '').localeCompare(String(b.title || ''), 'ar');
    });
}

export function getLessonMedia(dataOrItems, lessonId) {
  const items = Array.isArray(dataOrItems) ? dataOrItems : (dataOrItems?.contentLibrary || []);
  return items
    .filter((item) => isLessonMedia(item) && String(item.lessonId || item.parentLessonId) === String(lessonId))
    .sort((a, b) => Number(a.order ?? 999) - Number(b.order ?? 999) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

export function getLessonBundle(data = {}, lessonId) {
  const lesson = (data.contentLibrary || []).find((item) => isLesson(item) && String(item.id) === String(lessonId)) || null;
  if (!lesson) return null;
  const textbook = getGradeTextbook(data, lesson.grade);
  const exams = getGradeExams(data, lesson.grade);
  const media = getLessonMedia(data, lesson.id);
  return { lesson, textbook, exams, media };
}

export function resolveDefaultLesson(data = {}, grade, preferredId = '') {
  const lessons = getLessonsForGrade(data, grade);
  return lessons.find((lesson) => String(lesson.id) === String(preferredId)) || lessons[0] || null;
}

export function getLessonModeResources(data = {}, grade, lessonId = '') {
  const lesson = resolveDefaultLesson(data, grade, lessonId);
  if (!lesson) {
    return (data.contentLibrary || []).filter((item) => !isLesson(item) && !isGradeExams(item) && (!item.grade || item.grade === grade) && hasResourceSource(item));
  }
  const textbook = getGradeTextbook(data, grade);
  const exams = getGradeExams(data, grade);
  const resources = [];
  if (textbook && hasResourceSource(textbook)) {
    resources.push({
      ...textbook,
      id: `lesson-textbook:${lesson.id}`,
      sourceResourceId: textbook.id,
      lessonId: lesson.id,
      kind: LIBRARY_KINDS.LESSON_MEDIA,
      title: `${lesson.title} — كتاب المنهج`,
      unit: lesson.unit,
      lesson: lesson.title,
      pageStart: lesson.pageStart || 1,
      pageEnd: lesson.pageEnd || '',
      notes: lesson.notes || textbook.notes || '',
      homework: lesson.homework || '',
      sequence: lesson.sequence || textbook.sequence,
      relatedQuestionIds: lesson.relatedQuestionIds || textbook.relatedQuestionIds || [],
      examAssetId: exams?.assetId || '',
      examUrl: exams?.url || '',
      examFileName: exams?.fileName || '',
      boardLayers: lesson.boardLayers || {},
      annotations: lesson.annotations || textbook.annotations || [],
      virtualLessonTextbook: true,
    });
  }
  resources.push(...getLessonMedia(data, lesson.id).filter(hasResourceSource).map((item) => ({
    ...item,
    grade: lesson.grade,
    term: lesson.term,
    unit: lesson.unit,
    lesson: lesson.title,
    pageStart: item.pageStart || '',
    pageEnd: item.pageEnd || '',
    notes: item.notes || lesson.notes || '',
    homework: lesson.homework || '',
    sequence: item.sequence?.length ? item.sequence : lesson.sequence,
  })));
  if (lesson.recordingAssetId || (lesson.recordingUrl && lesson.recordingUrl !== '#')) {
    resources.push({
      id: `lesson-recording:${lesson.id}`,
      sourceResourceId: lesson.id,
      lessonId: lesson.id,
      kind: LIBRARY_KINDS.LESSON_MEDIA,
      type: inferMediaType({ fileName: lesson.recordingFileName || '', mimeType: lesson.recordingMimeType || '' }) === 'video' ? 'video' : 'audio',
      title: `تسجيل الدرس — ${lesson.title}`,
      grade: lesson.grade,
      term: lesson.term,
      unit: lesson.unit,
      lesson: lesson.title,
      assetId: lesson.recordingAssetId || '',
      url: lesson.recordingUrl || '',
      fileName: lesson.recordingFileName || '',
      mimeType: lesson.recordingMimeType || '',
      notes: lesson.notes || '',
      homework: lesson.homework || '',
      sequence: lesson.sequence,
      virtualLessonRecording: true,
    });
  }
  return resources;
}

export function clampLessonPage(page, resource = {}, pdfPageCount = Infinity) {
  const minimum = Math.max(1, Number(resource.pageStart || 1));
  const requestedMaximum = Number(resource.pageEnd || pdfPageCount || minimum);
  const maximum = Number.isFinite(requestedMaximum) ? Math.max(minimum, requestedMaximum) : Math.max(minimum, Number(pdfPageCount || minimum));
  const finitePage = Number.isFinite(Number(page)) ? Number(page) : minimum;
  return Math.min(maximum, Math.max(minimum, finitePage));
}

export function collectLibraryAssetIds(data = {}) {
  const ids = new Set();
  for (const item of data.contentLibrary || []) {
    ['assetId', 'examAssetId', 'thumbnailAssetId', 'recordingAssetId'].forEach((field) => {
      if (item[field]) ids.add(String(item[field]));
    });
  }
  return [...ids];
}

export function librarySummary(data = {}) {
  const items = data.contentLibrary || [];
  const grades = getAllLibraryGrades(data);
  const lessons = items.filter(isLesson);
  const media = items.filter(isLessonMedia);
  return {
    grades: grades.length,
    textbooks: items.filter((item) => isGradeTextbook(item) && hasResourceSource(item)).length,
    exams: items.filter((item) => isGradeExams(item) && hasResourceSource(item)).length,
    lessons: lessons.length,
    media: media.filter(hasResourceSource).length,
    lessonsWithoutTextbook: lessons.filter((lesson) => !hasResourceSource(getGradeTextbook(items, lesson.grade) || {})).length,
  };
}
