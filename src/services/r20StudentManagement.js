export const R20_FIX03_MARKER = "R20_FIX03_STUDENT_MANAGEMENT_V1";

const ROOT_SELECTORS = [
  ".classmode-v103",
  ".classmode-page",
  ".lesson-mode-shell",
  "[data-r20-classmode-root='true']",
];

const LIST_SELECTORS = [
  ".classmode-students-list",
  ".classmode-student-list",
  ".students-list",
  "[data-students-list]",
  "[class*='student-list']",
];

const selectedCandidateIds = new Set();
let drawnCandidateIds = new Set();
let installed = false;
let panel = null;
let optionBox = null;
let statusBox = null;
let candidateSummary = null;
let currentList = null;
let lastRosterSignature = "";
let initialRosterObserved = false;
let previousRosterIds = new Set();
let scheduled = false;

const normalize = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeLower = (value) => normalize(value).toLowerCase();

export function normalizeStudentCredentialDigits(value) {
  return String(value ?? "")
    .replace(/[٠-٩]/g, (digit) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)),
    )
    .replace(/[۰-۹]/g, (digit) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)),
    )
    .trim();
}

export function chooseRandomCandidate(
  candidateIds,
  alreadyDrawn = [],
  rng = Math.random,
) {
  const pool = [...new Set([...candidateIds].map(String).filter(Boolean))];

  if (!pool.length) {
    return {
      id: null,
      nextDrawn: new Set(),
      cycleReset: false,
    };
  }

  const drawn = new Set(
    [...alreadyDrawn].map(String).filter((id) => pool.includes(id)),
  );

  let remaining = pool.filter((id) => !drawn.has(id));
  let cycleReset = false;

  if (!remaining.length) {
    drawn.clear();
    remaining = [...pool];
    cycleReset = true;
  }

  const safeRandom = Math.min(
    0.999999999,
    Math.max(0, Number(rng?.() ?? 0)),
  );
  const index = Math.floor(safeRandom * remaining.length);
  const id = remaining[index];

  drawn.add(id);

  return {
    id,
    nextDrawn: drawn,
    cycleReset,
  };
}

function getRoot() {
  for (const selector of ROOT_SELECTORS) {
    const found = document.querySelector(selector);
    if (found) return found;
  }
  return null;
}

function isVisible(element) {
  if (!element) return false;
  const style = getComputedStyle(element);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    element.getClientRects().length > 0
  );
}

function studentRows(root) {
  return [...root.querySelectorAll("[data-student-id]")].filter(
    (row) => !row.closest(".r20-random-picker"),
  );
}

function candidateNameFromRow(row) {
  const direct =
    row.querySelector(
      "[data-student-name], .student-name, .classmode-student-name, .student-display-name, strong, b",
    )?.textContent || "";

  const directName = normalize(direct);
  if (directName && /[\p{L}]/u.test(directName)) {
    return directName;
  }

  const clone = row.cloneNode(true);
  clone
    .querySelectorAll(
      "button, input, select, textarea, svg, [role='button'], .student-actions, .student-points",
    )
    .forEach((node) => node.remove());

  const text = normalize(clone.textContent)
    .replace(
      /(تشجيع|تنبيه|حاضر|غائب|إضافة نقطة|نقطة|نقاط|درجة|درجات)/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  const parts = text
    .split(/[|•·—–\-,:،؛]/)
    .map((part) => normalize(part))
    .filter(Boolean);

  return (
    parts.find(
      (part) =>
        /[\p{L}]/u.test(part) &&
        !/^\d+$/.test(part) &&
        part.length <= 80,
    ) ||
    text ||
    `طالب ${row.getAttribute("data-student-id")}`
  );
}

function discoverStudentLists(root) {
  const lists = new Set();

  for (const selector of LIST_SELECTORS) {
    root.querySelectorAll(selector).forEach((list) => {
      if (list.querySelector("[data-student-id]")) lists.add(list);
    });
  }

  const rows = studentRows(root);
  const parentCounts = new Map();

  for (const row of rows) {
    const parent = row.parentElement;
    if (!parent) continue;
    parentCounts.set(parent, (parentCounts.get(parent) || 0) + 1);
  }

  for (const [parent, count] of parentCounts) {
    if (count >= 1) lists.add(parent);
  }

  return [...lists];
}

function choosePrimaryList(lists) {
  if (!lists.length) return null;

  return [...lists].sort((a, b) => {
    const visibleDelta = Number(isVisible(b)) - Number(isVisible(a));
    if (visibleDelta) return visibleDelta;

    const rowDelta =
      b.querySelectorAll("[data-student-id]").length -
      a.querySelectorAll("[data-student-id]").length;
    if (rowDelta) return rowDelta;

    return 0;
  })[0];
}

function createPanel() {
  const root = document.createElement("section");
  root.className = "r20-random-picker";
  root.setAttribute("data-r20-random-picker", "true");
  root.setAttribute(
    "aria-label",
    "اختيار عشوائي من أسماء طلاب محددة",
  );

  root.innerHTML = `
    <div class="r20-random-picker__top">
      <div class="r20-random-picker__title">🎲 اختيار عشوائي من أسماء محددة</div>
      <div class="r20-random-picker__buttons">
        <button type="button" data-r20-action="select-all">الكل</button>
        <button type="button" data-r20-action="clear">مسح</button>
        <button type="button" class="r20-random-picker__draw" data-r20-action="draw">اختيار</button>
      </div>
    </div>
    <details class="r20-random-picker__candidates">
      <summary>حدد الطلاب <span data-r20-candidate-count>0</span></summary>
      <div class="r20-random-picker__options" data-r20-options></div>
    </details>
    <div class="r20-random-picker__status" data-r20-status>
      حدد اسمًا واحدًا أو أكثر أولًا.
    </div>
  `;

  optionBox = root.querySelector("[data-r20-options]");
  statusBox = root.querySelector("[data-r20-status]");
  candidateSummary = root.querySelector("[data-r20-candidate-count]");

  root.addEventListener("change", (event) => {
    const input = event.target.closest?.(
      'input[type="checkbox"][data-r20-candidate-id]',
    );
    if (!input) return;

    const id = String(input.dataset.r20CandidateId || "");
    if (!id) return;

    if (input.checked) selectedCandidateIds.add(id);
    else selectedCandidateIds.delete(id);

    drawnCandidateIds = new Set(
      [...drawnCandidateIds].filter((item) =>
        selectedCandidateIds.has(item),
      ),
    );

    updateCandidateCount();
    setStatus(
      selectedCandidateIds.size
        ? `تم تحديد ${selectedCandidateIds.size} طالب.`
        : "حدد اسمًا واحدًا أو أكثر أولًا.",
    );
  });

  root.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-r20-action]");
    if (!button) return;

    const action = button.dataset.r20Action;

    if (action === "select-all") {
      for (const input of optionBox.querySelectorAll(
        'input[type="checkbox"][data-r20-candidate-id]',
      )) {
        input.checked = true;
        selectedCandidateIds.add(
          String(input.dataset.r20CandidateId),
        );
      }
      drawnCandidateIds.clear();
      updateCandidateCount();
      setStatus(`تم تحديد ${selectedCandidateIds.size} طالب.`);
      return;
    }

    if (action === "clear") {
      selectedCandidateIds.clear();
      drawnCandidateIds.clear();
      optionBox
        .querySelectorAll(
          'input[type="checkbox"][data-r20-candidate-id]',
        )
        .forEach((input) => {
          input.checked = false;
        });
      updateCandidateCount();
      setStatus("حدد اسمًا واحدًا أو أكثر أولًا.");
      return;
    }

    if (action === "draw") {
      drawFromExactCandidates();
    }
  });

  return root;
}

function updateCandidateCount() {
  if (candidateSummary) {
    candidateSummary.textContent = String(selectedCandidateIds.size);
  }
}

function setStatus(message, isResult = false) {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.classList.toggle(
    "r20-random-picker__result",
    Boolean(isResult),
  );
}

function syncCandidateOptions(list) {
  if (!panel || !optionBox || !list) return;

  const rows = [...list.querySelectorAll("[data-student-id]")];
  const roster = rows
    .map((row) => ({
      id: String(row.getAttribute("data-student-id") || "").trim(),
      name: candidateNameFromRow(row),
    }))
    .filter((item) => item.id);

  const signature = roster
    .map((item) => `${item.id}:${item.name}`)
    .join("|");

  if (signature === lastRosterSignature) return;
  lastRosterSignature = signature;

  const rosterIds = new Set(roster.map((item) => item.id));

  for (const id of [...selectedCandidateIds]) {
    if (!rosterIds.has(id)) selectedCandidateIds.delete(id);
  }

  drawnCandidateIds = new Set(
    [...drawnCandidateIds].filter((id) => rosterIds.has(id)),
  );

  const previousScroll = optionBox.scrollTop;
  const fragment = document.createDocumentFragment();

  for (const item of roster) {
    const label = document.createElement("label");
    label.className = "r20-random-picker__option";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.r20CandidateId = item.id;
    input.checked = selectedCandidateIds.has(item.id);

    const span = document.createElement("span");
    span.textContent = item.name;
    span.title = item.name;

    label.append(input, span);
    fragment.append(label);
  }

  optionBox.replaceChildren(fragment);
  optionBox.scrollTop = previousScroll;
  updateCandidateCount();
}

async function speakStudentName(name) {
  const text = normalize(name);
  if (!text) return false;

  try {
    if (typeof window.mobdeaR20SpeakArabic === "function") {
      const result = await window.mobdeaR20SpeakArabic(text);
      if (result !== false) return true;
    }
  } catch {
    // Continue to browser fallback.
  }

  try {
    if (!("speechSynthesis" in window)) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-EG";
    utterance.rate = 0.92;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

function activateStudentRow(row) {
  if (!row) return;

  const root = getRoot();
  root
    ?.querySelectorAll('[data-r20-random-selected="true"]')
    .forEach((item) =>
      item.removeAttribute("data-r20-random-selected"),
    );

  row.setAttribute("data-r20-random-selected", "true");
  row.scrollIntoView?.({ block: "nearest", behavior: "smooth" });

  const target =
    row.querySelector(
      "[data-student-select], [data-testid*='student-select'], .student-main, .student-info",
    ) || row;

  try {
    target.click();
  } catch {
    target.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
      }),
    );
  }
}

function drawFromExactCandidates() {
  if (!selectedCandidateIds.size) {
    setStatus("حدد طالبًا واحدًا على الأقل قبل الاختيار.");
    return;
  }

  const result = chooseRandomCandidate(
    selectedCandidateIds,
    drawnCandidateIds,
  );

  if (!result.id) {
    setStatus("لا يوجد طالب صالح للاختيار.");
    return;
  }

  drawnCandidateIds = result.nextDrawn;

  const root = getRoot();
  const row = root?.querySelector(
    `[data-student-id="${CSS.escape(result.id)}"]`,
  );

  if (!row) {
    selectedCandidateIds.delete(result.id);
    drawnCandidateIds.delete(result.id);
    updateCandidateCount();
    scheduleRun();
    setStatus("تم تحديث قائمة الطلاب. أعد الاختيار.");
    return;
  }

  const name = candidateNameFromRow(row);
  activateStudentRow(row);
  setStatus(`تم اختيار: ${name}`, true);
  void speakStudentName(name);
}

function classifyLegacyRandomUi(root) {
  const modalCandidates = root.querySelectorAll(
    "[role='dialog'], dialog, .modal, .dialog, .popup, [class*='modal'], [class*='popup'], [class*='random']",
  );

  for (const element of modalCandidates) {
    if (element.closest(".r20-random-picker")) continue;
    const text = normalizeLower(
      [
        element.textContent,
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
      ].join(" "),
    );

    if (
      /تم اختيار الطلاب|تم اختيار الطالب|اختيار عشوائي للطلاب|اختيار الطلاب عشوائي|سحب عشوائي للطلاب/.test(
        text,
      )
    ) {
      element.setAttribute(
        "data-r20-legacy-random-modal",
        "true",
      );
    }
  }

  const controls = root.querySelectorAll(
    "button, [role='button'], a",
  );

  for (const control of controls) {
    if (control.closest(".r20-random-picker")) continue;

    const label = normalizeLower(
      [
        control.textContent,
        control.getAttribute("aria-label"),
        control.getAttribute("title"),
      ].join(" "),
    );

    if (
      /اختيار عشوائي للطلاب|اختيار الطلاب عشوائي|سحب عشوائي للطلاب|random student|random picker/.test(
        label,
      )
    ) {
      control.setAttribute(
        "data-r20-legacy-random-trigger",
        "true",
      );
    }
  }
}

function looksLikeStudentModal(element) {
  if (!element || element.closest(".r20-random-picker")) return false;

  const text = normalizeLower(
    [
      element.textContent,
      element.getAttribute?.("aria-label"),
      element.getAttribute?.("title"),
    ].join(" "),
  );

  if (/إضافة طالب|اضافة طالب|طالب جديد|add student|new student/.test(text)) {
    return true;
  }

  const fields = [...element.querySelectorAll("input, select")];
  const fieldText = normalizeLower(
    fields
      .map((field) =>
        [
          field.name,
          field.placeholder,
          field.getAttribute("aria-label"),
        ]
          .filter(Boolean)
          .join(" "),
      )
      .join(" "),
  );

  return (
    /(student|طالب)/.test(fieldText) &&
    /(code|كود|phone|هاتف|ولي الأمر|المجموعة|group)/.test(fieldText)
  );
}

function classifyStudentModal() {
  const candidates = document.querySelectorAll(
    "[role='dialog'], dialog, .modal, .dialog, [class*='modal'], [class*='dialog']",
  );

  for (const element of candidates) {
    if (!looksLikeStudentModal(element)) continue;
    element.setAttribute("data-r20-student-modal", "true");

    element
      .querySelectorAll("h1, h2, h3, .modal-actions, .dialog-actions")
      .forEach((node) =>
        node.setAttribute("data-r20-modal-wide", "true"),
      );
  }
}

function credentialFieldKind(input) {
  const context = normalizeLower(
    [
      input.name,
      input.id,
      input.placeholder,
      input.getAttribute("aria-label"),
      input.closest("label")?.textContent,
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (/(pin|كلمة المرور|الرقم السري|رمز الدخول|كود الدخول)/.test(context)) {
    return "pin";
  }

  if (/(student.?code|كود الطالب|رقم الطالب|student id)/.test(context)) {
    return "student-code";
  }

  return null;
}

function normalizeCredentialInput(input) {
  const kind = credentialFieldKind(input);
  if (!kind) return false;

  const normalized = normalizeStudentCredentialDigits(input.value);
  const compact =
    kind === "pin"
      ? normalized.replace(/\s+/g, "")
      : normalized.replace(/\s+/g, "");

  if (input.value !== compact) {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    );
    if (descriptor?.set) descriptor.set.call(input, compact);
    else input.value = compact;

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  if (kind === "pin") {
    input.inputMode = "numeric";
    input.autocomplete = "current-password";
  }

  return true;
}

function normalizeCredentialsWithin(scope) {
  scope
    .querySelectorAll?.("input")
    .forEach((input) => normalizeCredentialInput(input));
}

function requestStudentCloudSync(reason = "student-roster-changed") {
  if (typeof window === "undefined") return;

  const detail = {
    reason,
    at: Date.now(),
  };

  try {
    localStorage.setItem(
      "mobdea:r20:student-sync-requested",
      JSON.stringify(detail),
    );
  } catch {
    // Storage can be unavailable in a restricted WebView.
  }

  for (const type of [
    "mobdea:sync-requested",
    "mobdea:data-changed",
    "mobdea:student-roster-changed",
  ]) {
    try {
      window.dispatchEvent(new CustomEvent(type, { detail }));
    } catch {
      // Ignore optional event channels.
    }
  }

  /*
   * Existing Mobdea releases already sync on connectivity/focus.
   * These standard lifecycle nudges make a newly-created student
   * eligible for the existing pull/merge/push path immediately,
   * without duplicating cloud credentials in this repair layer.
   */
  try {
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("focus"));
  } catch {
    // Ignore.
  }
}

function observeRosterChanges(root) {
  const ids = new Set(
    studentRows(root)
      .map((row) =>
        String(row.getAttribute("data-student-id") || "").trim(),
      )
      .filter(Boolean),
  );

  if (!initialRosterObserved) {
    previousRosterIds = ids;
    initialRosterObserved = true;
    return;
  }

  const newIds = [...ids].filter((id) => !previousRosterIds.has(id));
  previousRosterIds = ids;

  if (newIds.length) {
    setTimeout(
      () => requestStudentCloudSync("student-created"),
      250,
    );
    setTimeout(
      () => requestStudentCloudSync("student-created-confirm"),
      1400,
    );
  }
}

function attachPanel(root) {
  const lists = discoverStudentLists(root);

  for (const list of lists) {
    list.setAttribute("data-r20-student-list", "true");
  }

  const nextList = choosePrimaryList(lists);
  if (!nextList) return;

  if (!panel) panel = createPanel();

  if (currentList !== nextList || !panel.isConnected) {
    currentList = nextList;
    nextList.insertBefore(panel, nextList.firstChild);
  }

  syncCandidateOptions(nextList);
}

function run() {
  const root = getRoot();

  classifyStudentModal();
  normalizeCredentialsWithin(document);

  if (!root) return;

  classifyLegacyRandomUi(root);
  attachPanel(root);
  observeRosterChanges(root);
}

function scheduleRun() {
  if (scheduled) return;
  scheduled = true;

  requestAnimationFrame(() => {
    scheduled = false;
    run();
  });
}

function install() {
  if (installed || typeof document === "undefined") return;
  installed = true;

  const observer = new MutationObserver(scheduleRun);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      "class",
      "style",
      "aria-label",
      "title",
      "data-student-id",
    ],
  });

  document.addEventListener(
    "input",
    (event) => {
      if (event.target instanceof HTMLInputElement) {
        normalizeCredentialInput(event.target);
      }
    },
    true,
  );

  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      normalizeCredentialsWithin(form);

      if (form.closest('[data-r20-student-modal="true"]')) {
        setTimeout(
          () => requestStudentCloudSync("student-form-submit"),
          500,
        );
        setTimeout(
          () => requestStudentCloudSync("student-form-submit-confirm"),
          2000,
        );
      }
    },
    true,
  );

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest?.("button");
      if (!button) return;

      const modal = button.closest(
        '[data-r20-student-modal="true"]',
      );
      if (!modal) return;

      const label = normalizeLower(
        [
          button.textContent,
          button.getAttribute("aria-label"),
          button.getAttribute("title"),
        ].join(" "),
      );

      if (/إضافة|اضافة|حفظ|تسجيل|إنشاء|انشاء|add|save|create/.test(label)) {
        setTimeout(
          () => requestStudentCloudSync("student-save-click"),
          800,
        );
        setTimeout(
          () => requestStudentCloudSync("student-save-confirm"),
          2600,
        );
      }
    },
    true,
  );

  window.addEventListener("resize", scheduleRun, { passive: true });
  window.addEventListener("orientationchange", scheduleRun, {
    passive: true,
  });

  run();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.__MOBDEA_R20_FIX03__ = R20_FIX03_MARKER;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, {
      once: true,
    });
  } else {
    install();
  }
}
