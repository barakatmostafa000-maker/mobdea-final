import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl =
  process.env.R20_MONTHLY_URL
  || "http://127.0.0.1:4173";

const out =
  path.resolve(
    "r20-monthly-evaluation-smoke",
  );

await fs.mkdir(
  out,
  {
    recursive: true,
  },
);

const browser =
  await chromium.launch({
    headless: true,
  });

const context =
  await browser.newContext({
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
      name: "Monthly Audit",
      expiresAt:
        Date.now()
        + 3600000,
    }),
  );

  localStorage.setItem(
    "mobdea_students_fixture",
    JSON.stringify({
      students: [
        {
          id: "S1",
          name: "أحمد",
          groupId: "A",
          groupName: "مجموعة A",
        },
        {
          id: "S2",
          name: "محمود",
          groupId: "A",
          groupName: "مجموعة A",
        },
        {
          id: "S3",
          name: "سارة",
          groupId: "B",
          groupName: "مجموعة B",
        },
        {
          id: "S4",
          name: "نور",
          groupId: "B",
          groupName: "مجموعة B",
        },
      ],
    }),
  );
});

const page =
  await context.newPage();

const errors = [];

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
    waitUntil: "networkidle",
  },
);

await page.waitForTimeout(
  450,
);

const audit =
  await page.evaluate(
    () => {
      const api =
        window
          .mobdeaR20MonthlyEvaluation;

      if (!api) {
        return null;
      }

      const profiles = [
        [
          "S1",
          "أحمد",
          "A",
          "مجموعة A",
        ],
        [
          "S2",
          "محمود",
          "A",
          "مجموعة A",
        ],
        [
          "S3",
          "سارة",
          "B",
          "مجموعة B",
        ],
        [
          "S4",
          "نور",
          "B",
          "مجموعة B",
        ],
      ];

      profiles.forEach(
        (
          [
            id,
            name,
            groupId,
            groupName,
          ],
        ) =>
          api.setStudentProfile(
            id,
            {
              studentName: name,
              groupId,
              groupName,
            },
          ),
      );

      const add =
        (
          id,
          percentage,
          date,
          code,
        ) =>
          api.ingestExamResult(
            {
              resultId:
                `${id}-${code}-${date}`,
              attemptId:
                `ATT-${id}-${code}-${date}`,
              examCode: code,
              studentId: id,
              studentName:
                profiles.find(
                  (item) =>
                    item[0] === id,
                )[1],
              percentage,
              correctCount:
                percentage,
              wrongCount:
                100
                - percentage,
              gradedCount: 100,
              completedAt:
                `${date}T10:00:00.000Z`,
            },
            {
              examTitle:
                `امتحان ${code}`,
            },
          );

      add(
        "S1",
        70,
        "2026-07-10",
        "JUL",
      );

      add(
        "S2",
        95,
        "2026-07-10",
        "JUL",
      );

      add(
        "S3",
        50,
        "2026-07-10",
        "JUL",
      );

      add(
        "S4",
        70,
        "2026-07-10",
        "JUL",
      );

      add(
        "S1",
        90,
        "2026-08-05",
        "AUG1",
      );

      add(
        "S1",
        95,
        "2026-08-15",
        "AUG2",
      );

      add(
        "S2",
        98,
        "2026-08-05",
        "AUG1",
      );

      add(
        "S2",
        97,
        "2026-08-15",
        "AUG2",
      );

      add(
        "S3",
        85,
        "2026-08-05",
        "AUG1",
      );

      add(
        "S4",
        70,
        "2026-08-05",
        "AUG1",
      );

      for (
        const [
          id,
          july,
          august,
        ]
        of [
          [
            "S1",
            10,
            20,
          ],
          [
            "S2",
            12,
            15,
          ],
          [
            "S3",
            10,
            30,
          ],
          [
            "S4",
            5,
            5,
          ],
        ]
      ) {
        api.recordClassPoints({
          studentId: id,
          points: july,
          at: "2026-07-20",
          source: "monthly",
          mode: "absolute",
        });

        api.recordClassPoints({
          studentId: id,
          points: august,
          at: "2026-08-20",
          source: "monthly",
          mode: "absolute",
        });
      }

      const all =
        api.rankings(
          "2026-08",
        );

      const groupA =
        api.rankings(
          "2026-08",
          {
            group: "A",
          },
        );

      const own =
        api.ownRanks(
          "2026-08",
          "S1",
        );

      return {
        topExam:
          all.exams[0]
            .studentId,
        topClass:
          all.classes[0]
            .studentId,
        topImprove:
          all.improvement[0]
            .studentId,
        topImproveValue:
          all.improvement[0]
            .examImprovement,
        groupATopExam:
          groupA.exams[0]
            .studentId,
        ownOverallExamRank:
          own.overall.exams
            .rank,
        ownGroupExamRank:
          own.group.exams
            .rank,
        monthlyText:
          api.formatMonthlyShare(
            "2026-08",
          ),
        examText:
          api.formatExamShare(
            "AUG1",
          ),
        groups:
          api.groups(
            "2026-08",
          ),
      };
    },
  );

assert.ok(
  audit,
  "Monthly Evaluation API missing",
);

assert.equal(
  audit.topExam,
  "S2",
  "Highest monthly exam ranking incorrect",
);

assert.equal(
  audit.topClass,
  "S3",
  "Highest class-points ranking incorrect",
);

assert.equal(
  audit.topImprove,
  "S3",
  "Most-improved ranking incorrect",
);

assert.equal(
  audit.topImproveValue,
  35,
);

assert.equal(
  audit.groupATopExam,
  "S2",
);

assert.equal(
  audit.ownOverallExamRank,
  2,
);

assert.equal(
  audit.ownGroupExamRank,
  2,
);

assert.equal(
  audit.groups.length,
  2,
);

for (
  const token of [
    "ترتيب درجات الامتحانات",
    "ترتيب نقاط الحصص",
    "الأكثر تحسنًا",
  ]
) {
  assert.ok(
    audit.monthlyText
      .includes(token),
    `Monthly share missing ${token}`,
  );
}

assert.ok(
  audit.examText
    .includes(
      "AUG1",
    ),
);

assert.ok(
  audit.examText
    .indexOf(
      "محمود",
    )
  <
  audit.examText
    .indexOf(
      "أحمد",
    ),
);

const card =
  page.locator(
    "[data-r20-monthly-evaluation-card='true']",
  ).first();

assert.ok(
  await card.count(),
  "Monthly evaluation dashboard icon missing",
);

assert.equal(
  await card.isVisible(),
  true,
);

await card.click();

const dialog =
  page.locator(
    "[data-r20-monthly-dialog='true']",
  );

assert.equal(
  await dialog.isVisible(),
  true,
  "Monthly evaluation dialog did not open",
);

const text =
  await dialog.textContent();

for (
  const token of [
    "ترتيب درجات الامتحانات",
    "ترتيب نقاط الحصص",
    "الأكثر تحسنًا",
  ]
) {
  assert.ok(
    text.includes(token),
    `Visible monthly dialog missing ${token}`,
  );
}

const overflow =
  await page.evaluate(
    () =>
      document
        .documentElement
        .scrollWidth
      - innerWidth,
  );

assert.ok(
  overflow <= 4,
  `Monthly UI horizontal overflow=${overflow}`,
);

assert.deepEqual(
  errors,
  [],
  errors.join("\n"),
);

await page.screenshot({
  path:
    path.join(
      out,
      "tablet-1280x800-monthly-evaluation.png",
    ),
  fullPage: true,
});

await context.close();
await browser.close();
