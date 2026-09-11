export const R20_MAPS_MARKER =
  "R20_FIX12_MAPS_RENDERING_INTERACTION_V1";

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const stateByRoot = new WeakMap();

const ROOT_SELECTORS = [
  "[data-r20-resource-kind='map']",
  "[data-map-stage]",
  ".map-stage",
  ".map-viewer",
  ".lesson-map",
  ".geography-map",
  "[class*='map-stage']",
  "[class*='map-viewer']",
  "[class*='lesson-map']",
];

const CONTENT_SELECTORS = [
  "[data-map-content]",
  ".map-content",
  ".map-canvas",
  ".map-svg",
  "svg",
];

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function point(event) {
  return { x: event.clientX, y: event.clientY };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function first(root, selectors) {
  for (const selector of selectors) {
    const item = root.querySelector(selector);
    if (item) return item;
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

function isNativeMapLibrary(root) {
  const signature = clean([
    root.className,
    root.id,
    root.querySelector(".leaflet-container")?.className,
    root.querySelector(".mapboxgl-map")?.className,
  ].filter(Boolean).join(" "));
  return /leaflet|mapboxgl|openlayers|ol-viewport/.test(signature);
}

function findRoots() {
  const roots = new Set();

  for (const selector of ROOT_SELECTORS) {
    document.querySelectorAll(selector).forEach((root) => {
      if (visible(root)) roots.add(root);
    });
  }

  document.querySelectorAll("svg").forEach((svg) => {
    const signature = clean([
      svg.className?.baseVal || svg.className,
      svg.id,
      svg.getAttribute("aria-label"),
      svg.parentElement?.className,
    ].filter(Boolean).join(" "));

    if (/map|خريطة|geograph|atlas/.test(signature)) {
      const root =
        svg.closest(
          "[data-r20-resource-kind='map'], [data-map-stage], .map-stage, .map-viewer, .lesson-map, .geography-map, [class*='map']",
        ) || svg.parentElement;
      if (root && visible(root)) roots.add(root);
    }
  });

  return [...roots];
}

function resolveContent(root) {
  if (isNativeMapLibrary(root)) return null;
  return first(root, CONTENT_SELECTORS);
}

function getState(root) {
  let state = stateByRoot.get(root);
  if (!state) {
    state = {
      scale: 1,
      x: 0,
      y: 0,
      pointers: new Map(),
      pinchStartDistance: 0,
      pinchStartScale: 1,
      pinchStartMidpoint: null,
      pinchStartX: 0,
      pinchStartY: 0,
      panStartPoint: null,
      panStartX: 0,
      panStartY: 0,
      content: null,
    };
    stateByRoot.set(root, state);
  }
  return state;
}

function naturalSize(content, scale) {
  const rect = content.getBoundingClientRect();
  const safeScale = Math.max(0.001, Number(scale) || 1);

  return {
    width: Math.max(
      1,
      content.scrollWidth || content.offsetWidth || rect.width / safeScale,
    ),
    height: Math.max(
      1,
      content.scrollHeight || content.offsetHeight || rect.height / safeScale,
    ),
  };
}

function clampPan(root, state) {
  if (!state.content || state.scale <= 1) {
    state.x = 0;
    state.y = 0;
    return;
  }

  const rect = root.getBoundingClientRect();
  const size = naturalSize(state.content, state.scale);
  const scaledWidth = size.width * state.scale;
  const scaledHeight = size.height * state.scale;
  const maxX = Math.max(0, (scaledWidth - rect.width) / 2);
  const maxY = Math.max(0, (scaledHeight - rect.height) / 2);

  state.x = clamp(state.x, -maxX, maxX);
  state.y = clamp(state.y, -maxY, maxY);
}

function renderTransform(root, state) {
  if (!state.content) return;
  clampPan(root, state);

  state.content.style.setProperty("--r20-map-scale", String(state.scale));
  state.content.style.setProperty("--r20-map-pan-x", `${state.x}px`);
  state.content.style.setProperty("--r20-map-pan-y", `${state.y}px`);

  root.setAttribute("data-r20-map-scale", state.scale.toFixed(3));
  root.setAttribute("data-r20-map-pan-x", state.x.toFixed(1));
  root.setAttribute("data-r20-map-pan-y", state.y.toFixed(1));
  root.setAttribute(
    "data-r20-map-zoomed",
    state.scale > 1.001 ? "true" : "false",
  );
}

export function resetR20MapTransform(root) {
  const state = getState(root);
  state.scale = 1;
  state.x = 0;
  state.y = 0;
  state.pointers.clear();
  state.pinchStartDistance = 0;
  state.panStartPoint = null;
  renderTransform(root, state);
}

function beginPinch(root, state) {
  const points = [...state.pointers.values()];
  if (points.length < 2) return;

  state.pinchStartDistance = Math.max(1, distance(points[0], points[1]));
  state.pinchStartScale = state.scale;
  state.pinchStartMidpoint = midpoint(points[0], points[1]);
  state.pinchStartX = state.x;
  state.pinchStartY = state.y;
  state.panStartPoint = null;
  root.setAttribute("data-r20-map-pinching", "true");
}

function updatePinch(root, state) {
  const points = [...state.pointers.values()];
  if (points.length < 2 || !state.pinchStartDistance) return;

  const nowDistance = Math.max(1, distance(points[0], points[1]));
  const nowMidpoint = midpoint(points[0], points[1]);
  const ratio = nowDistance / state.pinchStartDistance;
  const nextScale = clamp(
    state.pinchStartScale * ratio,
    MIN_SCALE,
    MAX_SCALE,
  );

  const rect = root.getBoundingClientRect();
  const startMid = state.pinchStartMidpoint || nowMidpoint;
  const focusX = startMid.x - (rect.left + rect.width / 2);
  const focusY = startMid.y - (rect.top + rect.height / 2);
  const scaleRatio =
    state.pinchStartScale > 0
      ? nextScale / state.pinchStartScale
      : 1;

  state.scale = nextScale;
  state.x =
    state.pinchStartX +
    (nowMidpoint.x - startMid.x) -
    focusX * (scaleRatio - 1);
  state.y =
    state.pinchStartY +
    (nowMidpoint.y - startMid.y) -
    focusY * (scaleRatio - 1);

  renderTransform(root, state);
}

function beginPan(state, currentPoint) {
  state.panStartPoint = currentPoint;
  state.panStartX = state.x;
  state.panStartY = state.y;
}

function updatePan(root, state, currentPoint) {
  if (!state.panStartPoint || state.scale <= 1) return;

  state.x =
    state.panStartX +
    (currentPoint.x - state.panStartPoint.x);
  state.y =
    state.panStartY +
    (currentPoint.y - state.panStartPoint.y);

  renderTransform(root, state);
}

function wireGestures(root) {
  const state = getState(root);
  const currentContent = resolveContent(root);

  if (currentContent && currentContent !== state.content) {
    state.content?.removeAttribute?.("data-r20-map-content");
    state.content = currentContent;
    state.content.setAttribute("data-r20-map-content", "true");
    renderTransform(root, state);
  }

  if (isNativeMapLibrary(root)) {
    root.setAttribute("data-r20-map-native-interaction", "true");
    return;
  }

  if (root.dataset.r20MapGesturesWired === "true") return;
  if (!state.content) return;

  root.dataset.r20MapGesturesWired = "true";

  root.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;

      state.pointers.set(event.pointerId, point(event));

      try {
        root.setPointerCapture(event.pointerId);
      } catch {}

      if (state.pointers.size === 2) {
        beginPinch(root, state);
        event.preventDefault();
      } else if (state.pointers.size === 1 && state.scale > 1) {
        beginPan(state, point(event));
        event.preventDefault();
      }
    },
    { passive: false },
  );

  root.addEventListener(
    "pointermove",
    (event) => {
      if (!state.pointers.has(event.pointerId)) return;

      state.pointers.set(event.pointerId, point(event));

      if (state.pointers.size >= 2) {
        updatePinch(root, state);
        event.preventDefault();
        return;
      }

      if (state.pointers.size === 1 && state.scale > 1) {
        updatePan(root, state, point(event));
        event.preventDefault();
      }
    },
    { passive: false },
  );

  const endPointer = (event) => {
    state.pointers.delete(event.pointerId);

    if (state.pointers.size < 2) {
      root.removeAttribute("data-r20-map-pinching");
      state.pinchStartDistance = 0;
      state.pinchStartMidpoint = null;
    }

    if (state.pointers.size === 1 && state.scale > 1) {
      beginPan(state, [...state.pointers.values()][0]);
    } else if (!state.pointers.size) {
      state.panStartPoint = null;
    }

    renderTransform(root, state);
  };

  root.addEventListener("pointerup", endPointer, { passive: true });
  root.addEventListener("pointercancel", endPointer, { passive: true });
  root.addEventListener("lostpointercapture", endPointer, { passive: true });

  root.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey && !event.metaKey) return;

      event.preventDefault();

      const factor = event.deltaY < 0 ? 1.12 : 0.89;
      const nextScale = clamp(
        state.scale * factor,
        MIN_SCALE,
        MAX_SCALE,
      );

      const rect = root.getBoundingClientRect();
      const focusX = event.clientX - (rect.left + rect.width / 2);
      const focusY = event.clientY - (rect.top + rect.height / 2);
      const ratio = nextScale / state.scale;

      state.x -= focusX * (ratio - 1);
      state.y -= focusY * (ratio - 1);
      state.scale = nextScale;

      renderTransform(root, state);
    },
    { passive: false },
  );

  root.addEventListener(
    "dblclick",
    (event) => {
      if (state.scale <= 1.001) return;
      event.preventDefault();
      resetR20MapTransform(root);
    },
    { passive: false },
  );

  renderTransform(root, state);
}

function semanticValue(element) {
  return clean([
    element.id,
    element.className?.baseVal || element.className,
    element.getAttribute?.("data-layer"),
    element.getAttribute?.("data-type"),
    element.getAttribute?.("data-feature"),
    element.getAttribute?.("aria-label"),
    element.getAttribute?.("title"),
  ].filter(Boolean).join(" "));
}

function nearBlack(value) {
  const color = clean(value).replace(/\s+/g, "");

  if (
    color === "#000" ||
    color === "#000000" ||
    color === "black" ||
    color === "rgb(0,0,0)" ||
    color === "rgba(0,0,0,1)"
  ) {
    return true;
  }

  const match = color.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  if (!match) return false;

  return match
    .slice(1)
    .map(Number)
    .every((channel) => channel <= 24);
}

function markVisualLayers(root) {
  root
    .querySelectorAll("path, polygon, polyline, rect, circle, ellipse, g")
    .forEach((element) => {
      const semantic = semanticValue(element);

      if (
        /river|water|stream|nile|نهر|النيل|مجرى/.test(semantic)
      ) {
        element.setAttribute("data-r20-map-river", "true");
      }

      if (
        /land|country|region|continent|territory|أرض|دولة|اقليم|إقليم|قارة/.test(
          semantic,
        )
      ) {
        element.setAttribute("data-r20-map-land", "true");

        const fill =
          getComputedStyle(element).fill ||
          element.getAttribute?.("fill") ||
          "";

        if (nearBlack(fill)) {
          element.setAttribute(
            "data-r20-map-land-black",
            "corrected",
          );
        }
      }
    });
}

function controlLabel(control) {
  return clean([
    control.getAttribute?.("aria-label"),
    control.getAttribute?.("title"),
    control.getAttribute?.("data-action"),
    control.textContent,
  ].filter(Boolean).join(" "));
}

function markControls(root) {
  root
    .querySelectorAll(
      "button, [role='button'], [data-action], [data-control]",
    )
    .forEach((control) => {
      const label = controlLabel(control);

      if (
        /الرموز|رموز الخريطة|symbols?|legend|مفتاح الخريطة/.test(label)
      ) {
        control.setAttribute(
          "data-r20-map-symbols-control",
          "true",
        );
      }

      if (
        /خطوط العرض|دوائر العرض|خط الاستواء|خط جرينتش|جرينتش|latitude|greenwich|longitude/.test(
          label,
        )
      ) {
        control.setAttribute(
          "data-r20-map-reference-control",
          "true",
        );
      }
    });
}

function protectSymbolsControl(root) {
  if (root.dataset.r20MapSymbolsGuard === "true") return;

  root.dataset.r20MapSymbolsGuard = "true";

  root.addEventListener(
    "click",
    (event) => {
      const control = event.target.closest?.(
        "[data-r20-map-symbols-control='true']",
      );
      if (!control) return;

      const state = getState(root);
      const before = {
        scale: state.scale,
        x: state.x,
        y: state.y,
      };

      requestAnimationFrame(() => {
        state.scale = before.scale;
        state.x = before.x;
        state.y = before.y;
        renderTransform(root, state);
      });
    },
    true,
  );
}

function markRoot(root) {
  root.setAttribute("data-r20-map-root", "true");
  markVisualLayers(root);
  markControls(root);
  protectSymbolsControl(root);
  wireGestures(root);
}

function run() {
  findRoots().forEach(markRoot);
}

export function installR20MapsRuntime() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__MOBDEA_R20_MAPS_RUNTIME__) return;

  window.__MOBDEA_R20_MAPS_RUNTIME__ = R20_MAPS_MARKER;

  window.mobdeaR20Maps = Object.freeze({
    marker: R20_MAPS_MARKER,
    resetR20MapTransform,
    minScale: MIN_SCALE,
    maxScale: MAX_SCALE,
  });

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      run();
    });
  };

  new MutationObserver(schedule).observe(
    document.documentElement,
    {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "class",
        "style",
        "fill",
        "stroke",
        "aria-label",
        "data-action",
      ],
    },
  );

  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("orientationchange", schedule, { passive: true });

  run();
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      installR20MapsRuntime,
      { once: true },
    );
  } else {
    installR20MapsRuntime();
  }
}
