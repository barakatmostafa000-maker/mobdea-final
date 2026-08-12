import { sanitizeQuestion } from './assessment.js';
import { gradeOptions } from '../data/questionBank.js';
import { questionFingerprint } from './questionRotation.js';

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

function officialQuestionKind(resource = {}, fallbackKind = sourceKind(resource)) {
  const ocrKind = normalize(resource.ocrSourceKind || '').toLowerCase();
  const hasReviewQueue = Array.isArray(resource.ocrReviewQuestions) && resource.ocrReviewQuestions.length > 0;
  const reviewed = hasReviewQueue && resource.ocrReviewQuestions.some((item) => item.approved && item.answer);
  if (hasReviewQueue && !reviewed) return '';
  if (['textbook', 'exams'].includes(ocrKind) && (reviewed || resource.questionText || resource.extractedText)) return ocrKind;
  if (['textbook', 'exams'].includes(fallbackKind) && (reviewed || resource.questionText || resource.extractedText)) return fallbackKind;
  return '';
}

function questionOriginForKind(kind = '') {
  if (kind === 'textbook') return 'official-textbook';
  if (kind === 'exams') return 'official-exams';
  return 'lesson-content';
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

export function parseStructuredQuestionText(value = '') {
  const raw = String(value || '').replace(/\r/g, '\n').trim();
  if (!raw) return [];
  const lines = raw.split(/\n+/).map((line) => normalize(line)).filter(Boolean);
  const items = [];
  let current = null;

  const flush = () => {
    if (!current?.question || !current?.answer) {
      current = null;
      return;
    }
    const labels = ['أ', 'ب', 'ج', 'د'];
    const labelIndex = labels.indexOf(current.answer.replace(/[.)\-–—:]/g, '').trim());
    if (labelIndex >= 0 && current.options[labelIndex]) current.answer = current.options[labelIndex];
    items.push({
      question: normalize(current.question),
      answer: normalize(current.answer),
      options: current.options.map(normalize).filter(Boolean),
      type: current.type || '',
    });
    current = null;
  };

  for (const line of lines) {
    const inline = line.match(/^(?:س(?:ؤال)?\s*[:：-]?\s*)?(.{6,260}?[؟?])\s*(?:=>|→|\||الإجابة\s*[:：-]|الاجابة\s*[:：-]|ج(?:واب|ابة)?\s*[:：-])\s*(.{1,220})$/u);
    if (inline) {
      flush();
      current = { question: inline[1], answer: inline[2], options: [], type: '' };
      flush();
      continue;
    }

    const questionLine = line.match(/^(?:س(?:ؤال)?\s*[:：-]\s*|\d{1,3}\s*[.)\-–—:]\s*)(.{4,300})$/u);
    if (questionLine) {
      flush();
      current = { question: questionLine[1], answer: '', options: [], type: '' };
      continue;
    }

    const answerLine = line.match(/^(?:الإجابة|الاجابة|الحل|ج(?:واب|ابة)?)\s*[:：-]\s*(.{1,240})$/u);
    if (answerLine && current) {
      current.answer = answerLine[1];
      flush();
      continue;
    }

    const optionLine = line.match(/^(?:\(?([أاببججددهـ])\)?|([A-Da-d])|([1-4]))\s*[.)\-–—:]\s*(.{1,240})$/u);
    if (optionLine && current) {
      current.options.push(optionLine[4]);
      continue;
    }

    const truth = line.match(/^(.{8,260}?)\s*[（(]?(صح|خطأ)[）)]?$/u);
    if (truth) {
      flush();
      current = { question: truth[1], answer: truth[2], options: ['صح', 'خطأ'], type: 'tf' };
      flush();
      continue;
    }

    if (/[؟?]$/.test(line)) {
      flush();
      current = { question: line, answer: '', options: [], type: '' };
      continue;
    }

    if (current && !current.options.length && !current.answer) {
      current.question = `${current.question} ${line}`;
    }
  }
  flush();
  return items;
}

function buildQuestionsFromQuestionText(resource, baseId, common, officialKind = 'textbook') {
  const reviewQueue = Array.isArray(resource.ocrReviewQuestions) ? resource.ocrReviewQuestions : [];
  const reviewed = reviewQueue
    .filter((item) => item.approved && normalize(item.question || item.text) && normalize(item.answer))
    .map((item) => ({
      question: normalize(item.question || item.text),
      answer: normalize(item.answer),
      options: Array.isArray(item.options) ? item.options.map(normalize).filter(Boolean) : [],
      type: item.type || '',
      page: Number(item.page || 0) || '',
    }));
  const pairs = reviewQueue.length ? reviewed : parseStructuredQuestionText(resource.questionText || resource.extractedText || '');
  const answers = pairs.map((item) => item.answer).filter(Boolean);
  return pairs.slice(0, 120).map((item, index) => {
    if (item.type === 'tf' || ['صح', 'خطأ'].includes(item.answer)) {
      return { ...buildQuestion(`${baseId}-book-question-${index + 1}`, {
        ...common,
        type: 'tf',
        text: item.question,
        options: ['صح', 'خطأ'],
        answer: item.answer,
        answerIndex: item.answer === 'صح' ? 0 : 1,
        difficulty: 'متوسط',
        maxScore: 1,
        source: officialKind === 'exams' ? 'official-exams' : 'official-textbook',
      }), ocrPage: item.page || '' };
    }
    const distractors = answers
      .filter((answer) => answer !== item.answer)
      .slice(index % Math.max(1, answers.length), index % Math.max(1, answers.length) + 3);
    const options = item.options.length >= 2
      ? uniqueOptions(item.answer, item.options)
      : uniqueOptions(item.answer, [...distractors, 'لا ينطبق على موضوع الدرس', 'إجابة غير صحيحة']);
    return { ...buildQuestion(`${baseId}-book-question-${index + 1}`, {
      ...common,
      type: 'mcq',
      text: item.question,
      options,
      answer: item.answer,
      answerIndex: options.indexOf(item.answer),
      difficulty: 'متوسط',
      maxScore: 2,
      source: officialKind === 'exams' ? 'official-exams' : 'official-textbook',
    }), ocrPage: item.page || '' };
  });
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
  const officialKind = officialQuestionKind(resource, kind);
  const textbookQuestions = buildQuestionsFromQuestionText(resource, base, common, officialKind || 'textbook');
  const hasOfficialQuestionBank = Boolean(officialKind && textbookQuestions.length);

  const lessonOptions = uniqueOptions(lesson, distractorsForLesson(resource));
  const unitOptions = uniqueOptions(unit, ['الوحدة الأولى', 'الوحدة الثانية', 'مراجعة عامة']);
  const sourceOptions = uniqueOptions(label, [
    'ملف غير مرتبط بالصف الحالي',
    'مورد ترفيهي خارج الدرس',
    'سجل إداري للطلاب',
  ]);

  const items = hasOfficialQuestionBank ? [...textbookQuestions] : [
    ...textbookQuestions,
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

  if (!hasOfficialQuestionBank) items.push(...buildQuestionsFromNotes(resource, base, common));

  if (!hasOfficialQuestionBank && kind === 'exams') {
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

  if (!hasOfficialQuestionBank && (/خريطة|map|خرائط|جغراف/i.test(`${title} ${lesson} ${unit} ${topic}`) || resource.type === 'map' || resource.mapState)) {
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

  if (!hasOfficialQuestionBank && homework) {
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
    generated: true,
    resourceId: resource.id,
    resourceTitle: title,
    sourceKind: officialKind || kind,
    sourceLabel: officialKind === 'exams' ? RESOURCE_TYPE_LABELS.exams : officialKind === 'textbook' ? RESOURCE_TYPE_LABELS.textbook : label,
    sourceResourceId: resource.sourceResourceId || resource.id,
    sourceAssetId: resource.ocrSourceAssetId || resource.assetId || '',
    sourceFileName: resource.fileName || '',
    sourceExamResourceId: resource.sourceExamResourceId || ((officialKind || kind) === 'exams' ? resource.id : ''),
    sourceExamAssetId: resource.sourceExamAssetId || ((officialKind || kind) === 'exams' ? (resource.ocrSourceAssetId || resource.assetId || '') : ''),
    sourceExamFileName: resource.sourceExamFileName || ((officialKind || kind) === 'exams' ? resource.fileName || '' : ''),
    sourcePageStart: question.ocrPage || (officialKind ? (resource.questionPageStart || resource.pageStart || '') : (kind === 'textbook' ? (resource.questionPageStart || resource.pageStart || '') : (resource.pageStart || ''))),
    sourcePageEnd: question.ocrPage || (officialKind ? (resource.questionPageEnd || resource.pageEnd || '') : (kind === 'textbook' ? (resource.questionPageEnd || resource.pageEnd || '') : (resource.pageEnd || ''))),
    questionOrigin: questionOriginForKind(officialKind || kind),
    source: question.questionOrigin || question.source || (officialKind ? questionOriginForKind(officialKind) : 'auto'),
  }));
}

export function generateQuestionsForLessonBundle(lesson = {}, resources = []) {
  const all = [lesson, ...(Array.isArray(resources) ? resources : [])].filter(Boolean);
  const chosenOfficialKind = normalize(lesson.ocrSourceKind || '').toLowerCase();
  const generated = all.flatMap((resource) => {
    const resourceKind = sourceKind(resource);
    const receivesLessonOcr = Boolean(lesson.questionText && ['textbook', 'exams'].includes(chosenOfficialKind) && resourceKind === chosenOfficialKind);
    const isLessonRecord = String(resource.id || '') === String(lesson.id || '');
    const questionText = resource.questionText
      || (receivesLessonOcr ? lesson.questionText : '')
      || (!chosenOfficialKind && isLessonRecord ? (lesson.questionText || lesson.extractedText || '') : '')
      || resource.extractedText
      || '';
    return generateQuestionsFromResource({
      ...resource,
      grade: resource.grade || lesson.grade,
      term: resource.term || lesson.term,
      unit: resource.unit || lesson.unit,
      lesson: resource.lesson || lesson.title || lesson.lesson,
      notes: resource.notes || lesson.notes,
      homework: resource.homework || lesson.homework,
      questionText,
      ocrSourceKind: receivesLessonOcr ? chosenOfficialKind : resource.ocrSourceKind,
      ocrSourceAssetId: receivesLessonOcr ? (lesson.ocrSourceAssetId || resource.assetId || '') : resource.ocrSourceAssetId,
      ocrExtractedAt: receivesLessonOcr ? lesson.ocrExtractedAt : resource.ocrExtractedAt,
      ocrReviewQuestions: receivesLessonOcr ? lesson.ocrReviewQuestions : resource.ocrReviewQuestions,
      questionPageStart: receivesLessonOcr ? lesson.questionPageStart : resource.questionPageStart,
      questionPageEnd: receivesLessonOcr ? lesson.questionPageEnd : resource.questionPageEnd,
    }).map((question) => ({
    ...question,
    lessonId: lesson.id || resource.lessonId || resource.parentLessonId || '',
    lessonTitle: lesson.title || lesson.lesson || resource.lesson || '',
    }));
  });

  const hasOfficial = generated.some((question) => ['official-textbook', 'official-exams'].includes(question.questionOrigin));
  const eligible = hasOfficial
    ? generated.filter((question) => ['official-textbook', 'official-exams'].includes(question.questionOrigin))
    : generated;
  const priority = { 'official-textbook': 0, 'official-exams': 1, 'lesson-content': 2 };
  eligible.sort((left, right) => (priority[left.questionOrigin] ?? 3) - (priority[right.questionOrigin] ?? 3));
  const seen = new Set();
  return eligible.filter((question) => {
    const key = `${question.type}|${questionFingerprint(question)}`;
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
        const generated = question?.generated === true || String(question?.id || '').startsWith('auto-');
        if (!generated) return true;
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
    const generated = question?.generated === true || String(question?.id || '').startsWith('auto-');
    if (!generated) return true;
    const sameResource = String(question?.resourceId ?? '') === key;
    const sameLesson = String(question?.lessonId ?? '') === key;
    const samePrefix = String(question?.id ?? '').startsWith(prefix);
    return !(sameResource || sameLesson || samePrefix);
  });
}
