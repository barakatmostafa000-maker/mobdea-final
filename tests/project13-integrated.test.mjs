import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  findSessionPayment,
  registerBarcodeAttendance,
} from '../src/services/project13AttendanceAccounting.js';
import {
  buildExamErrorIndex,
  upsertExamResult,
  wrongQuestionResults,
} from '../src/services/project13ExamAnalytics.js';

test('barcode attendance records presence and exactly one paid/due accounting row', () => {
  const data = { attendance: [], payments: [] };
  const student = { id: 7, code: 77, name: 'Student', sessionPrice: 60 };
  const session = { id: 4, title: 'Class', price: 50 };
  const paid = registerBarcodeAttendance(data, { student, session, date: '2026-08-22', paymentStatus: 'paid' });
  assert.equal(paid.attendance.length, 1);
  assert.equal(paid.attendance[0].status, 'present');
  assert.equal(paid.attendance[0].paymentStatus, 'paid');
  assert.equal(paid.payments.length, 1);
  assert.equal(paid.payments[0].type, 'paid');
  assert.equal(paid.payments[0].amount, 60);
  assert.equal(paid.payments[0].sessionId, 4);
  assert.equal(paid.payments[0].source, 'attendance-barcode');

  const due = registerBarcodeAttendance(paid, { student, session, date: '2026-08-22', paymentStatus: 'due' });
  assert.equal(due.attendance.length, 1);
  assert.equal(due.payments.length, 1);
  assert.equal(findSessionPayment(due, 7, 4, '2026-08-22').type, 'due');
});

test('exam analytics exposes wrong question numbers and aggregate student codes', () => {
  const one = {
    id: 1, studentId: 1, studentCode: 101, examId: 'e1', date: '2026-08-22',
    questionResults: [
      { questionId: 'q1', status: 'wrong', questionText: 'A', topic: 'T' },
      { questionId: 'q2', status: 'correct', questionText: 'B', topic: 'T2' },
    ],
  };
  const two = {
    id: 2, studentId: 2, studentCode: 102, examId: 'e1', date: '2026-08-22',
    questionResults: [
      { questionId: 'q1', status: 'blank', questionText: 'A', topic: 'T' },
      { questionId: 'q2', status: 'partial', questionText: 'B', topic: 'T2' },
    ],
  };
  assert.deepEqual(wrongQuestionResults(one).map((x) => x.questionNumber), [1]);
  const index = buildExamErrorIndex([one, two], 'e1');
  assert.equal(index[0].questionId, 'q1');
  assert.equal(index[0].totalErrors, 2);
  assert.deepEqual(index[0].students.map((s) => s.code), [101, 102]);

  const replaced = upsertExamResult([one], { ...one, id: 99, questionResults: [] });
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].id, 1);
});

test('native Android scanner is registered with Google Code Scanner', () => {
  const gradle = fs.readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
  const activity = fs.readFileSync(new URL('../android/app/src/main/java/com/mobdea/education/MainActivity.java', import.meta.url), 'utf8');
  const java = fs.readFileSync(new URL('../android/app/src/main/java/com/mobdea/education/barcode/MobdeaBarcodeScannerPlugin.java', import.meta.url), 'utf8');
  const manifest = fs.readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  assert.match(gradle, /play-services-code-scanner:16\.1\.0/);
  assert.match(activity, /MobdeaBarcodeScannerPlugin/);
  assert.match(java, /PROJECT13_NATIVE_BARCODE_SCANNER_V1/);
  assert.match(java, /GmsBarcodeScanning/);
  assert.match(java, /FORMAT_QR_CODE/);
  assert.match(java, /FORMAT_CODE_128/);
  assert.match(manifest, /barcode_ui/);
});

test('ClassMode PDF controls are reduced and recordings are not user-facing', () => {
  const source = fs.readFileSync(new URL('../src/pages/ClassMode.jsx', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../src/styles/project13-pdf-focus-attendance-links-exams.css', import.meta.url), 'utf8');
  const panels = fs.readFileSync(new URL('../src/components/classmode/Project03StudentPanels.jsx', import.meta.url), 'utf8');
  const dock = fs.readFileSync(new URL('../src/components/classmode/Project12PageQuestionDock.jsx', import.meta.url), 'utf8');
  assert.match(source, /PROJECT13_CLASSMODE_IMAGE_LINKS_V1/);
  assert.match(source, /saveBoardForStudents/);
  assert.match(source, /Project13LinkHub/);
  assert.match(source, /project13-legacy-recordings-panel/);
  assert.match(source, /ملخص الحصة/);
  assert.match(css, /project12-classmode-dock\s*\{\s*display:none/);
  assert.match(css, /classmode-record-btn[\s\S]*display:none/);
  assert.match(css, /classmode-page-nav button[\s\S]*background:rgba\(6,10,16,.16\)/);
  assert.match(panels, /PROJECT13_STUDENT_PANELS_COLLAPSED_V1/);
  assert.match(panels, /useState\(false\)/);
  assert.match(dock, /PROJECT13_COLLAPSED_PAGE_QUESTIONS_V1/);
  assert.match(dock, /project13-question-chip/);
});

test('Sessions and lesson editor use links instead of visible recordings', () => {
  const sessions = fs.readFileSync(new URL('../src/pages/Sessions.jsx', import.meta.url), 'utf8');
  const library = fs.readFileSync(new URL('../src/pages/ContentLibrary.jsx', import.meta.url), 'utf8');
  const settings = fs.readFileSync(new URL('../src/pages/Settings.jsx', import.meta.url), 'utf8');
  assert.match(sessions, /PROJECT13_SOCIAL_LESSON_LINKS_V1/);
  assert.match(sessions, /Project13LinkHub/);
  assert.doesNotMatch(sessions, /LessonRecordingItem/);
  assert.doesNotMatch(sessions, /قائمة التسجيلات/);
  assert.match(library, /PROJECT13_LESSON_LINKS_IMAGES_ONLY_V1/);
  assert.match(library, /lessonLink/);
  assert.match(library, /صور الدرس للطلاب/);
  assert.doesNotMatch(library, /<strong>تسجيل الدرس<\/strong>/);
  assert.match(settings, /Project13SocialLinkSettings/);
});

test('GradeScanner stores exam-source and immediate error metadata', () => {
  const scanner = fs.readFileSync(new URL('../src/pages/GradeScanner.jsx', import.meta.url), 'utf8');
  const details = fs.readFileSync(new URL('../src/pages/ResultDetails.jsx', import.meta.url), 'utf8');
  assert.match(scanner, /PROJECT13_EXAM_SCANNER_ANALYTICS_V1/);
  assert.match(scanner, /sourceExamResourceId/);
  assert.match(scanner, /sourceExamAssetId/);
  assert.match(scanner, /errorQuestionIds/);
  assert.match(scanner, /errorCount/);
  assert.match(scanner, /project13-live-errors/);
  assert.match(scanner, /upsertExamResult/);
  assert.match(details, /PROJECT13_EXAM_ERROR_ANALYTICS_V1/);
  assert.match(details, /wrongOnly/);
  assert.match(details, /buildExamErrorIndex/);
  assert.match(details, /أكثر أسئلة الامتحان خطأً/);
});

test('Repair12 and earlier cumulative contracts remain in place', () => {
  assert.ok(fs.existsSync(new URL('../src/services/project12PageQuestions.js', import.meta.url)));
  assert.ok(fs.existsSync(new URL('../src/services/project12StudentCloud.js', import.meta.url)));
  const voice = fs.readFileSync(new URL('../src/services/voice.js', import.meta.url), 'utf8');
  assert.match(voice, /PROJECT12_TABLET_VOICE_V1/);
  const project11 = fs.readFileSync(new URL('../src/components/classmode/Project03StudentPanels.jsx', import.meta.url), 'utf8');
  assert.match(project11, /الأكثر تحسنًا/);
});
