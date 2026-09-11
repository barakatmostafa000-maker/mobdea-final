const R20_MARKER = "R20_FIX01_CORE_RUNTIME_V1";

const norm = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

function classModeRoot() {
  return document.querySelector(
    ".classmode-v103, .classmode-page, .lesson-mode-shell",
  );
}

function visible(element) {
  if (!element) return false;
  const style = getComputedStyle(element);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    element.getClientRects().length > 0
  );
}

function elementLabel(element) {
  return norm(
    [
      element?.getAttribute?.("aria-label"),
      element?.getAttribute?.("title"),
      element?.textContent,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function classifyControls(root) {
  if (!root) return;

  const controls = [
    ...root.querySelectorAll(
      'button, [role="button"], a[class*="button"], a[class*="btn"]',
    ),
  ];
  const studentButtons = [];

  for (const control of controls) {
    const label = elementLabel(control);

    if (/عودة الحصة|العودة للحصة|رجوع للحصة/.test(label)) {
      control.classList.add("r20-return-control");
      control.setAttribute("aria-label", "عودة للحصة");
      control.setAttribute("title", "عودة للحصة");
    }

    if (/^حفظ$| حفظ |حفظ السبورة|حفظ الصفحة/.test(` ${label} `)) {
      control.classList.add("r20-save-control");
      control.setAttribute("aria-label", "حفظ");
    }

    if (/إدارة طالب|إدارة الطلاب|قائمة الطلاب/.test(label)) {
      control.classList.add("r20-student-control");
      studentButtons.push(control);
    }

    if (/الحصة الأونلاين|الحصة الاونلاين|online lesson|online class/.test(label)) {
      control.classList.add("r20-online-floating-control");
    }

    if (/أدوات السبورة|ادوات السبورة|board tools|whiteboard tools/.test(label)) {
      control.classList.add("r20-board-tools-control");
      control.setAttribute("aria-label", "أدوات السبورة");
    }

    if (/^البطاقات$|^بطاقات$|الكروت|cards/.test(label)) {
      control.classList.add("r20-cards-control");
      control.setAttribute("aria-label", "البطاقات");
    }
  }

  studentButtons
    .filter((button) => visible(button))
    .slice(1)
    .forEach((button) =>
      button.classList.add("r20-duplicate-student-control"),
    );

  root
    .querySelectorAll(".classmode-page-nav, [class*='page-nav']")
    .forEach((element) =>
      element.setAttribute("data-r20-page-nav", "true"),
    );

  root
    .querySelectorAll(
      ".classmode-students-list, .r19-split-source, [class*='student-list']",
    )
    .forEach((element) =>
      element.setAttribute("data-r20-scroll", "students"),
    );

  for (const dialog of root.querySelectorAll(
    'dialog, [role="dialog"], .modal, [class*="dialog"], [class*="modal"]',
  )) {
    const label = elementLabel(dialog);
    if (
      /اختيار عشوائي|الاختيار العشوائي/.test(label) &&
      !dialog.closest(".r20-random-picker")
    ) {
      dialog.classList.add("r20-old-random-dialog");
    }
  }
}

function scrubInternalOcrPath(root = document.body) {
  if (!root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  for (const node of nodes) {
    const text = String(node.nodeValue || "");
    if (
      /(?:^|[/\\])tess304[/\\]/i.test(text) ||
      /\b(?:ara|eng)\.traineddata\b/i.test(text)
    ) {
      node.nodeValue = text.replace(
        /(?:[\w.-]+[/\\])*tess304[/\\][\w.-]+|(?:ara|eng)\.traineddata/gi,
        "OCR العربي",
      );
    }
  }
}

let audioContext = null;

async function unlockTabletMedia() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      if (!audioContext) audioContext = new AudioCtx();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
    }
  } catch {
    // Native audio/TTS remains available.
  }

  try {
    window.speechSynthesis?.resume?.();
  } catch {
    // No-op.
  }

  document.dispatchEvent(
    new CustomEvent("mobdea:r20-media-unlocked", {
      detail: { marker: R20_MARKER },
    }),
  );
}

export async function r20SpeakArabic(text) {
  const safe = String(text || "").trim();
  if (!safe) return false;

  await unlockTabletMedia();

  try {
    const plugins = globalThis.Capacitor?.Plugins || {};
    const nativeTts =
      plugins.MobdeaTextToSpeech ||
      plugins.MobdeaTTS ||
      plugins.TextToSpeech;

    if (nativeTts?.speak) {
      await nativeTts.speak({
        text: safe,
        language: "ar-EG",
        lang: "ar-EG",
        rate: 0.92,
      });
      return true;
    }
  } catch {
    // Fall back to browser TTS.
  }

  try {
    if ("speechSynthesis" in window && "SpeechSynthesisUtterance" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(safe);
      utterance.lang = "ar-EG";
      utterance.rate = 0.92;
      window.speechSynthesis.speak(utterance);
      return true;
    }
  } catch {
    // No-op.
  }

  return false;
}

function installRuntime() {
  if (typeof document === "undefined") return;

  const run = () => {
    const root = classModeRoot();
    if (root) classifyControls(root);
    scrubInternalOcrPath(document.body);
  };

  for (const eventName of ["pointerdown", "touchend", "keydown"]) {
    document.addEventListener(eventName, unlockTabletMedia, {
      capture: true,
      passive: true,
    });
  }

  window.addEventListener("error", (event) => {
    try {
      sessionStorage.setItem(
        "mobdea:r20:last-runtime-error",
        JSON.stringify({
          message: String(event?.message || "Runtime error"),
          source: String(event?.filename || ""),
          line: Number(event?.lineno || 0),
          at: new Date().toISOString(),
        }),
      );
    } catch {
      // Diagnostics must never crash the UI.
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    try {
      sessionStorage.setItem(
        "mobdea:r20:last-runtime-rejection",
        JSON.stringify({
          message: String(event?.reason?.message || event?.reason || "Promise rejection"),
          at: new Date().toISOString(),
        }),
      );
    } catch {
      // Diagnostics must never crash the UI.
    }
  });

  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      run();
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  run();
}

if (typeof window !== "undefined") {
  window.__MOBDEA_R20_FIX01__ = R20_MARKER;
  window.mobdeaR20SpeakArabic = r20SpeakArabic;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installRuntime, {
      once: true,
    });
  } else {
    installRuntime();
  }
}
