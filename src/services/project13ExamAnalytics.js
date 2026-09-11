// PROJECT13_EXAM_ERROR_ANALYTICS_V1
import { getGradeExams } from './libraryModel.js';

export function wrongQuestionResults(result = {}) {
  return (result.questionResults || [])
    .map((item, index) => ({ ...item, questionNumber: index + 1 }))
    .filter((item) => item.status !== 'correct');
}

export function resultErrorQuestionIds(result = {}) {
  return wrongQuestionResults(result).map((item) => String(item.questionId || '')).filter(Boolean);
}

export function resolveExamSource(data = {}, exam = {}, student = null) {
  const grade = student?.grade || exam?.grade || '';
  const permanent = grade ? getGradeExams(data, grade) : null;
  return {
    resourceId: exam?.sourceResourceId || permanent?.id || '',
    assetId: exam?.sourceAssetId || permanent?.assetId || '',
    fileName: exam?.sourceFileName || permanent?.fileName || '',
    url: permanent?.url || '',
    grade,
  };
}

export function buildExamErrorIndex(results = [], examId = '') {
  const map = new Map();
  const filtered = (results || []).filter((result) => !examId || String(result.examId) === String(examId));
  for (const result of filtered) {
    for (const item of wrongQuestionResults(result)) {
      const key = String(item.questionId || `index:${item.questionNumber}`);
      const current = map.get(key) || {
        questionId: item.questionId,
        questionNumber: item.questionNumber,
        questionText: item.questionText || '',
        unit: item.unit || '',
        lesson: item.lesson || '',
        topic: item.topic || '',
        wrong: 0,
        partial: 0,
        blank: 0,
        totalErrors: 0,
        students: [],
      };
      current[item.status] = Number(current[item.status] || 0) + 1;
      current.totalErrors += 1;
      if (!current.students.some((student) => String(student.studentId) === String(result.studentId))) {
        current.students.push({
          studentId: result.studentId,
          name: result.studentName || '',
          code: result.studentCode || '',
          status: item.status,
        });
      }
      map.set(key, current);
    }
  }
  return [...map.values()].sort((a, b) => b.totalErrors - a.totalErrors || a.questionNumber - b.questionNumber);
}

export function upsertExamResult(list = [], next = {}) {
  const index = (list || []).findIndex((item) =>
    String(item.studentId) === String(next.studentId)
    && String(item.examId) === String(next.examId)
    && String(item.date) === String(next.date)
  );
  if (index < 0) return [...(list || []), next];
  const copy = [...list];
  copy[index] = { ...copy[index], ...next, id: copy[index].id || next.id, updatedAt: new Date().toISOString() };
  return copy;
}
