import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl =
  process.env.R20_REPORTS_URL ||
  "http://127.0.0.1:4173";

const out =
  path.resolve(
    "r20-reports-whatsapp-smoke",
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
        "admin",
      name:
        "R20 Reports Audit",
      expiresAt:
        Date.now() +
        60 * 60 * 1000,
    }),
  );

  localStorage.setItem(
    "mobdea_students_fixture",
    JSON.stringify({
      students: [
        {
          id:
            "STU-RPT-1",
          name:
            "طالب التقرير",
          studentCode:
            "9001",
          parentPhone:
            "01012345678",
        },
        {
          id:
            "STU-RPT-2",
          name:
            "طالب آخر",
          studentCode:
            "9002",
          parentPhone:
            "01199999999",
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
            "ما عاصمة مصر؟",
          options:
            [
              "القاهرة",
              "الجيزة",
            ],
          correctAnswer:
            "القاهرة",
          subject:
            "دراسات",
          unit:
            "الوحدة الأولى",
          lesson:
            "مصر",
        },
        {
          question:
            "يمر خط جرينتش بدرجة؟",
          options:
            [
              "0",
              "30",
            ],
          correctAnswer:
            "0",
          subject:
            "دراسات",
          unit:
            "الوحدة الأولى",
          lesson:
            "الموقع",
        },
        {
          question:
            "تكثر الأمطار في؟",
          options:
            [
              "الغابات",
              "الصحراء",
            ],
          correctAnswer:
            "الغابات",
          subject:
            "دراسات",
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

const pageErrors =
  [];

const popups =
  [];

page.on(
  "pageerror",
  (error) =>
    pageErrors.push(
      String(error),
    ),
);

page.on(
  "popup",
  (popup) =>
    popups.push(
      popup,
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
  450,
);

const created =
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

      const exam =
        await exams
          .registerExamFromDefinition({
            title:
              "امتحان التقرير",
            source:
              "phase22-smoke",
            questionIds:
              questions.map(
                (question) =>
                  question.id,
              ),
          });

      const attempt =
        exams.startAttempt({
          examCode:
            exam.examCode,
          studentId:
            "STU-RPT-1",
          studentName:
            "طالب التقرير",
        });

      exams.recordAnswer({
        attemptId:
          attempt.attemptId,
        questionId:
          questions[0].id,
        selectedAnswer:
          "القاهرة",
      });

      exams.recordAnswer({
        attemptId:
          attempt.attemptId,
        questionId:
          questions[1].id,
        selectedAnswer:
          "30",
      });

      exams.recordAnswer({
        attemptId:
          attempt.attemptId,
        questionId:
          questions[2].id,
        selectedAnswer:
          "الصحراء",
      });

      const result =
        exams.finalizeAttempt(
          attempt.attemptId,
        );

      return {
        attemptId:
          attempt.attemptId,
        examCode:
          exam.examCode,
        result,
      };
    },
  );

await page.waitForTimeout(
  300,
);

assert.equal(
  popups.length,
  0,
  "WhatsApp opened automatically after exam result",
);

const panel =
  page.locator(
    '[data-r20-report-ready-panel="true"]',
  ).first();

assert.ok(
  await panel.count(),
  "Teacher report-ready panel missing",
);

assert.equal(
  await panel.isVisible(),
  true,
  "Teacher report-ready panel hidden",
);

const report =
  await page.evaluate(
    ({
      attemptId,
    }) => {
      return window
        .mobdeaR20Reports
        .buildStudentReport({
          studentId:
            "STU-RPT-1",
          attemptId,
          viewer: {
            role:
              "teacher",
          },
        });
    },
    {
      attemptId:
        created.attemptId,
    },
  );

assert.equal(
  report.wrongCount,
  2,
);

assert.equal(
  report.examWeaknesses.length,
  2,
  "Every grouped exam weakness was not retained",
);

assert.equal(
  report.contact.whatsappPhone,
  "201012345678",
  "Parent WhatsApp phone resolved incorrectly",
);

const share =
  await page.evaluate(
    ({
      attemptId,
    }) => {
      const api =
        window
          .mobdeaR20Reports;

      const report =
        api.buildStudentReport({
          studentId:
            "STU-RPT-1",
          attemptId,
          viewer: {
            role:
              "teacher",
          },
        });

      return api
        .createWhatsAppShare(
          report,
        );
    },
    {
      attemptId:
        created.attemptId,
    },
  );

assert.match(
  share.url,
  /^https:\/\/wa\.me\/201012345678\?text=/,
);

for (
  const token of [
    "الموقع",
    "المناخ",
    created.examCode,
  ]
) {
  assert.ok(
    share.message.includes(
      token,
    ),
    `WhatsApp report is missing ${token}`,
  );
}

const scope =
  await page.evaluate(() => {
    const api =
      window
        .mobdeaR20Reports;

    return {
      linked:
        api.viewerCanAccessStudent(
          {
            role:
              "parent",
            linkedStudentIds:
              [
                "STU-RPT-1",
              ],
          },
          "STU-RPT-1",
        ),
      foreign:
        api.viewerCanAccessStudent(
          {
            role:
              "parent",
            linkedStudentIds:
              [
                "STU-RPT-1",
              ],
          },
          "STU-RPT-2",
        ),
      studentOwn:
        api.viewerCanAccessStudent(
          {
            role:
              "student",
            studentId:
              "STU-RPT-1",
          },
          "STU-RPT-1",
        ),
      studentOther:
        api.viewerCanAccessStudent(
          {
            role:
              "student",
            studentId:
              "STU-RPT-1",
          },
          "STU-RPT-2",
        ),
    };
  });

assert.equal(
  scope.linked,
  true,
);

assert.equal(
  scope.foreign,
  false,
);

assert.equal(
  scope.studentOwn,
  true,
);

assert.equal(
  scope.studentOther,
  false,
);

await panel
  .locator(
    '[data-r20-report-action="view"]',
  )
  .click();

const dialog =
  page.locator(
    "#r20-student-report-dialog",
  );

assert.ok(
  await dialog.count(),
);

assert.equal(
  await dialog.isVisible(),
  true,
  "Report dialog did not open",
);

const dialogText =
  await dialog.textContent();

for (
  const token of [
    "الموقع",
    "المناخ",
    "نقاط الضعف",
  ]
) {
  assert.ok(
    dialogText.includes(
      token,
    ),
    `Visible report is missing ${token}`,
  );
}

const overflow =
  await page.evaluate(
    () =>
      document.documentElement
        .scrollWidth -
      innerWidth,
  );

assert.ok(
  overflow <= 4,
  `Reports horizontal overflow=${overflow}`,
);

assert.deepEqual(
  pageErrors,
  [],
  pageErrors.join(
    "\n",
  ),
);

await page.screenshot({
  path:
    path.join(
      out,
      "tablet-1280x800-report.png",
    ),
  fullPage:
    true,
});

await context.close();
await browser.close();
