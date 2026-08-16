function normalizeDigits(value = '') {
  return String(value)
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
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

function isHeading(line = '') {
  return /^(?:تدريبات|اسئلة|أسئلة|اختبر نفسك|تقويم|مراجعة|انشطة|أنشطة|النشاط|الاجابات|الإجابات|نموذج الاجابة|نموذج الإجابة)\b/iu.test(line);
}

function isQuestionStart(line = '') {
  return /^(?:س(?:ؤال)?\s*[:：-]|\d{1,3}\s*[.)\-–—:]|(?:اختر|أكمل|اكمل|ضع|بم تفسر|فسر|علل|ما النتائج|ما المقصود|قارن|اذكر|حدد|دلل|صحح|رتب|اكتب|أجب|اجب)\b)/iu.test(line)
    || /[؟?]$/.test(line);
}

function optionMatch(line = '') {
  return line.match(/^(?:\(?([أاببججددهـ])\)?|([A-Da-d])|([1-4]))\s*[.)\-–—:]\s*(.{1,240})$/u);
}

function answerMatch(line = '') {
  return line.match(/^(?:الإجابة|الاجابة|الإجابات|الاجابات|الحل|ج(?:واب|ابة)?)\s*[:：-]\s*(.{1,260})$/iu);
}

function normalizeQuestionLead(line = '') {
  return line
    .replace(/^س(?:ؤال)?\s*[:：-]?\s*/iu, '')
    .replace(/^\d{1,3}\s*[.)\-–—:]\s*/u, '')
    .trim();
}

export function structureOcrQuestions(rawText = '') {
  const lines = normalizeOcrText(rawText)
    .split('\n')
    .map(cleanLine)
    .filter(Boolean);

  const blocks = [];
  let current = null;
  let activePage = 0;

  const flush = () => {
    if (!current?.question) return;
    current.question = normalizeOcrText(current.question);
    current.answer = normalizeOcrText(current.answer || '');
    current.options = current.options.map((item) => normalizeOcrText(item)).filter(Boolean);
    blocks.push(current);
    current = null;
  };

  for (const line of lines) {
    const pageMarker = line.match(/^(?:صفحة|page)\s*(\d{1,5})\b/iu);
    if (pageMarker) {
      flush();
      activePage = Number(pageMarker[1]);
      continue;
    }
    if (isHeading(line)) continue;

    const answer = answerMatch(line);
    if (answer && current) {
      current.answer = answer[1];
      continue;
    }

    if (isQuestionStart(line)) {
      flush();
      current = { question: normalizeQuestionLead(line), options: [], answer: '', page: activePage || null };
      continue;
    }

    const option = optionMatch(line);
    if (option && current) {
      current.options.push(option[4]);
      continue;
    }

    if (current) {
      if (/^(?:صح|خطأ|صواب|خطا)\b/iu.test(line) && !current.answer) current.answer = line;
      else current.question = `${current.question} ${line}`.trim();
    }
  }
  flush();

  const output = [];
  let answeredCount = 0;
  for (const block of blocks) {
    output.push(`س: ${block.question}`);
    block.options.forEach((option, index) => {
      const labels = ['أ', 'ب', 'ج', 'د'];
      output.push(`${labels[index] || index + 1}) ${option}`);
    });
    if (block.answer) {
      answeredCount += 1;
      output.push(`الإجابة: ${block.answer}`);
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
      id: `ocr-question-${index + 1}`,
      question: block.question,
      options: [...block.options],
      answer: block.answer,
      page: block.page || null,
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
