import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQuestionsForLessonBundle, generateQuestionsFromResource } from '../src/services/contentQuestions.js';

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


test('lesson bundle creates game-ready MCQ and true-false questions for attached media', () => {
  const questions = generateQuestionsForLessonBundle(
    {
      id: 'lesson-bundle',
      title: 'قارات العالم',
      lesson: 'قارات العالم',
      grade: 'الصف الثالث الإعدادي',
      unit: 'الوحدة الأولى',
      notes: 'تتوزع اليابسة إلى قارات تختلف في المساحة والسكان.',
    },
    [
      { id: 'lesson-image', type: 'image', title: 'خريطة القارات' },
      { id: 'lesson-video', type: 'video', title: 'شرح قارات العالم' },
    ],
  );

  assert.equal(questions.some((item) => item.type === 'mcq' && item.options?.length >= 2), true);
  assert.equal(questions.some((item) => item.type === 'tf'), true);
  assert.equal(new Set(questions.map((item) => item.id)).size, questions.length);
});
