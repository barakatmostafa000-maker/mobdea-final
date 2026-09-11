import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildQuestionBank,
  normalizeQuestion,
  stableQuestionId,
} from "../src/services/r20QuestionBankPipeline.js";

const q1 = {
  question: "ما عاصمة مصر؟",
  options: [
    "القاهرة",
    "الجيزة",
    "الإسكندرية",
    "أسوان",
  ],
  correctAnswer: "القاهرة",
  subject: "دراسات",
  grade: "الصف السادس",
};

const q1Duplicate = {
  prompt: "ما عاصمة مصر؟",
  choices: [
    "القاهرة",
    "الجيزة",
    "الإسكندرية",
    "أسوان",
  ],
  answer: "القاهرة",
  subject: "دراسات",
  grade: "الصف السادس",
};

const q2 = {
  questionText: "يمر خط جرينتش بدرجة طول؟",
  answers: [
    "0",
    "30 شرقًا",
    "30 غربًا",
    "90",
  ],
  correctIndex: 0,
  subject: "دراسات",
  grade: "الصف السادس",
};

test("FIX19 normalizes question shapes", () => {
  const normalized = normalizeQuestion(
    q1,
    { sourceId: "bank-a" },
  );

  assert.ok(normalized);
  assert.match(
    normalized.id,
    /^r20q_[0-9a-f]{8}$/,
  );
  assert.equal(normalized.prompt, q1.question);
  assert.equal(normalized.options.length, 4);
  assert.equal(normalized.correctIndex, 0);
  assert.equal(normalized.correctAnswer, "القاهرة");
});

test("FIX19 stable ID is content-stable across source shapes", () => {
  assert.equal(
    stableQuestionId(q1),
    stableQuestionId(q1Duplicate),
  );
});

test("FIX19 deduplicates and merges source provenance", () => {
  const bank = buildQuestionBank([
    {
      sourceId: "bank-a",
      questions: [q1, q2],
    },
    {
      sourceId: "bank-b",
      questions: [q1Duplicate],
    },
  ]);

  assert.equal(bank.stats().uniqueCount, 2);

  const duplicate = bank.getById(
    stableQuestionId(q1),
  );

  assert.deepEqual(
    new Set(duplicate.sourceIds),
    new Set(["bank-a", "bank-b"]),
  );
});

test("FIX19 query filters metadata", () => {
  const bank = buildQuestionBank([
    {
      sourceId: "bank-a",
      questions: [q1, q2],
    },
  ]);

  assert.equal(
    bank.query({
      subject: "دراسات",
      grade: "الصف السادس",
    }).length,
    2,
  );
});

test("FIX19 take supports no-repeat exclusion", () => {
  const bank = buildQuestionBank([
    {
      sourceId: "bank-a",
      questions: [q1, q2],
    },
  ]);

  const first = bank.take({ limit: 1 });
  const next = bank.take({
    limit: 2,
    excludeIds: [first[0].id],
  });

  assert.equal(first.length, 1);
  assert.equal(next.length, 1);
  assert.notEqual(first[0].id, next[0].id);
});

test("FIX19 never invents a missing correct answer", () => {
  const normalized = normalizeQuestion({
    question: "سؤال تجريبي",
    options: ["أ", "ب"],
  });

  assert.ok(normalized);
  assert.equal(normalized.correctAnswer, "");
  assert.equal(normalized.correctIndex, -1);
});

test("FIX19 is wired to OCR page questions and prior Games", () => {
  const runtime = fs.readFileSync(
    "src/services/r20QuestionBankPipeline.js",
    "utf8",
  );

  const main = fs.readFileSync(
    "src/main.jsx",
    "utf8",
  );

  assert.match(
    runtime,
    /mobdea:r20-page-questions/,
  );
  assert.match(
    runtime,
    /mobdea:r20-question-bank-source/,
  );
  assert.match(
    runtime,
    /mobdea:r20-question-bank-request/,
  );
  assert.match(
    main,
    /r20QuestionBankPipeline\.js/,
  );
  assert.match(
    main,
    /r20GamesRuntime\.js/,
  );
});
