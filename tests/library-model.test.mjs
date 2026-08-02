import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIBRARY_KINDS,
  clampLessonPage,
  getGradeExams,
  getGradeTextbook,
  getLessonModeResources,
  collectLibraryAssetIds,
  migrateLibraryItems,
} from '../src/services/libraryModel.js';
import { getGradeMapRecommendation } from '../src/data/geography.js';

test('legacy textbook with exams migrates into two permanent grade sources', () => {
  const migrated = migrateLibraryItems([{
    id: 'book-6',
    type: 'textbook',
    title: 'كتاب الصف السادس',
    grade: 'الصف السادس الابتدائي',
    assetId: 'asset-book',
    examAssetId: 'asset-exams',
    examFileName: 'exams.pdf',
  }]);
  const textbook = getGradeTextbook(migrated, 'الصف السادس الابتدائي');
  const exams = getGradeExams(migrated, 'الصف السادس الابتدائي');
  assert.equal(textbook.kind, LIBRARY_KINDS.GRADE_TEXTBOOK);
  assert.equal(textbook.assetId, 'asset-book');
  assert.equal(exams.kind, LIBRARY_KINDS.GRADE_EXAMS);
  assert.equal(exams.assetId, 'asset-exams');
});

test('lesson mode builds one automatic textbook resource and all lesson media', () => {
  const data = {
    contentLibrary: [
      { id: 'book', kind: LIBRARY_KINDS.GRADE_TEXTBOOK, type: 'textbook', grade: 'الصف السادس الابتدائي', assetId: 'book-asset', title: 'الكتاب' },
      { id: 'exams', kind: LIBRARY_KINDS.GRADE_EXAMS, type: 'exams', grade: 'الصف السادس الابتدائي', assetId: 'exam-asset', title: 'الامتحانات' },
      { id: 'lesson-1', kind: LIBRARY_KINDS.LESSON, type: 'lesson', grade: 'الصف السادس الابتدائي', title: 'الوطن العربي', unit: 'الوحدة الأولى', pageStart: 12, pageEnd: 18, recordingAssetId: 'recording-asset', recordingFileName: 'lesson.mp3' },
      { id: 'media-1', kind: LIBRARY_KINDS.LESSON_MEDIA, lessonId: 'lesson-1', type: 'image', assetId: 'image-asset', title: 'خريطة الوطن العربي' },
      { id: 'media-2', kind: LIBRARY_KINDS.LESSON_MEDIA, lessonId: 'lesson-1', type: 'video', assetId: 'video-asset', title: 'شرح الدرس' },
    ],
  };
  const resources = getLessonModeResources(data, 'الصف السادس الابتدائي', 'lesson-1');
  assert.equal(resources[0].virtualLessonTextbook, true);
  assert.equal(resources[0].pageStart, 12);
  assert.equal(resources[0].pageEnd, 18);
  assert.equal(resources[0].examAssetId, 'exam-asset');
  assert.deepEqual(resources.map((item) => item.type), ['textbook', 'image', 'video', 'audio']);
});

test('selected lesson content still opens when the active class grade is stale', () => {
  const data = {
    contentLibrary: [
      { id: 'book-6', kind: LIBRARY_KINDS.GRADE_TEXTBOOK, type: 'textbook', grade: 'الصف السادس الابتدائي', assetId: 'book-asset', title: 'كتاب السادس' },
      { id: 'lesson-6', kind: LIBRARY_KINDS.LESSON, type: 'lesson', grade: 'الصف السادس الابتدائي', title: 'درس محفوظ', pageStart: 3, pageEnd: 8 },
      { id: 'lesson-image', kind: LIBRARY_KINDS.LESSON_MEDIA, lessonId: 'lesson-6', type: 'image', assetId: 'image-asset', title: 'صورة الدرس' },
    ],
  };

  const resources = getLessonModeResources(
    data,
    'الصف الرابع الابتدائي',
    'lesson-6',
  );

  assert.equal(resources[0].virtualLessonTextbook, true);
  assert.equal(resources[0].sourceResourceId, 'book-6');
  assert.equal(resources[0].pageStart, 3);
  assert.equal(resources[1].lessonId, 'lesson-6');
  assert.equal(resources[1].type, 'image');
});

test('lesson PDF navigation never leaves the selected page range', () => {
  const resource = { pageStart: 7, pageEnd: 11 };
  assert.equal(clampLessonPage(1, resource, 100), 7);
  assert.equal(clampLessonPage(9, resource, 100), 9);
  assert.equal(clampLessonPage(40, resource, 100), 11);
});


test('lesson PDF navigation safely handles a missing resource', () => {
  assert.equal(clampLessonPage(4, null, 20), 4);
  assert.equal(clampLessonPage(0, null, 20), 1);
  assert.equal(clampLessonPage(50, null, 20), 20);
});

test('grade map recommendations match the requested curriculum', () => {
  assert.equal(getGradeMapRecommendation('الصف الرابع الابتدائي').defaultRegion, 'egypt');
  assert.equal(getGradeMapRecommendation('الصف السادس الابتدائي').defaultRegion, 'arab');
  assert.equal(getGradeMapRecommendation('الصف الأول الإعدادي').defaultRegion, 'africa');
  assert.deepEqual(getGradeMapRecommendation('الصف الثاني الإعدادي').recommended, ['asia', 'europe']);
  assert.deepEqual(getGradeMapRecommendation('الصف الثالث الإعدادي').recommended, ['northAmerica', 'southAmerica', 'australia']);
  assert.equal(getGradeMapRecommendation('الصف الاول الاعدادي - مجموعة أ').defaultRegion, 'africa');
  assert.deepEqual(getGradeMapRecommendation('الصف الثاني الإعدادي (ب)').recommended, ['asia', 'europe']);
});

test('cloud synchronization collects every library asset type exactly once', () => {
  const ids = collectLibraryAssetIds({ contentLibrary: [
    { assetId: 'book', examAssetId: 'exam', thumbnailAssetId: 'thumb', recordingAssetId: 'recording' },
    { assetId: 'book' },
    { assetId: 'media' },
  ] });
  assert.deepEqual(ids.sort(), ['book', 'exam', 'media', 'recording', 'thumb']);
});

test('lesson map keeps independent explanation layers for every selected region', async () => {
  const { mergeLessonMapRegion, normalizeLessonMapState } = await import('../src/services/lessonMapState.js');
  let state = normalizeLessonMapState({}, 'الصف الثاني الإعدادي');
  state = mergeLessonMapRegion(state, 'asia', { placements: [{ id: 'asia-mountain' }], strokes: [{ id: 'asia-line' }] });
  state = mergeLessonMapRegion(state, 'europe', { placements: [{ id: 'europe-river' }], strokes: [] });
  assert.equal(state.regionKey, 'europe');
  assert.equal(state.regions.asia.placements[0].id, 'asia-mountain');
  assert.equal(state.regions.asia.strokes[0].id, 'asia-line');
  assert.equal(state.regions.europe.placements[0].id, 'europe-river');
});

test('library resources match a grade even when the session adds a group suffix', () => {
  const data = {
    contentLibrary: [
      {
        id: 'book-grade-normalized',
        kind: LIBRARY_KINDS.GRADE_TEXTBOOK,
        type: 'textbook',
        grade: 'الصف الأول الإعدادي',
        assetId: 'book-normalized',
      },
      {
        id: 'lesson-grade-normalized',
        kind: LIBRARY_KINDS.LESSON,
        type: 'lesson',
        grade: 'الصف الأول الإعدادي',
        title: 'الدرس الأول',
      },
    ],
  };

  const textbook = getGradeTextbook(data, 'الصف الأول الإعدادي - مجموعة أ');
  const resources = getLessonModeResources(
    data,
    'الصف الأول الإعدادي - مجموعة أ',
    'lesson-grade-normalized',
  );

  assert.equal(textbook?.assetId, 'book-normalized');
  assert.equal(resources[0]?.virtualLessonTextbook, true);
});
