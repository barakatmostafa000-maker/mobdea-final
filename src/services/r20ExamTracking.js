import {
  R20_EXAM_SOURCE_COUNT,
  R20_EXAM_HAS_EXAM_UI,
  R20_EXAM_HAS_QUESTIONS,
  R20_EXAM_HAS_RESULTS,
} from "../config/r20ExamTrackingConfig.js";

export const R20_EXAM_TRACKING_MARKER = "R20_FIX20_EXAM_TRACKING_V1";
const STORAGE_KEY = "mobdea_r20_exam_tracking_v1";
const SCHEMA_VERSION = 1;

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const lower = (v) => clean(v).toLowerCase();
const safeArray = (v) => Array.isArray(v) ? v : [];
const clone = (v) => JSON.parse(JSON.stringify(v));

function canonicalStudentId(value) {
  const id = clean(value);
  if (!id) throw new Error("R20 exam tracking requires a canonical studentId.");
  return id;
}

function hex(bytes) {
  return [...bytes].map(v => v.toString(16).padStart(2, "0")).join("");
}

async function sha256Bytes(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", input));
}

function examCodeFromDigest(digest) {
  return `EX-${hex(digest).slice(0, 12).toUpperCase()}`;
}

export async function stableExamCodeFromBytes(bytes) {
  return examCodeFromDigest(await sha256Bytes(bytes));
}

export async function stableExamCodeFromFile(file) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("R20 exam file is missing or unreadable.");
  }
  return stableExamCodeFromBytes(await file.arrayBuffer());
}

export async function stableExamCodeFromDefinition(definition = {}) {
  const canonical = JSON.stringify({
    title: clean(definition.title || definition.name || ""),
    source: clean(definition.source || definition.sourceId || ""),
    questionIds: safeArray(definition.questionIds).map(clean).filter(Boolean),
  });
  return stableExamCodeFromBytes(new TextEncoder().encode(canonical));
}

function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    exams: {},
    attempts: {},
    attemptsByExam: {},
    attemptsByStudent: {},
    weaknessByStudent: {},
  };
}

function loadState() {
  if (typeof localStorage === "undefined") return defaultState();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) return defaultState();
    return {
      ...defaultState(),
      ...parsed,
      exams: parsed.exams || {},
      attempts: parsed.attempts || {},
      attemptsByExam: parsed.attemptsByExam || {},
      attemptsByStudent: parsed.attemptsByStudent || {},
      weaknessByStudent: parsed.weaknessByStudent || {},
    };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

function uniquePush(object, key, value) {
  const list = safeArray(object[key]);
  if (!list.includes(value)) list.push(value);
  object[key] = list;
}

function questionFromBank(questionId) {
  try {
    return typeof window !== "undefined"
      ? window.mobdeaR20QuestionBank?.getById(questionId) || null
      : null;
  } catch {
    return null;
  }
}

function selectedText(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") {
    return clean(value.text || value.label || value.value || value.answer || "");
  }
  return clean(value);
}

function answerCorrectness(question, selected, explicitIsCorrect) {
  const selectedAnswer = selectedText(selected);

  if (question && clean(question.correctAnswer)) {
    return {
      isCorrect: lower(selectedAnswer) === lower(question.correctAnswer),
      source: "question-bank",
      correctAnswer: clean(question.correctAnswer),
    };
  }

  if (typeof explicitIsCorrect === "boolean") {
    return {
      isCorrect: explicitIsCorrect,
      source: "exam-engine",
      correctAnswer: clean(question?.correctAnswer || ""),
    };
  }

  return {
    isCorrect: null,
    source: "ungraded",
    correctAnswer: clean(question?.correctAnswer || ""),
  };
}

function weaknessMetadata(question) {
  const output = {};
  for (const key of ["subject","grade","unit","lesson","chapter","topic","skill","difficulty"]) {
    const value = question?.[key];
    if (value !== undefined && value !== null && value !== "") {
      output[key] = typeof value === "number" ? value : clean(value);
    }
  }
  return output;
}

function weaknessKey(questionId, metadata) {
  const parts = Object.entries(metadata).map(([k,v]) => `${k}:${clean(v)}`);
  return parts.length ? parts.join("|") : `question:${clean(questionId)}`;
}

function buildWeaknessSummary(errors) {
  const buckets = new Map();
  for (const error of errors) {
    const metadata = error.weakness || {};
    const key = weaknessKey(error.questionId, metadata);
    const current = buckets.get(key) || {key, count: 0, questionIds: [], metadata};
    current.count += 1;
    if (!current.questionIds.includes(error.questionId)) current.questionIds.push(error.questionId);
    buckets.set(key, current);
  }
  return [...buckets.values()].sort((a,b) => b.count - a.count);
}

function mergeStudentWeakness(state, studentId, examCode, attemptId, weaknesses) {
  const student = state.weaknessByStudent[studentId] || {
    studentId, buckets: {}, attemptIds: [], examCodes: [], updatedAt: null,
  };

  uniquePush(student, "attemptIds", attemptId);
  uniquePush(student, "examCodes", examCode);

  for (const weakness of weaknesses) {
    const existing = student.buckets[weakness.key] || {
      ...weakness, totalWrong: 0, attemptIds: [], examCodes: [],
    };
    existing.totalWrong += weakness.count;
    existing.questionIds = [...new Set([
      ...safeArray(existing.questionIds),
      ...safeArray(weakness.questionIds),
    ])];
    uniquePush(existing, "attemptIds", attemptId);
    uniquePush(existing, "examCodes", examCode);
    student.buckets[weakness.key] = existing;
  }

  student.updatedAt = new Date().toISOString();
  state.weaknessByStudent[studentId] = student;
}

function attemptIdFor(examCode, studentId) {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = crypto.getRandomValues(new Uint32Array(1))[0]
    .toString(36).slice(0, 6).toUpperCase();
  const student = clean(studentId)
    .replace(/[^A-Za-z0-9\u0600-\u06FF_-]+/g, "-")
    .slice(0, 20);
  return ["ATT", examCode, student, stamp, random].join("-");
}

export class R20ExamTracker {
  constructor() {
    this.state = loadState();
  }

  persist() {
    saveState(this.state);
  }

  registerExam({
    examCode, title = "", questionIds = [], source = "",
    fileName = "", fileSize = null, mimeType = "", metadata = {},
  }) {
    const code = clean(examCode);
    if (!/^EX-[0-9A-F]{12}$/.test(code)) {
      throw new Error("R20 examCode must be a stable EX-XXXXXXXXXXXX code.");
    }

    const previous = this.state.exams[code];
    const ids = [...new Set(safeArray(questionIds).map(clean).filter(Boolean))];

    const exam = {
      examCode: code,
      title: clean(title || previous?.title || ""),
      questionIds: ids.length ? ids : safeArray(previous?.questionIds),
      source: clean(source || previous?.source || ""),
      fileName: clean(fileName || previous?.fileName || ""),
      fileSize: Number.isFinite(Number(fileSize)) ? Number(fileSize) : (previous?.fileSize ?? null),
      mimeType: clean(mimeType || previous?.mimeType || ""),
      metadata: {...(previous?.metadata || {}), ...(metadata || {})},
      registeredAt: previous?.registeredAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.state.exams[code] = exam;
    this.persist();
    return clone(exam);
  }

  async registerExamFromFile(file, details = {}) {
    const examCode = await stableExamCodeFromFile(file);
    return this.registerExam({
      ...details,
      examCode,
      fileName: file.name || details.fileName || "",
      fileSize: file.size,
      mimeType: file.type || details.mimeType || "",
    });
  }

  async registerExamFromDefinition(definition = {}) {
    const examCode = await stableExamCodeFromDefinition(definition);
    return this.registerExam({...definition, examCode});
  }

  getExam(examCode) {
    const exam = this.state.exams[clean(examCode)];
    return exam ? clone(exam) : null;
  }

  startAttempt({examCode, studentId, studentName = "", questionIds = [], metadata = {}}) {
    const code = clean(examCode);
    const canonicalStudent = canonicalStudentId(studentId);
    const exam = this.state.exams[code];
    if (!exam) throw new Error(`R20 unknown examCode: ${code}`);

    const ids = [...new Set(
      (safeArray(questionIds).length ? safeArray(questionIds) : safeArray(exam.questionIds))
        .map(clean).filter(Boolean)
    )];

    const attemptId = attemptIdFor(code, canonicalStudent);
    const attempt = {
      attemptId,
      examCode: code,
      studentId: canonicalStudent,
      studentName: clean(studentName),
      questionIds: ids,
      answers: {},
      status: "in-progress",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      metadata: metadata || {},
      result: null,
    };

    this.state.attempts[attemptId] = attempt;
    uniquePush(this.state.attemptsByExam, code, attemptId);
    uniquePush(this.state.attemptsByStudent, canonicalStudent, attemptId);
    this.persist();
    return clone(attempt);
  }

  recordAnswer({attemptId, questionId, selectedAnswer, isCorrect, answeredAt}) {
    const id = clean(attemptId);
    const qid = clean(questionId);
    const attempt = this.state.attempts[id];

    if (!attempt) throw new Error(`R20 unknown attemptId: ${id}`);
    if (attempt.status !== "in-progress") {
      throw new Error("R20 cannot change a finalized exam attempt.");
    }
    if (!qid) throw new Error("R20 questionId is required for exam tracking.");

    const question = questionFromBank(qid);
    const correctness = answerCorrectness(question, selectedAnswer, isCorrect);

    const answer = {
      questionId: qid,
      selectedAnswer: selectedText(selectedAnswer),
      correctAnswer: correctness.correctAnswer,
      isCorrect: correctness.isCorrect,
      correctnessSource: correctness.source,
      weakness: weaknessMetadata(question),
      sourceIds: safeArray(question?.sourceIds),
      answeredAt: answeredAt || new Date().toISOString(),
    };

    attempt.answers[qid] = answer;
    this.persist();
    return clone(answer);
  }

  finalizeAttempt(attemptId) {
    const id = clean(attemptId);
    const attempt = this.state.attempts[id];

    if (!attempt) throw new Error(`R20 unknown attemptId: ${id}`);
    if (attempt.status === "completed" && attempt.result) return clone(attempt.result);

    const answers = Object.values(attempt.answers || {});
    const correct = answers.filter(a => a.isCorrect === true);
    const errors = answers.filter(a => a.isCorrect === false);
    const ungraded = answers.filter(a => a.isCorrect === null);
    const gradedCount = correct.length + errors.length;
    const percentage = gradedCount > 0
      ? Number((correct.length / gradedCount * 100).toFixed(2))
      : null;
    const weaknesses = buildWeaknessSummary(errors);

    const result = {
      resultId: `RES-${attempt.attemptId}`,
      attemptId: attempt.attemptId,
      examCode: attempt.examCode,
      studentId: attempt.studentId,
      studentName: attempt.studentName,
      answeredCount: answers.length,
      gradedCount,
      correctCount: correct.length,
      wrongCount: errors.length,
      ungradedCount: ungraded.length,
      percentage,
      errors: errors.map(clone),
      weaknesses: weaknesses.map(clone),
      completedAt: new Date().toISOString(),
    };

    attempt.status = "completed";
    attempt.finishedAt = result.completedAt;
    attempt.result = result;

    mergeStudentWeakness(
      this.state,
      attempt.studentId,
      attempt.examCode,
      attempt.attemptId,
      weaknesses,
    );

    this.persist();

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("mobdea:r20-exam-result-ready", {
          detail: clone(result),
        }),
      );
    }

    return clone(result);
  }

  getAttempt(attemptId) {
    const attempt = this.state.attempts[clean(attemptId)];
    return attempt ? clone(attempt) : null;
  }

  listAttemptsByExam(examCode) {
    return safeArray(this.state.attemptsByExam[clean(examCode)])
      .map(id => this.state.attempts[id]).filter(Boolean).map(clone);
  }

  listAttemptsByStudent(studentId) {
    const canonical = canonicalStudentId(studentId);
    return safeArray(this.state.attemptsByStudent[canonical])
      .map(id => this.state.attempts[id]).filter(Boolean).map(clone);
  }

  getStudentWeakness(studentId) {
    const canonical = canonicalStudentId(studentId);
    const value = this.state.weaknessByStudent[canonical];
    return value ? clone(value) : {
      studentId: canonical, buckets: {}, attemptIds: [], examCodes: [], updatedAt: null,
    };
  }

  snapshot() {
    return clone({
      marker: R20_EXAM_TRACKING_MARKER,
      repository: {
        sourceCount: R20_EXAM_SOURCE_COUNT,
        hasExamUi: R20_EXAM_HAS_EXAM_UI,
        hasQuestions: R20_EXAM_HAS_QUESTIONS,
        hasResults: R20_EXAM_HAS_RESULTS,
      },
      ...this.state,
    });
  }
}

function attachFileInputBridge(tracker) {
  document.addEventListener("change", async (event) => {
    const input = event.target;
    if (!input?.matches?.('input[type="file"]') || !input.files?.length) return;

    const semantic = lower([
      input.name,
      input.id,
      input.accept,
      input.getAttribute("aria-label"),
      input.getAttribute("title"),
      input.closest("label, form, section, div")?.textContent,
    ].filter(Boolean).join(" "));

    if (!/exam|test|quiz|question|امتحان|اختبار|أسئلة|اسئلة/.test(semantic)) return;

    try {
      const file = input.files[0];
      const exam = await tracker.registerExamFromFile(file, {
        title: clean(input.getAttribute("data-exam-title") || file.name),
        source: "exam-file-input",
      });

      input.setAttribute("data-r20-exam-code", exam.examCode);

      window.dispatchEvent(
        new CustomEvent("mobdea:r20-exam-code-ready", {
          detail: {
            examCode: exam.examCode,
            fileName: file.name,
            fileSize: file.size,
          },
        }),
      );
    } catch (error) {
      console.error("R20 exam-code generation failed", error);
    }
  }, true);
}

export function installR20ExamTracking() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__MOBDEA_R20_EXAM_TRACKING__) return;

  const tracker = new R20ExamTracker();
  window.__MOBDEA_R20_EXAM_TRACKING__ = R20_EXAM_TRACKING_MARKER;

  window.mobdeaR20ExamTracking = Object.freeze({
    marker: R20_EXAM_TRACKING_MARKER,
    stableExamCodeFromBytes,
    stableExamCodeFromFile,
    stableExamCodeFromDefinition,
    registerExam: (details) => tracker.registerExam(details),
    registerExamFromFile: (file, details) => tracker.registerExamFromFile(file, details),
    registerExamFromDefinition: (definition) => tracker.registerExamFromDefinition(definition),
    getExam: (examCode) => tracker.getExam(examCode),
    startAttempt: (details) => tracker.startAttempt(details),
    recordAnswer: (details) => tracker.recordAnswer(details),
    finalizeAttempt: (attemptId) => tracker.finalizeAttempt(attemptId),
    getAttempt: (attemptId) => tracker.getAttempt(attemptId),
    listAttemptsByExam: (examCode) => tracker.listAttemptsByExam(examCode),
    listAttemptsByStudent: (studentId) => tracker.listAttemptsByStudent(studentId),
    getStudentWeakness: (studentId) => tracker.getStudentWeakness(studentId),
    snapshot: () => tracker.snapshot(),
  });

  window.addEventListener("mobdea:r20-exam-register", async (event) => {
    const detail = event.detail || {};
    try {
      const exam = detail.file
        ? await tracker.registerExamFromFile(detail.file, detail)
        : await tracker.registerExamFromDefinition(detail);

      window.dispatchEvent(
        new CustomEvent("mobdea:r20-exam-code-ready", {detail: exam}),
      );
    } catch (error) {
      console.error("R20 exam register failed", error);
    }
  });

  window.addEventListener("mobdea:r20-exam-start", (event) => {
    const attempt = tracker.startAttempt(event.detail || {});
    window.dispatchEvent(
      new CustomEvent("mobdea:r20-exam-attempt-started", {detail: attempt}),
    );
  });

  window.addEventListener("mobdea:r20-exam-answer", (event) => {
    tracker.recordAnswer(event.detail || {});
  });

  window.addEventListener("mobdea:r20-exam-finish", (event) => {
    tracker.finalizeAttempt(event.detail?.attemptId);
  });

  window.addEventListener("mobdea:r20-exam-tracking-request", () => {
    window.dispatchEvent(
      new CustomEvent("mobdea:r20-exam-tracking-snapshot", {
        detail: tracker.snapshot(),
      }),
    );
  });

  attachFileInputBridge(tracker);
}

if (
  typeof window !== "undefined" &&
  typeof document !== "undefined"
) {
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      installR20ExamTracking,
      {once: true},
    );
  } else {
    installR20ExamTracking();
  }
}
