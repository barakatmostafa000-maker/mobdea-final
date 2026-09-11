export const R20_ATLAS_MARKER =
  "R20_FIX13_ATLAS_BOUNDARIES_NAMES_V1";

const stateByRoot = new WeakMap();

const ROOT_SELECTORS = [
  "[data-r20-resource-kind='atlas']",
  "[data-atlas]",
  ".atlas",
  ".atlas-stage",
  ".atlas-viewer",
  ".geography-atlas",
  "[class*='atlas-stage']",
  "[class*='atlas-viewer']",
  "[class*='geography-atlas']",
];

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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

function signature(element) {
  return clean([
    element?.id,
    element?.className?.baseVal || element?.className,
    element?.getAttribute?.("aria-label"),
    element?.getAttribute?.("title"),
    element?.getAttribute?.("data-mode"),
    element?.getAttribute?.("data-resource-kind"),
    element?.textContent,
  ].filter(Boolean).join(" "));
}

function isAtlasRoot(element) {
  if (!element || !visible(element)) return false;

  if (
    element.matches?.(
      "[data-r20-resource-kind='atlas'], [data-atlas], .atlas, .atlas-stage, .atlas-viewer, .geography-atlas, [class*='atlas']",
    )
  ) {
    return true;
  }

  return (
    /atlas|أطلس|الاطلس|الأطلس/.test(signature(element)) &&
    Boolean(
      element.querySelector(
        "svg, [data-r20-map-content], .map-content",
      ),
    )
  );
}

function findAtlasRoots() {
  const roots = new Set();

  for (const selector of ROOT_SELECTORS) {
    document.querySelectorAll(selector).forEach((root) => {
      if (isAtlasRoot(root)) roots.add(root);
    });
  }

  document.querySelectorAll(
    "[data-r20-map-root='true']",
  ).forEach((mapRoot) => {
    const nearbyText = clean([
      mapRoot.getAttribute("aria-label"),
      mapRoot.getAttribute("title"),
      mapRoot.parentElement?.textContent,
      mapRoot.previousElementSibling?.textContent,
    ].filter(Boolean).join(" "));

    if (/atlas|أطلس|الاطلس|الأطلس/.test(nearbyText)) {
      roots.add(mapRoot);
    }
  });

  return [...roots];
}

function stateFor(root) {
  let state = stateByRoot.get(root);

  if (!state) {
    state = {
      boundariesVisible: true,
      namesVisible: true,
    };
    stateByRoot.set(root, state);
  }

  return state;
}

function semanticValue(element) {
  return clean([
    element.id,
    element.className?.baseVal || element.className,
    element.getAttribute?.("data-layer"),
    element.getAttribute?.("data-type"),
    element.getAttribute?.("data-feature"),
    element.getAttribute?.("data-name"),
    element.getAttribute?.("aria-label"),
    element.getAttribute?.("title"),
  ].filter(Boolean).join(" "));
}

function isExcludedReferenceOrWater(element) {
  if (
    element.matches?.(
      "[data-r20-map-river='true'], [data-r20-atlas-label='true']",
    )
  ) {
    return true;
  }

  return /river|water|stream|lake|sea|ocean|nile|نهر|بحر|بحيرة|latitude|longitude|greenwich|equator|graticule|grid|جرينتش|الاستواء|خطوط العرض|دوائر العرض/.test(
    semanticValue(element),
  );
}

function hasVisibleStroke(element) {
  const style = getComputedStyle(element);

  const stroke = clean(
    style.stroke ||
    element.getAttribute?.("stroke"),
  );

  const width = Number.parseFloat(
    style.strokeWidth ||
    element.getAttribute?.("stroke-width") ||
    "0",
  );

  const opacity = Number.parseFloat(
    style.strokeOpacity || "1",
  );

  return (
    stroke &&
    stroke !== "none" &&
    stroke !== "transparent" &&
    Number.isFinite(width) &&
    width > 0 &&
    (!Number.isFinite(opacity) || opacity > 0)
  );
}

function isSemanticBoundary(element) {
  return /boundary|border|country-border|country|territory|region|state|province|admin|حدود|دولة|دول|إقليم|اقليم|محافظة/.test(
    semanticValue(element),
  );
}

function markBoundaries(root) {
  root.querySelectorAll(
    "svg path, svg polygon, svg polyline, svg line",
  ).forEach((element) => {
    if (isExcludedReferenceOrWater(element)) return;

    if (
      isSemanticBoundary(element) ||
      hasVisibleStroke(element)
    ) {
      element.setAttribute(
        "data-r20-atlas-boundary",
        "true",
      );
    }
  });
}

function markLabels(root) {
  root.querySelectorAll(
    "svg text, svg textPath, [data-country-name], .country-label, .atlas-label, [class*='country-label'], [class*='atlas-label']",
  ).forEach((element) => {
    if (
      element.closest?.(
        "[data-r20-atlas-controls], [data-r20-map-symbols-control], .legend, [class*='legend'], [role='button'], button",
      )
    ) {
      return;
    }

    if (!clean(element.textContent)) return;

    element.setAttribute(
      "data-r20-atlas-label",
      "true",
    );
  });
}

function oldControlLabel(control) {
  return clean([
    control.getAttribute?.("aria-label"),
    control.getAttribute?.("title"),
    control.getAttribute?.("data-action"),
    control.textContent,
  ].filter(Boolean).join(" "));
}

function markLegacyControls(root) {
  root.querySelectorAll(
    "button, [role='button'], [data-action]",
  ).forEach((control) => {
    if (
      control.closest(
        "[data-r20-atlas-controls]",
      )
    ) {
      return;
    }

    const label = oldControlLabel(control);

    if (
      /حدود الدول|الحدود|boundaries|borders/.test(label) ||
      /أسماء الدول|اسماء الدول|الأسماء|الاسماء|country names|labels/.test(label)
    ) {
      control.setAttribute(
        "data-r20-atlas-legacy-control",
        "true",
      );
    }
  });
}

function makeButton(kind, label, icon) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "r20-atlas-control";
  button.setAttribute(
    "data-r20-atlas-toggle",
    kind,
  );
  button.setAttribute(
    "aria-pressed",
    "true",
  );
  button.setAttribute("title", label);
  button.setAttribute(
    "aria-label",
    label,
  );

  const iconNode =
    document.createElement("span");
  iconNode.className =
    "r20-atlas-control__icon";
  iconNode.setAttribute(
    "aria-hidden",
    "true",
  );
  iconNode.textContent = icon;

  const textNode =
    document.createElement("span");
  textNode.className =
    "r20-atlas-control__text";
  textNode.textContent = label;

  button.append(
    iconNode,
    textNode,
  );

  return button;
}

function applyState(root, state) {
  root.setAttribute(
    "data-r20-atlas-boundaries-visible",
    state.boundariesVisible
      ? "true"
      : "false",
  );

  root.setAttribute(
    "data-r20-atlas-names-visible",
    state.namesVisible
      ? "true"
      : "false",
  );

  root.querySelectorAll(
    "[data-r20-atlas-toggle='boundaries']",
  ).forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      state.boundariesVisible
        ? "true"
        : "false",
    );
  });

  root.querySelectorAll(
    "[data-r20-atlas-toggle='names']",
  ).forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      state.namesVisible
        ? "true"
        : "false",
    );
  });

  root.dispatchEvent(
    new CustomEvent(
      "mobdea:r20-atlas-layers",
      {
        bubbles: true,
        detail: {
          boundariesVisible:
            state.boundariesVisible,
          namesVisible:
            state.namesVisible,
        },
      },
    ),
  );
}

function ensureControls(root) {
  let controls = root.querySelector(
    ":scope > [data-r20-atlas-controls='true']",
  );

  if (!controls) {
    controls = document.createElement("div");
    controls.className =
      "r20-atlas-controls";
    controls.setAttribute(
      "data-r20-atlas-controls",
      "true",
    );

    controls.append(
      makeButton(
        "boundaries",
        "حدود الدول",
        "▦",
      ),
      makeButton(
        "names",
        "أسماء الدول",
        "Aa",
      ),
    );

    root.appendChild(controls);
  }

  if (
    controls.dataset.r20AtlasWired !==
    "true"
  ) {
    controls.dataset.r20AtlasWired =
      "true";

    controls.addEventListener(
      "pointerdown",
      (event) => {
        event.stopPropagation();
      },
      true,
    );

    controls.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest?.(
            "[data-r20-atlas-toggle]",
          );

        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        const state =
          stateFor(root);

        const kind =
          button.getAttribute(
            "data-r20-atlas-toggle",
          );

        if (
          kind ===
          "boundaries"
        ) {
          state.boundariesVisible =
            !state.boundariesVisible;
        }

        if (
          kind ===
          "names"
        ) {
          state.namesVisible =
            !state.namesVisible;
        }

        applyState(
          root,
          state,
        );
      },
    );
  }

  return controls;
}

function markRoot(root) {
  root.setAttribute(
    "data-r20-atlas-root",
    "true",
  );

  markBoundaries(root);
  markLabels(root);
  markLegacyControls(root);
  ensureControls(root);
  applyState(
    root,
    stateFor(root),
  );
}

function run() {
  findAtlasRoots().forEach(
    markRoot,
  );
}

export function installR20AtlasRuntime() {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return;
  }

  if (
    window.__MOBDEA_R20_ATLAS_RUNTIME__
  ) {
    return;
  }

  window.__MOBDEA_R20_ATLAS_RUNTIME__ =
    R20_ATLAS_MARKER;

  window.mobdeaR20Atlas =
    Object.freeze({
      marker:
        R20_ATLAS_MARKER,
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
      characterData: true,
      attributeFilter: [
        "class",
        "style",
        "stroke",
        "stroke-width",
        "data-layer",
        "aria-label",
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

if (
  typeof window !== "undefined"
) {
  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      installR20AtlasRuntime,
      { once: true },
    );
  } else {
    installR20AtlasRuntime();
  }
}
