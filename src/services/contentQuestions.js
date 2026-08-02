import { sanitizeQuestion } from './assessment.js';
import { gradeOptions } from '../data/questionBank.js';

const RESOURCE_TYPE_LABELS = {
  textbook: 'كتاب المنهج الرئيسي',
  exams: 'ملف الامتحانات الرئيسي',
  video: 'فيديو تعليمي',
  pdf: 'شرح PDF',
  image: 'صورة تعليمية',
  map: 'خريطة تعليمية',
  audio: 'ملف صوتي',
  slides: 'عرض تقديمي',
  document: 'مستند تعليمي',
  file: 'ملف مرتبط بالدرس',
  link: 'رابط خارجي',
  lesson: 'خطة الدرس',
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
  const text = normalize([
    resource.title,
    resource.unit,
    resource.lesson,
    resource.notes,
    ...(Array.isArray(resource.tags) ? resource.tags : []),
  ].join(' '));
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

function sourceKind(resource = {}) {
  if (resource.sourceKind) return normalize(resource.sourceKind).toLowerCase();
  if (resource.type === 'textbook' || resource.kind === 'grade-textbook') return 'textbook';
  if (resource.type === 'exams' || resource.kind === 'grade-exams') return 'exams';
  return normalize(resource.type || 'lesson').toLowerCase();
}

function sourceLabel(resource = {}) {
  const kind = sourceKind(resource);
  return RESOURCE_TYPE_LABELS[kind] || RESOURCE_TYPE_LABELS[resource.type] || normalize(resource.title || 'المحتوى المرتبط');
}

function splitNoteLines(value = '') {
  return String(value || '')
    .replace(/\r/g, '\n')
    .split(/\n+|[؛;]+|(?<=[.!؟])\s+/u)
    .map((line) => normalize(line.replace(/^[\s\-–—•*\d٠-٩]+[.)ـ:\-–—]*\s*/u, '')))
    .filter((line) => line.length >= 8)
    .slice(0, 16);
}

function extractDefinitions(lines = []) {
  const output = [];
  for (const line of lines) {
    const match = line.match(/^(.{2,55}?)\s*(?::|：|—|–|-)\s*(.{8,220})$/u);
    if (!match) continue;
    const term = normalize(match[1]);
    const definition = normalize(match[2]);
    if (!term || !definition || term.length > 55) continue;
    output.push({ term, definition });
  }
  return output.slice(0, 6);
}

function questionBase(resource = {}) {
  const gradeKey = inferGradeKey(resource.grade);
  const grade = normalize(resource.grade || gradeOptions.find((item) => item.key === gradeKey)?.label || 'غير محدد');
  const title = normalize(resource.title || 'مورد تعليمي');
  const unit = normalize(resource.unit || 'الوحدة');
  const lesson = normalize(resource.lesson || title);
  const topic = inferTopic(resource);
  const term = normalize(resource.term || 'الترم الأول');
  return { gradeKey, grade, title, unit, lesson, topic, term };
}

function buildQuestionsFromNotes(resource, baseId, common) {
  const notes = normalize(resource.notes || resource.summary || resource.extractedText || '');
  const lines = splitNoteLines(notes);
  if (!lines.length) return [];

  const definitions = extractDefinitions(lines);
  const definitionPool = definitions.map((item) => item.definition);
  const items = [];

  definitions.forEach((item, index) => {
    const options = uniqueOptions(item.definition, [
      ...definitionPool.filter((value) => value !== item.definition),
      `مفهوم مختلف لا يعبّر عن ${item.term}`,
      `نتيجة جانبية وليست تعريف ${item.term}`,
    ]);
    items.push(buildQuestion(`${baseId}-definition-${index + 1}`, {
      ...common,
      type: 'mcq',
      text: `ما المقصود بـ «${item.term}»؟`,
      options,
      answer: item.definition,
      answerIndex: options.indexOf(item.definition),
      difficulty: 'متوسط',
      maxScore: 2,
      source: 'auto',
    }));
  });

  lines.slice(0, 5).forEach((line, index) => {
    items.push(buildQuestion(`${baseId}-fact-${index + 1}`, {
      ...common,
      type: 'tf',
      text: line.endsWith('.') || line.endsWith('؟') ? line : `${line}.`,
      options: ['صح', 'خطأ'],
      answer: 'صح',
      answerIndex: 0,
      difficulty: index < 2 ? 'سهل' : 'متوسط',
      maxScore: 1,
      source: 'auto',
    }));
  });

  return items;
}

export function generateQuestionsFromResource(resource = {}) {
  if (!resource?.id) return [];

  const { gradeKey, grade, title, unit, lesson, topic, term } = questionBase(resource);
  const notes = normalize(resource.notes || resource.summary || resource.extractedText || '');
  const homework = normalize(resource.homework || '');
  const kind = sourceKind(resource);
  const label = sourceLabel(resource);
  const modelIdea = normalize(splitNoteLines(notes)[0] || notes || `المفاهيم الأساسية في درس ${lesson}`);
  const pages = resource.pageStart && resource.pageEnd
    ? `من صفحة ${resource.pageStart} إلى صفحة ${resource.pageEnd}`
    : resource.pageStart
      ? `ابتداءً من صفحة ${resource.pageStart}`
      : `داخل ${label}`;
  const base = `auto-${resource.id}`;
  const common = { gradeKey, grade, term, unit, lesson, topic };

  const lessonOptions = uniqueOptions(lesson, distractorsForLesson(resource));
  const unitOptions = uniqueOptions(unit, ['الوحدة الأولى', 'الوحدة الثانية', 'مراجعة عامة']);
  const sourceOptions = uniqueOptions(label, [
    'ملف غير مرتبط بالصف الحالي',
    'مورد ترفيهي خارج الدرس',
    'سجل إداري للطلاب',
  ]);

  const items = [
    buildQuestion(`${base}-lesson-mcq`, {
      ...common,
      type: 'mcq',
      text: 'أي عنوان يطابق المحتوى المستخدم في هذه الحصة؟',
      options: lessonOptions,
      answer: lesson,
      answerIndex: lessonOptions.indexOf(lesson),
      difficulty: 'سهل',
      maxScore: 1,
      source: 'auto',
    }),
    buildQuestion(`${base}-unit-mcq`, {
      ...common,
      type: 'mcq',
      text: `ينتمي درس «${lesson}» إلى أي وحدة؟`,
      options: unitOptions,
      answer: unit,
      answerIndex: unitOptions.indexOf(unit),
      difficulty: 'سهل',
      maxScore: 1,
      source: 'auto',
    }),
    buildQuestion(`${base}-source-mcq`, {
      ...common,
      type: 'mcq',
      text: `ما المصدر الأساسي المرتبط بهذا الجزء من درس «${lesson}»؟`,
      options: sourceOptions,
      answer: label,
      answerIndex: sourceOptions.indexOf(label),
      difficulty: 'سهل',
      maxScore: 1,
      source: 'auto',
    }),
    buildQuestion(`${base}-content-tf`, {
      ...common,
      type: 'tf',
      text: `المحتوى الحالي من «${label}» ومرتبط بدرس «${lesson}».`,
      options: ['صح', 'خطأ'],
      answer: 'صح',
      answerIndex: 0,
      difficulty: 'سهل',
      maxScore: 1,
      source: 'auto',
    }),
    buildQuestion(`${base}-concept`, {
      ...common,
      type: 'fill',
      text: `${pages}: اكتب اسم الدرس الذي تشرحه هذه الصفحات أو المادة.`,
      answer: lesson,
      difficulty: 'سهل',
      maxScore: 1,
      source: 'auto',
    }),
    buildQuestion(`${base}-main-idea`, {
      ...common,
      type: 'essay',
      text: `اشرح الفكرة الرئيسة في درس «${lesson}» اعتمادًا على ${label}.`,
      answer: modelIdea,
      difficulty: 'متوسط',
      maxScore: 3,
      source: 'auto',
    }),
  ];

  items.push(...buildQuestionsFromNotes(resource, base, common));

  if (kind === 'exams') {
    items.push(buildQuestion(`${base}-exam-training`, {
      ...common,
      type: 'mcq',
      text: `أي تدريب يجب اختياره لمراجعة درس «${lesson}» وفق ملف الامتحانات الرئيسي؟`,
      options: uniqueOptions(`أسئلة ${lesson}`, [
        `أسئلة درس مختلف من ${unit}`,
        'أسئلة غير مرتبطة بالمنهج',
        'تدريبات بلا إجابات أو مصدر',
      ]),
      answer: `أسئلة ${lesson}`,
      answerIndex: 0,
      difficulty: 'سهل',
      maxScore: 1,
      source: 'auto',
    }));
  }

  if (/خريطة|map|خرائط|جغراف/i.test(`${title} ${lesson} ${unit} ${topic}`) || resource.type === 'map' || resource.mapState) {
    items.push(buildQuestion(`${base}-map`, {
      ...common,
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
      ...common,
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
    sourceKind: kind,
    sourceLabel: label,
    sourceResourceId: resource.sourceResourceId || resource.id,
    sourceAssetId: resource.assetId || '',
    sourceFileName: resource.fileName || '',
    sourceExamResourceId: resource.sourceExamResourceId || (kind === 'exams' ? resource.id : ''),
    sourceExamAssetId: resource.sourceExamAssetId || (kind === 'exams' ? resource.assetId || '' : ''),
    sourceExamFileName: resource.sourceExamFileName || (kind === 'exams' ? resource.fileName || '' : ''),
    sourcePageStart: resource.pageStart || '',
    sourcePageEnd: resource.pageEnd || '',
    questionOrigin: kind === 'exams' ? 'official-exams' : kind === 'textbook' ? 'official-textbook' : 'lesson-content',
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
    lessonTitle: lesson.title || lesson.lesson || resource.lesson || '',
  })));

  const seen = new Set();
  return generated.filter((question) => {
    const key = `${question.type}|${normalize(question.text)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 80);
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
    const sameLesson = String(question?.lessonId ?? '') === key;
    const samePrefix = String(question?.id ?? '').startsWith(prefix);
    return !(sameResource || sameLesson || samePrefix);
  });
}
