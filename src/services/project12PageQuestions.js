// PROJECT12_PAGE_AWARE_QUESTIONS_V1
import { isQuestionReadyForGame, questionImportFingerprint } from './project08QuestionImport.js';

const norm = (value = '') => String(value ?? '').trim().toLowerCase();

function readPage(question = {}) {
  for (const value of [question.ocrPage, question.pdfPage, question.pageNumber, question.page]) {
    const page = Number(value);
    if (Number.isInteger(page) && page > 0) return page;
  }
  return 0;
}

function sameResource(question = {}, resource = {}) {
  const qAsset = String(question.sourceAssetId || '');
  const qResource = String(question.sourceResourceId || '');
  const assets = [resource.assetId, resource.examAssetId, resource.sourceAssetId].filter(Boolean).map(String);
  const resources = [resource.id, resource.sourceResourceId].filter(Boolean).map(String);
  if (qAsset && assets.includes(qAsset)) return true;
  if (qResource && resources.includes(qResource)) return true;
  const qFile = norm(question.sourceFileName || question.fileName);
  const files = [resource.fileName, resource.sourceExamFileName].map(norm).filter(Boolean);
  return Boolean(qFile && files.includes(qFile));
}

function sameLesson(question = {}, lesson = {}, resource = {}) {
  const qLesson = norm(question.lesson || question.lessonTitle);
  const names = [lesson.title, lesson.lesson, resource.lesson, resource.title].map(norm).filter(Boolean);
  if (qLesson && names.some((name) => name === qLesson || name.includes(qLesson) || qLesson.includes(name))) return true;
  const qGrade = norm(question.grade);
  const grade = norm(lesson.grade || resource.grade);
  return Boolean(qGrade && grade && qGrade === grade);
}

function uniqueReady(items = []) {
  const seen = new Set();
  const result = [];
  for (const question of Array.isArray(items) ? items : []) {
    if (!question || !isQuestionReadyForGame(question)) continue;
    const key = question.id ? `id:${question.id}` : questionImportFingerprint(question);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(question);
  }
  return result;
}

export function buildPageAwareQuestionSets({
  allQuestions = [],
  relatedQuestions = [],
  resource = {},
  lesson = {},
  page = 1,
} = {}) {
  const bank = uniqueReady(allQuestions);
  const currentPage = Math.max(1, Number(page || 1));
  const pageQuestions = bank.filter((question) => readPage(question) === currentPage && sameResource(question, resource));
  const lessonQuestions = uniqueReady([
    ...relatedQuestions,
    ...bank.filter((question) => sameResource(question, resource) || sameLesson(question, lesson, resource)),
  ]);
  return {
    currentPage,
    page: pageQuestions,
    lesson: lessonQuestions,
    manual: uniqueReady(relatedQuestions),
    pageCount: pageQuestions.length,
    lessonCount: lessonQuestions.length,
  };
}

export function pickPageQuestionScope(sets = {}, scope = 'page') {
  if (scope === 'page') return sets.page || [];
  if (scope === 'lesson') return sets.lesson || [];
  return sets.manual || [];
}
