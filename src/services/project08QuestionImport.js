// PROJECT08_OCR_EXAM_IMPORT_V1

function normalizeDigits(value = '') {
  return String(value)
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}

export function normalizeImportText(value = '') {
  return normalizeDigits(value)
    .normalize('NFKC')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[“”"'`´]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function questionImportFingerprint(question = {}) {
  const text = normalizeImportText(question.text || question.question);
  const options = (Array.isArray(question.options) ? question.options : [])
    .map(normalizeImportText).filter(Boolean).sort().join('|');
  return `${normalizeImportText(question.gradeKey || question.grade)}|${text}|${options}`;
}

function normalizeAnswer(question = {}) {
  const options = Array.isArray(question.options)
    ? question.options.map((option) => String(option || '').trim()).filter(Boolean)
    : [];
  let answer = String(question.answer || '').trim();
  let answerIndex = Number.isInteger(Number(question.answerIndex)) ? Number(question.answerIndex) : -1;

  const label = answer.replace(/[()[\].،,؛;:\-–—]/g, '').trim();
  const arabicIndex = ['أ', 'ب', 'ج', 'د'].indexOf(label);
  const latinIndex = ['a', 'b', 'c', 'd'].indexOf(label.toLowerCase());
  if (arabicIndex >= 0 && options[arabicIndex]) {
    answerIndex = arabicIndex;
    answer = options[arabicIndex];
  } else if (latinIndex >= 0 && options[latinIndex]) {
    answerIndex = latinIndex;
    answer = options[latinIndex];
  } else if (answer) {
    const exact = options.findIndex((option) => normalizeImportText(option) === normalizeImportText(answer));
    if (exact >= 0) {
      answerIndex = exact;
      answer = options[exact];
    }
  } else if (answerIndex >= 0 && options[answerIndex]) {
    answer = options[answerIndex];
  }

  const truth = normalizeImportText(answer);
  if (['صح', 'صواب', 'true'].includes(truth)) {
    answer = 'صح';
    answerIndex = 0;
  } else if (['خطا', 'false'].includes(truth)) {
    answer = 'خطأ';
    answerIndex = 1;
  }
  return { options, answer, answerIndex };
}

export function buildOcrImportCandidates(questions = [], context = {}) {
  const now = Date.now();
  return (Array.isArray(questions) ? questions : []).map((item, index) => {
    const text = String(item.question || item.text || '').trim();
    if (!text) return null;
    const normalized = normalizeAnswer(item);
    const inferredType = item.type === 'tf' || ['صح', 'خطأ'].includes(normalized.answer)
      ? 'tf'
      : normalized.options.length >= 2 ? 'mcq' : 'fill';
    const answerReady = Boolean(normalized.answer)
      && (inferredType !== 'mcq' || normalized.answerIndex >= 0);
    return {
      id: `ocr-import-${now}-${index + 1}`,
      gradeKey: String(context.gradeKey || item.gradeKey || '6'),
      grade: String(context.grade || item.grade || 'غير محدد').trim() || 'غير محدد',
      term: String(context.term || item.term || 'الترم الأول').trim() || 'الترم الأول',
      unit: String(context.unit || item.unit || 'مستورد من ملف الامتحانات').trim() || 'مستورد من ملف الامتحانات',
      lesson: String(context.lesson || item.lesson || 'أسئلة مستوردة').trim() || 'أسئلة مستوردة',
      topic: String(context.topic || item.topic || 'أسئلة الامتحانات').trim() || 'أسئلة الامتحانات',
      type: inferredType,
      text,
      options: inferredType === 'tf' ? ['صح', 'خطأ'] : normalized.options,
      answer: normalized.answer,
      answerIndex: answerReady ? normalized.answerIndex : -1,
      difficulty: String(item.difficulty || 'متوسط'),
      maxScore: Math.max(1, Number(item.maxScore || 1)),
      source: 'ocr-exam',
      questionOrigin: 'official-exams-ocr',
      sourceResourceId: String(context.sourceResourceId || ''),
      sourceAssetId: String(context.sourceAssetId || ''),
      sourceFileName: String(context.sourceFileName || ''),
      ocrPage: Number(item.page || 0) || '',
      needsAnswer: !answerReady,
      approved: false,
    };
  }).filter(Boolean);
}

export function isQuestionReadyForGame(question = {}) {
  const answer = String(question.answer || '').trim();
  if (!answer) return false;
  if (question.type === 'mcq') {
    const index = Number(question.answerIndex);
    return Number.isInteger(index) && index >= 0
      && Array.isArray(question.options) && Boolean(question.options[index]);
  }
  if (question.type === 'tf') return ['صح', 'خطأ'].includes(answer);
  return true;
}

export function dedupeImportedQuestions(candidates = [], existing = []) {
  const seen = new Set((Array.isArray(existing) ? existing : []).map(questionImportFingerprint));
  const accepted = [];
  const duplicates = [];
  for (const question of Array.isArray(candidates) ? candidates : []) {
    const key = questionImportFingerprint(question);
    if (!key || seen.has(key)) {
      duplicates.push(question);
      continue;
    }
    seen.add(key);
    accepted.push(question);
  }
  return { accepted, duplicates };
}
