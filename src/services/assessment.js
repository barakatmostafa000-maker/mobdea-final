const TYPE_META = {
  mcq: { label: 'اختيار متعدد', autoGradable: true },
  tf: { label: 'صح أو خطأ', autoGradable: true },
  fill: { label: 'أكمل', autoGradable: false },
  essay: { label: 'مقالي', autoGradable: false },
  matching: { label: 'مطابقة', autoGradable: false },
  timeline: { label: 'خط زمني', autoGradable: false },
  character: { label: 'من الشخصية؟', autoGradable: false },
  map: { label: 'خرائط', autoGradable: false }
};

export function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function fingerprintQuestion(question) {
  const gradeKey = normalizeText(question?.gradeKey);
  const unit = normalizeText(question?.unit);
  const lesson = normalizeText(question?.lesson);
  const text = normalizeText(question?.text).toLowerCase();
  return `${gradeKey}|${unit}|${lesson}|${text}`;
}

export function isAutoGradable(question) {
  return Boolean(TYPE_META[question?.type]?.autoGradable);
}

export function getQuestionTypeLabel(type) {
  return TYPE_META[type]?.label || type || 'سؤال';
}

export function sanitizeQuestion(input = {}, fallback = {}) {
  const gradeKey = String(input.gradeKey ?? fallback.gradeKey ?? '6');
  const grade = normalizeText(input.grade || fallback.grade || 'غير محدد') || 'غير محدد';
  const type = input.type || fallback.type || 'mcq';
  const options = Array.isArray(input.options)
    ? input.options.map((option) => normalizeText(option)).filter(Boolean)
    : [];

  return {
    id: input.id || fallback.id || `custom-${Date.now()}`,
    gradeKey,
    grade,
    term: normalizeText(input.term || fallback.term || 'الترم الأول') || 'الترم الأول',
    unit: normalizeText(input.unit || fallback.unit || 'غير محدد') || 'غير محدد',
    lesson: normalizeText(input.lesson || fallback.lesson || 'غير محدد') || 'غير محدد',
    topic: normalizeText(input.topic || fallback.topic || 'عام') || 'عام',
    type,
    text: normalizeText(input.text || fallback.text),
    options,
    answer: normalizeText(input.answer ?? fallback.answer ?? ''),
    answerIndex: Number.isFinite(Number(input.answerIndex ?? fallback.answerIndex))
      ? Number(input.answerIndex ?? fallback.answerIndex)
      : 0,
    difficulty: normalizeText(input.difficulty || fallback.difficulty || 'متوسط') || 'متوسط',
    maxScore: Math.max(1, Number(input.maxScore || fallback.maxScore || 1)),
    source: input.source || fallback.source || 'custom'
  };
}

export function mergeQuestionBanks(...banks) {
  const seen = new Set();
  const merged = [];
  banks.flat().filter(Boolean).forEach((question) => {
    const key = fingerprintQuestion(question);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(question);
  });
  return merged;
}

export function resolveExamQuestions(exam, banks = []) {
  const lookup = new Map();
  banks.flat().forEach((question) => lookup.set(String(question.id), question));
  return (exam?.questionIds || [])
    .map((id) => lookup.get(String(id)))
    .filter(Boolean);
}

export function buildExamFromPool(pool = [], { title, grade, count = 20, shuffle = true, generated = true } = {}) {
  const source = [...pool];
  if (!source.length) return null;
  if (shuffle) source.sort(() => Math.random() - 0.5);
  const chosen = source.slice(0, Math.min(count, source.length));
  const first = chosen[0];
  return {
    id: `exam-${Date.now()}`,
    title: normalizeText(title) || `اختبار مولد تلقائيًا - ${new Date().toLocaleDateString('ar-EG')}`,
    grade: grade || first?.grade || 'غير محدد',
    questionIds: chosen.map((item) => item.id),
    active: true,
    generated,
    createdAt: new Date().toISOString(),
    totalScore: chosen.reduce((sum, item) => sum + Number(item.maxScore || 1), 0)
  };
}

export function calculateQuestionOutcome(question, status = 'blank') {
  const maxScore = Number(question?.maxScore || 1);
  const factor = {
    correct: 1,
    partial: 0.5,
    wrong: 0,
    blank: 0
  }[status] ?? 0;
  return {
    questionId: question?.id,
    status,
    score: Math.round(maxScore * factor * 100) / 100,
    maxScore,
    unit: question?.unit || '',
    lesson: question?.lesson || '',
    topic: question?.topic || '',
    questionText: question?.text || ''
  };
}

export function scoreQuestionResponse(question, response) {
  if (!question) return { status: 'blank', score: 0, maxScore: 0 };
  const maxScore = Number(question.maxScore || 1);

  if (response == null || response === '') {
    return { status: 'blank', score: 0, maxScore };
  }

  if (question.type === 'mcq') {
    const expectedIndex = Number(question.answerIndex);
    const actualIndex = Number(response);
    return {
      status: Number.isFinite(expectedIndex) && expectedIndex === actualIndex ? 'correct' : 'wrong',
      score: Number.isFinite(expectedIndex) && expectedIndex === actualIndex ? maxScore : 0,
      maxScore
    };
  }

  if (question.type === 'tf') {
    const expected = normalizeText(question.answer || question.options?.[Number(question.answerIndex)] || '');
    const actual = normalizeText(response);
    const isCorrect = expected && actual && expected === actual;
    return {
      status: isCorrect ? 'correct' : 'wrong',
      score: isCorrect ? maxScore : 0,
      maxScore
    };
  }

  return {
    status: 'partial',
    score: Math.round(maxScore * 0.5 * 100) / 100,
    maxScore
  };
}

export function buildAssessmentSummary(results = []) {
  const totalStudents = results.length;
  const average = totalStudents
    ? Math.round(results.reduce((sum, item) => sum + Number(item.pct || 0), 0) / totalStudents)
    : 0;
  const passCount = results.filter((item) => Number(item.pct || 0) >= 60).length;
  const passRate = totalStudents ? Math.round((passCount / totalStudents) * 100) : 0;
  return { totalStudents, average, passRate, passCount };
}

export function buildExamAnalytics(examResults = []) {
  const summary = buildAssessmentSummary(examResults);
  const topicMap = new Map();
  const weaknessMap = new Map();

  examResults.forEach((result) => {
    (result.questionResults || []).forEach((item) => {
      if (item.status === 'correct') {
        topicMap.set(item.topic, (topicMap.get(item.topic) || 0) + 1);
      } else {
        weaknessMap.set(item.topic, (weaknessMap.get(item.topic) || 0) + 1);
      }
    });
  });

  const strongest = [...topicMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const weakest = [...weaknessMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  return {
    ...summary,
    strongest,
    weakest,
    count: examResults.length
  };
}

export const questionTypeMeta = TYPE_META;
