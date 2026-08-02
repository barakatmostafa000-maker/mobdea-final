import { sanitizeQuestion } from './assessment.js';
import { gradeOptions } from '../data/questionBank.js';

const RESOURCE_TYPE_LABELS = {
  video: 'فيديو',
  pdf: 'كتاب أو شرح PDF',
  image: 'صورة تعليمية',
  map: 'خريطة تعليمية',
  audio: 'صوت',
  slides: 'عرض تقديمي',
  link: 'رابط خارجي',
};

function normalize(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function inferGradeKey(grade = '') {
  const normalized = normalize(grade);
  const exact = gradeOptions.find((item) => normalize(item.label) === normalized);
  if (exact) return exact.key;
  const partial = gradeOptions.find((item) => normalized && normalize(item.label).includes(normalized))
    || gradeOptions.find((item) => normalized && normalized.includes(normalize(item.label)));
  return partial?.key || '6';
}

function inferTopic(resource = {}) {
  const text = normalize([resource.title, resource.unit, resource.lesson, resource.notes, ...(Array.isArray(resource.tags) ? resource.tags : [])].join(' '));
  if (/خريطة|map|atlas|خرائط/i.test(text) || resource.type === 'map') return 'الخريطة والمهارات الجغرافية';
  if (/تاريخ|حضارة|مصر|الوطن العربي|دولة|حدود|موقع/i.test(text)) return 'المفاهيم الأساسية';
  return normalize(resource.tags?.[0] || resource.lesson || resource.unit || 'عام');
}

function uniqueOptions(correct, candidates = []) {
  const output = [normalize(correct), ...candidates.map(normalize)].filter(Boolean);
  return [...new Set(output)].slice(0, 4);
}

function distractorsForLesson(resource = {}) {
  const lesson = normalize(resource.lesson || resource.title || 'الدرس');
  const unit = normalize(resource.unit || 'الوحدة');
  return [
    `مراجعة عامة قبل ${lesson}`,
    `نشاط منفصل عن ${unit}`,
    'موضوع غير مرتبط بالمحتوى المحفوظ',
  ];
}

function buildQuestion(id, input, fallback) {
  return sanitizeQuestion({ id, ...input }, fallback);
}

export function generateQuestionsFromResource(resource = {}) {
  if (!resource?.id) return [];

  const gradeKey = inferGradeKey(resource.grade);
  const grade = normalize(resource.grade || gradeOptions.find((item) => item.key === gradeKey)?.label || 'غير محدد');
  const title = normalize(resource.title || 'مورد تعليمي');
  const unit = normalize(resource.unit || 'الوحدة');
  const lesson = normalize(resource.lesson || title);
  const topic = inferTopic(resource);
  const notes = normalize(resource.notes || resource.summary || '');
  const homework = normalize(resource.homework || '');
  const modelIdea = normalize(notes.split(/[.!؟؛]/)[0] || notes || `المفاهيم الأساسية في درس ${lesson}`);
  const pages = resource.pageStart && resource.pageEnd
    ? `من صفحة ${resource.pageStart} إلى صفحة ${resource.pageEnd}`
    : resource.pageStart
      ? `ابتداءً من صفحة ${resource.pageStart}`
      : 'داخل محتوى الدرس المحفوظ في المكتبة';
  const base = `auto-${resource.id}`;

  const lessonOptions = uniqueOptions(lesson, distractorsForLesson(resource));
  const unitOptions = uniqueOptions(unit, ['الوحدة الأولى', 'الوحدة الثانية', 'مراجعة عامة']);
  const items = [
    buildQuestion(`${base}-lesson-mcq`, {
      gradeKey,
      grade,
      term: normalize(resource.term || 'الترم الأول'),
      unit,
      lesson,
      topic,
      type: 'mcq',
      text: `أي عنوان يطابق المحتوى المحفوظ في هذا الدرس؟`,
      options: lessonOptions,
      answer: lesson,
      answerIndex: lessonOptions.indexOf(lesson),
      difficulty: 'سهل',
      maxScore: 1,
      source: 'auto',
    }),
    buildQuestion(`${base}-unit-mcq`, {
      gradeKey,
      grade,
      term: normalize(resource.term || 'الترم الأول'),
      unit,
      lesson,
      topic,
      type: 'mcq',
      text: `ينتمي درس «${lesson}» إلى أي وحدة؟`,
      options: unitOptions,
      answer: unit,
      answerIndex: unitOptions.indexOf(unit),
      difficulty: 'سهل',
      maxScore: 1,
      source: 'auto',
    }),
    buildQuestion(`${base}-content-tf`, {
      gradeKey,
      grade,
      term: normalize(resource.term || 'الترم الأول'),
      unit,
      lesson,
      topic,
      type: 'tf',
      text: `المحتوى الحالي جزء من درس «${lesson}».`,
      options: ['صح', 'خطأ'],
      answer: 'صح',
      answerIndex: 0,
      difficulty: 'سهل',
      maxScore: 1,
      source: 'auto',
    }),
    buildQuestion(`${base}-main-idea`, {
      gradeKey,
      grade,
      term: normalize(resource.term || 'الترم الأول'),
      unit,
      lesson,
      topic,
      type: 'essay',
      text: `اشرح الفكرة الرئيسة في درس «${lesson}» بأسلوبك.`,
      answer: modelIdea,
      difficulty: 'متوسط',
      maxScore: 3,
      source: 'auto',
    }),
    buildQuestion(`${base}-concept`, {
      gradeKey,
      grade,
      term: normalize(resource.term || 'الترم الأول'),
      unit,
      lesson,
      topic,
      type: 'fill',
      text: `${pages}: اكتب اسم المفهوم أو الدرس الذي تشرحه هذه الصفحات.`,
      answer: lesson,
      difficulty: 'سهل',
      maxScore: 1,
      source: 'auto',
    }),
    buildQuestion(`${base}-review`, {
      gradeKey,
      grade,
      term: normalize(resource.term || 'الترم الأول'),
      unit,
      lesson,
      topic,
      type: 'essay',
      text: `اذكر نقطتين مهمتين يجب مراجعتهما بعد دراسة «${lesson}».`,
      answer: notes || `تُراجع أهداف الدرس والمفاهيم والأمثلة الواردة ${pages}.`,
      difficulty: 'متوسط',
      maxScore: 2,
      source: 'auto',
    }),
  ];

  if (/خريطة|map|خرائط|جغراف/i.test(title + ' ' + lesson + ' ' + unit + ' ' + topic) || resource.type === 'map' || resource.mapState) {
    items.push(buildQuestion(`${base}-map`, {
      gradeKey,
      grade,
      term: normalize(resource.term || 'الترم الأول'),
      unit,
      lesson,
      topic: 'الخريطة والظاهرات الجغرافية',
      type: 'map',
      text: `حدد على الخريطة أهم موقع أو ظاهرة جغرافية مرتبطة بدرس «${lesson}»، ثم وضح أهميتها.`,
      answer: notes || `يُقبل التحديد الصحيح مع تفسير علاقته بموضوع ${lesson}.`,
      difficulty: 'متوسط',
      maxScore: 3,
      source: 'auto',
    }));
  }

  if (homework) {
    items.push(buildQuestion(`${base}-homework`, {
      gradeKey,
      grade,
      term: normalize(resource.term || 'الترم الأول'),
      unit,
      lesson,
      topic,
      type: 'essay',
      text: `سؤال الواجب المرتبط بدرس «${lesson}»: ${homework}`,
      answer: `تُراجع إجابة الطالب وفق عناصر الواجب المحفوظة في درس ${lesson}.`,
      difficulty: 'متوسط',
      maxScore: 3,
      source: 'auto',
    }));
  }

  return items.map((question) => ({
    ...question,
    resourceId: resource.id,
    resourceTitle: title,
    sourceExamResourceId: resource.sourceExamResourceId || '',
    sourceExamAssetId: resource.sourceExamAssetId || '',
    sourceExamFileName: resource.sourceExamFileName || '',
    sourcePageStart: resource.pageStart || '',
    sourcePageEnd: resource.pageEnd || '',
    source: 'auto',
  }));
}

export function generateQuestionsForLessonBundle(lesson = {}, resources = []) {
  const all = [lesson, ...(Array.isArray(resources) ? resources : [])].filter(Boolean);
  const generated = all.flatMap((resource) => generateQuestionsFromResource({
    ...resource,
    grade: resource.grade || lesson.grade,
    term: resource.term || lesson.term,
    unit: resource.unit || lesson.unit,
    lesson: resource.lesson || lesson.title || lesson.lesson,
    notes: resource.notes || lesson.notes,
    homework: resource.homework || lesson.homework,
  }).map((question) => ({
    ...question,
    lessonId: lesson.id || resource.lessonId || resource.parentLessonId || '',
  })));
  const seen = new Set();
  return generated.filter((question) => {
    const key = `${question.type}|${question.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function upsertGeneratedQuestions(questionBank = [], resource = {}, generatedQuestions = []) {
  const resourceId = String(resource?.id ?? '');
  const prefix = `auto-${resourceId}`;
  const incomingIds = new Set((generatedQuestions || []).map((question) => String(question?.id || '')).filter(Boolean));
  const cleaned = Array.isArray(questionBank)
    ? questionBank.filter((question) => {
        const sameResource = String(question?.resourceId ?? '') === resourceId;
        const sameLesson = resourceId && String(question?.lessonId ?? '') === resourceId;
        const samePrefix = String(question?.id ?? '').startsWith(prefix);
        const replacedByIncoming = incomingIds.has(String(question?.id || ''));
        return !(sameResource || sameLesson || samePrefix || replacedByIncoming);
      })
    : [];
  return [...cleaned, ...(generatedQuestions || [])];
}

export function removeGeneratedQuestions(questionBank = [], resourceId) {
  const key = String(resourceId ?? '');
  const prefix = `auto-${key}`;
  return (Array.isArray(questionBank) ? questionBank : []).filter((question) => {
    const sameResource = String(question?.resourceId ?? '') === key;
    const samePrefix = String(question?.id ?? '').startsWith(prefix);
    return !(sameResource || samePrefix);
  });
}
