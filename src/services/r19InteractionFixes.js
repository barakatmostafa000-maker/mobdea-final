const POS_PREFIX = "mobdea:r19:drag:";

let observer = null;
let intervalHandle = null;
let scheduled = false;

function classModeRoot() {
  return document.querySelector(
    ".classmode-v103, .classmode-page, .lesson-mode-shell",
  );
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

function savePosition(key, x, y) {
  try {
    localStorage.setItem(POS_PREFIX + key, JSON.stringify({ x, y }));
  } catch {}
}

function readPosition(key) {
  try {
    const value = JSON.parse(localStorage.getItem(POS_PREFIX + key) || "null");
    if (Number.isFinite(value?.x) && Number.isFinite(value?.y)) return value;
  } catch {}
  return null;
}

function makeDraggable(element, key) {
  if (!element || element.dataset.r19Draggable === "1") return;
  element.dataset.r19Draggable = "1";

  const restored = readPosition(key);
  if (restored) {
    element.style.position = "fixed";
    element.style.left = `${Math.max(4, restored.x)}px`;
    element.style.top = `${Math.max(4, restored.y)}px`;
    element.style.right = "auto";
    element.style.bottom = "auto";
    element.style.transform = "none";
  }

  let drag = null;
  element.addEventListener("pointerdown", (event) => {
    if (event.button != null && event.button !== 0) return;
    const rect = element.getBoundingClientRect();
    drag = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      moved: false,
    };
    try {
      element.setPointerCapture?.(event.pointerId);
    } catch {}
  });

  element.addEventListener(
    "pointermove",
    (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;

      const maxX = Math.max(4, innerWidth - element.offsetWidth - 4);
      const maxY = Math.max(4, innerHeight - element.offsetHeight - 4);
      const x = Math.max(4, Math.min(maxX, drag.left + dx));
      const y = Math.max(4, Math.min(maxY, drag.top + dy));

      Object.assign(element.style, {
        position: "fixed",
        left: `${x}px`,
        top: `${y}px`,
        right: "auto",
        bottom: "auto",
        transform: "none",
      });
      event.preventDefault();
    },
    { passive: false },
  );

  element.addEventListener(
    "pointerup",
    (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      if (drag.moved) {
        const rect = element.getBoundingClientRect();
        savePosition(key, rect.left, rect.top);
        element.dataset.r19DraggedAt = String(Date.now());
        event.preventDefault();
        event.stopPropagation();
      }
      drag = null;
    },
    true,
  );

  element.addEventListener(
    "click",
    (event) => {
      const last = Number(element.dataset.r19DraggedAt || 0);
      if (last && Date.now() - last < 350) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
}

function findStudentToggle() {
  const root = classModeRoot();
  if (!root) return null;
  return root.querySelector(
    '.classmode-management-toggle, [data-testid="classmode-students-toggle"], button[aria-label*="الطلاب"]',
  );
}

function cleanupFloatingUi() {
  document.querySelector(".r19-students-toggle-mirror")?.remove();
  document.querySelector(".r19-students-left-panel")?.remove();
  document.querySelector(".r19-quick-board-save")?.remove();

  document
    .querySelectorAll(".classmode-student-row.r19-second-half")
    .forEach((row) => {
      row.classList.remove("r19-second-half");
      row.style.removeProperty("order");
    });

  document
    .querySelectorAll(".classmode-students-list.r19-split-source")
    .forEach((list) => list.classList.remove("r19-split-source"));
}

function ensureMirrorToggle() {
  const root = classModeRoot();
  const original = findStudentToggle();
  let mirror = document.querySelector(".r19-students-toggle-mirror");

  if (!root || !original) {
    mirror?.remove();
    return;
  }

  makeDraggable(original, "students-right");

  if (!mirror) {
    mirror = document.createElement("button");
    mirror.type = "button";
    mirror.className = "r19-students-toggle-mirror";
    mirror.setAttribute("aria-label", "الطلاب - الجانب الأيسر");
    mirror.title = "الطلاب — اسحب الأيقونة للمكان المناسب";
    mirror.innerHTML = original.innerHTML || '<span aria-hidden="true">👥</span>';
    mirror.addEventListener("click", () => {
      const target = findStudentToggle();
      if (target) target.click();
    });
    document.body.appendChild(mirror);
    makeDraggable(mirror, "students-left");
  }
}

function studentName(row) {
  return (
    row.querySelector(".classmode-student-row-main strong")?.textContent ||
    row.querySelector("strong")?.textContent ||
    row.textContent ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

function rowIdentity(row) {
  return String(row?.dataset?.studentId || studentName(row) || "").trim();
}

function ensureLeftStudentPanel() {
  if (!classModeRoot()) return null;

  let panel = document.querySelector(".r19-students-left-panel");
  if (panel) return panel;

  panel = document.createElement("aside");
  panel.className = "r19-students-left-panel";
  panel.setAttribute("aria-label", "النصف الثاني من الطلاب");
  panel.innerHTML =
    '<strong>الطلاب — الجزء الثاني</strong><div class="r19-students-left-list"></div>';
  document.body.appendChild(panel);
  return panel;
}

function rowActionSignature(row) {
  const buttons = [...row.querySelectorAll("button")].map((button) => [
    button.textContent?.replace(/\s+/g, " ").trim() || "",
    button.className || "",
    button.disabled ? "1" : "0",
    button.getAttribute("aria-label") || "",
  ]);
  return JSON.stringify({
    id: rowIdentity(row),
    name: studentName(row),
    className: String(row.className || "").replace(/\br19-second-half\b/g, ""),
    buttons,
  });
}

function proxyCloneRow(source, index) {
  const clone = source.cloneNode(true);
  clone.classList.remove("r19-second-half");
  clone.style.removeProperty("order");
  clone.classList.add("r19-proxy-row");

  const sourceIdentity = rowIdentity(source);
  clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  clone.querySelectorAll("[data-testid]").forEach((node) => {
    node.dataset.testid = `r19-proxy-${index}-${node.dataset.testid}`;
  });

  [...clone.querySelectorAll("button")].forEach((button, buttonIndex) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const liveRoot = classModeRoot();
      const liveRows = liveRoot
        ? [
            ...liveRoot.querySelectorAll(
              ".classmode-students-list > .classmode-student-row",
            ),
          ]
        : [];
      const liveRow = liveRows.find(
        (row) => rowIdentity(row) === sourceIdentity,
      );
      const target = liveRow?.querySelectorAll("button")?.[buttonIndex];

      if (target && !target.disabled) target.click();
      setTimeout(scheduleSync, 70);
    });
  });

  return clone;
}

function resetSourceRoster(list) {
  list?.classList.remove("r19-split-source");
  list?.querySelectorAll(".classmode-student-row").forEach((row) => {
    row.classList.remove("r19-second-half");
    row.style.removeProperty("order");
  });
}

function syncStudentPanels() {
  const root = classModeRoot();
  const existingMirrorPanel = document.querySelector(".r19-students-left-panel");

  if (!root) {
    cleanupFloatingUi();
    return;
  }

  const sourceList = root.querySelector(".classmode-students-list");
  const sourcePanel = sourceList?.closest(
    ".classmode-management-panel, .classmode-students-panel, aside",
  );

  if (!sourceList || !sourcePanel || !isVisible(sourcePanel)) {
    existingMirrorPanel?.classList.remove("open");
    resetSourceRoster(sourceList);
    return;
  }

  const rows = [...sourceList.querySelectorAll(":scope > .classmode-student-row")];
  if (!rows.length) {
    existingMirrorPanel?.classList.remove("open");
    return;
  }

  const sortedRows = [...rows].sort((a, b) =>
    studentName(a).localeCompare(studentName(b), "ar", {
      sensitivity: "base",
      numeric: true,
    }),
  );

  const half = Math.ceil(sortedRows.length / 2);
  sourceList.classList.add("r19-split-source");

  sortedRows.forEach((row, index) => {
    row.style.order = String(index);
    row.classList.toggle("r19-second-half", index >= half);
  });

  const mirrorPanel = ensureLeftStudentPanel();
  if (!mirrorPanel) return;

  const leftList = mirrorPanel.querySelector(".r19-students-left-list");
  const signature = sortedRows
    .slice(half)
    .map(rowActionSignature)
    .join("||");

  if (leftList.dataset.r19RosterSignature !== signature) {
    leftList.replaceChildren(
      ...sortedRows.slice(half).map((row, index) => proxyCloneRow(row, index)),
    );
    leftList.dataset.r19RosterSignature = signature;
  }

  mirrorPanel.classList.toggle("open", sortedRows.length > 1);
}

function findBoardSaveTarget() {
  const root = classModeRoot();
  if (!root) return null;

  return [...root.querySelectorAll("button")].find((button) => {
    if (button.classList.contains("r19-quick-board-save")) return false;
    const text = (button.textContent || "").replace(/\s+/g, " ").trim();
    const testid = button.getAttribute("data-testid") || "";
    return (
      /حفظ (السبورة|طبقة الكتابة)|حفظ السبوره/.test(text) ||
      /save.*board|board.*save/i.test(testid)
    );
  });
}

function ensureQuickSave() {
  let quick = document.querySelector(".r19-quick-board-save");
  const root = classModeRoot();
  const target = root ? findBoardSaveTarget() : null;

  if (!root) {
    quick?.remove();
    return;
  }

  if (!quick) {
    quick = document.createElement("button");
    quick.type = "button";
    quick.className = "r19-quick-board-save";
    quick.innerHTML = '<b aria-hidden="true">💾</b><span>حفظ</span>';
    quick.title = "حفظ السبورة الحالية";
    quick.addEventListener("click", () => {
      const save = findBoardSaveTarget();
      if (save) save.click();
    });
    document.body.appendChild(quick);
    makeDraggable(quick, "board-save");
  }

  quick.style.display = target ? "grid" : "none";
}

function hardenPhraseButtons() {
  const root = classModeRoot();
  if (!root) return;

  root
    .querySelectorAll(".student-row-phrase-btn, .classmode-command-buttons button")
    .forEach((button) => {
      button.style.pointerEvents = "auto";
      button.style.touchAction = "manipulation";
    });
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    if (!classModeRoot()) {
      cleanupFloatingUi();
      return;
    }
    ensureMirrorToggle();
    ensureQuickSave();
    hardenPhraseButtons();
    syncStudentPanels();
  });
}

function shouldIgnoreMutation(mutation) {
  const target = mutation.target;
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      ".r19-students-left-panel, .r19-students-toggle-mirror, .r19-quick-board-save",
    ),
  );
}

export function installR19InteractionFixes() {
  if (globalThis.__mobdeaR19InteractionFixesInstalled) return;
  globalThis.__mobdeaR19InteractionFixesInstalled = true;

  const start = () => {
    observer = new MutationObserver((mutations) => {
      if (mutations.length && mutations.every(shouldIgnoreMutation)) return;
      scheduleSync();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    intervalHandle = setInterval(() => {
      if (classModeRoot()) scheduleSync();
      else if (
        document.querySelector(
          ".r19-students-toggle-mirror, .r19-students-left-panel, .r19-quick-board-save",
        )
      ) {
        cleanupFloatingUi();
      }
    }, 1200);

    window.addEventListener("resize", scheduleSync, { passive: true });
    window.addEventListener("orientationchange", scheduleSync, { passive: true });
    scheduleSync();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}

installR19InteractionFixes();
