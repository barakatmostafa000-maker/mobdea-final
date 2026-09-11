import assert from "node:assert/strict";
import test from "node:test";

class MemoryStorage {
  constructor() {
    this.map = new Map();
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

  key(index) {
    return [
      ...this.map.keys(),
    ][index] ?? null;
  }

  get length() {
    return this.map.size;
  }

  clear() {
    this.map.clear();
  }
}

const {
  R20MonthlyEvaluation,
  formatMonthlyShare,
  formatExamShare,
  viewerCanSeeMonthlyStudent,
  previousMonthKey,
} = await import(
  "../src/services/r20MonthlyEvaluation.js"
);

function evaluator() {
  return new R20MonthlyEvaluation({
    storage: new MemoryStorage(),
    examTracking: {
      getExam: (code) => ({
        examCode: code,
        title: "امتحان أغسطس",
      }),
    },
  });
}

function profile(
  evaluator,
  id,
  name,
  group,
) {
  evaluator.setStudentProfile(
    id,
    {
      studentName: name,
      groupId: group,
      groupName: group,
    },
  );
}

function exam(
  evaluator,
  id,
  percentage,
  date,
  code = "EX-A",
) {
  return evaluator.ingestExamResult(
    {
      resultId:
        `${id}-${code}-${date}`,
      attemptId:
        `ATT-${id}-${date}`,
      examCode:
        code,
      studentId:
        id,
      studentName:
        id,
      percentage,
      correctCount:
        percentage,
      wrongCount:
        100 - percentage,
      gradedCount:
        100,
      completedAt:
        `${date}T10:00:00.000Z`,
    },
    {
      examTitle:
        "امتحان أغسطس",
    },
  );
}

test("FIX25 exam ingestion is idempotent and totals monthly grades", () => {
  const e = evaluator();

  profile(
    e,
    "S1",
    "أحمد",
    "A",
  );

  exam(
    e,
    "S1",
    90,
    "2026-08-01",
    "EX-1",
  );

  exam(
    e,
    "S1",
    90,
    "2026-08-01",
    "EX-1",
  );

  exam(
    e,
    "S1",
    80,
    "2026-08-10",
    "EX-2",
  );

  const summary =
    e.studentSummary(
      "2026-08",
      "S1",
    );

  assert.equal(
    summary.examCount,
    2,
  );

  assert.equal(
    summary.examTotal,
    170,
  );

  assert.equal(
    summary.examAverage,
    85,
  );
});

test("FIX25 overall and per-group rankings are separate", () => {
  const e = evaluator();

  profile(
    e,
    "S1",
    "أحمد",
    "A",
  );

  profile(
    e,
    "S2",
    "محمود",
    "A",
  );

  profile(
    e,
    "S3",
    "سارة",
    "B",
  );

  exam(
    e,
    "S1",
    90,
    "2026-08-01",
  );

  exam(
    e,
    "S2",
    98,
    "2026-08-01",
  );

  exam(
    e,
    "S3",
    95,
    "2026-08-01",
  );

  assert.equal(
    e.rankings(
      "2026-08",
    ).exams[0].studentId,
    "S2",
  );

  assert.equal(
    e.rankings(
      "2026-08",
      {
        group: "B",
      },
    ).exams[0].studentId,
    "S3",
  );
});

test("FIX25 class points support delta and absolute legacy snapshots", () => {
  const e = evaluator();

  profile(
    e,
    "S1",
    "أحمد",
    "A",
  );

  e.recordClassPoints({
    studentId: "S1",
    points: 5,
    at: "2026-08-01",
    eventId: "p1",
  });

  e.recordClassPoints({
    studentId: "S1",
    points: 5,
    at: "2026-08-01",
    eventId: "p1",
  });

  e.recordClassPoints({
    studentId: "S1",
    points: 12,
    at: "2026-08-01",
    source: "legacy",
    mode: "absolute",
  });

  assert.equal(
    e.studentSummary(
      "2026-08",
      "S1",
    ).classPoints,
    17,
  );
});

test("FIX25 most-improved ranking compares with previous month", () => {
  const e = evaluator();

  for (
    const [
      id,
      name,
      group,
    ]
    of [
      ["S1", "أحمد", "A"],
      ["S2", "محمود", "A"],
      ["S3", "سارة", "B"],
    ]
  ) {
    profile(
      e,
      id,
      name,
      group,
    );
  }

  exam(
    e,
    "S1",
    70,
    "2026-07-10",
  );

  exam(
    e,
    "S1",
    90,
    "2026-08-10",
  );

  exam(
    e,
    "S2",
    95,
    "2026-07-10",
  );

  exam(
    e,
    "S2",
    98,
    "2026-08-10",
  );

  exam(
    e,
    "S3",
    50,
    "2026-07-10",
  );

  exam(
    e,
    "S3",
    85,
    "2026-08-10",
  );

  const ranking =
    e.rankings(
      "2026-08",
    ).improvement;

  assert.equal(
    ranking[0].studentId,
    "S3",
  );

  assert.equal(
    ranking[0].examImprovement,
    35,
  );

  assert.equal(
    previousMonthKey(
      "2026-08",
    ),
    "2026-07",
  );
});

test("FIX25 monthly share has exams, classes and most improved", () => {
  const e = evaluator();

  profile(
    e,
    "S1",
    "أحمد",
    "A",
  );

  exam(
    e,
    "S1",
    80,
    "2026-07-01",
  );

  exam(
    e,
    "S1",
    90,
    "2026-08-01",
  );

  e.recordClassPoints({
    studentId: "S1",
    points: 10,
    at: "2026-07-01",
    source: "legacy",
    mode: "absolute",
  });

  e.recordClassPoints({
    studentId: "S1",
    points: 20,
    at: "2026-08-01",
    source: "legacy",
    mode: "absolute",
  });

  const text =
    formatMonthlyShare(
      e,
      "2026-08",
    );

  for (
    const token of [
      "ترتيب درجات الامتحانات",
      "ترتيب نقاط الحصص",
      "الأكثر تحسنًا",
      "أحمد",
    ]
  ) {
    assert.ok(
      text.includes(token),
    );
  }
});

test("FIX25 each exam gets a ready ranked share text", () => {
  const e = evaluator();

  profile(
    e,
    "S1",
    "أحمد",
    "A",
  );

  profile(
    e,
    "S2",
    "محمود",
    "A",
  );

  exam(
    e,
    "S1",
    90,
    "2026-08-01",
    "EX-X",
  );

  exam(
    e,
    "S2",
    95,
    "2026-08-01",
    "EX-X",
  );

  const text =
    formatExamShare(
      e,
      "EX-X",
    );

  assert.ok(
    text.includes(
      "كود الامتحان: EX-X",
    ),
  );

  assert.ok(
    text.indexOf("محمود")
      < text.indexOf("أحمد"),
  );
});

test("FIX25 student and parent scopes expose only own or linked rank", () => {
  assert.equal(
    viewerCanSeeMonthlyStudent(
      {
        role: "student",
        studentId: "S1",
      },
      "S1",
    ),
    true,
  );

  assert.equal(
    viewerCanSeeMonthlyStudent(
      {
        role: "student",
        studentId: "S1",
      },
      "S2",
    ),
    false,
  );

  assert.equal(
    viewerCanSeeMonthlyStudent(
      {
        role: "parent",
        linkedStudentIds: ["S1"],
      },
      "S1",
    ),
    true,
  );

  assert.equal(
    viewerCanSeeMonthlyStudent(
      {
        role: "parent",
        linkedStudentIds: ["S1"],
      },
      "S2",
    ),
    false,
  );
});
