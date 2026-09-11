import {
  R20_REPORTS_HAS_EXAM_RESULTS,
  R20_REPORTS_HAS_PARENT_PHONE,
  R20_REPORTS_HAS_LINKED_STUDENTS,
  R20_REPORTS_HAS_PORTAL_PERMISSION,
} from "../config/r20ReportsWhatsAppConfig.js";

export const R20_REPORTS_WHATSAPP_MARKER =
  "R20_FIX21_REPORTS_WHATSAPP_V1";

const APP_AUTH_KEY =
  "mobdea_mobile_auth_v2";

const REPORT_PANEL_ID =
  "r20-report-ready-panel";

const REPORT_DIALOG_ID =
  "r20-student-report-dialog";

const clean =
  (value) =>
    String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();

const safeArray =
  (value) =>
    Array.isArray(value)
      ? value
      : [];

function digitsToLatin(value) {
  const arabic =
    "٠١٢٣٤٥٦٧٨٩";

  const eastern =
    "۰۱۲۳۴۵۶۷۸۹";

  return String(value ?? "")
    .replace(
      /[٠-٩]/g,
      (char) =>
        String(
          arabic.indexOf(
            char,
          ),
        ),
    )
    .replace(
      /[۰-۹]/g,
      (char) =>
        String(
          eastern.indexOf(
            char,
          ),
        ),
    );
}

export function normalizeWhatsAppPhone(
  value,
) {
  let raw =
    digitsToLatin(
      value,
    )
      .trim();

  if (!raw) {
    return "";
  }

  raw =
    raw.replace(
      /^00/,
      "+",
    );

  let digits =
    raw.replace(
      /\D/g,
      "",
    );

  if (
    /^01[0125]\d{8}$/.test(
      digits,
    )
  ) {
    digits =
      `20${digits.slice(1)}`;
  }

  if (
    /^20?1[0125]\d{8}$/.test(
      digits,
    ) &&
    !digits.startsWith(
      "20",
    )
  ) {
    digits =
      `20${digits}`;
  }

  if (
    digits.startsWith(
      "0",
    )
  ) {
    return "";
  }

  if (
    digits.length <
      8 ||
    digits.length >
      15
  ) {
    return "";
  }

  return digits;
}

function parentPhoneFromStudent(
  student,
) {
  if (
    !student ||
    typeof student !==
      "object"
  ) {
    return "";
  }

  return clean(
    student.parentPhone ??
    student.guardianPhone ??
    student.parentPhoneNumber ??
    student.guardianMobile ??
    student.parentMobile ??
    student.guardianPhoneNumber ??
    "",
  );
}

function studentIdFromRecord(
  student,
) {
  return clean(
    student?.id ??
    student?.studentId ??
    student?.student_id ??
    "",
  );
}

function studentNameFromRecord(
  student,
) {
  return clean(
    student?.name ??
    student?.fullName ??
    student?.studentName ??
    "",
  );
}

function scanStudents(
  value,
  found,
  depth = 0,
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    depth > 6
  ) {
    return;
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    for (
      const item of
      value
    ) {
      scanStudents(
        item,
        found,
        depth + 1,
      );
    }

    return;
  }

  if (
    Array.isArray(
      value.students,
    )
  ) {
    for (
      const student of
      value.students
    ) {
      const studentId =
        studentIdFromRecord(
          student,
        );

      if (
        studentId
      ) {
        found.set(
          studentId,
          {
            studentId,
            studentName:
              studentNameFromRecord(
                student,
              ),
            parentPhone:
              parentPhoneFromStudent(
                student,
              ),
          },
        );
      }
    }
  }

  for (
    const child of
    Object.values(
      value,
    )
  ) {
    if (
      child &&
      typeof child ===
        "object"
    ) {
      scanStudents(
        child,
        found,
        depth + 1,
      );
    }
  }
}

export function resolveStudentContact(
  studentId,
  storage =
    typeof localStorage !==
      "undefined"
      ? localStorage
      : null,
) {
  const canonical =
    clean(
      studentId,
    );

  if (
    !canonical ||
    !storage
  ) {
    return {
      studentId:
        canonical,
      studentName:
        "",
      parentPhone:
        "",
      whatsappPhone:
        "",
    };
  }

  const found =
    new Map();

  for (
    let index = 0;
    index <
      storage.length;
    index += 1
  ) {
    const key =
      storage.key(
        index,
      );

    if (!key) {
      continue;
    }

    try {
      const parsed =
        JSON.parse(
          storage.getItem(
            key,
          ),
        );

      scanStudents(
        parsed,
        found,
      );
    } catch {
      // Ignore non-JSON storage.
    }
  }

  const student =
    found.get(
      canonical,
    );

  const parentPhone =
    clean(
      student
        ?.parentPhone ||
      "",
    );

  return {
    studentId:
      canonical,
    studentName:
      student
        ?.studentName ||
      "",
    parentPhone,
    whatsappPhone:
      normalizeWhatsAppPhone(
        parentPhone,
      ),
  };
}

function appAuth() {
  if (
    typeof localStorage ===
      "undefined"
  ) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
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

export function viewerCanAccessStudent(
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
      "admin",
      "teacher",
    ].includes(
      viewer.role,
    )
  ) {
    return true;
  }

  if (
    viewer.role ===
      "student"
  ) {
    return (
      clean(
        viewer.studentId,
      ) ===
      canonical
    );
  }

  if (
    viewer.role ===
      "parent"
  ) {
    return safeArray(
      viewer.linkedStudentIds,
    )
      .map(
        clean,
      )
      .includes(
        canonical,
      );
  }

  return false;
}

function trackingApi() {
  return (
    typeof window !==
      "undefined"
      ? window
        .mobdeaR20ExamTracking
      : null
  );
}

function questionBankApi() {
  return (
    typeof window !==
      "undefined"
      ? window
        .mobdeaR20QuestionBank
      : null
  );
}

function latestCompletedAttempt(
  studentId,
) {
  const tracker =
    trackingApi();

  if (!tracker) {
    return null;
  }

  const attempts =
    tracker
      .listAttemptsByStudent(
        studentId,
      )
      .filter(
        (attempt) =>
          attempt.status ===
            "completed" &&
          attempt.result,
      )
      .sort(
        (a, b) =>
          String(
            b.finishedAt ||
            b.startedAt ||
            "",
          )
            .localeCompare(
              String(
                a.finishedAt ||
                a.startedAt ||
                "",
              ),
            ),
      );

  return (
    attempts[0] ||
    null
  );
}

function groupedWeaknesses(
  result,
) {
  return safeArray(
    result
      ?.weaknesses,
  ).map(
    (entry) => ({
      key:
        clean(
          entry.key,
        ),
      count:
        Number(
          entry.count ||
          0,
        ),
      questionIds:
        safeArray(
          entry
            .questionIds,
        ),
      metadata:
        entry.metadata ||
        {},
    }),
  );
}

function cumulativeWeaknesses(
  studentId,
) {
  const tracker =
    trackingApi();

  if (!tracker) {
    return [];
  }

  const weakness =
    tracker
      .getStudentWeakness(
        studentId,
      );

  return Object
    .values(
      weakness
        ?.buckets ||
      {},
    )
    .sort(
      (a, b) =>
        Number(
          b.totalWrong ||
          0,
        ) -
        Number(
          a.totalWrong ||
          0,
        ),
    );
}

function errorQuestion(
  error,
) {
  const bank =
    questionBankApi();

  const question =
    bank?.getById(
      error.questionId,
    );

  return {
    questionId:
      error.questionId,
    prompt:
      clean(
        question
          ?.prompt ||
        "",
      ),
    selectedAnswer:
      clean(
        error.selectedAnswer,
      ),
    correctAnswer:
      clean(
        error.correctAnswer ||
        question
          ?.correctAnswer ||
        "",
      ),
    weakness:
      error.weakness ||
      {},
  };
}

export function buildStudentReport({
  studentId,
  attemptId = "",
  viewer =
    appAuth(),
} = {}) {
  const canonical =
    clean(
      studentId,
    );

  if (
    !viewerCanAccessStudent(
      viewer,
      canonical,
    )
  ) {
    throw new Error(
      "R20 viewer is not authorized for this student report.",
    );
  }

  const tracker =
    trackingApi();

  if (!tracker) {
    throw new Error(
      "R20 Exam Tracking API is unavailable.",
    );
  }

  const attempt =
    clean(
      attemptId,
    )
      ? tracker
        .getAttempt(
          attemptId,
        )
      : latestCompletedAttempt(
          canonical,
        );

  if (
    !attempt ||
    attempt.studentId !==
      canonical ||
    attempt.status !==
      "completed" ||
    !attempt.result
  ) {
    throw new Error(
      "R20 completed exam result was not found for this student.",
    );
  }

  const exam =
    tracker
      .getExam(
        attempt.examCode,
      );

  const contact =
    resolveStudentContact(
      canonical,
    );

  const result =
    attempt.result;

  const report = {
    reportId:
      `RPT-${result.resultId}`,
    studentId:
      canonical,
    studentName:
      clean(
        result.studentName ||
        attempt.studentName ||
        contact.studentName ||
        "",
      ),
    examCode:
      attempt.examCode,
    examTitle:
      clean(
        exam?.title ||
        "",
      ),
    attemptId:
      attempt.attemptId,
    completedAt:
      result.completedAt ||
      attempt.finishedAt ||
      "",
    answeredCount:
      result.answeredCount,
    gradedCount:
      result.gradedCount,
    correctCount:
      result.correctCount,
    wrongCount:
      result.wrongCount,
    ungradedCount:
      result.ungradedCount,
    percentage:
      result.percentage,
    errors:
      safeArray(
        result.errors,
      )
        .map(
          errorQuestion,
        ),
    examWeaknesses:
      groupedWeaknesses(
        result,
      ),
    cumulativeWeaknesses:
      cumulativeWeaknesses(
        canonical,
      ),
    contact,
  };

  return report;
}

function labelForWeakness(
  entry,
) {
  const meta =
    entry.metadata ||
    {};

  const values =
    [
      meta.subject,
      meta.unit,
      meta.lesson,
      meta.chapter,
      meta.topic,
      meta.skill,
      meta.difficulty,
    ]
      .map(
        clean,
      )
      .filter(Boolean);

  if (
    values.length
  ) {
    return values.join(
      " ← ",
    );
  }

  return (
    clean(
      entry.key,
    ) ||
    "سؤال يحتاج مراجعة"
  );
}

export function formatWhatsAppReport(
  report,
) {
  if (!report) {
    throw new Error(
      "R20 report is required.",
    );
  }

  const lines = [
    "تقرير منصة المُبدع",
    `الطالب: ${report.studentName || report.studentId}`,
    `كود الامتحان: ${report.examCode}`,
  ];

  if (
    report.examTitle
  ) {
    lines.push(
      `الامتحان: ${report.examTitle}`,
    );
  }

  lines.push(
    `النتيجة: ${
      report.percentage ??
      "غير محسوبة"
    }%`,
  );

  lines.push(
    `إجابات صحيحة: ${report.correctCount}`,
  );

  lines.push(
    `إجابات خاطئة: ${report.wrongCount}`,
  );

  if (
    report.ungradedCount
  ) {
    lines.push(
      `إجابات غير مصححة: ${report.ungradedCount}`,
    );
  }

  lines.push("");
  lines.push(
    "نقاط الضعف في هذا الامتحان:",
  );

  if (
    report.examWeaknesses
      .length
  ) {
    report.examWeaknesses
      .forEach(
        (
          weakness,
          index,
        ) => {
          lines.push(
            `${index + 1}) ${labelForWeakness(weakness)} — ${weakness.count} خطأ`,
          );
        },
      );
  } else {
    lines.push(
      "لا توجد نقاط ضعف مسجلة في هذا الامتحان.",
    );
  }

  lines.push("");
  lines.push(
    "نقاط الضعف التراكمية:",
  );

  if (
    report
      .cumulativeWeaknesses
      .length
  ) {
    report
      .cumulativeWeaknesses
      .forEach(
        (
          weakness,
          index,
        ) => {
          lines.push(
            `${index + 1}) ${labelForWeakness(weakness)} — ${Number(weakness.totalWrong || weakness.count || 0)} خطأ`,
          );
        },
      );
  } else {
    lines.push(
      "لا توجد نقاط ضعف تراكمية مسجلة.",
    );
  }

  return lines.join(
    "\n",
  );
}

export function buildWhatsAppUrl(
  phone,
  message,
) {
  const normalized =
    normalizeWhatsAppPhone(
      phone,
    );

  if (!normalized) {
    throw new Error(
      "R20 valid parent WhatsApp phone is unavailable.",
    );
  }

  const text =
    clean(
      message,
    );

  if (!text) {
    throw new Error(
      "R20 WhatsApp report message is empty.",
    );
  }

  return (
    `https://wa.me/${normalized}` +
    `?text=${encodeURIComponent(message)}`
  );
}

export function createWhatsAppShare(
  report,
) {
  const phone =
    report
      ?.contact
      ?.whatsappPhone ||
    normalizeWhatsAppPhone(
      report
        ?.contact
        ?.parentPhone,
    );

  const message =
    formatWhatsAppReport(
      report,
    );

  return {
    phone,
    message,
    url:
      buildWhatsAppUrl(
        phone,
        message,
      ),
  };
}

export function openWhatsAppReport(
  report,
) {
  const share =
    createWhatsAppShare(
      report,
    );

  if (
    typeof window ===
      "undefined"
  ) {
    return share;
  }

  const popup =
    window.open(
      share.url,
      "_blank",
      "noopener,noreferrer",
    );

  return {
    ...share,
    opened:
      Boolean(
        popup,
      ),
  };
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

function reportWeaknessList(
  entries,
  cumulative =
    false,
) {
  if (
    !entries.length
  ) {
    return (
      "<li>لا توجد نقاط ضعف مسجلة.</li>"
    );
  }

  return entries
    .map(
      (entry) =>
        `<li><span>${escapeHtml(labelForWeakness(entry))}</span><strong>${
          Number(
            cumulative
              ? (
                  entry.totalWrong ||
                  entry.count ||
                  0
                )
              : (
                  entry.count ||
                  0
                ),
          )
        } خطأ</strong></li>`,
    )
    .join("");
}

function ensureDialog() {
  let dialog =
    document.getElementById(
      REPORT_DIALOG_ID,
    );

  if (dialog) {
    return dialog;
  }

  dialog =
    document.createElement(
      "dialog",
    );

  dialog.id =
    REPORT_DIALOG_ID;

  dialog.className =
    "r20-student-report-dialog";

  dialog.innerHTML = `
    <form method="dialog" class="r20-student-report-dialog__shell">
      <button class="r20-student-report-dialog__close" value="cancel" aria-label="إغلاق">×</button>
      <div data-r20-report-dialog-body></div>
    </form>
  `;

  document.body
    .appendChild(
      dialog,
    );

  return dialog;
}

function showReportDialog(
  report,
) {
  const dialog =
    ensureDialog();

  const body =
    dialog.querySelector(
      "[data-r20-report-dialog-body]",
    );

  body.innerHTML = `
    <article class="r20-student-report">
      <header>
        <p>تقرير منصة المُبدع</p>
        <h2>${escapeHtml(report.studentName || report.studentId)}</h2>
        <span>${escapeHtml(report.examTitle || report.examCode)}</span>
      </header>

      <section class="r20-student-report__score">
        <strong>${escapeHtml(report.percentage ?? "—")}%</strong>
        <span>صحيح ${escapeHtml(report.correctCount)} · خطأ ${escapeHtml(report.wrongCount)}</span>
      </section>

      <section>
        <h3>نقاط الضعف في الامتحان</h3>
        <ul>${reportWeaknessList(report.examWeaknesses)}</ul>
      </section>

      <section>
        <h3>نقاط الضعف التراكمية</h3>
        <ul>${reportWeaknessList(report.cumulativeWeaknesses, true)}</ul>
      </section>

      <footer>
        <small>كود الامتحان: ${escapeHtml(report.examCode)}</small>
      </footer>
    </article>
  `;

  if (
    typeof dialog.showModal ===
      "function"
  ) {
    dialog.showModal();
  } else {
    dialog.setAttribute(
      "open",
      "",
    );
  }
}

function removePanel() {
  document
    .getElementById(
      REPORT_PANEL_ID,
    )
    ?.remove();
}

function showTeacherReportPanel(
  report,
) {
  const viewer =
    appAuth();

  if (
    ![
      "admin",
      "teacher",
    ].includes(
      viewer?.role,
    )
  ) {
    return;
  }

  removePanel();

  const panel =
    document.createElement(
      "aside",
    );

  panel.id =
    REPORT_PANEL_ID;

  panel.className =
    "r20-report-ready-panel";

  panel.setAttribute(
    "data-r20-report-ready-panel",
    "true",
  );

  const canWhatsApp =
    Boolean(
      report
        .contact
        .whatsappPhone,
    );

  panel.innerHTML = `
    <div>
      <strong>تم تجهيز تقرير ${escapeHtml(report.studentName || report.studentId)}</strong>
      <small>${escapeHtml(report.examCode)} · ${escapeHtml(report.percentage ?? "—")}%</small>
    </div>
    <div class="r20-report-ready-panel__actions">
      <button type="button" data-r20-report-action="view">عرض التقرير</button>
      <button type="button" data-r20-report-action="whatsapp" ${canWhatsApp ? "" : "disabled"}>WhatsApp</button>
      <button type="button" data-r20-report-action="dismiss" aria-label="إغلاق">×</button>
    </div>
  `;

  panel.addEventListener(
    "click",
    (event) => {
      const action =
        event.target
          .closest?.(
            "[data-r20-report-action]",
          )
          ?.getAttribute(
            "data-r20-report-action",
          );

      if (
        action ===
          "view"
      ) {
        showReportDialog(
          report,
        );
      }

      if (
        action ===
          "whatsapp"
      ) {
        openWhatsAppReport(
          report,
        );
      }

      if (
        action ===
          "dismiss"
      ) {
        removePanel();
      }
    },
  );

  document.body
    .appendChild(
      panel,
    );
}

function buildReportFromResult(
  result,
) {
  if (
    !result
      ?.studentId
  ) {
    return null;
  }

  return buildStudentReport({
    studentId:
      result.studentId,
    attemptId:
      result.attemptId,
    viewer: {
      role:
        "teacher",
    },
  });
}

function dispatchReport(
  report,
) {
  window.dispatchEvent(
    new CustomEvent(
      "mobdea:r20-student-report-ready",
      {
        detail:
          report,
      },
    ),
  );
}


function ensurePortalReportCards() {
  const viewer =
    appAuth();

  if (
    !viewer ||
    ![
      "student",
      "parent",
    ].includes(
      viewer.role,
    )
  ) {
    return;
  }

  const dashboard =
    document.querySelector(
      `[data-r20-dashboard-role="${viewer.role}"]`,
    );

  if (!dashboard) {
    return;
  }

  const studentIds =
    viewer.role ===
      "student"
      ? [
          clean(
            viewer.studentId,
          ),
        ].filter(Boolean)
      : safeArray(
          viewer.linkedStudentIds,
        )
          .map(clean)
          .filter(Boolean);

  const grid =
    dashboard.querySelector(
      ".dashboard-grid, .dashboard-feature-grid, [data-dashboard-grid], [class*='dashboard-grid']",
    ) ||
    dashboard;

  for (
    const studentId of
    studentIds
  ) {
    if (
      !viewerCanAccessStudent(
        viewer,
        studentId,
      )
    ) {
      continue;
    }

    const latest =
      latestCompletedAttempt(
        studentId,
      );

    if (!latest) {
      continue;
    }

    if (
      grid.querySelector(
        `[data-r20-report-portal-card][data-r20-report-student-id="${CSS.escape(studentId)}"]`,
      )
    ) {
      continue;
    }

    const contact =
      resolveStudentContact(
        studentId,
      );

    const card =
      document.createElement(
        "button",
      );

    card.type =
      "button";

    card.className =
      "r20-report-portal-card";

    card.setAttribute(
      "data-r20-report-portal-card",
      "true",
    );

    card.setAttribute(
      "data-r20-report-student-id",
      studentId,
    );

    card.setAttribute(
      "data-r20-dashboard-feature",
      "reports",
    );

    card.setAttribute(
      "data-r20-dashboard-access",
      "allowed",
    );

    card.innerHTML = `
      <span aria-hidden="true">📊</span>
      <span>
        <strong>آخر تقرير</strong>
        <small>${escapeHtml(contact.studentName || studentId)}</small>
      </span>
    `;

    card.addEventListener(
      "click",
      () => {
        try {
          const report =
            buildStudentReport({
              studentId,
              attemptId:
                latest.attemptId,
              viewer:
                appAuth(),
            });

          showReportDialog(
            report,
          );
        } catch (error) {
          console.error(
            "R20 portal report open failed",
            error,
          );
        }
      },
    );

    grid.appendChild(
      card,
    );
  }
}

function resultReadyHandler(
  event,
) {
  try {
    const report =
      buildReportFromResult(
        event.detail,
      );

    if (!report) {
      return;
    }

    dispatchReport(
      report,
    );

    showTeacherReportPanel(
      report,
    );

    // Deliberately no window.open() here.
    // WhatsApp opens only from the explicit user button.
  } catch (error) {
    console.error(
      "R20 report generation failed",
      error,
    );
  }
}

export function installR20ReportsWhatsApp() {
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
      .__MOBDEA_R20_REPORTS_WHATSAPP__
  ) {
    return;
  }

  if (
    !(
      R20_REPORTS_HAS_EXAM_RESULTS &&
      R20_REPORTS_HAS_PARENT_PHONE &&
      R20_REPORTS_HAS_LINKED_STUDENTS &&
      R20_REPORTS_HAS_PORTAL_PERMISSION
    )
  ) {
    throw new Error(
      "R20 report prerequisites are not ready.",
    );
  }

  window
    .__MOBDEA_R20_REPORTS_WHATSAPP__ =
    R20_REPORTS_WHATSAPP_MARKER;

  window.mobdeaR20Reports =
    Object.freeze({
      marker:
        R20_REPORTS_WHATSAPP_MARKER,
      resolveStudentContact,
      viewerCanAccessStudent,
      buildStudentReport,
      formatWhatsAppReport,
      buildWhatsAppUrl,
      createWhatsAppShare,
      openWhatsAppReport,
      showReport:
        showReportDialog,
    });

  window.addEventListener(
    "mobdea:r20-exam-result-ready",
    (event) => {
      resultReadyHandler(
        event,
      );

      ensurePortalReportCards();
    },
  );

  ensurePortalReportCards();

  new MutationObserver(
    () => {
      ensurePortalReportCards();
    },
  ).observe(
    document.documentElement,
    {
      childList:
        true,
      subtree:
        true,
    },
  );

  window.addEventListener(
    "mobdea:r20-report-request",
    (event) => {
      try {
        const detail =
          event.detail ||
          {};

        const report =
          buildStudentReport({
            studentId:
              detail.studentId,
            attemptId:
              detail.attemptId,
            viewer:
              appAuth(),
          });

        dispatchReport(
          report,
        );
      } catch (error) {
        console.error(
          "R20 report request rejected",
          error,
        );
      }
    },
  );
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
      installR20ReportsWhatsApp,
      {
        once:
          true,
      },
    );
  } else {
    installR20ReportsWhatsApp();
  }
}
