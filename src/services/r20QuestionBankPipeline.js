import {
  R20_QUESTION_BANK_SOURCE_COUNT,
  R20_QUESTION_BANK_HAS_PROMPT,
  R20_QUESTION_BANK_HAS_OPTIONS,
  R20_QUESTION_BANK_HAS_CORRECT_ANSWER,
} from "../config/r20QuestionBankConfig.js";

export const R20_QUESTION_BANK_MARKER =
  "R20_FIX19_QUESTION_BANK_PIPELINE_V1";

const PROMPT_KEYS = [
  "questionText", "question_text", "question",
  "prompt", "stem", "text", "السؤال",
];

const OPTIONS_KEYS = [
  "options", "answers", "choices", "alternatives",
  "اختيارات", "الإجابات", "الاجابات",
];

const CORRECT_KEYS = [
  "correctAnswer", "correct_answer", "correctIndex",
  "correctOption", "answer", "correct",
  "الإجابة_الصحيحة", "الاجابة_الصحيحة",
];

const ID_KEYS = [
  "id", "questionId", "question_id", "code", "uid",
];

const META_KEYS = {
  subject: ["subject", "subjectName", "المادة"],
  grade: ["grade", "gradeName", "class", "الصف"],
  unit: ["unit", "unitName", "الوحدة"],
  lesson: ["lesson", "lessonName", "الدرس"],
  chapter: ["chapter", "chapterName", "الفصل"],
  difficulty: ["difficulty", "level", "المستوى"],
  pageNumber: ["pageNumber", "page", "pdfPage", "الصفحة"],
  documentId: ["documentId", "docId", "fileId"],
  type: ["type", "questionType"],
};

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function first(object, keys) {
  if (!object || typeof object !== "object") {
    return undefined;
  }

  for (const key of keys) {
    if (
      Object.prototype.hasOwnProperty.call(object, key) &&
      object[key] !== undefined &&
      object[key] !== null
    ) {
      return object[key];
    }
  }

  return undefined;
}

function hash32(value) {
  let hash = 0x811c9dc5;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}

function optionText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return clean(value);
  }

  if (typeof value === "object") {
    return clean(
      first(
        value,
        ["text", "label", "value", "answer", "option", "name"],
      ),
    );
  }

  return "";
}

export function normalizeOptions(raw) {
  if (Array.isArray(raw)) {
    return raw.map(optionText).filter(Boolean);
  }

  if (raw && typeof raw === "object") {
    return Object.entries(raw)
      .map(([key, value]) => optionText(value) || clean(key))
      .filter(Boolean);
  }

  return [];
}

function normalizeCorrect(raw, options) {
  if (raw === undefined || raw === null || raw === "") {
    return {
      correctAnswer: "",
      correctIndex: -1,
    };
  }

  if (typeof raw === "number" && Number.isInteger(raw)) {
    let index = -1;

    if (raw >= 0 && raw < options.length) {
      index = raw;
    } else if (raw >= 1 && raw <= options.length) {
      index = raw - 1;
    }

    return {
      correctAnswer:
        index >= 0 ? options[index] : clean(raw),
      correctIndex: index,
    };
  }

  const text = optionText(raw);
  const index = options.findIndex(
    (option) => lower(option) === lower(text),
  );

  if (index >= 0) {
    return {
      correctAnswer: options[index],
      correctIndex: index,
    };
  }

  const letter = lower(text);

  if (/^[a-d]$/.test(letter)) {
    const indexByLetter =
      letter.charCodeAt(0) - "a".charCodeAt(0);

    if (indexByLetter < options.length) {
      return {
        correctAnswer: options[indexByLetter],
        correctIndex: indexByLetter,
      };
    }
  }

  return {
    correctAnswer: text,
    correctIndex: -1,
  };
}

function metadata(raw, context) {
  const output = {};

  for (const [name, keys] of Object.entries(META_KEYS)) {
    const value =
      first(raw, keys) ??
      first(context, keys);

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      output[name] =
        typeof value === "number"
          ? value
          : clean(value);
    }
  }

  return output;
}

function contentKey(prompt, options, answer) {
  return [
    lower(prompt),
    options.map(lower).join("\u241f"),
    lower(answer),
  ].join("\u241e");
}

export function stableQuestionId(raw) {
  const prompt = clean(first(raw, PROMPT_KEYS));
  const options = normalizeOptions(first(raw, OPTIONS_KEYS));
  const correct = normalizeCorrect(
    first(raw, CORRECT_KEYS),
    options,
  );

  return `r20q_${hash32(
    contentKey(
      prompt,
      options,
      correct.correctAnswer,
    ),
  )}`;
}

export function normalizeQuestion(raw, context = {}) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const prompt = clean(first(raw, PROMPT_KEYS));

  if (!prompt) {
    return null;
  }

  const options = normalizeOptions(first(raw, OPTIONS_KEYS));
  const correct = normalizeCorrect(
    first(raw, CORRECT_KEYS),
    options,
  );

  const sourceId = clean(
    context.sourceId ||
    context.source ||
    "unknown",
  );

  return {
    id: stableQuestionId(raw),
    explicitId: clean(first(raw, ID_KEYS)),
    prompt,
    options,
    correctAnswer: correct.correctAnswer,
    correctIndex: correct.correctIndex,
    sourceIds: sourceId ? [sourceId] : [],
    ...metadata(raw, context),
  };
}

function looksLikeQuestion(raw) {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw)
  ) {
    return false;
  }

  const prompt = clean(first(raw, PROMPT_KEYS));

  if (!prompt) {
    return false;
  }

  const options = normalizeOptions(first(raw, OPTIONS_KEYS));

  return (
    options.length >= 2 ||
    first(raw, CORRECT_KEYS) !== undefined
  );
}

export function findQuestionArrays(value, maxDepth = 5) {
  const output = [];

  function visit(node, path, depth) {
    if (depth > maxDepth) return;

    if (Array.isArray(node)) {
      const questions = node.filter(looksLikeQuestion);

      if (
        questions.length > 0 &&
        questions.length >=
          Math.max(1, Math.ceil(node.length * 0.4))
      ) {
        output.push({
          path,
          questions,
        });
        return;
      }

      node.forEach((child, index) => {
        if (child && typeof child === "object") {
          visit(child, `${path}[${index}]`, depth + 1);
        }
      });

      return;
    }

    if (!node || typeof node !== "object") {
      return;
    }

    for (const [key, child] of Object.entries(node)) {
      if (child && typeof child === "object") {
        visit(
          child,
          path ? `${path}.${key}` : key,
          depth + 1,
        );
      }
    }
  }

  visit(value, "", 0);
  return output;
}

function merge(existing, incoming) {
  if (!existing) return incoming;

  const sourceIds = [
    ...new Set([
      ...(existing.sourceIds || []),
      ...(incoming.sourceIds || []),
    ]),
  ];

  const meaningfulIncoming = Object.fromEntries(
    Object.entries(incoming).filter(
      ([, value]) =>
        value !== "" &&
        value !== undefined &&
        value !== null,
    ),
  );

  return {
    ...existing,
    ...meaningfulIncoming,
    sourceIds,
  };
}

export class R20QuestionBankPipeline {
  constructor() {
    this.byId = new Map();
    this.sources = new Map();
    this.order = [];
  }

  registerSource(sourceId, questions, context = {}) {
    const safeSource = clean(
      sourceId ||
      context.sourceId ||
      "unknown",
    );

    if (!Array.isArray(questions)) {
      return {
        sourceId: safeSource,
        accepted: 0,
        duplicates: 0,
        rejected: 0,
      };
    }

    let accepted = 0;
    let duplicates = 0;
    let rejected = 0;
    const ids = [];

    for (const raw of questions) {
      const normalized = normalizeQuestion(
        raw,
        {
          ...context,
          sourceId: safeSource,
        },
      );

      if (!normalized) {
        rejected += 1;
        continue;
      }

      const existing = this.byId.get(normalized.id);

      if (existing) {
        duplicates += 1;
        this.byId.set(
          normalized.id,
          merge(existing, normalized),
        );
      } else {
        accepted += 1;
        this.byId.set(normalized.id, normalized);
        this.order.push(normalized.id);
      }

      ids.push(normalized.id);
    }

    this.sources.set(
      safeSource,
      {
        sourceId: safeSource,
        questionIds: [...new Set(ids)],
        registeredAt: Date.now(),
      },
    );

    return {
      sourceId: safeSource,
      accepted,
      duplicates,
      rejected,
    };
  }

  getById(id) {
    return this.byId.get(String(id)) || null;
  }

  query(filters = {}) {
    return this.order
      .map((id) => this.byId.get(id))
      .filter(Boolean)
      .filter((question) => {
        for (const [key, expected] of Object.entries(filters)) {
          if (
            expected === undefined ||
            expected === null ||
            expected === ""
          ) {
            continue;
          }

          if (key === "sourceId") {
            if (
              !(question.sourceIds || [])
                .includes(String(expected))
            ) {
              return false;
            }
            continue;
          }

          if (
            lower(question[key]) !==
            lower(expected)
          ) {
            return false;
          }
        }

        return true;
      })
      .map((question) => ({
        ...question,
        options: [...question.options],
        sourceIds: [...(question.sourceIds || [])],
      }));
  }

  take({
    limit = 10,
    excludeIds = [],
    filters = {},
  } = {}) {
    const excluded = new Set(
      excludeIds.map(String),
    );

    return this.query(filters)
      .filter(
        (question) =>
          !excluded.has(question.id),
      )
      .slice(
        0,
        Math.max(0, Number(limit) || 0),
      );
  }

  stats() {
    return {
      uniqueCount: this.byId.size,
      sourceCount: this.sources.size,
      sourceIds: [...this.sources.keys()],
      repositorySourceCount:
        R20_QUESTION_BANK_SOURCE_COUNT,
      repositoryShapeReady:
        Boolean(
          R20_QUESTION_BANK_HAS_PROMPT &&
          R20_QUESTION_BANK_HAS_OPTIONS &&
          R20_QUESTION_BANK_HAS_CORRECT_ANSWER
        ),
    };
  }

  snapshot() {
    return {
      marker: R20_QUESTION_BANK_MARKER,
      stats: this.stats(),
      questions: this.query(),
    };
  }
}

export function buildQuestionBank(sources = []) {
  const pipeline = new R20QuestionBankPipeline();

  for (const source of sources) {
    pipeline.registerSource(
      source.sourceId,
      source.questions,
      source.context || {},
    );
  }

  return pipeline;
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function relevantStorageKey(key) {
  return /question|bank|quiz|exam|أسئ|اسئ|سؤال|بنك/i.test(
    String(key || ""),
  );
}

function ingestObject(
  pipeline,
  sourceId,
  value,
  context = {},
) {
  for (const [index, entry] of
    findQuestionArrays(value).entries()
  ) {
    pipeline.registerSource(
      `${sourceId}:${entry.path || index}`,
      entry.questions,
      context,
    );
  }
}

function ingestLocalStorage(pipeline) {
  for (
    let index = 0;
    index < localStorage.length;
    index += 1
  ) {
    const key = localStorage.key(index);

    if (!relevantStorageKey(key)) {
      continue;
    }

    const parsed = parseJson(
      localStorage.getItem(key),
    );

    if (parsed !== null) {
      ingestObject(
        pipeline,
        `localStorage:${key}`,
        parsed,
      );
    }
  }
}

function ingestWindowGlobals(pipeline) {
  const names = Object.keys(window).filter(
    (key) =>
      /question.?bank|quizQuestions|examQuestions|questionBank/i.test(
        key,
      ),
  );

  for (const key of names) {
    let value;

    try {
      value = window[key];
    } catch {
      continue;
    }

    if (value && typeof value === "object") {
      ingestObject(
        pipeline,
        `window:${key}`,
        value,
      );
    }
  }
}

function dispatchReady(pipeline) {
  window.dispatchEvent(
    new CustomEvent(
      "mobdea:r20-question-bank-ready",
      {
        detail: pipeline.stats(),
      },
    ),
  );
}

export function installR20QuestionBankPipeline() {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return;
  }

  if (window.__MOBDEA_R20_QUESTION_BANK__) {
    return;
  }

  const pipeline = new R20QuestionBankPipeline();

  window.__MOBDEA_R20_QUESTION_BANK__ =
    R20_QUESTION_BANK_MARKER;

  window.mobdeaR20QuestionBank = Object.freeze({
    marker: R20_QUESTION_BANK_MARKER,
    registerSource:
      (sourceId, questions, context) =>
        pipeline.registerSource(
          sourceId,
          questions,
          context,
        ),
    getById:
      (id) =>
        pipeline.getById(id),
    query:
      (filters) =>
        pipeline.query(filters),
    take:
      (options) =>
        pipeline.take(options),
    stats:
      () =>
        pipeline.stats(),
    snapshot:
      () =>
        pipeline.snapshot(),
    refresh:
      () => {
        ingestLocalStorage(pipeline);
        ingestWindowGlobals(pipeline);
        dispatchReady(pipeline);
        return pipeline.stats();
      },
  });

  window.addEventListener(
    "mobdea:r20-question-bank-source",
    (event) => {
      const detail = event.detail || {};

      pipeline.registerSource(
        detail.sourceId ||
        detail.source ||
        "event-source",
        detail.questions ||
        detail.items ||
        [],
        detail.context || {},
      );

      dispatchReady(pipeline);
    },
  );

  window.addEventListener(
    "mobdea:r20-page-questions",
    (event) => {
      const detail = event.detail || {};

      const documentId = clean(
        detail.documentId ||
        detail.docId ||
        "document",
      );

      const pageNumber =
        detail.pageNumber ??
        detail.page ??
        "";

      pipeline.registerSource(
        `ocr:${documentId}:page:${pageNumber}`,
        detail.questions ||
        detail.items ||
        [],
        {
          documentId,
          pageNumber,
          source: "ocr-page-questions",
        },
      );

      dispatchReady(pipeline);
    },
  );

  window.addEventListener(
    "mobdea:r20-question-bank-request",
    () => {
      window.dispatchEvent(
        new CustomEvent(
          "mobdea:r20-question-bank-snapshot",
          {
            detail: pipeline.snapshot(),
          },
        ),
      );
    },
  );

  ingestLocalStorage(pipeline);
  ingestWindowGlobals(pipeline);
  dispatchReady(pipeline);
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      installR20QuestionBankPipeline,
      { once: true },
    );
  } else {
    installR20QuestionBankPipeline();
  }
}
