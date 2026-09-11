export const R20_WHITEBOARD_MARKER =
  "R20_FIX09_WHITEBOARD_RENDERING_LAYOUT_V1";

const ROOT_SELECTORS = [
  "[data-r20-resource-kind='whiteboard']",
  ".whiteboard-page",
  ".whiteboard-stage",
  ".whiteboard-container",
  "[data-whiteboard]",
  "[class*='whiteboard']",
];

const stateByCanvas = new WeakMap();
let currentTool = "pen";
let currentWidth = "medium";
let currentLineStyle = "solid";
let installed = false;

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeWhiteboardTool(label = "") {
  const text = clean(label);

  if (/highlighter|marker|هايلايتر|محدد|ماركر/.test(text)) {
    return "marker";
  }
  if (/brush|فرشاة|فرشاه/.test(text)) {
    return "brush";
  }
  if (/pencil|رصاص/.test(text)) {
    return "pencil";
  }
  if (/eraser|ممحاة|مسح/.test(text)) {
    return "eraser";
  }
  if (/line|خط مستقيم|مستقيم/.test(text)) {
    return "line";
  }
  if (/pen|قلم/.test(text)) {
    return "pen";
  }

  return null;
}

export function normalizeWhiteboardWidth(label = "") {
  const text = clean(label);

  if (/رفيع|thin|small|صغير|1px|2px|3px/.test(text)) {
    return "thin";
  }
  if (/عريض جدًا|عريض جدا|extra wide|very thick|xl|20px|24px/.test(text)) {
    return "extra-wide";
  }
  if (/عريض|thick|wide|كبير|12px|14px|16px/.test(text)) {
    return "wide";
  }
  if (/متوسط|medium|normal|6px|8px|10px/.test(text)) {
    return "medium";
  }

  const numeric = Number(text.match(/(\d+(?:\.\d+)?)\s*(?:px)?/)?.[1]);
  if (Number.isFinite(numeric)) {
    if (numeric <= 3) return "thin";
    if (numeric <= 10) return "medium";
    if (numeric <= 18) return "wide";
    return "extra-wide";
  }

  return null;
}

export function normalizeWhiteboardLineStyle(label = "") {
  const text = clean(label);

  if (/dotted|dots?|منقط|نقط/.test(text)) {
    return "dotted";
  }
  if (/dashed|dash|متقطع|شرط/.test(text)) {
    return "dashed";
  }
  if (/solid|متصل|عادي/.test(text)) {
    return "solid";
  }

  return null;
}

export function whiteboardStrokeProfile(
  tool = "pen",
  width = "medium",
  lineStyle = "solid",
) {
  const widthBase = {
    thin: 2,
    medium: 6,
    wide: 13,
    "extra-wide": 22,
  }[width] || 6;

  const toolProfile = {
    pen: {
      widthMultiplier: 1,
      alpha: 1,
      cap: "round",
      join: "round",
      composite: "source-over",
      shadowBlur: 0,
    },
    pencil: {
      widthMultiplier: 0.72,
      alpha: 0.72,
      cap: "round",
      join: "round",
      composite: "source-over",
      shadowBlur: 0,
    },
    brush: {
      widthMultiplier: 1.65,
      alpha: 0.86,
      cap: "round",
      join: "round",
      composite: "source-over",
      shadowBlur: 1.4,
    },
    marker: {
      widthMultiplier: 2.15,
      alpha: 0.34,
      cap: "square",
      join: "round",
      composite: "source-over",
      shadowBlur: 0,
    },
    line: {
      widthMultiplier: 1,
      alpha: 1,
      cap: "butt",
      join: "miter",
      composite: "source-over",
      shadowBlur: 0,
    },
    eraser: {
      widthMultiplier: 2.35,
      alpha: 1,
      cap: "round",
      join: "round",
      composite: "destination-out",
      shadowBlur: 0,
    },
  }[tool] || {
    widthMultiplier: 1,
    alpha: 1,
    cap: "round",
    join: "round",
    composite: "source-over",
    shadowBlur: 0,
  };

  const lineWidth = Math.max(
    1,
    widthBase * toolProfile.widthMultiplier,
  );

  const dash =
    lineStyle === "dotted"
      ? [Math.max(1, lineWidth * 0.3), lineWidth * 1.8]
      : lineStyle === "dashed"
        ? [lineWidth * 2.2, lineWidth * 1.4]
        : [];

  return {
    tool,
    width,
    lineStyle,
    lineWidth,
    globalAlpha: toolProfile.alpha,
    lineCap: toolProfile.cap,
    lineJoin: toolProfile.join,
    globalCompositeOperation: toolProfile.composite,
    shadowBlur: toolProfile.shadowBlur,
    lineDash: dash,
  };
}

function rootFor(element) {
  if (!element) return null;

  for (const selector of ROOT_SELECTORS) {
    const root = element.closest?.(selector);
    if (root) return root;
  }

  const canvas = element.closest?.("canvas");
  return canvas?.parentElement || null;
}

function likelyWhiteboardRoot(element) {
  if (!element) return false;

  if (element.matches?.("[data-r20-resource-kind='whiteboard']")) {
    return true;
  }

  const signature = clean([
    element.className,
    element.id,
    element.getAttribute?.("aria-label"),
    element.getAttribute?.("data-mode"),
  ].filter(Boolean).join(" "));

  if (/whiteboard|سبورة|board/.test(signature)) return true;

  const text = clean(element.textContent);
  return (
    /أدوات السبورة|ادوات السبورة|whiteboard tools/.test(text) &&
    Boolean(element.querySelector("canvas"))
  );
}

function findRoots() {
  const roots = new Set();

  for (const selector of ROOT_SELECTORS) {
    document.querySelectorAll(selector).forEach((root) => {
      if (likelyWhiteboardRoot(root)) roots.add(root);
    });
  }

  document.querySelectorAll("canvas").forEach((canvas) => {
    const root =
      canvas.closest(
        "[data-r20-resource-kind='whiteboard'], [class*='whiteboard'], [data-whiteboard]",
      ) ||
      canvas.parentElement;

    if (root && likelyWhiteboardRoot(root)) {
      roots.add(root);
    }
  });

  return [...roots];
}

function canvasState(canvas) {
  let state = stateByCanvas.get(canvas);
  if (!state) {
    state = {
      tool: currentTool,
      width: currentWidth,
      lineStyle: currentLineStyle,
    };
    stateByCanvas.set(canvas, state);
  }
  return state;
}

function applyStateToCanvas(canvas) {
  const state = canvasState(canvas);
  state.tool = currentTool;
  state.width = currentWidth;
  state.lineStyle = currentLineStyle;

  canvas.dataset.r20WhiteboardTool = state.tool;
  canvas.dataset.r20WhiteboardWidth = state.width;
  canvas.dataset.r20WhiteboardLineStyle = state.lineStyle;
}

function labelFor(control) {
  return clean([
    control.getAttribute?.("aria-label"),
    control.getAttribute?.("title"),
    control.getAttribute?.("data-tool"),
    control.getAttribute?.("data-brush"),
    control.getAttribute?.("data-width"),
    control.getAttribute?.("data-size"),
    control.getAttribute?.("data-style"),
    control.textContent,
  ].filter(Boolean).join(" "));
}

function handleToolControl(control) {
  const label = labelFor(control);

  const tool = normalizeWhiteboardTool(label);
  const width = normalizeWhiteboardWidth(label);
  const lineStyle = normalizeWhiteboardLineStyle(label);

  if (tool) currentTool = tool;
  if (width) currentWidth = width;
  if (lineStyle) currentLineStyle = lineStyle;

  findRoots().forEach((root) => {
    root.querySelectorAll("canvas").forEach(applyStateToCanvas);
  });

  if (tool || width || lineStyle) {
    document.dispatchEvent(
      new CustomEvent("mobdea:r20-whiteboard-style", {
        detail: {
          tool: currentTool,
          width: currentWidth,
          lineStyle: currentLineStyle,
          profile: whiteboardStrokeProfile(
            currentTool,
            currentWidth,
            currentLineStyle,
          ),
        },
      }),
    );
  }
}

function classifyControls(root) {
  const controls = root.querySelectorAll(
    "button, [role='button'], input[type='button'], input[type='range'], select, [data-tool], [data-action]",
  );

  controls.forEach((control) => {
    const label = labelFor(control);

    if (/أدوات السبورة|ادوات السبورة|whiteboard tools|board tools/.test(label)) {
      control.setAttribute(
        "data-r20-whiteboard-bottom-control",
        "tools",
      );
      control.setAttribute(
        "aria-label",
        control.getAttribute("aria-label") || "أدوات السبورة",
      );
    }

    if (/البطاقات|بطاقات|cards?/.test(label)) {
      control.setAttribute(
        "data-r20-whiteboard-bottom-control",
        "cards",
      );
      control.setAttribute(
        "aria-label",
        control.getAttribute("aria-label") || "البطاقات",
      );
    }

    if (
      normalizeWhiteboardTool(label) ||
      normalizeWhiteboardWidth(label) ||
      normalizeWhiteboardLineStyle(label)
    ) {
      control.setAttribute(
        "data-r20-whiteboard-style-control",
        "true",
      );
    }
  });
}

function markCanvasLayout(root) {
  root.setAttribute("data-r20-whiteboard-root", "true");

  const canvasCandidates = root.querySelectorAll("canvas");
  canvasCandidates.forEach((canvas) => {
    canvas.setAttribute("data-r20-whiteboard-canvas", "true");
    applyStateToCanvas(canvas);

    const parent = canvas.parentElement;
    if (parent && parent !== root) {
      parent.setAttribute(
        "data-r20-whiteboard-canvas-host",
        "true",
      );
    }
  });
}

function isOpaqueBlack(style) {
  const value = String(style.backgroundColor || "")
    .replace(/\s+/g, "")
    .toLowerCase();

  return (
    value === "rgb(0,0,0)" ||
    value === "rgba(0,0,0,1)" ||
    value === "#000" ||
    value === "#000000"
  );
}

function removeBoardToolBlackCover(root) {
  const rootRect = root.getBoundingClientRect();
  const area = Math.max(1, rootRect.width * rootRect.height);

  root.querySelectorAll(
    "[class*='modal'], [class*='overlay'], [class*='backdrop'], [role='dialog'], dialog",
  ).forEach((element) => {
    if (element.matches("canvas")) return;

    const rect = element.getBoundingClientRect();
    const coverRatio =
      (rect.width * rect.height) / area;

    if (coverRatio < 0.7) return;

    const style = getComputedStyle(element);
    const text = clean(element.textContent);

    const boardRelated =
      /أدوات السبورة|ادوات السبورة|whiteboard|board tools/.test(
        text + " " + clean(element.className),
      );

    if (boardRelated && isOpaqueBlack(style)) {
      element.setAttribute(
        "data-r20-whiteboard-black-cover",
        "neutralized",
      );
    }
  });
}

function markRoot(root) {
  markCanvasLayout(root);
  classifyControls(root);
  removeBoardToolBlackCover(root);
}

function patchCanvasStroke() {
  const proto = globalThis.CanvasRenderingContext2D?.prototype;
  if (!proto || proto.__r20WhiteboardPatched) return;

  const originalStroke = proto.stroke;
  const originalFill = proto.fill;

  Object.defineProperty(proto, "__r20WhiteboardPatched", {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  proto.stroke = function(...args) {
    const canvas = this.canvas;
    if (!canvas?.matches?.("[data-r20-whiteboard-canvas='true']")) {
      return originalStroke.apply(this, args);
    }

    const state = canvasState(canvas);
    const profile = whiteboardStrokeProfile(
      state.tool,
      state.width,
      state.lineStyle,
    );

    const original = {
      lineWidth: this.lineWidth,
      globalAlpha: this.globalAlpha,
      lineCap: this.lineCap,
      lineJoin: this.lineJoin,
      globalCompositeOperation:
        this.globalCompositeOperation,
      shadowBlur: this.shadowBlur,
      dash: this.getLineDash?.() || [],
    };

    try {
      this.lineWidth = profile.lineWidth;
      this.globalAlpha = profile.globalAlpha;
      this.lineCap = profile.lineCap;
      this.lineJoin = profile.lineJoin;
      this.globalCompositeOperation =
        profile.globalCompositeOperation;
      this.shadowBlur = profile.shadowBlur;
      this.setLineDash?.(profile.lineDash);

      return originalStroke.apply(this, args);
    } finally {
      this.lineWidth = original.lineWidth;
      this.globalAlpha = original.globalAlpha;
      this.lineCap = original.lineCap;
      this.lineJoin = original.lineJoin;
      this.globalCompositeOperation =
        original.globalCompositeOperation;
      this.shadowBlur = original.shadowBlur;
      this.setLineDash?.(original.dash);
    }
  };

  proto.fill = function(...args) {
    const canvas = this.canvas;
    if (
      !canvas?.matches?.("[data-r20-whiteboard-canvas='true']") ||
      canvasState(canvas).tool !== "eraser"
    ) {
      return originalFill.apply(this, args);
    }

    const old = this.globalCompositeOperation;
    try {
      this.globalCompositeOperation =
        "destination-out";
      return originalFill.apply(this, args);
    } finally {
      this.globalCompositeOperation = old;
    }
  };
}

function clickHandler(event) {
  const control = event.target.closest?.(
    "button, [role='button'], input, select, [data-tool], [data-action]",
  );
  if (!control) return;

  const root = rootFor(control);
  if (!root || !likelyWhiteboardRoot(root)) return;

  handleToolControl(control);

  const label = labelFor(control);
  if (/أدوات السبورة|ادوات السبورة|whiteboard tools|board tools/.test(label)) {
    requestAnimationFrame(() => {
      removeBoardToolBlackCover(root);
      markCanvasLayout(root);
    });
    setTimeout(() => {
      removeBoardToolBlackCover(root);
      markCanvasLayout(root);
    }, 90);
  }
}

function inputHandler(event) {
  const control = event.target;
  if (
    !control?.matches?.(
      "input[type='range'], select, input[type='number']",
    )
  ) {
    return;
  }

  const root = rootFor(control);
  if (!root || !likelyWhiteboardRoot(root)) return;

  const mergedLabel = `${labelFor(control)} ${clean(control.value)}`;
  const width = normalizeWhiteboardWidth(mergedLabel);

  if (width) {
    currentWidth = width;
    findRoots().forEach((board) => {
      board
        .querySelectorAll("canvas")
        .forEach(applyStateToCanvas);
    });
  }
}

function run() {
  patchCanvasStroke();
  findRoots().forEach(markRoot);
}

export function installR20WhiteboardRuntime() {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return;
  }

  if (installed) return;
  installed = true;

  window.__MOBDEA_R20_WHITEBOARD__ =
    R20_WHITEBOARD_MARKER;

  window.mobdeaR20Whiteboard = Object.freeze({
    marker: R20_WHITEBOARD_MARKER,
    normalizeWhiteboardTool,
    normalizeWhiteboardWidth,
    normalizeWhiteboardLineStyle,
    whiteboardStrokeProfile,
  });

  document.addEventListener(
    "click",
    clickHandler,
    true,
  );
  document.addEventListener(
    "input",
    inputHandler,
    true,
  );
  document.addEventListener(
    "change",
    inputHandler,
    true,
  );

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
        "aria-label",
        "data-tool",
        "data-action",
      ],
    },
  );

  window.addEventListener(
    "resize",
    schedule,
    { passive: true },
  );
  window.addEventListener(
    "orientationchange",
    schedule,
    { passive: true },
  );

  run();
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      installR20WhiteboardRuntime,
      { once: true },
    );
  } else {
    installR20WhiteboardRuntime();
  }
}
