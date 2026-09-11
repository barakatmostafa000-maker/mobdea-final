const R20_FIX02_MARKER = "R20_FIX02_UNIFIED_CLASSMODE_LAYOUT_V1";

const normalize = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const CLASSMODE_ROOT_SELECTORS = [
  ".classmode-v103",
  ".classmode-page",
  ".lesson-mode-shell",
  "[class*='class-mode']",
  "[class*='classmode']",
];

const STAGE_SELECTORS = [
  ".classmode-viewport-stage",
  ".classmode-main",
  ".classmode-content",
  ".classmode-stage",
  ".classmode-resource-area",
  ".classmode-media-stage",
  ".classmode-whiteboard-stage",
  ".lesson-content",
  ".resource-stage",
];

function firstExisting(root, selectors) {
  for (const selector of selectors) {
    const found = root.querySelector(selector);
    if (found) return found;
  }
  return null;
}

function getRoot() {
  for (const selector of CLASSMODE_ROOT_SELECTORS) {
    const root = document.querySelector(selector);
    if (root) return root;
  }
  return null;
}

function labelOf(element) {
  return normalize(
    [
      element?.getAttribute?.("aria-label"),
      element?.getAttribute?.("title"),
      element?.textContent,
    ]
      .filter(Boolean)
      .join(" "),
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

function classifyResource(element) {
  if (!element) return null;

  const cls = normalize(element.className);
  const id = normalize(element.id);
  const label = normalize(
    [
      cls,
      id,
      element.getAttribute?.("data-type"),
      element.getAttribute?.("data-mode"),
      element.getAttribute?.("aria-label"),
    ].join(" "),
  );

  if (/pdf|document|viewer/.test(label)) return "pdf";
  if (/whiteboard|board|سبورة/.test(label)) return "whiteboard";
  if (/powerpoint|pptx|\bppt\b|presentation/.test(label)) return "powerpoint";
  if (/video|youtube/.test(label)) return "video";
  if (/audio|sound|صوت/.test(label)) return "audio";
  if (/map|atlas|خريطة|خرائط/.test(label)) return "map";
  if (/game|challenge|لعبة|العاب|ألعاب/.test(label)) return "game";
  if (/image|photo|صورة|صور/.test(label)) return "image";

  if (element.querySelector?.("video")) return "video";
  if (element.querySelector?.("audio")) return "audio";
  if (element.querySelector?.("iframe[src*='.ppt'], iframe[src*='office']")) {
    return "powerpoint";
  }

  return null;
}

function markResourceNodes(root) {
  const selectors = [
    ".pdf-viewer",
    ".pdf-stage",
    ".whiteboard-shell",
    ".whiteboard-stage",
    ".board-stage",
    ".image-viewer",
    ".media-image",
    ".video-player",
    ".audio-player",
    ".powerpoint-viewer",
    ".ppt-viewer",
    ".map-shell",
    ".map-stage",
    ".atlas",
    ".map-challenge-pro",
    ".game-shell",
    ".classmode-game",
    "[data-resource-type]",
    "[data-media-type]",
    "[data-viewer-type]",
  ];

  for (const element of root.querySelectorAll(selectors.join(","))) {
    const kind = classifyResource(element);
    if (kind) element.setAttribute("data-r20-resource-kind", kind);
  }

  const stage = firstExisting(root, STAGE_SELECTORS) || root;
  stage.setAttribute("data-r20-classmode-stage", "true");

  let content =
    firstExisting(stage, [
      ".classmode-content-inner",
      ".resource-content",
      ".media-content",
      ".viewer-content",
    ]) || stage.firstElementChild;

  if (content && content !== stage) {
    content.setAttribute("data-r20-classmode-content", "true");
  }
}

function classifyControls(root) {
  const controls = [
    ...root.querySelectorAll(
      'button, [role="button"], a[class*="button"], a[class*="btn"]',
    ),
  ];

  const studentControls = [];

  for (const control of controls) {
    const label = labelOf(control);

    if (/عودة الحصة|العودة للحصة|رجوع للحصة|back to lesson/.test(label)) {
      control.setAttribute("data-r20-control", "back");
      control.setAttribute("aria-label", "عودة للحصة");
      control.setAttribute("title", "عودة للحصة");
      continue;
    }

    if (/إدارة الطلاب|إدارة طالب|قائمة الطلاب|students/.test(label)) {
      control.setAttribute("data-r20-control", "students");
      studentControls.push(control);
      continue;
    }

    if (/^حفظ$|حفظ السبورة|حفظ الصفحة|save/.test(label)) {
      control.setAttribute("data-r20-control", "save");
      control.setAttribute("aria-label", "حفظ");
      continue;
    }

    if (/أدوات السبورة|ادوات السبورة|whiteboard tools|board tools/.test(label)) {
      control.setAttribute("data-r20-control", "board-tools");
      control.setAttribute("aria-label", "أدوات السبورة");
      continue;
    }

    if (/^البطاقات$|^بطاقات$|الكروت|cards/.test(label)) {
      control.setAttribute("data-r20-control", "cards");
      control.setAttribute("aria-label", "البطاقات");
      continue;
    }

    if (/الرموز|رموز الخرائط|symbols/.test(label)) {
      control.setAttribute("data-r20-control", "symbols");
      control.setAttribute("aria-label", "الرموز");
      continue;
    }

    if (/الحصة الأونلاين|الحصة الاونلاين|online lesson|online class/.test(label)) {
      control.setAttribute("data-r20-control", "online-floating");
    }
  }

  studentControls
    .filter((element) => isVisible(element))
    .slice(1)
    .forEach((element) =>
      element.setAttribute("data-r20-duplicate-control", "true"),
    );

  for (const pager of root.querySelectorAll(
    ".classmode-page-nav, [class*='page-nav'], [class*='pager']",
  )) {
    pager.setAttribute("data-r20-pager", "true");
  }
}

function runFix02Layout() {
  const root = getRoot();
  if (!root) return;

  root.setAttribute("data-r20-classmode-root", "true");
  classifyControls(root);
  markResourceNodes(root);
}

function installFix02() {
  if (typeof document === "undefined") return;

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      runFix02Layout();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "aria-label", "title"],
  });

  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("orientationchange", schedule, { passive: true });

  runFix02Layout();
}

if (typeof window !== "undefined") {
  window.__MOBDEA_R20_FIX02__ = R20_FIX02_MARKER;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installFix02, {
      once: true,
    });
  } else {
    installFix02();
  }
}
