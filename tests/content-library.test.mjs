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

test('textbook end-of-lesson questions are the primary game bank and keep their page range', () => {
  const questions = generateQuestionsForLessonBundle({
    id: 'lesson-book-questions',
    type: 'textbook',
    kind: 'grade-textbook',
    title: 'كتاب الشرح الأساسي',
    lesson: 'الحضارة المصرية القديمة',
    grade: 'الصف الأول الإعدادي',
    unit: 'الوحدة الأولى',
    pageStart: 20,
    pageEnd: 28,
    questionPageStart: 27,
    questionPageEnd: 28,
    questionText: [
      'س: أين قامت الحضارة المصرية القديمة؟',
      'ج: على ضفاف نهر النيل',
      'س: اتحد القطران على يد الملك مينا؟',
      'ج: صح',
      'س: أين قامت الحضارة المصريه القديمه؟',
      'ج: على ضفاف نهر النيل',
    ].join('\n'),
  }, [
    {
      id: 'exam-file',
      type: 'exams',
      title: 'ملف الامتحانات الأساسي',
      lesson: 'الحضارة المصرية القديمة',
      grade: 'الصف الأول الإعدادي',
    },
  ]);

  assert.equal(questions[0].questionOrigin, 'official-textbook');
  assert.equal(questions[0].sourcePageStart, 27);
  assert.equal(questions[0].sourcePageEnd, 28);
  assert.equal(questions.some((item) => item.type === 'tf' && item.answer === 'صح'), true);
  const matching = questions.filter((item) => item.questionOrigin === 'official-textbook' && item.text.startsWith('أين قامت الحضارة'));
  assert.equal(matching.length, 1);
});

test('OCR official textbook bank suppresses synthetic lesson questions in games', () => {
  const questions = generateQuestionsForLessonBundle({
    id: 'lesson-ocr-official',
    type: 'lesson',
    title: 'مصر موقع ومظاهر سطح',
    grade: 'الصف الأول الإعدادي',
    unit: 'الوحدة الأولى',
    notes: 'شرح طويل لا يجب أن يولد أسئلة مصطنعة عند وجود بنك الكتاب.',
    pageStart: 20,
    pageEnd: 30,
    questionPageStart: 28,
    questionPageEnd: 30,
    ocrSourceKind: 'textbook',
    ocrSourceAssetId: 'book-asset',
    ocrExtractedAt: '2026-08-07T10:00:00.000Z',
    questionText: [
      'س: ما عاصمة مصر؟',
      'أ) القاهرة',
      'ب) الإسكندرية',
      'الإجابة: أ',
      'س: يمر نهر النيل في مصر؟',
      'الإجابة: صح',
    ].join('\n'),
  }, [{
    id: 'grade-1-book',
    type: 'textbook',
    kind: 'grade-textbook',
    sourceKind: 'textbook',
    title: 'كتاب الشرح الأساسي',
    grade: 'الصف الأول الإعدادي',
    assetId: 'book-asset',
  }]);

  assert.equal(questions.length, 2);
  assert.equal(questions.every((item) => item.questionOrigin === 'official-textbook'), true);
  assert.equal(questions.every((item) => item.sourceAssetId === 'book-asset'), true);
  assert.equal(questions.some((item) => item.text.includes('أي عنوان يطابق')), false);
});

test('structured OCR review admits only approved questions and preserves each source page', () => {
  const questions = generateQuestionsForLessonBundle({
    id: 'lesson-reviewed-ocr',
    type: 'lesson',
    title: 'مراجعة مصر',
    grade: 'الصف الأول الإعدادي',
    unit: 'الوحدة الأولى',
    ocrSourceKind: 'textbook',
    ocrSourceAssetId: 'book-asset',
    questionText: 'س: سؤال قديم لا يجب استخدامه؟\nالإجابة: إجابة قديمة',
    ocrReviewQuestions: [
      { id: 'review-1', question: 'ما عاصمة مصر؟', options: ['القاهرة', 'أسوان'], answer: 'القاهرة', page: 27, approved: true, sourceKind: 'textbook' },
      { id: 'review-2', question: 'ما أطول أنهار مصر؟', answer: 'النيل', page: 28, approved: false, sourceKind: 'textbook' },
    ],
  }, [{
    id: 'grade-book', type: 'textbook', kind: 'grade-textbook', grade: 'الصف الأول الإعدادي', assetId: 'book-asset',
  }]);

  assert.equal(questions.length, 1);
  assert.equal(questions[0].text, 'ما عاصمة مصر؟');
  assert.equal(questions[0].sourcePageStart, 27);
  assert.equal(questions[0].sourcePageEnd, 27);
  assert.equal(questions[0].questionOrigin, 'official-textbook');
});
