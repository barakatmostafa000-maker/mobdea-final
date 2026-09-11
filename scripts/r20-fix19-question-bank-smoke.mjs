import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl =
  process.env.R20_QUESTION_BANK_URL ||
  "http://127.0.0.1:4173";

const out = path.resolve(
  "r20-question-bank-smoke",
);

await fs.mkdir(
  out,
  { recursive: true },
);

const browser = await chromium.launch({
  headless: true,
});

const context = await browser.newContext({
  viewport: {
    width: 1280,
    height: 800,
  },
});

await context.addInitScript(() => {
  localStorage.setItem(
    "mobdea_mobile_auth_v2",
    JSON.stringify({
      role: "admin",
      name: "R20 Question Bank Audit",
      expiresAt:
        Date.now() + 60 * 60 * 1000,
    }),
  );

  localStorage.setItem(
    "mobdea_question_bank_fixture",
    JSON.stringify({
      questions: [
        {
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
        },
        {
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
        },
        {
          questionText:
            "يمر خط جرينتش بدرجة طول؟",
          answers: [
            "0",
            "30 شرقًا",
            "30 غربًا",
            "90",
          ],
          correctIndex: 0,
          subject: "دراسات",
          grade: "الصف السادس",
        },
      ],
    }),
  );
});

const page = await context.newPage();
const errors = [];

page.on(
  "pageerror",
  (error) => errors.push(String(error)),
);

await page.goto(
  baseUrl,
  { waitUntil: "networkidle" },
);

await page.waitForTimeout(450);

const initial = await page.evaluate(() => {
  const api = window.mobdeaR20QuestionBank;

  if (!api) return null;

  return {
    stats: api.stats(),
    ids: api.query().map((q) => q.id),
    filtered: api.query({
      subject: "دراسات",
      grade: "الصف السادس",
    }).length,
  };
});

assert.ok(
  initial,
  "Question Bank runtime API missing",
);

assert.equal(
  initial.stats.uniqueCount,
  2,
  "Duplicate question was not removed",
);

assert.equal(
  initial.filtered,
  2,
  "Question metadata filtering failed",
);

const firstIds = [...initial.ids].sort();

await page.reload({
  waitUntil: "networkidle",
});

await page.waitForTimeout(300);

const secondIds = await page.evaluate(
  () =>
    window.mobdeaR20QuestionBank
      .query()
      .map((q) => q.id)
      .sort(),
);

assert.deepEqual(
  secondIds,
  firstIds,
  "Stable question IDs changed after reload",
);

const multiSource = await page.evaluate(() => {
  const api = window.mobdeaR20QuestionBank;
  const existing = api.query()[0];

  window.dispatchEvent(
    new CustomEvent(
      "mobdea:r20-question-bank-source",
      {
        detail: {
          sourceId: "second-bank",
          questions: [
            {
              question: existing.prompt,
              options: existing.options,
              correctAnswer:
                existing.correctAnswer,
              subject: existing.subject,
              grade: existing.grade,
            },
            {
              question:
                "ما البحر الذي يصب فيه نهر النيل؟",
              options: [
                "البحر المتوسط",
                "البحر الأحمر",
                "الخليج العربي",
                "المحيط الأطلسي",
              ],
              correctAnswer:
                "البحر المتوسط",
              subject: "دراسات",
              grade: "الصف السادس",
            },
          ],
        },
      },
    ),
  );

  return {
    count: api.stats().uniqueCount,
    sourceIds:
      api.getById(existing.id)
        .sourceIds,
  };
});

assert.equal(
  multiSource.count,
  3,
  "Second source did not merge/deduplicate correctly",
);

assert.ok(
  multiSource.sourceIds.includes(
    "second-bank",
  ),
  "Duplicate question lost second source provenance",
);

const ocr = await page.evaluate(() => {
  const api = window.mobdeaR20QuestionBank;

  window.dispatchEvent(
    new CustomEvent(
      "mobdea:r20-page-questions",
      {
        detail: {
          documentId: "doc-1",
          pageNumber: 7,
          questions: [
            {
              question: "سؤال من صفحة PDF",
              options: ["أ", "ب", "ج", "د"],
              correctAnswer: "ب",
              subject: "دراسات",
            },
          ],
        },
      },
    ),
  );

  const found = api.query({
    documentId: "doc-1",
    pageNumber: 7,
  });

  return {
    count: found.length,
    sourceIds:
      found[0]?.sourceIds || [],
  };
});

assert.equal(
  ocr.count,
  1,
  "OCR per-page questions were not ingested",
);

assert.ok(
  ocr.sourceIds.some(
    (value) =>
      value.includes(
        "ocr:doc-1:page:7",
      ),
  ),
  "OCR question lost document/page provenance",
);

const noRepeat = await page.evaluate(() => {
  const api = window.mobdeaR20QuestionBank;

  const first = api.take({
    limit: 1,
  });

  const next = api.take({
    limit: 2,
    excludeIds: [first[0].id],
  });

  return {
    firstId: first[0].id,
    nextIds: next.map((q) => q.id),
  };
});

assert.ok(
  !noRepeat.nextIds.includes(
    noRepeat.firstId,
  ),
  "No-repeat exclusion failed",
);

const snapshot = await page.evaluate(() => {
  return new Promise((resolve) => {
    const timeout = setTimeout(
      () => resolve(null),
      500,
    );

    window.addEventListener(
      "mobdea:r20-question-bank-snapshot",
      (event) => {
        clearTimeout(timeout);

        resolve({
          marker: event.detail?.marker,
          count:
            event.detail?.stats
              ?.uniqueCount,
        });
      },
      { once: true },
    );

    window.dispatchEvent(
      new CustomEvent(
        "mobdea:r20-question-bank-request",
      ),
    );
  });
});

assert.ok(
  snapshot,
  "Question Bank snapshot request event failed",
);

assert.ok(
  snapshot.count >= 4,
  "Question Bank snapshot is incomplete",
);

assert.deepEqual(
  errors,
  [],
  errors.join("\n"),
);

await page.screenshot({
  path: path.join(
    out,
    "tablet-1280x800-question-bank.png",
  ),
  fullPage: true,
});

await context.close();
await browser.close();
