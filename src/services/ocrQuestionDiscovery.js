import { normalizeOcrText, structureOcrQuestions } from './ocrQuestionParser.js';

export function scoreQuestionPageText(text = '') {
  const normalized = normalizeOcrText(text);
  if (!normalized) return { score: 0, parsed: 0 };
  const headingHits = (normalized.match(/(?:أسئلة|اسئلة|تدريبات|اختبر نفسك|تقويم|مراجعة|أجب|اجب عن|اختر|أكمل|اكمل|صح أو خطأ|صح وخطأ)/giu) || []).length;
  const questionMarks = (normalized.match(/[؟?]/g) || []).length;
  const numbered = (normalized.match(/(?:^|\n)\s*\d{1,3}\s*[.)\-–—:]/g) || []).length;
  const options = (normalized.match(/(?:^|\n)\s*(?:[أبجدهـA-Da-d1-4])\s*[.)\-–—:]/gu) || []).length;
  const answers = (normalized.match(/(?:الإجابة|الاجابة|الحل|نموذج الإجابة|نموذج الاجابة)\s*[:：\-]?/giu) || []).length;
  const commands = (normalized.match(/(?:بم تفسر|فسر|علل|ما النتائج|ما المقصود|قارن|اذكر|حدد|دلل|صحح|رتب)/giu) || []).length;
  const parsed = structureOcrQuestions(normalized).questionCount;
  const score = headingHits * 6 + parsed * 4 + Math.min(questionMarks, 8) * 2 + Math.min(numbered, 12) + Math.min(options, 16) * 0.75 + answers * 2 + commands * 2;
  return { score, parsed };
}

export function selectQuestionPageWindow(pages = []) {
  const scored = pages.map((page) => ({
    ...page,
    ...scoreQuestionPageText(page.text || ''),
  }));
  if (!scored.length) return { pages: [], scored };

  const strongest = scored.reduce((best, item) => item.score > best.score ? item : best, scored[0]);
  if (strongest.score < 3) return { pages: [], scored };

  let startIndex = scored.indexOf(strongest);
  while (startIndex > 0 && scored[startIndex - 1].score >= 3) startIndex -= 1;

  let endIndex = scored.indexOf(strongest);
  let lowRun = 0;
  for (let index = endIndex + 1; index < scored.length; index += 1) {
    if (scored[index].score >= 2 || scored[index].parsed > 0) {
      endIndex = index;
      lowRun = 0;
    } else {
      lowRun += 1;
      if (lowRun >= 2) break;
      endIndex = index;
    }
  }

  if (startIndex > 0 && scored[startIndex - 1].score >= 2) startIndex -= 1;
  const selected = scored.slice(startIndex, endIndex + 1).filter((item, index, list) => {
    if (item.score >= 1.5 || item.parsed > 0) return true;
    return index > 0 && index < list.length - 1;
  });
  return { pages: selected, scored };
}
