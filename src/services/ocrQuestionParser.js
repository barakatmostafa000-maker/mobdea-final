// PROJECT08_OCR_EXAM_IMPORT_V1

function normalizeDigits(value = '') {
  return String(value)
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}

function normalizeArabicLetters(value = '') {
  return String(value)
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[ًٌٍَُِّْـ]/g, '');
}

export function normalizeOcrText(value = '') {
  return normalizeDigits(value)
    .replace(/\r/g, '\n')
    .replace(/[ـ]+/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([،؛:؟.!])/g, '$1')
    .replace(/([،؛:؟.!])(?=[\p{L}\p{N}])/gu, '$1 ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanLine(value = '') {
  return normalizeOcrText(value)
    .replace(/^[•●▪◦*]+\s*/u, '')
    .replace(/^[-–—]+\s*/u, '')
    .trim();
}

function canonical(value = '') {
  return normalizeArabicLetters(normalizeOcrText(value))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isHeading(line = '') {
  return /^(?:تدريبات|اسئلة|أسئلة|اختبر نفسك|تقويم|مراجعة|انشطة|أنشطة|النشاط|الاجابات|الإجابات|نموذج الاجابة|نموذج الإجابة|answer key|answers?)\b/iu.test(line);
}

function isAnswerHeading(line = '') {
  return /^(?:الاجابات|الإجابات|نموذج الاجابة|نموذج الإجابة|answer key|answers?)\s*[:：-]?\s*$/iu.test(line);
}

function optionMatch(line = '') {
  return line.match(/^(?:\(?([أاببججددهـ])\)?|([A-Da-d])|([1-4]))\s*[.)\-–—:：]\s*(.{1,320})$/u);
}

function answerLineMatch(line = '') {
  return line.match(/^(?:الإجابة الصحيحة|الاجابة الصحيحة|الإجابة|الاجابة|الحل|جواب|answer)\s*[:：\-–—]\s*(.{1,320})$/iu);
}

function questionStartMatch(line = '') {
  return line.match(/^(?:(?:س(?:ؤال)?\s*)?(\d{1,3})\s*[.)\-–—:：]\s*)(.{4,520})$/u)
    || line.match(/^(?:س(?:ؤال)?\s*[:：\-–—]\s*)(.{4,520})$/iu);
}

function imperativeQuestion(line = '') {
  return /^(?:اختر|أكمل|اكمل|ضع|بم تفسر|فسر|علل|ما النتائج|ما المقصود|قارن|اذكر|حدد|دلل|صحح|رتب|اكتب|أجب|اجب)\b/iu.test(line);
}

function truthValue(value = '') {
  const key = canonical(value);
  if (['صح', 'صواب', 'true'].includes(key)) return 'صح';
  if (['خطا', 'false'].includes(key)) return 'خطأ';
  return '';
}

const optionLabels = ['أ', 'ب', 'ج', 'د'];
const latinLabels = ['a', 'b', 'c', 'd'];

function optionIndexFromAnswer(answer = '', options = []) {
  const clean = normalizeOcrText(answer).replace(/[()[\].،,؛;:\-–—]/g, '').trim();
  const canonicalAnswer = canonical(clean);
  const arabicIndex = optionLabels.findIndex((label) => canonical(label) === canonicalAnswer);
  if (arabicIndex >= 0 && options[arabicIndex]) return arabicIndex;
  const latinIndex = latinLabels.indexOf(clean.toLowerCase());
  if (latinIndex >= 0 && options[latinIndex]) return latinIndex;
  const numeric = Number(clean);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= options.length) return numeric - 1;
  return options.findIndex((option) => canonical(option) === canonicalAnswer);
}

function applyAnswer(block, rawAnswer = '') {
  if (!block) return;
  let answer = normalizeOcrText(rawAnswer);
  if (!answer) return;
  const truth = truthValue(answer);
  if (truth) {
    block.type = 'tf';
    block.options = ['صح', 'خطأ'];
    block.answer = truth;
    block.answerIndex = truth === 'صح' ? 0 : 1;
    return;
  }
  const answerIndex = optionIndexFromAnswer(answer, block.options);
  if (answerIndex >= 0 && block.options[answerIndex]) {
    block.answerIndex = answerIndex;
    block.answer = block.options[answerIndex];
    return;
  }
  block.answer = answer;
  block.answerIndex = block.options.length ? optionIndexFromAnswer(answer, block.options) : -1;
}

function parseAnswerKeyPairs(line = '') {
  const output = [];
  const source = normalizeOcrText(line)
    .replace(/^(?:الاجابات|الإجابات|نموذج الاجابة|نموذج الإجابة|answer key|answers?)\s*[:：-]?\s*/iu, '');
  const re = /(?:^|[\s،,؛;|])(\d{1,3})\s*[.)\-–—:：=]\s*([أاببججددهـA-Da-d1-4]|صح|خطأ|صواب|خطا)(?=$|[\s،,؛;|])/gu;
  let match;
  while ((match = re.exec(source))) output.push({ number: Number(match[1]), answer: match[2] });
  return output;
}

function parseInlineOptions(questionText = '') {
  const matches = [...String(questionText).matchAll(/(?:^|\s)([أاببججددهـA-Da-d])\s*[.)\-–—:：]\s*([^أاببججددهـA-Da-d]{1,160}?)(?=(?:\s[أاببججددهـA-Da-d]\s*[.)\-–—:：])|$)/gu)];
  if (matches.length < 2) return { question: questionText, options: [] };
  const firstIndex = matches[0].index ?? -1;
  return {
    question: firstIndex >= 0 ? questionText.slice(0, firstIndex).trim() : questionText,
    options: matches.map((match) => normalizeOcrText(match[2])).filter(Boolean),
  };
}

export function structureOcrQuestions(rawText = '') {
  const lines = normalizeOcrText(rawText).split('\n').map(cleanLine).filter(Boolean);
  const blocks = [];
  const answerKey = new Map();
  let current = null;
  let activePage = 0;
  let answerKeyMode = false;
  let sequence = 0;

  const flush = () => {
    if (!current?.question) {
      current = null;
      return;
    }
    current.question = normalizeOcrText(current.question);
    current.options = current.options.map((item) => normalizeOcrText(item)).filter(Boolean);
    if (!current.answer && current.number && answerKey.has(current.number)) applyAnswer(current, answerKey.get(current.number));
    current.answer = normalizeOcrText(current.answer || '');
    current.answerIndex = Number.isInteger(current.answerIndex) ? current.answerIndex : -1;
    current.needsAnswer = !current.answer;
    blocks.push(current);
    current = null;
  };

  const recordAnswerPairs = (line) => {
    const pairs = parseAnswerKeyPairs(line);
    pairs.forEach(({ number, answer }) => answerKey.set(number, answer));
    return pairs.length > 0;
  };

  for (const rawLine of lines) {
    const pageMarker = rawLine.match(/^(?:---\s*)?(?:صفحة|page)\s*(\d{1,5})\b.*$/iu);
    if (pageMarker) {
      flush();
      activePage = Number(pageMarker[1]);
      continue;
    }

    if (isAnswerHeading(rawLine)) {
      flush();
      answerKeyMode = true;
      continue;
    }

    if (answerKeyMode) {
      if (recordAnswerPairs(rawLine)) continue;
      if (isHeading(rawLine)) continue;
      if (questionStartMatch(rawLine) || imperativeQuestion(rawLine) || /[؟?]$/.test(rawLine)) answerKeyMode = false;
      else continue;
    }

    const directAnswer = answerLineMatch(rawLine);
    if (directAnswer && current) {
      applyAnswer(current, directAnswer[1]);
      continue;
    }

    // A numbered next question (2- ..., 3- ...) can look like a numeric option.
    // Prefer it as a question when its number advances the current item and the
    // current question already has enough structure to move on.
    const start = questionStartMatch(rawLine);
    const hasNumberedStart = Boolean(start && start.length >= 3 && /^\d+$/.test(String(start[1] || '')));
    const nextNumber = hasNumberedStart ? Number(start[1]) : 0;
    const likelyNextQuestion = Boolean(
      hasNumberedStart && current && nextNumber === Number(current.number || 0) + 1
      && (current.options.length >= 2 || /[؟?]$/.test(String(start[2] || '')))
    );

    if (start && (!current || likelyNextQuestion)) {
      flush();
      sequence += 1;
      const hasNumber = start.length >= 3 && /^\d+$/.test(String(start[1] || ''));
      const number = hasNumber ? Number(start[1]) : sequence;
      const rawQuestion = hasNumber ? start[2] : start[1];
      const inline = parseInlineOptions(rawQuestion);
      current = { number, question: inline.question, options: inline.options, answer: '', answerIndex: -1, page: activePage || null, type: '' };
      continue;
    }

    const option = optionMatch(rawLine);
    if (option && current) {
      current.options.push(normalizeOcrText(option[4]));
      continue;
    }

    if (start) {
      flush();
      sequence += 1;
      const hasNumber = start.length >= 3 && /^\d+$/.test(String(start[1] || ''));
      const number = hasNumber ? Number(start[1]) : sequence;
      const rawQuestion = hasNumber ? start[2] : start[1];
      const inline = parseInlineOptions(rawQuestion);
      current = { number, question: inline.question, options: inline.options, answer: '', answerIndex: -1, page: activePage || null, type: '' };
      continue;
    }

    const truth = rawLine.match(/^(.{8,400}?)\s*[（(]?(صح|خطأ|صواب|خطا)[）)]?\s*$/u);
    if (truth) {
      flush();
      sequence += 1;
      const answer = truthValue(truth[2]);
      current = { number: sequence, question: truth[1], options: ['صح', 'خطأ'], answer, answerIndex: answer === 'صح' ? 0 : 1, page: activePage || null, type: 'tf' };
      flush();
      continue;
    }

    if (imperativeQuestion(rawLine) || /[؟?]$/.test(rawLine)) {
      flush();
      sequence += 1;
      const inline = parseInlineOptions(rawLine);
      current = { number: sequence, question: inline.question, options: inline.options, answer: '', answerIndex: -1, page: activePage || null, type: '' };
      continue;
    }

    if (current) current.question = `${current.question} ${rawLine}`.trim();
  }
  flush();

  blocks.forEach((block, index) => {
    if (!block.answer) applyAnswer(block, answerKey.get(block.number || index + 1) || '');
    block.needsAnswer = !String(block.answer || '').trim();
    if (block.type !== 'tf') block.type = block.options.length >= 2 ? 'mcq' : 'fill';
  });

  const output = [];
  let answeredCount = 0;
  for (const block of blocks) {
    output.push(`س: ${block.question}`);
    block.options.forEach((optionText, index) => output.push(`${optionLabels[index] || index + 1}) ${optionText}`));
    if (block.answer) {
      answeredCount += 1;
      output.push(`الإجابة: ${block.answer}`);
    } else {
      output.push('الإجابة: [تحتاج إدخال المعلم]');
    }
    output.push('');
  }

  return {
    rawText: normalizeOcrText(rawText),
    questionText: output.join('\n').trim(),
    questionCount: blocks.length,
    answeredCount,
    reviewCount: Math.max(0, blocks.length - answeredCount),
    questions: blocks.map((block, index) => ({
      id: `ocr-question-${block.page || 0}-${block.number || index + 1}-${index + 1}`,
      question: block.question,
      options: [...block.options],
      answer: block.answer,
      answerIndex: block.answerIndex,
      type: block.type,
      page: block.page || null,
      needsAnswer: Boolean(block.needsAnswer),
      approved: false,
    })),
  };
}

export function contextualizeOcrQuestions(questions = [], context = {}) {
  return (Array.isArray(questions) ? questions : []).map((item) => ({
    ...item,
    sourceKind: String(context.sourceKind || item.sourceKind || ''),
    sourceAssetId: String(context.sourceAssetId || item.sourceAssetId || ''),
    sourceTitle: String(context.sourceTitle || item.sourceTitle || ''),
    sourceFileName: String(context.sourceFileName || item.sourceFileName || ''),
    grade: String(context.grade || item.grade || ''),
    lesson: String(context.lesson || item.lesson || ''),
  }));
}
