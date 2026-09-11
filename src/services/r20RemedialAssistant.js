import {
  R20_REMEDIAL_HAS_QUESTION_QUERY,
  R20_REMEDIAL_HAS_QUESTION_TAKE,
  R20_REMEDIAL_HAS_WEAKNESS,
  R20_REMEDIAL_HAS_ATTEMPTS,
  R20_REMEDIAL_HAS_REPORTS,
  R20_REMEDIAL_HAS_ASSISTANT_DASHBOARD,
} from "../config/r20RemedialAssistantConfig.js";

export const R20_REMEDIAL_ASSISTANT_MARKER =
  "R20_FIX22_REMEDIAL_ASSISTANT_V1";

const STORAGE_KEY =
  "mobdea_r20_remedial_assistant_v1";

const APP_AUTH_KEY =
  "mobdea_mobile_auth_v2";

const DIALOG_ID =
  "r20-remedial-assistant-dialog";

const TARGET_KEYS = Object.freeze([
  "skill",
  "topic",
  "lesson",
  "unit",
  "chapter",
  "subject",
  "grade",
]);

const clean =
  (value) =>
    String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();

const lower =
  (value) =>
    clean(value)
      .toLowerCase();

const safeArray =
  (value) =>
    Array.isArray(value)
      ? value
      : [];

function clone(value) {
  return JSON.parse(
    JSON.stringify(
      value,
    ),
  );
}

function hash32(value) {
  let hash =
    0x811c9dc5;

  for (
    let index = 0;
    index <
      value.length;
    index += 1
  ) {
    hash ^=
      value.charCodeAt(
        index,
      );

    hash =
      Math.imul(
        hash,
        0x01000193,
      ) >>> 0;
  }

  return hash
    .toString(16)
    .padStart(
      8,
      "0",
    )
    .toUpperCase();
}

function defaultState() {
  return {
    schemaVersion:
      1,
    plans: {},
    planIdsByStudent: {},
    activePlanId: null,
  };
}

function loadState(
  storage,
) {
  if (!storage) {
    return defaultState();
  }

  try {
    const parsed =
      JSON.parse(
        storage.getItem(
          STORAGE_KEY,
        ) ||
        "null",
      );

    if (
      !parsed ||
      parsed.schemaVersion !==
        1
    ) {
      return defaultState();
    }

    return {
      ...defaultState(),
      ...parsed,
      plans:
        parsed.plans ||
        {},
      planIdsByStudent:
        parsed.planIdsByStudent ||
        {},
    };
  } catch {
    return defaultState();
  }
}

function saveState(
  storage,
  state,
) {
  if (!storage) {
    return;
  }

  storage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      state,
    ),
  );
}

function uniquePush(
  object,
  key,
  value,
) {
  const list =
    safeArray(
      object[key],
    );

  if (
    !list.includes(
      value,
    )
  ) {
    list.push(
      value,
    );
  }

  object[key] =
    list;
}

function appAuth(
  storage =
    typeof localStorage !==
      "undefined"
      ? localStorage
      : null,
) {
  if (!storage) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(
        storage.getItem(
          APP_AUTH_KEY,
        ) ||
        "null",
      );

    if (
      !parsed ||
      (
        parsed.expiresAt &&
        Number(
          parsed.expiresAt,
        ) <= Date.now()
      )
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function viewerCanUseRemedialAssistant(
  viewer,
  studentId,
) {
  const canonical =
    clean(
      studentId,
    );

  if (
    !viewer ||
    !canonical
  ) {
    return false;
  }

  if (
    [
      "teacher",
      "admin",
    ].includes(
      viewer.role,
    )
  ) {
    return true;
  }

  return (
    viewer.role ===
      "student" &&
    clean(
      viewer.studentId,
    ) ===
      canonical
  );
}

function metadataOfBucket(
  bucket,
) {
  const output = {};

  for (
    const key of
    TARGET_KEYS
  ) {
    const value =
      bucket
        ?.metadata
        ?.[key];

    if (
      value !==
        undefined &&
      value !==
        null &&
      value !==
        ""
    ) {
      output[key] =
        typeof value ===
          "number"
          ? value
          : clean(
              value,
            );
    }
  }

  return output;
}

export function buildWeaknessTargets(
  weakness,
) {
  return Object
    .values(
      weakness
        ?.buckets ||
      {},
    )
    .map(
      (bucket) => ({
        key:
          clean(
            bucket.key,
          ),
        totalWrong:
          Number(
            bucket.totalWrong ||
            bucket.count ||
            0,
          ),
        questionIds:
          safeArray(
            bucket.questionIds,
          )
            .map(clean)
            .filter(Boolean),
        metadata:
          metadataOfBucket(
            bucket,
          ),
      }),
    )
    .filter(
      (target) =>
        target.totalWrong >
        0,
    )
    .sort(
      (a, b) =>
        b.totalWrong -
        a.totalWrong,
    );
}

function queryFilters(
  target,
) {
  const meta =
    target.metadata ||
    {};

  const sets = [
    [
      "subject",
      "grade",
      "unit",
      "lesson",
      "topic",
      "skill",
    ],
    [
      "subject",
      "grade",
      "unit",
      "lesson",
    ],
    [
      "subject",
      "grade",
      "lesson",
    ],
    [
      "subject",
      "lesson",
    ],
    [
      "unit",
      "lesson",
    ],
    [
      "lesson",
    ],
    [
      "subject",
      "grade",
      "unit",
    ],
    [
      "subject",
      "unit",
    ],
    [
      "subject",
      "grade",
    ],
    [
      "subject",
    ],
  ];

  const output = [];
  const signatures =
    new Set();

  for (
    const keys of
    sets
  ) {
    const filters = {};

    for (
      const key of
      keys
    ) {
      if (
        meta[key] !==
          undefined &&
        meta[key] !==
          null &&
        meta[key] !==
          ""
      ) {
        filters[key] =
          meta[key];
      }
    }

    const entries =
      Object.entries(
        filters,
      );

    if (!entries.length) {
      continue;
    }

    const signature =
      JSON.stringify(
        entries,
      );

    if (
      signatures.has(
        signature,
      )
    ) {
      continue;
    }

    signatures.add(
      signature,
    );

    output.push(
      filters,
    );
  }

  return output;
}

function questionMatchesTarget(
  question,
  target,
) {
  const meta =
    target.metadata ||
    {};

  const meaningful =
    TARGET_KEYS.filter(
      (key) =>
        meta[key] !==
          undefined &&
        meta[key] !==
          null &&
        meta[key] !==
          "",
    );

  if (
    !meaningful.length
  ) {
    return false;
  }

  return meaningful.some(
    (key) =>
      lower(
        question
          ?.[key],
      ) ===
      lower(
        meta[key],
      ),
  );
}

function gradedQuestion(
  question,
) {
  return Boolean(
    question &&
    clean(
      question.correctAnswer,
    ) &&
    safeArray(
      question.options,
    ).length >=
      2
  );
}

function historicalQuestionIds(
  attempts,
) {
  const ids =
    new Set();

  for (
    const attempt of
    attempts
  ) {
    safeArray(
      attempt.questionIds,
    ).forEach(
      (id) => {
        if (
          clean(
            id,
          )
        ) {
          ids.add(
            clean(
              id,
            ),
          );
        }
      },
    );

    Object.keys(
      attempt.answers ||
      {},
    ).forEach(
      (id) => {
        if (
          clean(
            id,
          )
        ) {
          ids.add(
            clean(
              id,
            ),
          );
        }
      },
    );
  }

  return ids;
}

function planHistoryQuestionIds(
  state,
  studentId,
) {
  const ids =
    new Set();

  for (
    const planId of
    safeArray(
      state
        .planIdsByStudent[
          studentId
        ],
    )
  ) {
    const plan =
      state.plans[
        planId
      ];

    safeArray(
      plan
        ?.questionIds,
    ).forEach(
      (questionId) => {
        if (
          clean(
            questionId,
          )
        ) {
          ids.add(
            clean(
              questionId,
            ),
          );
        }
      },
    );
  }

  return ids;
}

function candidatesForTarget(
  questionBank,
  target,
) {
  const output = [];
  const seen =
    new Set();

  for (
    const filters of
    queryFilters(
      target,
    )
  ) {
    const questions =
      questionBank.query(
        filters,
      );

    for (
      const question of
      questions
    ) {
      if (
        !gradedQuestion(
          question,
        ) ||
        seen.has(
          question.id,
        )
      ) {
        continue;
      }

      seen.add(
        question.id,
      );

      output.push(
        question,
      );
    }
  }

  return output;
}

function baselineStats(
  questionBank,
  attempts,
  targets,
) {
  let correct = 0;
  let wrong = 0;

  for (
    const attempt of
    attempts
  ) {
    if (
      attempt.status !==
        "completed"
    ) {
      continue;
    }

    for (
      const answer of
      Object.values(
        attempt.answers ||
        {},
      )
    ) {
      if (
        typeof answer
          ?.isCorrect !==
        "boolean"
      ) {
        continue;
      }

      const question =
        questionBank
          .getById(
            answer.questionId,
          );

      if (
        !question ||
        !targets.some(
          (target) =>
            questionMatchesTarget(
              question,
              target,
            ),
        )
      ) {
        continue;
      }

      if (
        answer.isCorrect
      ) {
        correct += 1;
      } else {
        wrong += 1;
      }
    }
  }

  const graded =
    correct +
    wrong;

  return {
    correct,
    wrong,
    graded,
    accuracy:
      graded > 0
        ? Number(
            (
              correct /
              graded *
              100
            ).toFixed(2),
          )
        : null,
  };
}

export function computeImprovement(
  baselineAccuracy,
  currentAccuracy,
) {
  if (
    baselineAccuracy ===
      null ||
    baselineAccuracy ===
      undefined ||
    currentAccuracy ===
      null ||
    currentAccuracy ===
      undefined
  ) {
    return null;
  }

  return Number(
    (
      Number(
        currentAccuracy,
      ) -
      Number(
        baselineAccuracy,
      )
    ).toFixed(2),
  );
}

function planIdFor(
  studentId,
  targetKeys,
  questionIds,
) {
  const signature =
    JSON.stringify({
      studentId:
        clean(
          studentId,
        ),
      targetKeys:
        [
          ...targetKeys,
        ].sort(),
      questionIds,
    });

  return (
    `REM-${hash32(
      signature,
    )}`
  );
}

function displayTarget(
  target,
) {
  const meta =
    target.metadata ||
    {};

  return (
    clean(
      meta.skill ||
      meta.topic ||
      meta.lesson ||
      meta.unit ||
      meta.chapter ||
      meta.subject ||
      target.key,
    ) ||
    "نقطة ضعف"
  );
}

export class R20RemedialAssistant {
  constructor({
    questionBank =
      typeof window !==
        "undefined"
        ? window
          .mobdeaR20QuestionBank
        : null,
    examTracking =
      typeof window !==
        "undefined"
        ? window
          .mobdeaR20ExamTracking
        : null,
    storage =
      typeof localStorage !==
        "undefined"
        ? localStorage
        : null,
  } = {}) {
    this.questionBank =
      questionBank;

    this.examTracking =
      examTracking;

    this.storage =
      storage;

    this.state =
      loadState(
        storage,
      );
  }

  persist() {
    saveState(
      this.storage,
      this.state,
    );
  }

  getPlan(
    planId,
  ) {
    const plan =
      this.state.plans[
        clean(
          planId,
        )
      ];

    return plan
      ? clone(
          plan,
        )
      : null;
  }

  history(
    studentId,
  ) {
    return safeArray(
      this.state
        .planIdsByStudent[
          clean(
            studentId,
          )
        ],
    )
      .map(
        (planId) =>
          this.state
            .plans[
              planId
            ],
      )
      .filter(Boolean)
      .map(clone);
  }

  activePlanId() {
    return (
      this.state
        .activePlanId ||
      null
    );
  }

  async createPlan({
    studentId,
    studentName = "",
    limit = 6,
  }) {
    const canonical =
      clean(
        studentId,
      );

    if (!canonical) {
      throw new Error(
        "R20 remedial assistant requires studentId.",
      );
    }

    if (
      !this.questionBank ||
      !this.examTracking
    ) {
      throw new Error(
        "R20 remedial assistant dependencies are unavailable.",
      );
    }

    const weakness =
      this.examTracking
        .getStudentWeakness(
          canonical,
        );

    const targets =
      buildWeaknessTargets(
        weakness,
      );

    if (!targets.length) {
      throw new Error(
        "R20 no recorded weakness is available for this student.",
      );
    }

    const attempts =
      this.examTracking
        .listAttemptsByStudent(
          canonical,
        );

    const excluded =
      historicalQuestionIds(
        attempts,
      );

    for (
      const id of
      planHistoryQuestionIds(
        this.state,
        canonical,
      )
    ) {
      excluded.add(
        id,
      );
    }

    const queues =
      targets.map(
        (target) => ({
          target,
          questions:
            candidatesForTarget(
              this.questionBank,
              target,
            )
              .filter(
                (question) =>
                  !excluded.has(
                    question.id,
                  ),
              ),
          cursor:
            0,
        }),
      );

    const selected = [];
    const selectedIds =
      new Set();

    const requested =
      Math.max(
        1,
        Math.min(
          30,
          Number(
            limit,
          ) ||
          6,
        ),
      );

    while (
      selected.length <
        requested
    ) {
      let added =
        false;

      for (
        const queue of
        queues
      ) {
        while (
          queue.cursor <
          queue.questions
            .length
        ) {
          const question =
            queue.questions[
              queue.cursor
            ];

          queue.cursor +=
            1;

          if (
            selectedIds.has(
              question.id,
            )
          ) {
            continue;
          }

          selectedIds.add(
            question.id,
          );

          selected.push({
            questionId:
              question.id,
            targetKey:
              queue
                .target
                .key,
          });

          added =
            true;

          break;
        }

        if (
          selected.length >=
          requested
        ) {
          break;
        }
      }

      if (!added) {
        break;
      }
    }

    if (
      !selected.length
    ) {
      throw new Error(
        "R20 no unseen graded remedial questions are available for the recorded weaknesses.",
      );
    }

    const questionIds =
      selected.map(
        (entry) =>
          entry.questionId,
      );

    const baseline =
      baselineStats(
        this.questionBank,
        attempts,
        targets,
      );

    const planId =
      planIdFor(
        canonical,
        targets.map(
          (target) =>
            target.key,
        ),
        questionIds,
      );

    const exam =
      await this
        .examTracking
        .registerExamFromDefinition({
          title:
            `امتحان علاجي - ${
              clean(
                studentName,
              ) ||
              canonical
            }`,
          source:
            "mobdea-assistant-remedial",
          questionIds,
          metadata: {
            r20RemedialPlanId:
              planId,
            studentId:
              canonical,
            targetWeaknessKeys:
              targets.map(
                (target) =>
                  target.key,
              ),
            baselineAccuracy:
              baseline.accuracy,
          },
        });

    const plan = {
      planId,
      studentId:
        canonical,
      studentName:
        clean(
          studentName,
        ),
      examCode:
        exam.examCode,
      questionIds,
      targetWeaknesses:
        targets.map(
          (target) => ({
            key:
              target.key,
            totalWrong:
              target.totalWrong,
            metadata:
              target.metadata,
            label:
              displayTarget(
                target,
              ),
          }),
        ),
      baseline,
      status:
        "ready",
      attemptId:
        null,
      result:
        null,
      createdAt:
        new Date()
          .toISOString(),
      completedAt:
        null,
    };

    this.state.plans[
      planId
    ] =
      plan;

    uniquePush(
      this.state
        .planIdsByStudent,
      canonical,
      planId,
    );

    this.state
      .activePlanId =
      planId;

    this.persist();

    if (
      typeof window !==
        "undefined"
    ) {
      window.dispatchEvent(
        new CustomEvent(
          "mobdea:r20-remedial-exam-ready",
          {
            detail:
              clone(
                plan,
              ),
          },
        ),
      );
    }

    return clone(
      plan,
    );
  }

  startPlan(
    planId,
  ) {
    const plan =
      this.state.plans[
        clean(
          planId,
        )
      ];

    if (!plan) {
      throw new Error(
        "R20 remedial plan was not found.",
      );
    }

    if (
      plan.status ===
        "completed"
    ) {
      throw new Error(
        "R20 remedial plan is already completed.",
      );
    }

    if (
      plan.attemptId
    ) {
      return clone(
        this.examTracking
          .getAttempt(
            plan.attemptId,
          ),
      );
    }

    const attempt =
      this.examTracking
        .startAttempt({
          examCode:
            plan.examCode,
          studentId:
            plan.studentId,
          studentName:
            plan.studentName,
          questionIds:
            plan.questionIds,
          metadata: {
            r20RemedialPlanId:
              plan.planId,
            source:
              "mobdea-assistant-remedial",
          },
        });

    plan.attemptId =
      attempt.attemptId;

    plan.status =
      "in-progress";

    this.persist();

    return clone(
      attempt,
    );
  }

  recordAnswer({
    planId,
    questionId,
    selectedAnswer,
  }) {
    const plan =
      this.state.plans[
        clean(
          planId,
        )
      ];

    if (
      !plan ||
      !plan.attemptId
    ) {
      throw new Error(
        "R20 remedial attempt is not started.",
      );
    }

    return this
      .examTracking
      .recordAnswer({
        attemptId:
          plan.attemptId,
        questionId,
        selectedAnswer,
      });
  }

  completePlan(
    planId,
  ) {
    const plan =
      this.state.plans[
        clean(
          planId,
        )
      ];

    if (
      !plan ||
      !plan.attemptId
    ) {
      throw new Error(
        "R20 remedial attempt is not started.",
      );
    }

    if (
      plan.status ===
        "completed" &&
      plan.result
    ) {
      return clone(
        plan.result,
      );
    }

    const result =
      this.examTracking
        .finalizeAttempt(
          plan.attemptId,
        );

    const progress = {
      baselineAccuracy:
        plan.baseline
          .accuracy,
      remedialAccuracy:
        result.percentage,
      improvementPoints:
        computeImprovement(
          plan.baseline
            .accuracy,
          result.percentage,
        ),
      correctCount:
        result.correctCount,
      wrongCount:
        result.wrongCount,
      gradedCount:
        result.gradedCount,
    };

    plan.status =
      "completed";

    plan.completedAt =
      new Date()
        .toISOString();

    plan.result = {
      ...result,
      progress,
    };

    this.persist();

    if (
      typeof window !==
        "undefined"
    ) {
      window.dispatchEvent(
        new CustomEvent(
          "mobdea:r20-remedial-progress-ready",
          {
            detail:
              clone(
                plan.result,
              ),
          },
        ),
      );
    }

    return clone(
      plan.result,
    );
  }

  snapshot() {
    return clone({
      marker:
        R20_REMEDIAL_ASSISTANT_MARKER,
      ...this.state,
    });
  }
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
    "r20-remedial-assistant-dialog";

  dialog.innerHTML = `
    <div class="r20-remedial-assistant-dialog__shell">
      <button type="button" class="r20-remedial-assistant-dialog__close" data-r20-remedial-close aria-label="إغلاق">×</button>
      <div data-r20-remedial-body></div>
    </div>
  `;

  dialog
    .querySelector(
      "[data-r20-remedial-close]",
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

function showModal(
  dialog,
) {
  if (
    typeof dialog
      .showModal ===
    "function"
  ) {
    if (
      !dialog.open
    ) {
      dialog.showModal();
    }
  } else {
    dialog.setAttribute(
      "open",
      "",
    );
  }
}

function renderResult(
  dialog,
  plan,
  result,
) {
  const body =
    dialog.querySelector(
      "[data-r20-remedial-body]",
    );

  const improvement =
    result
      .progress
      .improvementPoints;

  body.innerHTML = `
    <article class="r20-remedial-result" data-r20-remedial-result>
      <p>المُبدع Assistant</p>
      <h2>نتيجة الامتحان العلاجي</h2>
      <strong>${result.percentage ?? "—"}%</strong>
      <span>صحيح ${result.correctCount} · خطأ ${result.wrongCount}</span>
      <div>
        <small>المستوى السابق</small>
        <b>${plan.baseline.accuracy ?? "—"}%</b>
      </div>
      <div>
        <small>مقدار التحسن</small>
        <b data-r20-remedial-improvement>${improvement === null ? "—" : `${improvement > 0 ? "+" : ""}${improvement} نقطة`}</b>
      </div>
    </article>
  `;
}

function renderQuestion(
  assistant,
  dialog,
  plan,
  index,
) {
  const body =
    dialog.querySelector(
      "[data-r20-remedial-body]",
    );

  const questionId =
    plan.questionIds[
      index
    ];

  const question =
    assistant
      .questionBank
      .getById(
        questionId,
      );

  if (!question) {
    throw new Error(
      `R20 remedial question missing: ${questionId}`,
    );
  }

  body.innerHTML = `
    <article class="r20-remedial-question" data-r20-remedial-question data-r20-remedial-question-id="${questionId}">
      <header>
        <span>المُبدع Assistant</span>
        <small>${index + 1} / ${plan.questionIds.length}</small>
      </header>
      <h2>${escapeHtml(question.prompt)}</h2>
      <div class="r20-remedial-question__options">
        ${safeArray(question.options).map(
          (option, optionIndex) =>
            `<button type="button" data-r20-remedial-option data-r20-remedial-option-index="${optionIndex}">${escapeHtml(option)}</button>`,
        ).join("")}
      </div>
    </article>
  `;

  body
    .querySelectorAll(
      "[data-r20-remedial-option]",
    )
    .forEach(
      (button) => {
        button
          .addEventListener(
            "click",
            async () => {
              if (
                button
                  .closest(
                    "[data-r20-remedial-question]",
                  )
                  ?.getAttribute(
                    "data-r20-remedial-answered",
                  ) ===
                "true"
              ) {
                return;
              }

              const root =
                button.closest(
                  "[data-r20-remedial-question]",
                );

              root.setAttribute(
                "data-r20-remedial-answered",
                "true",
              );

              root
                .querySelectorAll(
                  "[data-r20-remedial-option]",
                )
                .forEach(
                  (item) => {
                    item.disabled =
                      true;
                  },
                );

              assistant.recordAnswer({
                planId:
                  plan.planId,
                questionId,
                selectedAnswer:
                  button.textContent,
              });

              await new Promise(
                (resolve) =>
                  setTimeout(
                    resolve,
                    80,
                  ),
              );

              if (
                index + 1 <
                plan.questionIds
                  .length
              ) {
                renderQuestion(
                  assistant,
                  dialog,
                  plan,
                  index + 1,
                );
                return;
              }

              const result =
                assistant
                  .completePlan(
                    plan.planId,
                  );

              const completed =
                assistant
                  .getPlan(
                    plan.planId,
                  );

              renderResult(
                dialog,
                completed,
                result,
              );
            },
          );
      },
    );
}

function escapeHtml(
  value,
) {
  return String(
    value ?? "",
  )
    .replace(
      /&/g,
      "&amp;",
    )
    .replace(
      /</g,
      "&lt;",
    )
    .replace(
      />/g,
      "&gt;",
    )
    .replace(
      /"/g,
      "&quot;",
    )
    .replace(
      /'/g,
      "&#39;",
    );
}

async function openStudentRemedialExam(
  assistant,
  viewer,
) {
  const plan =
    await assistant
      .createPlan({
        studentId:
          viewer.studentId,
        studentName:
          viewer.name ||
          "",
        limit:
          6,
      });

  assistant.startPlan(
    plan.planId,
  );

  const dialog =
    ensureDialog();

  showModal(
    dialog,
  );

  renderQuestion(
    assistant,
    dialog,
    plan,
    0,
  );

  return plan;
}

function weaknessCount(
  assistant,
  studentId,
) {
  try {
    return Object
      .keys(
        assistant
          .examTracking
          .getStudentWeakness(
            studentId,
          )
          ?.buckets ||
        {},
      )
      .length;
  } catch {
    return 0;
  }
}

function ensureStudentAssistantCard(
  assistant,
) {
  const viewer =
    appAuth(
      assistant.storage,
    );

  if (
    viewer?.role !==
      "student" ||
    !viewerCanUseRemedialAssistant(
      viewer,
      viewer.studentId,
    )
  ) {
    return;
  }

  const dashboard =
    document.querySelector(
      '[data-r20-dashboard-role="student"]',
    );

  if (!dashboard) {
    return;
  }

  if (
    dashboard.querySelector(
      "[data-r20-remedial-assistant-card]",
    )
  ) {
    return;
  }

  const count =
    weaknessCount(
      assistant,
      viewer.studentId,
    );

  if (!count) {
    return;
  }

  const grid =
    dashboard.querySelector(
      ".dashboard-grid, .dashboard-feature-grid, [data-dashboard-grid], [class*='dashboard-grid']",
    ) ||
    dashboard;

  const card =
    document.createElement(
      "button",
    );

  card.type =
    "button";

  card.className =
    "r20-remedial-assistant-card";

  card.setAttribute(
    "data-r20-remedial-assistant-card",
    "true",
  );

  card.setAttribute(
    "data-r20-dashboard-feature",
    "assistant",
  );

  card.setAttribute(
    "data-r20-dashboard-access",
    "allowed",
  );

  card.innerHTML = `
    <span aria-hidden="true">🧠</span>
    <span>
      <strong>المُبدع Assistant</strong>
      <small>${count} نقاط ضعف · امتحان علاجي مخصص</small>
    </span>
  `;

  card.addEventListener(
    "click",
    async () => {
      card.disabled =
        true;

      try {
        await openStudentRemedialExam(
          assistant,
          appAuth(
            assistant.storage,
          ),
        );
      } catch (error) {
        console.error(
          "R20 remedial exam generation failed",
          error,
        );

        card.setAttribute(
          "data-r20-remedial-error",
          clean(
            error
              ?.message ||
            error,
          ),
        );
      } finally {
        card.disabled =
          false;
      }
    },
  );

  grid.appendChild(
    card,
  );
}

export function installR20RemedialAssistant() {
  if (
    typeof window ===
      "undefined" ||
    typeof document ===
      "undefined"
  ) {
    return;
  }

  if (
    window
      .__MOBDEA_R20_REMEDIAL_ASSISTANT__
  ) {
    return;
  }

  if (
    !(
      R20_REMEDIAL_HAS_QUESTION_QUERY &&
      R20_REMEDIAL_HAS_QUESTION_TAKE &&
      R20_REMEDIAL_HAS_WEAKNESS &&
      R20_REMEDIAL_HAS_ATTEMPTS &&
      R20_REMEDIAL_HAS_REPORTS &&
      R20_REMEDIAL_HAS_ASSISTANT_DASHBOARD
    )
  ) {
    throw new Error(
      "R20 remedial assistant prerequisites are not ready.",
    );
  }

  const assistant =
    new R20RemedialAssistant();

  window
    .__MOBDEA_R20_REMEDIAL_ASSISTANT__ =
    R20_REMEDIAL_ASSISTANT_MARKER;

  window
    .mobdeaR20RemedialAssistant =
    Object.freeze({
      marker:
        R20_REMEDIAL_ASSISTANT_MARKER,
      createPlan:
        (options) =>
          assistant
            .createPlan(
              options,
            ),
      getPlan:
        (planId) =>
          assistant
            .getPlan(
              planId,
            ),
      history:
        (studentId) =>
          assistant
            .history(
              studentId,
            ),
      activePlanId:
        () =>
          assistant
            .activePlanId(),
      startPlan:
        (planId) =>
          assistant
            .startPlan(
              planId,
            ),
      recordAnswer:
        (details) =>
          assistant
            .recordAnswer(
              details,
            ),
      completePlan:
        (planId) =>
          assistant
            .completePlan(
              planId,
            ),
      snapshot:
        () =>
          assistant
            .snapshot(),
    });

  const schedule =
    () => {
      ensureStudentAssistantCard(
        assistant,
      );
    };

  window.addEventListener(
    "mobdea:r20-exam-result-ready",
    schedule,
  );

  window.addEventListener(
    "mobdea:r20-remedial-refresh",
    schedule,
  );

  new MutationObserver(
    schedule,
  ).observe(
    document.documentElement,
    {
      childList:
        true,
      subtree:
        true,
    },
  );

  schedule();
}

if (
  typeof window !==
    "undefined" &&
  typeof document !==
    "undefined"
) {
  if (
    document.readyState ===
      "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      installR20RemedialAssistant,
      {
        once:
          true,
      },
    );
  } else {
    installR20RemedialAssistant();
  }
}
