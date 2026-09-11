import {
  R20_MONTHLY_LEGACY_MONTHLY_FOUND,
  R20_MONTHLY_HAS_RANKING,
  R20_MONTHLY_HAS_CLASS_POINTS,
  R20_MONTHLY_HAS_GROUPS,
} from "../config/r20MonthlyEvaluationConfig.js";

export const R20_MONTHLY_EVALUATION_MARKER =
  "R20_FIX25_MONTHLY_EVALUATION_V1";

const STORAGE_KEY = "mobdea_r20_monthly_evaluation_v1";
const AUTH_KEY = "mobdea_mobile_auth_v2";
const DIALOG_ID = "r20-monthly-evaluation-dialog";
const SHARE_PANEL_ID = "r20-exam-share-ready-panel";

const clean = (value) =>
  String(value ?? "").replace(/\s+/g, " ").trim();

const safeArray = (value) =>
  Array.isArray(value) ? value : [];

const clone = (value) =>
  JSON.parse(JSON.stringify(value));

export function monthKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("R20 invalid monthly evaluation date.");
  }

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}`;
}

export function previousMonthKey(key) {
  if (!/^\d{4}-\d{2}$/.test(clean(key))) {
    throw new Error("R20 invalid month key.");
  }

  const [year, month] = key.split("-").map(Number);

  return monthKey(
    new Date(year, month - 2, 1),
  );
}

function defaultState() {
  return {
    schemaVersion: 1,
    months: {},
    studentProfiles: {},
    examIndex: {},
  };
}

function loadState(storage) {
  if (!storage) {
    return defaultState();
  }

  try {
    const parsed = JSON.parse(
      storage.getItem(STORAGE_KEY) || "null",
    );

    if (!parsed || parsed.schemaVersion !== 1) {
      return defaultState();
    }

    return {
      ...defaultState(),
      ...parsed,
      months: parsed.months || {},
      studentProfiles: parsed.studentProfiles || {},
      examIndex: parsed.examIndex || {},
    };
  } catch {
    return defaultState();
  }
}

function saveState(storage, state) {
  if (storage) {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify(state),
    );
  }
}

function studentRecord(state, key, studentId) {
  state.months[key] ||= {
    students: {},
  };

  state.months[key].students[studentId] ||= {
    studentId,
    exams: {},
    classDeltaEvents: {},
    classAbsoluteSources: {},
  };

  return state.months[key].students[studentId];
}

function numeric(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function studentName(record, profile) {
  return clean(
    profile?.studentName
    || profile?.name
    || record?.studentName
    || "",
  );
}

function profileGroupId(profile) {
  return clean(
    profile?.groupId
    ?? profile?.group
    ?? profile?.groupName
    ?? profile?.classGroup
    ?? profile?.batch
    ?? "",
  );
}

function profileGroupName(profile) {
  return clean(
    profile?.groupName
    ?? profile?.group
    ?? profile?.classGroup
    ?? profile?.batch
    ?? profile?.groupId
    ?? "",
  );
}

export function viewerCanSeeMonthlyStudent(
  viewer,
  studentId,
) {
  const id = clean(studentId);

  if (!viewer || !id) {
    return false;
  }

  if (
    [
      "teacher",
      "admin",
    ].includes(viewer.role)
  ) {
    return true;
  }

  if (viewer.role === "student") {
    return clean(viewer.studentId) === id;
  }

  if (viewer.role === "parent") {
    return safeArray(
      viewer.linkedStudentIds,
    )
      .map(clean)
      .includes(id);
  }

  return false;
}

function auth(
  storage = typeof localStorage !== "undefined"
    ? localStorage
    : null,
) {
  if (!storage) {
    return null;
  }

  try {
    const value = JSON.parse(
      storage.getItem(AUTH_KEY) || "null",
    );

    if (
      !value
      || (
        value.expiresAt
        && Number(value.expiresAt) <= Date.now()
      )
    ) {
      return null;
    }

    return value;
  } catch {
    return null;
  }
}

function rankRows(
  rows,
  scoreTuple,
) {
  const sorted = [...rows].sort(
    (a, b) => {
      const aScore = scoreTuple(a);
      const bScore = scoreTuple(b);

      for (
        let index = 0;
        index < Math.max(
          aScore.length,
          bScore.length,
        );
        index += 1
      ) {
        const av =
          aScore[index]
          ?? Number.NEGATIVE_INFINITY;

        const bv =
          bScore[index]
          ?? Number.NEGATIVE_INFINITY;

        if (av !== bv) {
          return bv - av;
        }
      }

      return clean(
        a.studentName || a.studentId,
      ).localeCompare(
        clean(
          b.studentName || b.studentId,
        ),
        "ar",
      );
    },
  );

  let lastSignature = null;
  let rank = 0;

  return sorted.map(
    (row, index) => {
      const signature = JSON.stringify(
        scoreTuple(row),
      );

      if (signature !== lastSignature) {
        rank = index + 1;
      }

      lastSignature = signature;

      return {
        ...row,
        rank,
      };
    },
  );
}

function summarizeStudentNoImprovement(
  state,
  key,
  studentId,
) {
  const record =
    state.months[key]?.students?.[studentId];

  if (!record) {
    return null;
  }

  const exams = Object.values(
    record.exams || {},
  );

  const values = exams
    .map(
      (exam) =>
        numeric(exam.percentage),
    )
    .filter(
      (value) =>
        value !== null,
    );

  const total = values.reduce(
    (sum, value) =>
      sum + value,
    0,
  );

  const classDelta =
    Object.values(
      record.classDeltaEvents || {},
    )
      .reduce(
        (sum, entry) =>
          sum
          + (
            numeric(entry.points)
            ?? 0
          ),
        0,
      );

  const classAbsolute =
    Object.values(
      record.classAbsoluteSources || {},
    )
      .reduce(
        (sum, entry) =>
          sum
          + (
            numeric(entry.points)
            ?? 0
          ),
        0,
      );

  return {
    examAverage:
      values.length
        ? Number(
            (
              total
              / values.length
            ).toFixed(2),
          )
        : null,
    classPoints:
      Number(
        (
          classDelta
          + classAbsolute
        ).toFixed(2),
      ),
  };
}

function summarizeStudent(
  state,
  key,
  studentId,
) {
  const record =
    state.months[key]?.students?.[studentId];

  if (!record) {
    return null;
  }

  const profile =
    state.studentProfiles[studentId]
    || {};

  const exams = Object.values(
    record.exams || {},
  );

  const percentages = exams
    .map(
      (exam) =>
        numeric(exam.percentage),
    )
    .filter(
      (value) =>
        value !== null,
    );

  const examTotal =
    Number(
      percentages
        .reduce(
          (sum, value) =>
            sum + value,
          0,
        )
        .toFixed(2),
    );

  const examAverage =
    percentages.length
      ? Number(
          (
            examTotal
            / percentages.length
          ).toFixed(2),
        )
      : null;

  const classDelta =
    Object.values(
      record.classDeltaEvents || {},
    )
      .reduce(
        (sum, entry) =>
          sum
          + (
            numeric(entry.points)
            ?? 0
          ),
        0,
      );

  const classAbsolute =
    Object.values(
      record.classAbsoluteSources || {},
    )
      .reduce(
        (sum, entry) =>
          sum
          + (
            numeric(entry.points)
            ?? 0
          ),
        0,
      );

  const classPoints =
    Number(
      (
        classDelta
        + classAbsolute
      ).toFixed(2),
    );

  const previous =
    summarizeStudentNoImprovement(
      state,
      previousMonthKey(key),
      studentId,
    );

  const examImprovement =
    (
      examAverage !== null
      && previous
      && previous.examAverage !== null
    )
      ? Number(
          (
            examAverage
            - previous.examAverage
          ).toFixed(2),
        )
      : null;

  const classImprovement =
    previous
      ? Number(
          (
            classPoints
            - previous.classPoints
          ).toFixed(2),
        )
      : null;

  const improvementSortValue =
    examImprovement
    ?? classImprovement;

  return {
    studentId,
    studentName:
      studentName(
        record,
        profile,
      )
      || studentId,
    groupId:
      profileGroupId(profile),
    groupName:
      profileGroupName(profile),
    examCount: exams.length,
    examTotal,
    examAverage,
    classPoints,
    examImprovement,
    classImprovement,
    improvementSortValue,
  };
}

export class R20MonthlyEvaluation {
  constructor({
    storage =
      typeof localStorage !== "undefined"
        ? localStorage
        : null,
    examTracking =
      typeof window !== "undefined"
        ? window.mobdeaR20ExamTracking
        : null,
  } = {}) {
    this.storage = storage;
    this.examTracking = examTracking;
    this.state = loadState(storage);
  }

  persist() {
    saveState(
      this.storage,
      this.state,
    );
  }

  setStudentProfile(
    studentId,
    profile = {},
  ) {
    const id = clean(studentId);

    if (!id) {
      throw new Error(
        "R20 monthly profile requires studentId.",
      );
    }

    this.state.studentProfiles[id] = {
      ...(
        this.state.studentProfiles[id]
        || {}
      ),
      ...profile,
      studentId: id,
    };

    this.persist();

    return clone(
      this.state.studentProfiles[id],
    );
  }

  ingestExamResult(
    result,
    {
      examTitle = "",
    } = {},
  ) {
    const studentId =
      clean(result?.studentId);

    const examCode =
      clean(result?.examCode);

    const resultId =
      clean(
        result?.resultId
        || result?.attemptId,
      );

    if (
      !studentId
      || !examCode
      || !resultId
    ) {
      throw new Error(
        "R20 monthly exam result requires studentId, examCode and resultId.",
      );
    }

    const key =
      monthKey(
        result.completedAt
        || new Date(),
      );

    const record =
      studentRecord(
        this.state,
        key,
        studentId,
      );

    record.studentName =
      clean(
        result.studentName
        || record.studentName
        || "",
      );

    record.exams[resultId] = {
      resultId,
      examCode,
      examTitle: clean(examTitle),
      percentage: numeric(
        result.percentage,
      ),
      correctCount: numeric(
        result.correctCount,
      ),
      wrongCount: numeric(
        result.wrongCount,
      ),
      gradedCount: numeric(
        result.gradedCount,
      ),
      completedAt:
        result.completedAt
        || new Date().toISOString(),
    };

    this.state.examIndex[examCode] ||= {};

    this.state.examIndex[examCode][studentId] = {
      monthKey: key,
      resultId,
    };

    this.persist();

    return {
      monthKey: key,
      studentId,
      resultId,
    };
  }

  recordClassPoints({
    studentId,
    points,
    at = new Date(),
    eventId = "",
    source = "class",
    mode = "delta",
  }) {
    const id = clean(studentId);
    const value = numeric(points);

    if (!id || value === null) {
      throw new Error(
        "R20 class points require studentId and numeric points.",
      );
    }

    const key = monthKey(at);

    const record =
      studentRecord(
        this.state,
        key,
        id,
      );

    if (mode === "absolute") {
      record.classAbsoluteSources[
        clean(source) || "class"
      ] = {
        points: value,
        at: new Date(at).toISOString(),
      };
    } else {
      const idempotencyKey =
        clean(eventId)
        || `${
          clean(source)
          || "class"
        }:${
          new Date(at).toISOString()
        }:${value}`;

      record.classDeltaEvents[
        idempotencyKey
      ] = {
        eventId: idempotencyKey,
        source:
          clean(source)
          || "class",
        points: value,
        at:
          new Date(at).toISOString(),
      };
    }

    this.persist();

    return this.studentSummary(
      key,
      id,
    );
  }

  studentSummary(
    key,
    studentId,
  ) {
    return summarizeStudent(
      this.state,
      clean(key),
      clean(studentId),
    );
  }

  rankings(
    key,
    {
      group = "",
    } = {},
  ) {
    const targetMonth =
      clean(key);

    const ids =
      Object.keys(
        this.state
          .months[
            targetMonth
          ]
          ?.students
        || {},
      );

    let rows = ids
      .map(
        (id) =>
          summarizeStudent(
            this.state,
            targetMonth,
            id,
          ),
      )
      .filter(Boolean);

    const targetGroup =
      clean(group);

    if (targetGroup) {
      rows = rows.filter(
        (row) =>
          row.groupId
            === targetGroup
          || row.groupName
            === targetGroup,
      );
    }

    return {
      monthKey:
        targetMonth,
      group:
        targetGroup,
      exams:
        rankRows(
          rows.filter(
            (row) =>
              row.examAverage
              !== null,
          ),
          (row) => [
            row.examTotal,
            row.examAverage,
            row.examCount,
          ],
        ),
      classes:
        rankRows(
          rows,
          (row) => [
            row.classPoints,
            row.examAverage
              ?? -1,
          ],
        ),
      improvement:
        rankRows(
          rows.filter(
            (row) =>
              row
                .improvementSortValue
              !== null,
          ),
          (row) => [
            row.improvementSortValue,
            row.examImprovement
              ?? Number.NEGATIVE_INFINITY,
            row.classImprovement
              ?? Number.NEGATIVE_INFINITY,
          ],
        ),
    };
  }

  groups(key) {
    const ids =
      Object.keys(
        this.state
          .months[
            clean(key)
          ]
          ?.students
        || {},
      );

    const groups =
      new Map();

    for (const id of ids) {
      const profile =
        this.state
          .studentProfiles[id]
        || {};

      const groupId =
        profileGroupId(
          profile,
        );

      if (!groupId) {
        continue;
      }

      groups.set(
        groupId,
        profileGroupName(profile)
        || groupId,
      );
    }

    return [
      ...groups.entries(),
    ].map(
      ([id, name]) => ({
        id,
        name,
      }),
    );
  }

  ownRanks(
    key,
    studentId,
  ) {
    const id = clean(studentId);
    const overall =
      this.rankings(key);
    const summary =
      this.studentSummary(
        key,
        id,
      );

    if (!summary) {
      return null;
    }

    const group =
      summary.groupId
        ? this.rankings(
            key,
            {
              group:
                summary.groupId,
            },
          )
        : null;

    const pick = (rows) =>
      rows.find(
        (row) =>
          row.studentId
          === id,
      )
      || null;

    return {
      monthKey:
        clean(key),
      student:
        summary,
      overall: {
        exams:
          pick(overall.exams),
        classes:
          pick(overall.classes),
        improvement:
          pick(overall.improvement),
      },
      group:
        group
          ? {
              groupId:
                summary.groupId,
              groupName:
                summary.groupName,
              exams:
                pick(group.exams),
              classes:
                pick(group.classes),
              improvement:
                pick(
                  group.improvement,
                ),
            }
          : null,
    };
  }

  examRows(examCode) {
    const index =
      this.state
        .examIndex[
          clean(examCode)
        ]
      || {};

    const rows = [];

    for (
      const [
        studentId,
        location,
      ]
      of Object.entries(index)
    ) {
      const record =
        this.state
          .months[
            location.monthKey
          ]
          ?.students
          ?.[studentId];

      const exam =
        record
          ?.exams
          ?.[location.resultId];

      if (!exam) {
        continue;
      }

      const profile =
        this.state
          .studentProfiles[
            studentId
          ]
        || {};

      rows.push({
        studentId,
        studentName:
          studentName(
            record,
            profile,
          )
          || studentId,
        groupId:
          profileGroupId(
            profile,
          ),
        groupName:
          profileGroupName(
            profile,
          ),
        ...exam,
      });
    }

    return rankRows(
      rows,
      (row) => [
        row.percentage
          ?? -1,
        row.correctCount
          ?? -1,
      ],
    );
  }

  snapshot() {
    return clone({
      marker:
        R20_MONTHLY_EVALUATION_MARKER,
      ...this.state,
    });
  }
}

function rankingLines(
  title,
  rows,
  valueFn,
  limit = 10,
) {
  const lines = [
    title,
  ];

  if (!rows.length) {
    return [
      ...lines,
      "لا توجد بيانات مسجلة.",
    ];
  }

  rows
    .slice(0, limit)
    .forEach(
      (row) => {
        lines.push(
          `${row.rank}) ${row.studentName} — ${valueFn(row)}`,
        );
      },
    );

  return lines;
}

export function formatMonthlyShare(
  evaluator,
  key,
  {
    group = "",
  } = {},
) {
  const ranking =
    evaluator.rankings(
      key,
      {
        group,
      },
    );

  const title =
    group
      ? `التقييم الشهري — ${key} — ${group}`
      : `التقييم الشهري العام — ${key}`;

  const parts = [
    title,
    "",
    ...rankingLines(
      "أولًا: ترتيب درجات الامتحانات",
      ranking.exams,
      (row) =>
        `إجمالي ${row.examTotal} | متوسط ${row.examAverage}%`,
    ),
    "",
    ...rankingLines(
      "ثانيًا: ترتيب نقاط الحصص",
      ranking.classes,
      (row) =>
        `${row.classPoints} نقطة`,
    ),
    "",
    ...rankingLines(
      "ثالثًا: الأكثر تحسنًا",
      ranking.improvement,
      (row) =>
        `امتحانات ${
          row.examImprovement === null
            ? "—"
            : `${
                row.examImprovement > 0
                  ? "+"
                  : ""
              }${row.examImprovement}`
        } | حصص ${
          row.classImprovement === null
            ? "—"
            : `${
                row.classImprovement > 0
                  ? "+"
                  : ""
              }${row.classImprovement}`
        }`,
    ),
  ];

  return parts.join("\n");
}

export function formatExamShare(
  evaluator,
  examCode,
) {
  const rows =
    evaluator.examRows(
      examCode,
    );

  const title =
    rows[0]?.examTitle
    || examCode;

  const lines = [
    `نتائج ${title}`,
    `كود الامتحان: ${examCode}`,
    "",
  ];

  if (!rows.length) {
    lines.push(
      "لا توجد نتائج مسجلة.",
    );

    return lines.join("\n");
  }

  rows.forEach(
    (row) => {
      lines.push(
        `${row.rank}) ${row.studentName} — ${
          row.percentage
          ?? "—"
        }%`,
      );
    },
  );

  return lines.join("\n");
}

export function whatsappGroupShareUrl(
  text,
) {
  const message =
    clean(text);

  if (!message) {
    throw new Error(
      "R20 monthly share text is empty.",
    );
  }

  return (
    "https://wa.me/?text="
    + encodeURIComponent(text)
  );
}

function scanStudentProfiles(
  evaluator,
) {
  if (!evaluator.storage) {
    return;
  }

  for (
    let index = 0;
    index < evaluator.storage.length;
    index += 1
  ) {
    const key =
      evaluator.storage.key(index);

    if (!key) {
      continue;
    }

    let parsed;

    try {
      parsed =
        JSON.parse(
          evaluator.storage
            .getItem(key),
        );
    } catch {
      continue;
    }

    const visit = (
      node,
      depth = 0,
    ) => {
      if (
        !node
        || typeof node
          !== "object"
        || depth > 5
      ) {
        return;
      }

      if (Array.isArray(node)) {
        node.forEach(
          (item) =>
            visit(
              item,
              depth + 1,
            ),
        );

        return;
      }

      if (
        Array.isArray(
          node.students,
        )
      ) {
        node.students.forEach(
          (student) => {
            const id =
              clean(
                student?.id
                ?? student?.studentId
                ?? student?.student_id,
              );

            if (!id) {
              return;
            }

            evaluator
              .setStudentProfile(
                id,
                {
                  studentName:
                    clean(
                      student.name
                      ?? student.fullName
                      ?? student.studentName,
                    ),
                  groupId:
                    clean(
                      student.groupId
                      ?? student.group
                      ?? student.groupName
                      ?? student.classGroup
                      ?? student.batch,
                    ),
                  groupName:
                    clean(
                      student.groupName
                      ?? student.group
                      ?? student.classGroup
                      ?? student.batch
                      ?? student.groupId,
                    ),
                },
              );

            for (
              const field of [
                "classPoints",
                "lessonPoints",
                "participationPoints",
                "attendancePoints",
              ]
            ) {
              const value =
                numeric(
                  student[field],
                );

              if (
                value !== null
              ) {
                evaluator
                  .recordClassPoints({
                    studentId:
                      id,
                    points:
                      value,
                    at:
                      new Date(),
                    source:
                      `legacy:${field}`,
                    mode:
                      "absolute",
                  });
              }
            }
          },
        );
      }

      Object.values(node)
        .forEach(
          (child) => {
            if (
              child
              && typeof child
                === "object"
            ) {
              visit(
                child,
                depth + 1,
              );
            }
          },
        );
    };

    visit(parsed);
  }
}

function escapeHtml(value) {
  return String(
    value ?? "",
  )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ensureDialog() {
  let dialog =
    document.getElementById(
      DIALOG_ID,
    );

  if (dialog) {
    return dialog;
  }

  dialog =
    document.createElement(
      "dialog",
    );

  dialog.id =
    DIALOG_ID;

  dialog.className =
    "r20-monthly-evaluation-dialog";

  dialog.setAttribute(
    "data-r20-monthly-dialog",
    "true",
  );

  dialog.innerHTML = `
    <div class="r20-monthly-evaluation-dialog__shell">
      <button type="button" data-r20-monthly-close aria-label="إغلاق">×</button>
      <div data-r20-monthly-body></div>
    </div>
  `;

  dialog
    .querySelector(
      "[data-r20-monthly-close]",
    )
    .addEventListener(
      "click",
      () =>
        dialog.close(),
    );

  document.body
    .appendChild(
      dialog,
    );

  return dialog;
}

function rankBlock(
  label,
  row,
  value,
) {
  if (!row) {
    return (
      `<div><span>${escapeHtml(label)}</span><b>لا يوجد ترتيب بعد</b></div>`
    );
  }

  return (
    `<div><span>${escapeHtml(label)}</span><b>رقم ${row.rank}</b><small>${escapeHtml(value)}</small></div>`
  );
}

function showDialog(
  evaluator,
  key,
  viewer,
) {
  const dialog =
    ensureDialog();

  const body =
    dialog.querySelector(
      "[data-r20-monthly-body]",
    );

  if (
    viewer?.role
    === "student"
  ) {
    const own =
      evaluator.ownRanks(
        key,
        viewer.studentId,
      );

    if (!own) {
      throw new Error(
        "R20 no monthly data for this student.",
      );
    }

    body.innerHTML = `
      <article class="r20-monthly-own">
        <header>
          <p>التقييم الشهري</p>
          <h2>${escapeHtml(own.student.studentName)}</h2>
          <span>${escapeHtml(key)}</span>
        </header>
        <section>
          ${rankBlock(
            "درجات الامتحانات — عام",
            own.overall.exams,
            own.overall.exams
              ? `${own.overall.exams.examTotal} درجة تراكمية`
              : "",
          )}
          ${rankBlock(
            "نقاط الحصص — عام",
            own.overall.classes,
            own.overall.classes
              ? `${own.overall.classes.classPoints} نقطة`
              : "",
          )}
          ${rankBlock(
            "الأكثر تحسنًا — عام",
            own.overall.improvement,
            own.overall.improvement
              ? `${own.overall.improvement.examImprovement ?? "—"} امتحانات`
              : "",
          )}
        </section>
        ${
          own.group
            ? `<section>
                <h3>${escapeHtml(
                  own.group.groupName
                  || own.group.groupId,
                )}</h3>
                ${rankBlock(
                  "درجات الامتحانات — المجموعة",
                  own.group.exams,
                  own.group.exams
                    ? `${own.group.exams.examTotal}`
                    : "",
                )}
                ${rankBlock(
                  "نقاط الحصص — المجموعة",
                  own.group.classes,
                  own.group.classes
                    ? `${own.group.classes.classPoints}`
                    : "",
                )}
                ${rankBlock(
                  "الأكثر تحسنًا — المجموعة",
                  own.group.improvement,
                  own.group.improvement
                    ? `${own.group.improvement.examImprovement ?? "—"}`
                    : "",
                )}
              </section>`
            : ""
        }
      </article>
    `;
  } else if (
    viewer?.role
    === "parent"
  ) {
    const children =
      safeArray(
        viewer.linkedStudentIds,
      )
        .filter(
          (studentId) =>
            viewerCanSeeMonthlyStudent(
              viewer,
              studentId,
            ),
        );

    body.innerHTML = `
      <article class="r20-monthly-parent">
        <header>
          <p>التقييم الشهري</p>
          <h2>أبناؤك</h2>
          <span>${escapeHtml(key)}</span>
        </header>
        ${
          children
            .map(
              (studentId) => {
                const own =
                  evaluator.ownRanks(
                    key,
                    studentId,
                  );

                if (!own) {
                  return "";
                }

                return `
                  <section>
                    <h3>${escapeHtml(own.student.studentName)}</h3>
                    ${rankBlock(
                      "الامتحانات — عام",
                      own.overall.exams,
                      own.overall.exams
                        ? `${own.overall.exams.examTotal}`
                        : "",
                    )}
                    ${rankBlock(
                      "الحصص — عام",
                      own.overall.classes,
                      own.overall.classes
                        ? `${own.overall.classes.classPoints}`
                        : "",
                    )}
                    ${rankBlock(
                      "التحسن — عام",
                      own.overall.improvement,
                      own.overall.improvement
                        ? `${own.overall.improvement.examImprovement ?? "—"}`
                        : "",
                    )}
                  </section>
                `;
              },
            )
            .join("")
        }
      </article>
    `;
  } else {
    const overall =
      evaluator.rankings(key);

    const list = (
      title,
      rows,
      valueFn,
    ) => (
      `<section>
        <h3>${escapeHtml(title)}</h3>
        <ol>${
          rows
            .slice(0, 10)
            .map(
              (row) =>
                `<li><b>${row.rank}</b><span>${escapeHtml(row.studentName)}</span><strong>${escapeHtml(valueFn(row))}</strong></li>`,
            )
            .join("")
        }</ol>
      </section>`
    );

    body.innerHTML = `
      <article class="r20-monthly-teacher">
        <header>
          <p>التقييم الشهري العام</p>
          <h2>${escapeHtml(key)}</h2>
        </header>
        ${list(
          "ترتيب درجات الامتحانات",
          overall.exams,
          (row) =>
            `${row.examTotal} | ${row.examAverage}%`,
        )}
        ${list(
          "ترتيب نقاط الحصص",
          overall.classes,
          (row) =>
            `${row.classPoints} نقطة`,
        )}
        ${list(
          "الأكثر تحسنًا",
          overall.improvement,
          (row) =>
            `امتحانات ${row.examImprovement ?? "—"} | حصص ${row.classImprovement ?? "—"}`,
        )}
      </article>
    `;
  }

  if (
    typeof dialog.showModal
    === "function"
  ) {
    if (!dialog.open) {
      dialog.showModal();
    }
  } else {
    dialog.setAttribute(
      "open",
      "",
    );
  }
}

function dashboardRoots() {
  return [
    ...new Set(
      document.querySelectorAll(
        "[data-r20-dashboard-role], [data-r20-teacher-dashboard], .teacher-dashboard, .dashboard",
      ),
    ),
  ];
}

function ensureDashboardCard(
  evaluator,
  root,
) {
  if (
    root.querySelector(
      "[data-r20-monthly-evaluation-card]",
    )
  ) {
    return;
  }

  const viewer =
    auth(
      evaluator.storage,
    );

  if (!viewer) {
    return;
  }

  const card =
    document.createElement(
      "button",
    );

  card.type =
    "button";

  card.className =
    "r20-monthly-evaluation-card";

  card.setAttribute(
    "data-r20-monthly-evaluation-card",
    "true",
  );

  card.setAttribute(
    "data-r20-dashboard-feature",
    "monthly-evaluation",
  );

  card.setAttribute(
    "data-r20-dashboard-access",
    "allowed",
  );

  card.innerHTML = `
    <span aria-hidden="true">🏆</span>
    <span>
      <strong>التقييم الشهري</strong>
      <small>الامتحانات · الحصص · الأكثر تحسنًا</small>
    </span>
  `;

  card.addEventListener(
    "click",
    () => {
      try {
        showDialog(
          evaluator,
          monthKey(
            new Date(),
          ),
          auth(
            evaluator.storage,
          ),
        );
      } catch (error) {
        console.error(
          "R20 monthly evaluation open failed",
          error,
        );
      }
    },
  );

  const grid =
    root.querySelector(
      ".dashboard-grid, .dashboard-feature-grid, [data-dashboard-grid], [class*='dashboard-grid']",
    )
    || root;

  grid.appendChild(card);
}

function refreshCards(
  evaluator,
) {
  dashboardRoots()
    .forEach(
      (root) =>
        ensureDashboardCard(
          evaluator,
          root,
        ),
    );
}

function showExamShareReady(
  evaluator,
  examCode,
) {
  const viewer =
    auth(
      evaluator.storage,
    );

  if (
    ![
      "teacher",
      "admin",
    ].includes(
      viewer?.role,
    )
  ) {
    return;
  }

  document
    .getElementById(
      SHARE_PANEL_ID,
    )
    ?.remove();

  const text =
    formatExamShare(
      evaluator,
      examCode,
    );

  const panel =
    document.createElement(
      "aside",
    );

  panel.id =
    SHARE_PANEL_ID;

  panel.className =
    "r20-exam-share-ready-panel";

  panel.setAttribute(
    "data-r20-exam-share-ready",
    "true",
  );

  panel.innerHTML = `
    <div>
      <strong>درجات الامتحان جاهزة للمشاركة</strong>
      <small>${escapeHtml(examCode)}</small>
    </div>
    <button type="button" data-r20-exam-share-whatsapp>WhatsApp</button>
    <button type="button" data-r20-exam-share-copy>نسخ</button>
    <button type="button" data-r20-exam-share-close>×</button>
  `;

  panel
    .querySelector(
      "[data-r20-exam-share-whatsapp]",
    )
    .addEventListener(
      "click",
      () => {
        window.open(
          whatsappGroupShareUrl(
            text,
          ),
          "_blank",
          "noopener,noreferrer",
        );
      },
    );

  panel
    .querySelector(
      "[data-r20-exam-share-copy]",
    )
    .addEventListener(
      "click",
      () => {
        navigator.clipboard
          ?.writeText(
            text,
          );
      },
    );

  panel
    .querySelector(
      "[data-r20-exam-share-close]",
    )
    .addEventListener(
      "click",
      () =>
        panel.remove(),
    );

  document.body
    .appendChild(
      panel,
    );
}

export function installR20MonthlyEvaluation() {
  if (
    typeof window
      === "undefined"
    || typeof document
      === "undefined"
  ) {
    return;
  }

  if (
    window
      .__MOBDEA_R20_MONTHLY_EVALUATION__
  ) {
    return;
  }

  if (
    !(
      R20_MONTHLY_HAS_RANKING
      && R20_MONTHLY_HAS_CLASS_POINTS
      && R20_MONTHLY_HAS_GROUPS
    )
  ) {
    throw new Error(
      "R20 monthly evaluation prerequisites are not ready.",
    );
  }

  const evaluator =
    new R20MonthlyEvaluation();

  scanStudentProfiles(
    evaluator,
  );

  window
    .__MOBDEA_R20_MONTHLY_EVALUATION__ =
    R20_MONTHLY_EVALUATION_MARKER;

  window
    .mobdeaR20MonthlyEvaluation =
    Object.freeze({
      marker:
        R20_MONTHLY_EVALUATION_MARKER,
      legacyMonthlyFound:
        R20_MONTHLY_LEGACY_MONTHLY_FOUND,
      monthKey,
      previousMonthKey,
      setStudentProfile:
        (id, profile) =>
          evaluator
            .setStudentProfile(
              id,
              profile,
            ),
      ingestExamResult:
        (result, options) =>
          evaluator
            .ingestExamResult(
              result,
              options,
            ),
      recordClassPoints:
        (options) =>
          evaluator
            .recordClassPoints(
              options,
            ),
      rankings:
        (key, options) =>
          evaluator
            .rankings(
              key,
              options,
            ),
      ownRanks:
        (key, id) =>
          evaluator
            .ownRanks(
              key,
              id,
            ),
      groups:
        (key) =>
          evaluator
            .groups(
              key,
            ),
      examRows:
        (code) =>
          evaluator
            .examRows(
              code,
            ),
      formatMonthlyShare:
        (key, options) =>
          formatMonthlyShare(
            evaluator,
            key,
            options,
          ),
      formatExamShare:
        (code) =>
          formatExamShare(
            evaluator,
            code,
          ),
      whatsappGroupShareUrl,
      viewerCanSeeMonthlyStudent,
      openMonth:
        (
          key =
            monthKey(
              new Date(),
            ),
        ) =>
          showDialog(
            evaluator,
            key,
            auth(
              evaluator.storage,
            ),
          ),
      snapshot:
        () =>
          evaluator.snapshot(),
    });

  window.addEventListener(
    "mobdea:r20-exam-result-ready",
    (event) => {
      try {
        const result =
          event.detail;

        const exam =
          evaluator
            .examTracking
            ?.getExam
            ?.(result.examCode);

        evaluator
          .ingestExamResult(
            result,
            {
              examTitle:
                exam?.title
                || "",
            },
          );

        const text =
          formatExamShare(
            evaluator,
            result.examCode,
          );

        window.dispatchEvent(
          new CustomEvent(
            "mobdea:r20-exam-share-ready",
            {
              detail: {
                examCode:
                  result.examCode,
                text,
                url:
                  whatsappGroupShareUrl(
                    text,
                  ),
              },
            },
          ),
        );

        showExamShareReady(
          evaluator,
          result.examCode,
        );

        refreshCards(
          evaluator,
        );
      } catch (error) {
        console.error(
          "R20 monthly exam ingestion failed",
          error,
        );
      }
    },
  );

  const pointHandler =
    (event) => {
      try {
        evaluator
          .recordClassPoints(
            event.detail
            || {},
          );

        refreshCards(
          evaluator,
        );

        window.dispatchEvent(
          new CustomEvent(
            "mobdea:r20-monthly-evaluation-updated",
            {
              detail: {
                monthKey:
                  monthKey(
                    event.detail
                      ?.at
                    || new Date(),
                  ),
              },
            },
          ),
        );
      } catch (error) {
        console.error(
          "R20 monthly class-points ingestion failed",
          error,
        );
      }
    };

  for (
    const eventName of [
      "mobdea:r20-class-points",
      "mobdea:r20-student-points",
      "mobdea:r20-lesson-points",
    ]
  ) {
    window.addEventListener(
      eventName,
      pointHandler,
    );
  }

  refreshCards(
    evaluator,
  );

  new MutationObserver(
    () =>
      refreshCards(
        evaluator,
      ),
  ).observe(
    document.documentElement,
    {
      childList: true,
      subtree: true,
    },
  );
}

if (
  typeof window !== "undefined"
  && typeof document !== "undefined"
) {
  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      installR20MonthlyEvaluation,
      {
        once: true,
      },
    );
  } else {
    installR20MonthlyEvaluation();
  }
}
