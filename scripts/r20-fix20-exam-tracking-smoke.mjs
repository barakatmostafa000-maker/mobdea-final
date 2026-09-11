import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl =
  process.env.R20_EXAM_TRACKING_URL ||
  "http://127.0.0.1:4173";

const out = path.resolve("r20-exam-tracking-smoke");
await fs.mkdir(out, {recursive:true});

const browser = await chromium.launch({headless:true});
const context = await browser.newContext({
  viewport:{width:1280,height:800},
});

await context.addInitScript(() => {
  localStorage.setItem(
    "mobdea_mobile_auth_v2",
    JSON.stringify({
      role:"admin",
      name:"R20 Exam Tracking Audit",
      expiresAt:Date.now()+60*60*1000,
    }),
  );

  localStorage.setItem(
    "mobdea_question_bank_fixture",
    JSON.stringify({
      questions:[
        {
          question:"ما عاصمة مصر؟",
          options:["القاهرة","الجيزة","الإسكندرية","أسوان"],
          correctAnswer:"القاهرة",
          subject:"دراسات",
          grade:"الصف السادس",
          unit:"الوحدة الأولى",
          lesson:"مصر",
        },
        {
          question:"يمر خط جرينتش بدرجة طول؟",
          options:["0","30 شرقًا","30 غربًا","90"],
          correctAnswer:"0",
          subject:"دراسات",
          grade:"الصف السادس",
          unit:"الوحدة الأولى",
          lesson:"الموقع",
        },
      ],
    }),
  );
});

const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(String(error)));

await page.goto(baseUrl, {waitUntil:"networkidle"});
await page.waitForTimeout(450);

const initial = await page.evaluate(async () => {
  const bank = window.mobdeaR20QuestionBank;
  const exams = window.mobdeaR20ExamTracking;
  if (!bank || !exams) return null;

  const questions = bank.query({
    subject:"دراسات",
    grade:"الصف السادس",
  });

  const bytes = new TextEncoder().encode(JSON.stringify({
    title:"امتحان الوحدة الأولى",
    questionIds:questions.map(q => q.id),
  }));

  const fileA = new File([bytes], "exam-a.json", {type:"application/json"});
  const fileB = new File([bytes], "renamed-exam.json", {type:"application/json"});
  const changed = new File(
    [new TextEncoder().encode("changed exam content")],
    "exam-a.json",
    {type:"application/json"},
  );

  const details = {
    title:"امتحان الوحدة الأولى",
    questionIds:questions.map(q => q.id),
    source:"teacher-file",
  };

  const examA = await exams.registerExamFromFile(fileA, details);
  const examB = await exams.registerExamFromFile(fileB, details);
  const examChanged = await exams.registerExamFromFile(
    changed,
    {...details, title:"نسخة معدلة"},
  );

  const attempt = exams.startAttempt({
    examCode:examA.examCode,
    studentId:"STU-2026-001",
    studentName:"طالب الاختبار",
  });

  exams.recordAnswer({
    attemptId:attempt.attemptId,
    questionId:questions[0].id,
    selectedAnswer:"القاهرة",
  });

  exams.recordAnswer({
    attemptId:attempt.attemptId,
    questionId:questions[1].id,
    selectedAnswer:"30 شرقًا",
  });

  const result = exams.finalizeAttempt(attempt.attemptId);
  const weakness = exams.getStudentWeakness("STU-2026-001");

  return {
    codeA:examA.examCode,
    codeB:examB.examCode,
    changedCode:examChanged.examCode,
    attemptId:attempt.attemptId,
    result,
    weakness,
  };
});

assert.ok(initial, "Exam Tracking runtime API missing");
assert.match(initial.codeA, /^EX-[0-9A-F]{12}$/);
assert.equal(
  initial.codeA,
  initial.codeB,
  "Renaming the same exam file changed its stable Exam Code",
);
assert.notEqual(
  initial.codeA,
  initial.changedCode,
  "Changing exam file content did not change Exam Code",
);
assert.equal(initial.result.studentId, "STU-2026-001");
assert.equal(initial.result.correctCount, 1);
assert.equal(initial.result.wrongCount, 1);
assert.equal(initial.result.percentage, 50);
assert.equal(
  initial.result.errors.length,
  1,
  "Wrong-answer list is incorrect",
);
assert.equal(
  initial.result.errors[0].weakness.lesson,
  "الموقع",
  "Wrong answer lost weakness metadata",
);
assert.ok(
  Object.keys(initial.weakness.buckets).length >= 1,
  "Student weakness aggregation is empty",
);

const attemptId = initial.attemptId;
const examCode = initial.codeA;

await page.reload({waitUntil:"networkidle"});
await page.waitForTimeout(350);

const persisted = await page.evaluate(
  ({attemptId, examCode}) => {
    const exams = window.mobdeaR20ExamTracking;
    return {
      attempt:exams.getAttempt(attemptId),
      byExamCount:exams.listAttemptsByExam(examCode).length,
      byStudentCount:exams.listAttemptsByStudent("STU-2026-001").length,
      weakness:exams.getStudentWeakness("STU-2026-001"),
    };
  },
  {attemptId, examCode},
);

assert.equal(
  persisted.attempt.status,
  "completed",
  "Completed exam attempt was not persisted",
);
assert.equal(persisted.attempt.result.percentage, 50);
assert.ok(
  persisted.byExamCount >= 1,
  "Attempt is missing from exam history",
);
assert.ok(
  persisted.byStudentCount >= 1,
  "Attempt is missing from student history",
);
assert.ok(
  Object.keys(persisted.weakness.buckets).length >= 1,
  "Student weakness did not persist",
);

const snapshot = await page.evaluate(() => new Promise(resolve => {
  const timeout = setTimeout(() => resolve(null), 600);
  window.addEventListener(
    "mobdea:r20-exam-tracking-snapshot",
    event => {
      clearTimeout(timeout);
      resolve({
        marker:event.detail?.marker,
        attemptCount:Object.keys(event.detail?.attempts || {}).length,
      });
    },
    {once:true},
  );
  window.dispatchEvent(
    new CustomEvent("mobdea:r20-exam-tracking-request"),
  );
}));

assert.ok(snapshot, "Exam Tracking snapshot event failed");
assert.ok(snapshot.attemptCount >= 1);
assert.deepEqual(errors, [], errors.join("\n"));

await page.screenshot({
  path:path.join(out, "tablet-1280x800-exam-tracking.png"),
  fullPage:true,
});

await context.close();
await browser.close();
