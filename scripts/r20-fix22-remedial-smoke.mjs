import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl =
  process.env.R20_REMEDIAL_URL ||
  "http://127.0.0.1:4173";

const out =
  path.resolve(
    "r20-remedial-smoke",
  );

await fs.mkdir(
  out,
  {
    recursive:
      true,
  },
);

const browser =
  await chromium.launch({
    headless:
      true,
  });

const context =
  await browser.newContext({
    viewport: {
      width:
        1280,
      height:
        800,
    },
  });

await context.addInitScript(() => {
  localStorage.setItem(
    "mobdea_mobile_auth_v2",
    JSON.stringify({
      role:
        "student",
      name:
        "طالب علاجي",
      studentId:
        "STU-REM-1",
      accountId:
        "9901",
      linkedStudentIds:
        [],
      r20Portal:
        true,
      expiresAt:
        Date.now() +
        60 * 60 * 1000,
    }),
  );

  sessionStorage.setItem(
    "mobdea-r20-portal-session",
    JSON.stringify({
      role:
        "student",
      accountId:
        "9901",
      studentId:
        "STU-REM-1",
      displayName:
        "طالب علاجي",
      mustChangePassword:
        false,
      canAccessPortal:
        true,
      linkedStudentIds:
        [],
      sess:
        "remedial-smoke",
    }),
  );

  localStorage.setItem(
    "mobdea_students_fixture",
    JSON.stringify({
      students: [
        {
          id:
            "STU-REM-1",
          name:
            "طالب علاجي",
          studentCode:
            "9901",
          parentPhone:
            "01012345678",
        },
      ],
    }),
  );

  localStorage.setItem(
    "mobdea_question_bank_fixture",
    JSON.stringify({
      questions: [
        {
          question:
            "سؤال موقع قديم",
          options:
            ["أ", "ب"],
          correctAnswer:
            "أ",
          subject:
            "دراسات",
          grade:
            "السادس",
          unit:
            "الوحدة الأولى",
          lesson:
            "الموقع",
        },
        {
          question:
            "سؤال موقع علاجي 1",
          options:
            ["أ", "ب"],
          correctAnswer:
            "أ",
          subject:
            "دراسات",
          grade:
            "السادس",
          unit:
            "الوحدة الأولى",
          lesson:
            "الموقع",
        },
        {
          question:
            "سؤال موقع علاجي 2",
          options:
            ["أ", "ب"],
          correctAnswer:
            "أ",
          subject:
            "دراسات",
          grade:
            "السادس",
          unit:
            "الوحدة الأولى",
          lesson:
            "الموقع",
        },
        {
          question:
            "سؤال موقع علاجي 3",
          options:
            ["أ", "ب"],
          correctAnswer:
            "أ",
          subject:
            "دراسات",
          grade:
            "السادس",
          unit:
            "الوحدة الأولى",
          lesson:
            "الموقع",
        },
        {
          question:
            "سؤال مناخ قديم",
          options:
            ["أ", "ب"],
          correctAnswer:
            "أ",
          subject:
            "دراسات",
          grade:
            "السادس",
          unit:
            "الوحدة الثانية",
          lesson:
            "المناخ",
        },
        {
          question:
            "سؤال مناخ علاجي 1",
          options:
            ["أ", "ب"],
          correctAnswer:
            "أ",
          subject:
            "دراسات",
          grade:
            "السادس",
          unit:
            "الوحدة الثانية",
          lesson:
            "المناخ",
        },
        {
          question:
            "سؤال مناخ علاجي 2",
          options:
            ["أ", "ب"],
          correctAnswer:
            "أ",
          subject:
            "دراسات",
          grade:
            "السادس",
          unit:
            "الوحدة الثانية",
          lesson:
            "المناخ",
        },
        {
          question:
            "سؤال مناخ علاجي 3",
          options:
            ["أ", "ب"],
          correctAnswer:
            "أ",
          subject:
            "دراسات",
          grade:
            "السادس",
          unit:
            "الوحدة الثانية",
          lesson:
            "المناخ",
        },
      ],
    }),
  );
});

const page =
  await context.newPage();

const errors =
  [];

page.on(
  "pageerror",
  (error) =>
    errors.push(
      String(error),
    ),
);

await page.goto(
  baseUrl,
  {
    waitUntil:
      "networkidle",
  },
);

await page.waitForTimeout(
  500,
);

const baseline =
  await page.evaluate(
    async () => {
      const bank =
        window
          .mobdeaR20QuestionBank;

      const exams =
        window
          .mobdeaR20ExamTracking;

      const questions =
        bank.query({
          subject:
            "دراسات",
        });

      const oldLocation =
        questions.find(
          (question) =>
            question.prompt ===
            "سؤال موقع قديم",
        );

      const oldClimate =
        questions.find(
          (question) =>
            question.prompt ===
            "سؤال مناخ قديم",
        );

      const exam =
        await exams
          .registerExamFromDefinition({
            title:
              "الامتحان التشخيصي",
            source:
              "remedial-smoke-baseline",
            questionIds: [
              oldLocation.id,
              oldClimate.id,
            ],
          });

      const attempt =
        exams.startAttempt({
          examCode:
            exam.examCode,
          studentId:
            "STU-REM-1",
          studentName:
            "طالب علاجي",
        });

      exams.recordAnswer({
        attemptId:
          attempt.attemptId,
        questionId:
          oldLocation.id,
        selectedAnswer:
          "ب",
      });

      exams.recordAnswer({
        attemptId:
          attempt.attemptId,
        questionId:
          oldClimate.id,
        selectedAnswer:
          "ب",
      });

      const result =
        exams.finalizeAttempt(
          attempt.attemptId,
        );

      return {
        usedIds: [
          oldLocation.id,
          oldClimate.id,
        ],
        percentage:
          result.percentage,
      };
    },
  );

assert.equal(
  baseline.percentage,
  0,
  "Baseline diagnostic result should be 0%",
);

await page.waitForTimeout(
  450,
);

const dashboard =
  page.locator(
    '[data-r20-dashboard-role="student"]',
  ).first();

assert.ok(
  await dashboard.count(),
  "Student dashboard was not activated",
);

const card =
  dashboard.locator(
    '[data-r20-remedial-assistant-card="true"]',
  ).first();

assert.ok(
  await card.count(),
  "Mobdea Assistant remedial card missing",
);

assert.equal(
  await card.isVisible(),
  true,
  "Mobdea Assistant remedial card hidden",
);

await card.click();

const dialog =
  page.locator(
    "#r20-remedial-assistant-dialog",
  );

await dialog.waitFor({
  state:
    "visible",
});

const planAudit =
  await page.evaluate(
    ({
      usedIds,
    }) => {
      const api =
        window
          .mobdeaR20RemedialAssistant;

      const planId =
        api.activePlanId();

      const plan =
        api.getPlan(
          planId,
        );

      return {
        planId,
        questionIds:
          plan.questionIds,
        baseline:
          plan.baseline,
        overlap:
          plan.questionIds
            .filter(
              (id) =>
                usedIds.includes(
                  id,
                ),
            ),
      };
    },
    {
      usedIds:
        baseline.usedIds,
    },
  );

assert.ok(
  planAudit.planId,
  "Remedial plan was not created",
);

assert.ok(
  planAudit.questionIds.length >=
    2,
  "Remedial plan has too few questions",
);

assert.deepEqual(
  planAudit.overlap,
  [],
  "Remedial plan repeated historical questions",
);

assert.equal(
  planAudit.baseline.accuracy,
  0,
  "Targeted baseline accuracy is incorrect",
);

for (
  let guard = 0;
  guard < 10;
  guard += 1
) {
  const result =
    dialog.locator(
      "[data-r20-remedial-result]",
    );

  if (
    await result.count()
  ) {
    break;
  }

  const question =
    dialog.locator(
      "[data-r20-remedial-question]",
    ).first();

  assert.ok(
    await question.count(),
    "Remedial question disappeared before completion",
  );

  const questionId =
    await question.getAttribute(
      "data-r20-remedial-question-id",
    );

  const correct =
    await page.evaluate(
      (questionId) =>
        window
          .mobdeaR20QuestionBank
          .getById(
            questionId,
          )
          .correctAnswer,
      questionId,
    );

  const options =
    question.locator(
      "[data-r20-remedial-option]",
    );

  const count =
    await options.count();

  let clicked =
    false;

  for (
    let index = 0;
    index < count;
    index += 1
  ) {
    const option =
      options.nth(
        index,
      );

    if (
      (
        await option.textContent()
      )?.trim() ===
      correct
    ) {
      await option.click();
      clicked =
        true;
      break;
    }
  }

  assert.equal(
    clicked,
    true,
    `Correct option not found for ${questionId}`,
  );

  await page.waitForTimeout(
    150,
  );
}

const resultPanel =
  dialog.locator(
    "[data-r20-remedial-result]",
  );

assert.equal(
  await resultPanel.isVisible(),
  true,
  "Remedial result did not render",
);

const progress =
  await page.evaluate(
    () => {
      const api =
        window
          .mobdeaR20RemedialAssistant;

      const plan =
        api.getPlan(
          api.activePlanId(),
        );

      return {
        status:
          plan.status,
        percentage:
          plan.result
            ?.percentage,
        baseline:
          plan.result
            ?.progress
            ?.baselineAccuracy,
        improvement:
          plan.result
            ?.progress
            ?.improvementPoints,
        wrongCount:
          plan.result
            ?.wrongCount,
      };
    },
  );

assert.equal(
  progress.status,
  "completed",
);

assert.equal(
  progress.percentage,
  100,
  "Remedial exam did not score 100% with all correct answers",
);

assert.equal(
  progress.baseline,
  0,
);

assert.equal(
  progress.improvement,
  100,
  "Improvement was not measured from baseline",
);

assert.equal(
  progress.wrongCount,
  0,
);

const improvementText =
  await dialog
    .locator(
      "[data-r20-remedial-improvement]",
    )
    .textContent();

assert.ok(
  improvementText.includes(
    "+100",
  ),
  "Visible improvement result is missing",
);

const overflow =
  await page.evaluate(
    () =>
      document
        .documentElement
        .scrollWidth -
      innerWidth,
  );

assert.ok(
  overflow <= 4,
  `Remedial UI horizontal overflow=${overflow}`,
);

assert.deepEqual(
  errors,
  [],
  errors.join(
    "\n",
  ),
);

await page.screenshot({
  path:
    path.join(
      out,
      "tablet-1280x800-remedial-result.png",
    ),
  fullPage:
    true,
});

await context.close();
await browser.close();
