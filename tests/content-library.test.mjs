import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQuestionsFromResource } from '../src/services/contentQuestions.js';

test('lesson-generated questions use lesson content, page range, map and homework context', () => {
  const questions = generateQuestionsFromResource({
    id: 'lesson-geo',
    title: 'مظاهر سطح مصر',
    lesson: 'مظاهر سطح مصر',
    grade: 'الصف الرابع الابتدائي',
    unit: 'الوحدة الأولى',
    notes: 'تنقسم مظاهر السطح إلى جبال وهضاب وسهول ومنخفضات.',
    homework: 'حدد جبال البحر الأحمر على الخريطة.',
    pageStart: 14,
    pageEnd: 19,
    mapState: { regionKey: 'egypt' },
    sourceExamResourceId: 'exam-source',
    sourceExamAssetId: 'exam-asset',
    sourceExamFileName: 'exams.pdf',
  });
  assert.equal(questions.some((item) => item.type === 'map'), true);
  assert.equal(questions.some((item) => item.text.includes('صفحة 14')), true);
  assert.equal(questions.some((item) => item.text.includes('حدد جبال البحر الأحمر')), true);
  assert.equal(questions.every((item) => item.sourceExamAssetId === 'exam-asset'), true);
});
