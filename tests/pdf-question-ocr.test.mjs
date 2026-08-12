import test from 'node:test';
import assert from 'node:assert/strict';
import { contextualizeOcrQuestions, normalizeOcrText, structureOcrQuestions } from '../src/services/ocrQuestionParser.js';
import { parseStructuredQuestionText } from '../src/services/contentQuestions.js';

test('Arabic OCR normalization cleans digits, spacing and tatweel', () => {
  assert.equal(normalizeOcrText('ســؤال ١  :  ما عاصمة مصر ؟'), 'سؤال 1: ما عاصمة مصر؟');
});

test('OCR structures numbered questions, options and explicit answers', () => {
  const result = structureOcrQuestions([
    'أسئلة الدرس',
    '١- ما عاصمة مصر؟',
    'أ) القاهرة',
    'ب) الإسكندرية',
    'ج) أسوان',
    'د) الأقصر',
    'الإجابة: أ',
    '٢- يمر نهر النيل في مصر؟',
    'الإجابة: صح',
    '٣- اذكر نتيجة بناء السد العالي.',
  ].join('\n'));

  assert.equal(result.questionCount, 3);
  assert.equal(result.answeredCount, 2);
  assert.equal(result.reviewCount, 1);
  assert.match(result.questionText, /س: ما عاصمة مصر؟/);
  assert.match(result.questionText, /الإجابة: أ/);
});

test('OCR keeps the source page on every extracted review item', () => {
  const result = structureOcrQuestions([
    '--- صفحة 27 ---',
    '1- ما عاصمة مصر؟',
    'الإجابة: القاهرة',
    '--- صفحة 28 ---',
    '2- أين يصب نهر النيل؟',
    'الإجابة: البحر المتوسط',
  ].join('\n'));
  assert.deepEqual(result.questions.map((item) => item.page), [27, 28]);
  assert.equal(result.questions.every((item) => item.approved === false), true);
});

test('OCR review records keep source, grade and lesson metadata before approval', () => {
  const result = structureOcrQuestions('--- صفحة 9 ---\n1- ما عاصمة مصر؟\nالإجابة: القاهرة');
  const [question] = contextualizeOcrQuestions(result.questions, {
    sourceKind: 'textbook',
    sourceAssetId: 'asset-book',
    sourceTitle: 'كتاب الشرح الأساسي',
    sourceFileName: 'grade-7.pdf',
    grade: 'الصف الأول الإعدادي',
    lesson: 'موقع مصر',
  });
  assert.equal(question.page, 9);
  assert.equal(question.sourceKind, 'textbook');
  assert.equal(question.sourceAssetId, 'asset-book');
  assert.equal(question.sourceFileName, 'grade-7.pdf');
  assert.equal(question.grade, 'الصف الأول الإعدادي');
  assert.equal(question.lesson, 'موقع مصر');
});

test('only reviewed OCR questions with answers enter the automatic game bank', () => {
  const parsed = parseStructuredQuestionText([
    'س: ما عاصمة مصر؟',
    'أ) القاهرة',
    'ب) الإسكندرية',
    'الإجابة: أ',
    '',
    'س: اذكر أهم النتائج.',
  ].join('\n'));

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].answer, 'القاهرة');
  assert.deepEqual(parsed[0].options, ['القاهرة', 'الإسكندرية']);
});

import { scoreQuestionPageText, selectQuestionPageWindow } from '../src/services/ocrQuestionDiscovery.js';

test('automatic OCR page discovery prioritizes exercise pages near lesson end', () => {
  const pages = [
    { page: 10, text: 'شرح الدرس عن نهر النيل وأهميته لمصر.' },
    { page: 11, text: 'أسئلة الدرس\n1- ما أهمية نهر النيل؟\nالإجابة: الزراعة والمياه\n2- بم تفسر قيام الحضارة حوله؟\nالإجابة: توافر المياه' },
    { page: 12, text: '3- اختر الإجابة الصحيحة: تقع مصر في؟\nأ) أفريقيا\nب) أوروبا\nالإجابة: أ' },
    { page: 13, text: 'ملخص الوحدة التالية' },
  ];
  assert.ok(scoreQuestionPageText(pages[1].text).score > scoreQuestionPageText(pages[0].text).score);
  const selected = selectQuestionPageWindow(pages).pages.map((item) => item.page);
  assert.deepEqual(selected.slice(0, 2), [11, 12]);
});
