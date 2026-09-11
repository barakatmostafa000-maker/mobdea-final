export const R20_PDF_GESTURE_MARKER =
  "R20_FIX07_PDF_PINCH_PAN_BOARD_OVERLAY_V2_AUDITED";

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const stateByViewport = new WeakMap();

const PDF_ROOT_SELECTORS = [
  "[data-r20-resource-kind='pdf']",
  ".pdf-viewer",
  ".pdf-stage",
  ".pdf-container",
  ".pdf-document",
  ".react-pdf__Document",
  "[data-pdf-viewer]",
  "[class*='pdf-viewer']",
  "[class*='pdf-stage']",
];

const PDF_CONTENT_SELECTORS = [
  "[data-pdf-content]",
  ".pdf-content",
  ".pdf-pages",
  ".react-pdf__Document",
  ".react-pdf__Page",
  "[class*='pdf-content']",
  "[class*='pdf-pages']",
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function pointFromEvent(event) {
  return { x: event.clientX, y: event.clientY };
}

function first(root, selectors) {
  for (const selector of selectors) {
    const found = root.querySelector(selector);
    if (found) return found;
  }
  return null;
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

function findPdfRoots(scope = document) {
  const roots = new Set();

  for (const selector of PDF_ROOT_SELECTORS) {
    scope.querySelectorAll(selector).forEach((element) => {
      if (visible(element)) roots.add(element);
    });
  }

  scope.querySelectorAll("canvas").forEach((canvas) => {
    const label = [
      canvas.className,
      canvas.id,
      canvas.getAttribute("aria-label"),
      canvas.parentElement?.className,
      canvas.closest("[class*='pdf']")?.className,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (/pdf|document|page/.test(label)) {
      roots.add(
        canvas.closest(
          "[data-r20-resource-kind='pdf'], .pdf-viewer, .pdf-stage, [class*='pdf']",
        ) || canvas.parentElement,
      );
    }
  });

  return [...roots].filter(Boolean);
}

function resolveContent(root) {
  const explicit = first(root, PDF_CONTENT_SELECTORS);
  if (explicit && explicit !== root) return explicit;

  const pages = root.querySelectorAll(
    ".react-pdf__Page, [data-page-number], canvas",
  );
  if (pages.length === 1) {
    return pages[0].parentElement || pages[0];
  }

  if (pages.length > 1) {
    const firstPage = pages[0];
    let node = firstPage.parentElement;
    while (
      node &&
      node !== root &&
      node.parentElement !== root &&
      node.querySelectorAll(
        ".react-pdf__Page, [data-page-number], canvas",
      ).length === pages.length
    ) {
      node = node.parentElement;
    }
    return node || root.firstElementChild || root;
  }

  return root.firstElementChild || root;
}

function defaultState() {
  return {
    scale: 1,
    x: 0,
    y: 0,
    pointers: new Map(),
    gestureStartDistance: 0,
    gestureStartScale: 1,
    gestureStartMidpoint: null,
    gestureStartX: 0,
    gestureStartY: 0,
    panStartPoint: null,
    panStartX: 0,
    panStartY: 0,
    content: null,
  };
}

function getState(viewport) {
  let state = stateByViewport.get(viewport);
  if (!state) {
    state = defaultState();
    stateByViewport.set(viewport, state);
  }
  return state;
}

function viewportBounds(viewport) {
  const rect = viewport.getBoundingClientRect();
  return {
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
  };
}

function contentBounds(content, scale = 1) {
  const rect = content.getBoundingClientRect();
  const safeScale = Math.max(0.001, Number(scale) || 1);
  return { width: Math.max(1, content.scrollWidth || content.offsetWidth || rect.width / safeScale), height: Math.max(1, content.scrollHeight || content.offsetHeight || rect.height / safeScale) };
}

function clampPan(viewport, state) {
  const content = state.content;
  if (!content || state.scale <= 1) {
    state.x = 0;
    state.y = 0;
    return;
  }

  const view = viewportBounds(viewport);
  const contentRect = contentBounds(content, state.scale);

  const scaledWidth = contentRect.width * state.scale;
  const scaledHeight = contentRect.height * state.scale;

  const maxX = Math.max(0, (scaledWidth - view.width) / 2);
  const maxY = Math.max(0, (scaledHeight - view.height) / 2);

  state.x = clamp(state.x, -maxX, maxX);
  state.y = clamp(state.y, -maxY, maxY);
}

function renderTransform(viewport, state) {
  if (!state.content) return;

  clampPan(viewport, state);

  state.content.style.setProperty(
    "--r20-pdf-scale",
    String(state.scale),
  );
  state.content.style.setProperty(
    "--r20-pdf-pan-x",
    `${state.x}px`,
  );
  state.content.style.setProperty(
    "--r20-pdf-pan-y",
    `${state.y}px`,
  );

  viewport.setAttribute(
    "data-r20-pdf-zoomed",
    state.scale > 1.001 ? "true" : "false",
  );
  viewport.setAttribute(
    "data-r20-pdf-scale",
    state.scale.toFixed(2),
  );

  viewport.dispatchEvent(
    new CustomEvent("mobdea:r20-pdf-transform", {
      bubbles: true,
      detail: {
        scale: state.scale,
        x: state.x,
        y: state.y,
      },
    }),
  );
}

export function resetR20PdfTransform(viewport) {
  const state = getState(viewport);
  state.scale = 1;
  state.x = 0;
  state.y = 0;
  state.gestureStartDistance = 0;
  state.gestureStartScale = 1;
  state.gestureStartMidpoint = null;
  state.panStartPoint = null;
  renderTransform(viewport, state);
}

function beginPinch(viewport, state) {
  const points = [...state.pointers.values()];
  if (points.length < 2) return;

  state.gestureStartDistance = Math.max(
    1,
    distance(points[0], points[1]),
  );
  state.gestureStartScale = state.scale;
  state.gestureStartMidpoint = midpoint(points[0], points[1]);
  state.gestureStartX = state.x;
  state.gestureStartY = state.y;
  state.panStartPoint = null;

  viewport.setAttribute("data-r20-pdf-pinching", "true");
}

function updatePinch(viewport, state) {
  const points = [...state.pointers.values()];
  if (points.length < 2 || !state.gestureStartDistance) return;

  const currentDistance = Math.max(
    1,
    distance(points[0], points[1]),
  );
  const currentMidpoint = midpoint(points[0], points[1]);

  const ratio = currentDistance / state.gestureStartDistance;
  const nextScale = clamp(
    state.gestureStartScale * ratio,
    MIN_SCALE,
    MAX_SCALE,
  );

  const viewRect = viewport.getBoundingClientRect();
  const startMid = state.gestureStartMidpoint || currentMidpoint;

  const dxMid = currentMidpoint.x - startMid.x;
  const dyMid = currentMidpoint.y - startMid.y;

  const focusX =
    startMid.x - (viewRect.left + viewRect.width / 2);
  const focusY =
    startMid.y - (viewRect.top + viewRect.height / 2);

  const scaleRatio =
    state.gestureStartScale > 0
      ? nextScale / state.gestureStartScale
      : 1;

  state.scale = nextScale;
  state.x =
    state.gestureStartX +
    dxMid -
    focusX * (scaleRatio - 1);
  state.y =
    state.gestureStartY +
    dyMid -
    focusY * (scaleRatio - 1);

  renderTransform(viewport, state);
}

function beginPan(state, point) {
  state.panStartPoint = point;
  state.panStartX = state.x;
  state.panStartY = state.y;
}

function updatePan(viewport, state, point) {
  if (!state.panStartPoint || state.scale <= 1) return;

  state.x =
    state.panStartX + (point.x - state.panStartPoint.x);
  state.y =
    state.panStartY + (point.y - state.panStartPoint.y);

  renderTransform(viewport, state);
}

function wirePointerGestures(viewport) {
  const state = getState(viewport);
  const nextContent = resolveContent(viewport);
  if (nextContent && state.content !== nextContent) { state.content?.removeAttribute?.("data-r20-pdf-content"); state.content = nextContent; state.content.setAttribute("data-r20-pdf-content", "true"); renderTransform(viewport, state); }
  if (viewport.dataset.r20PdfGesturesWired === "true") return;

  viewport.dataset.r20PdfGesturesWired = "true";
  viewport.setAttribute("data-r20-pdf-viewport", "true");

  if (!state.content) return;

  state.content.setAttribute("data-r20-pdf-content", "true");

  viewport.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      state.pointers.set(event.pointerId, pointFromEvent(event));

      try {
        viewport.setPointerCapture(event.pointerId);
      } catch {
        // Not fatal on older Android WebView.
      }

      if (state.pointers.size === 2) {
        beginPinch(viewport, state);
        event.preventDefault();
      } else if (
        state.pointers.size === 1 &&
        state.scale > 1 &&
        event.pointerType !== "mouse"
      ) {
        beginPan(state, pointFromEvent(event));
        event.preventDefault();
      }
    },
    { passive: false },
  );

  viewport.addEventListener(
    "pointermove",
    (event) => {
      if (!state.pointers.has(event.pointerId)) return;

      state.pointers.set(event.pointerId, pointFromEvent(event));

      if (state.pointers.size >= 2) {
        updatePinch(viewport, state);
        event.preventDefault();
        return;
      }

      if (state.scale > 1 && state.pointers.size === 1) {
        updatePan(viewport, state, pointFromEvent(event));
        event.preventDefault();
      }
    },
    { passive: false },
  );

  const endPointer = (event) => {
    state.pointers.delete(event.pointerId);

    if (state.pointers.size < 2) {
      viewport.removeAttribute("data-r20-pdf-pinching");
      state.gestureStartDistance = 0;
      state.gestureStartMidpoint = null;
    }

    if (state.pointers.size === 1 && state.scale > 1) {
      const remaining = [...state.pointers.values()][0];
      beginPan(state, remaining);
    } else if (!state.pointers.size) {
      state.panStartPoint = null;
    }

    renderTransform(viewport, state);
  };

  viewport.addEventListener("pointerup", endPointer, {
    passive: true,
  });
  viewport.addEventListener("pointercancel", endPointer, {
    passive: true,
  });
  viewport.addEventListener("lostpointercapture", endPointer, {
    passive: true,
  });

  viewport.addEventListener(
    "dblclick",
    (event) => {
      if (state.scale <= 1.001) return;
      event.preventDefault();
      resetR20PdfTransform(viewport);
    },
    { passive: false },
  );

  viewport.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();

      const factor = event.deltaY < 0 ? 1.12 : 0.89;
      const next = clamp(
        state.scale * factor,
        MIN_SCALE,
        MAX_SCALE,
      );

      const rect = viewport.getBoundingClientRect();
      const focusX =
        event.clientX - (rect.left + rect.width / 2);
      const focusY =
        event.clientY - (rect.top + rect.height / 2);
      const ratio = next / state.scale;

      state.x -= focusX * (ratio - 1);
      state.y -= focusY * (ratio - 1);
      state.scale = next;
      renderTransform(viewport, state);
    },
    { passive: false },
  );

  renderTransform(viewport, state);
}

function isBoardToolsControl(element) {
  if (!element) return false;
  if (element.matches?.('[data-r20-control="board-tools"]')) return true;

  const label = [
    element.getAttribute?.("aria-label"),
    element.getAttribute?.("title"),
    element.textContent,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return /أدوات السبورة|ادوات السبورة|whiteboard tools|board tools/.test(
    label,
  );
}

function nearestPdfRoot(element) {
  for (const selector of PDF_ROOT_SELECTORS) {
    const found = element?.closest?.(selector);
    if (found) return found;
  }
  return findPdfRoots(document)[0] || null;
}

function markBoardOverlay(root) {
  if (!root) return;

  root.setAttribute("data-r20-pdf-board-mode", "true");

  const candidates = document.querySelectorAll(
    ".whiteboard-overlay, .board-overlay, [class*='whiteboard'][class*='overlay'], [class*='board'][class*='overlay'], canvas[class*='whiteboard'], canvas[class*='board']",
  );

  candidates.forEach((element) => {
    const rect = element.getBoundingClientRect?.();
    if (!rect) return;
    const rootRect = root.getBoundingClientRect();

    const intersects =
      rect.right >= rootRect.left &&
      rect.left <= rootRect.right &&
      rect.bottom >= rootRect.top &&
      rect.top <= rootRect.bottom;

    if (!intersects) return;

    element.setAttribute("data-r20-pdf-board-overlay", "true");
  });
}

function protectPdfVisibility(root) {
  if (!root) return;

  root
    .querySelectorAll(
      "canvas, img, .react-pdf__Page, [data-page-number], [class*='pdf-page']",
    )
    .forEach((element) => {
      element.setAttribute("data-r20-pdf-page-visible", "true");
    });
}

function wireBoardOverlayGuard() {
  if (document.documentElement.dataset.r20PdfBoardGuard === "true") {
    return;
  }

  document.documentElement.dataset.r20PdfBoardGuard = "true";

  document.addEventListener(
    "click",
    (event) => {
      const control = event.target.closest?.(
        'button, [role="button"], [data-r20-control="board-tools"]',
      );
      if (!isBoardToolsControl(control)) return;

      const root = nearestPdfRoot(control);
      if (!root) return;

      protectPdfVisibility(root);

      requestAnimationFrame(() => {
        protectPdfVisibility(root);
        markBoardOverlay(root);
      });

      setTimeout(() => {
        protectPdfVisibility(root);
        markBoardOverlay(root);
      }, 80);
    },
    true,
  );

  window.addEventListener("error", () => {
    findPdfRoots(document).forEach((root) => {
      if (root.getAttribute("data-r20-pdf-board-mode") === "true") {
        protectPdfVisibility(root);
      }
    });
  });
}

function markPager() {
  document
    .querySelectorAll(
      ".classmode-page-nav, [class*='page-nav'], [class*='pager'], [data-r20-pager='true']",
    )
    .forEach((element) => {
      const label = [
        element.getAttribute("aria-label"),
        element.textContent,
        element.className,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (/page|pager|صفحة|الصفحة|التالي|السابق|^\s*\d+\s*$/.test(label)) {
        element.setAttribute("data-r20-pdf-pager", "true");
      }
    });
}

export function installR20PdfGestures() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  if (window.__MOBDEA_R20_PDF_GESTURES__) return;
  window.__MOBDEA_R20_PDF_GESTURES__ = R20_PDF_GESTURE_MARKER;

  const run = () => {
    findPdfRoots(document).forEach((root) => {
      wirePointerGestures(root);
      protectPdfVisibility(root);
    });
    markPager();
  };

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      run();
    });
  };

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "aria-label"],
  });

  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("orientationchange", schedule, {
    passive: true,
  });

  wireBoardOverlayGuard();
  run();
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      installR20PdfGestures,
      { once: true },
    );
  } else {
    installR20PdfGestures();
  }
}
