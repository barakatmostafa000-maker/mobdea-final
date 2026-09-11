import assert from "node:assert/strict";
import test from "node:test";

class MemoryStorage {
  constructor() {
    this.map =
      new Map();
  }

  getItem(key) {
    return this.map.has(key)
      ? this.map.get(key)
      : null;
  }

  setItem(key, value) {
    this.map.set(
      String(key),
      String(value),
    );
  }

  clear() {
    this.map.clear();
  }

  get length() {
    return this.map.size;
  }

  key(index) {
    return [
      ...this.map.keys(),
    ][index] ??
      null;
  }
}

const questions = [
  {
    id: "used-location",
    prompt: "قديم موقع",
    options: ["أ", "ب"],
    correctAnswer: "أ",
    subject: "دراسات",
    grade: "السادس",
    unit: "الوحدة الأولى",
    lesson: "الموقع",
  },
  {
    id: "new-location-1",
    prompt: "جديد موقع 1",
    options: ["أ", "ب"],
    correctAnswer: "أ",
    subject: "دراسات",
    grade: "السادس",
    unit: "الوحدة الأولى",
    lesson: "الموقع",
  },
  {
    id: "new-location-2",
    prompt: "جديد موقع 2",
    options: ["أ", "ب"],
    correctAnswer: "أ",
    subject: "دراسات",
    grade: "السادس",
    unit: "الوحدة الأولى",
    lesson: "الموقع",
  },
  {
    id: "used-climate",
    prompt: "قديم مناخ",
    options: ["أ", "ب"],
    correctAnswer: "أ",
    subject: "دراسات",
    grade: "السادس",
    unit: "الوحدة الثانية",
    lesson: "المناخ",
  },
  {
    id: "new-climate-1",
    prompt: "جديد مناخ 1",
    options: ["أ", "ب"],
    correctAnswer: "أ",
    subject: "دراسات",
    grade: "السادس",
    unit: "الوحدة الثانية",
    lesson: "المناخ",
  },
  {
    id: "new-climate-2",
    prompt: "جديد مناخ 2",
    options: ["أ", "ب"],
    correctAnswer: "أ",
    subject: "دراسات",
    grade: "السادس",
    unit: "الوحدة الثانية",
    lesson: "المناخ",
  },
];

const byId =
  new Map(
    questions.map(
      (question) => [
        question.id,
        question,
      ],
    ),
  );

function matching(
  question,
  filters,
) {
  return Object
    .entries(
      filters,
    )
    .every(
      ([key, value]) =>
        String(
          question[key] ??
          "",
        )
          .trim()
          .toLowerCase() ===
        String(
          value,
        )
          .trim()
          .toLowerCase(),
    );
}

const bank = {
  query(filters = {}) {
    return questions
      .filter(
        (question) =>
          matching(
            question,
            filters,
          ),
      )
      .map(
        (question) => ({
          ...question,
          options:
            [
              ...question.options,
            ],
        }),
      );
  },

  getById(id) {
    return byId.get(id) || null;
  },
};

class FakeExamTracking {
  constructor() {
    this.exams =
      new Map();

    this.attempts =
      [];

    this.answers =
      new Map();

    this.weakness = {
      studentId:
        "STU-1",
      buckets: {
        location: {
          key:
            "location",
          totalWrong:
            3,
          questionIds:
            [
              "used-location",
            ],
          metadata: {
            subject:
              "دراسات",
            grade:
              "السادس",
            unit:
              "الوحدة الأولى",
            lesson:
              "الموقع",
          },
        },
        climate: {
          key:
            "climate",
          totalWrong:
            2,
          questionIds:
            [
              "used-climate",
            ],
          metadata: {
            subject:
              "دراسات",
            grade:
              "السادس",
            unit:
              "الوحدة الثانية",
            lesson:
              "المناخ",
          },
        },
      },
    };

    this.attempts.push({
      attemptId:
        "OLD-1",
      studentId:
        "STU-1",
      status:
        "completed",
      questionIds:
        [
          "used-location",
          "used-climate",
        ],
      answers: {
        "used-location": {
          questionId:
            "used-location",
          isCorrect:
            false,
        },
        "used-climate": {
          questionId:
            "used-climate",
          isCorrect:
            false,
        },
      },
      result: {
        percentage:
          0,
      },
    });
  }

  getStudentWeakness() {
    return this.weakness;
  }

  listAttemptsByStudent() {
    return this.attempts;
  }

  async registerExamFromDefinition(
    definition,
  ) {
    const exam = {
      examCode:
        `EX-${String(this.exams.size + 1).padStart(12, "A")}`,
      ...definition,
    };

    this.exams.set(
      exam.examCode,
      exam,
    );

    return exam;
  }

  startAttempt(details) {
    const attempt = {
      attemptId:
        `ATT-${this.attempts.length + 1}`,
      status:
        "in-progress",
      answers: {},
      ...details,
    };

    this.attempts.push(
      attempt,
    );

    return attempt;
  }

  getAttempt(id) {
    return this.attempts.find(
      (attempt) =>
        attempt.attemptId ===
        id,
    ) || null;
  }

  recordAnswer(details) {
    const attempt =
      this.getAttempt(
        details.attemptId,
      );

    const question =
      bank.getById(
        details.questionId,
      );

    const answer = {
      questionId:
        details.questionId,
      selectedAnswer:
        details.selectedAnswer,
      isCorrect:
        details.selectedAnswer ===
        question.correctAnswer,
    };

    attempt.answers[
      details.questionId
    ] =
      answer;

    return answer;
  }

  finalizeAttempt(id) {
    const attempt =
      this.getAttempt(id);

    const answers =
      Object.values(
        attempt.answers,
      );

    const correct =
      answers.filter(
        (answer) =>
          answer.isCorrect,
      ).length;

    const wrong =
      answers.length -
      correct;

    attempt.status =
      "completed";

    attempt.result = {
      attemptId:
        attempt.attemptId,
      examCode:
        attempt.examCode,
      studentId:
        attempt.studentId,
      correctCount:
        correct,
      wrongCount:
        wrong,
      gradedCount:
        answers.length,
      percentage:
        answers.length
          ? correct /
            answers.length *
            100
          : null,
    };

    return attempt.result;
  }
}

globalThis.window = {
  dispatchEvent() {},
};

const {
  R20RemedialAssistant,
  buildWeaknessTargets,
  computeImprovement,
  viewerCanUseRemedialAssistant,
} = await import(
  "../src/services/r20RemedialAssistant.js"
);

test("FIX22 prioritizes higher weakness counts", () => {
  const targets =
    buildWeaknessTargets(
      new FakeExamTracking()
        .weakness,
    );

  assert.equal(
    targets[0].key,
    "location",
  );

  assert.equal(
    targets[1].key,
    "climate",
  );
});

test("FIX22 selects unseen graded questions only", async () => {
  const storage =
    new MemoryStorage();

  const tracker =
    new FakeExamTracking();

  const assistant =
    new R20RemedialAssistant({
      questionBank:
        bank,
      examTracking:
        tracker,
      storage,
    });

  const plan =
    await assistant
      .createPlan({
        studentId:
          "STU-1",
        limit:
          4,
      });

  assert.equal(
    plan.questionIds.length,
    4,
  );

  assert.ok(
    !plan.questionIds.includes(
      "used-location",
    ),
  );

  assert.ok(
    !plan.questionIds.includes(
      "used-climate",
    ),
  );

  assert.equal(
    new Set(
      plan.questionIds,
    ).size,
    plan.questionIds.length,
  );
});

test("FIX22 second plan cannot repeat the first remedial plan", async () => {
  const storage =
    new MemoryStorage();

  const tracker =
    new FakeExamTracking();

  const assistant =
    new R20RemedialAssistant({
      questionBank:
        bank,
      examTracking:
        tracker,
      storage,
    });

  const first =
    await assistant
      .createPlan({
        studentId:
          "STU-1",
        limit:
          2,
      });

  const second =
    await assistant
      .createPlan({
        studentId:
          "STU-1",
        limit:
          2,
      });

  const overlap =
    second.questionIds
      .filter(
        (id) =>
          first.questionIds
            .includes(
              id,
            ),
      );

  assert.deepEqual(
    overlap,
    [],
  );
});

test("FIX22 tracks improvement against historical targeted accuracy", async () => {
  const storage =
    new MemoryStorage();

  const tracker =
    new FakeExamTracking();

  const assistant =
    new R20RemedialAssistant({
      questionBank:
        bank,
      examTracking:
        tracker,
      storage,
    });

  const plan =
    await assistant
      .createPlan({
        studentId:
          "STU-1",
        limit:
          2,
      });

  assistant.startPlan(
    plan.planId,
  );

  for (
    const questionId of
    plan.questionIds
  ) {
    assistant.recordAnswer({
      planId:
        plan.planId,
      questionId,
      selectedAnswer:
        bank
          .getById(
            questionId,
          )
          .correctAnswer,
    });
  }

  const result =
    assistant.completePlan(
      plan.planId,
    );

  assert.equal(
    result.percentage,
    100,
  );

  assert.equal(
    result.progress
      .baselineAccuracy,
    0,
  );

  assert.equal(
    result.progress
      .improvementPoints,
    100,
  );

  assert.equal(
    computeImprovement(
      40,
      75,
    ),
    35,
  );
});

test("FIX22 student assistant scope is own-student only", () => {
  assert.equal(
    viewerCanUseRemedialAssistant(
      {
        role:
          "student",
        studentId:
          "STU-1",
      },
      "STU-1",
    ),
    true,
  );

  assert.equal(
    viewerCanUseRemedialAssistant(
      {
        role:
          "student",
        studentId:
          "STU-1",
      },
      "STU-2",
    ),
    false,
  );

  assert.equal(
    viewerCanUseRemedialAssistant(
      {
        role:
          "parent",
        linkedStudentIds:
          [
            "STU-1",
          ],
      },
      "STU-1",
    ),
    false,
  );
});
