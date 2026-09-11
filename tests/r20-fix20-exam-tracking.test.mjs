import assert from "node:assert/strict";
import test from "node:test";

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k,v) { this.map.set(String(k), String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
  key(i) { return [...this.map.keys()][i] ?? null; }
  get length() { return this.map.size; }
}

globalThis.localStorage = new MemoryStorage();
globalThis.window = {
  mobdeaR20QuestionBank: {
    getById(id) {
      return ({
        q1: {
          id: "q1",
          correctAnswer: "القاهرة",
          subject: "دراسات",
          grade: "الصف السادس",
          unit: "الوحدة الأولى",
          lesson: "مصر",
          sourceIds: ["bank-a"],
        },
        q2: {
          id: "q2",
          correctAnswer: "0",
          subject: "دراسات",
          grade: "الصف السادس",
          unit: "الوحدة الأولى",
          lesson: "الموقع",
          sourceIds: ["bank-a"],
        },
      })[id] || null;
    },
  },
  dispatchEvent() {},
};

const {
  R20ExamTracker,
  stableExamCodeFromBytes,
  stableExamCodeFromDefinition,
} = await import("../src/services/r20ExamTracking.js");

test("stable code is content-derived", async () => {
  const enc = new TextEncoder();
  const a = await stableExamCodeFromBytes(enc.encode("same"));
  const b = await stableExamCodeFromBytes(enc.encode("same"));
  const c = await stableExamCodeFromBytes(enc.encode("changed"));
  assert.match(a, /^EX-[0-9A-F]{12}$/);
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("definition code is stable", async () => {
  const d = {title:"Exam", source:"teacher", questionIds:["q1","q2"]};
  assert.equal(
    await stableExamCodeFromDefinition(d),
    await stableExamCodeFromDefinition({...d}),
  );
});

test("result, errors and weakness are tracked", async () => {
  localStorage.clear();
  const tracker = new R20ExamTracker();
  const examCode = await stableExamCodeFromDefinition({
    title:"Exam A", questionIds:["q1","q2"],
  });
  tracker.registerExam({examCode, questionIds:["q1","q2"]});
  const attempt = tracker.startAttempt({
    examCode, studentId:"STU-001", studentName:"طالب",
  });
  tracker.recordAnswer({
    attemptId:attempt.attemptId, questionId:"q1", selectedAnswer:"القاهرة",
  });
  tracker.recordAnswer({
    attemptId:attempt.attemptId, questionId:"q2", selectedAnswer:"30",
  });
  const result = tracker.finalizeAttempt(attempt.attemptId);
  assert.equal(result.correctCount, 1);
  assert.equal(result.wrongCount, 1);
  assert.equal(result.percentage, 50);
  assert.equal(result.errors[0].questionId, "q2");
  assert.equal(result.weaknesses[0].metadata.lesson, "الموقع");
  assert.equal(Object.keys(tracker.getStudentWeakness("STU-001").buckets).length, 1);
});

test("finalization is idempotent and completed attempt cannot mutate", async () => {
  localStorage.clear();
  const tracker = new R20ExamTracker();
  const examCode = await stableExamCodeFromDefinition({
    title:"Exam B", questionIds:["q1"],
  });
  tracker.registerExam({examCode, questionIds:["q1"]});
  const attempt = tracker.startAttempt({examCode, studentId:"STU-002"});
  tracker.recordAnswer({
    attemptId:attempt.attemptId, questionId:"q1", selectedAnswer:"القاهرة",
  });
  const first = tracker.finalizeAttempt(attempt.attemptId);
  const second = tracker.finalizeAttempt(attempt.attemptId);
  assert.equal(first.resultId, second.resultId);
  assert.throws(
    () => tracker.recordAnswer({
      attemptId:attempt.attemptId, questionId:"q1", selectedAnswer:"الجيزة",
    }),
    /finalized/,
  );
});

test("canonical studentId is required", async () => {
  localStorage.clear();
  const tracker = new R20ExamTracker();
  const examCode = await stableExamCodeFromDefinition({
    title:"Exam C", questionIds:["q1"],
  });
  tracker.registerExam({examCode, questionIds:["q1"]});
  assert.throws(
    () => tracker.startAttempt({examCode, studentName:"بدون ID"}),
    /studentId/,
  );
});
