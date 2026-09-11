import {
  R20_MAP_CHALLENGE_PATH,
  R20_MAP_CHALLENGE_HAS_NATIVE_GESTURES,
} from "../config/r20MapChallengeConfig.js";

export const R20_MAP_CHALLENGE_MARKER =
  "R20_FIX15_MAP_CHALLENGE_V1";

const ROOT_SELECTORS = [
  "[data-map-challenge]",
  "[data-r20-map-challenge]",
  ".map-challenge",
  ".map-challenge-page",
  ".map-challenge-screen",
  "[class*='map-challenge']",
  "[class*='mapChallenge']",
];

const LAYERS = Object.freeze({
  boundaries: {
    label: "الحدود",
    icon: "▦",
  },
  names: {
    label: "الأسماء",
    icon: "Aa",
  },
  rivers: {
    label: "الأنهار",
    icon: "≈",
  },
  references: {
    label: "خطوط العرض",
    icon: "⌗",
  },
});

const stateByRoot = new WeakMap();

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function visible(element) {
  if (!element) return false;

  const style =
    getComputedStyle(element);

  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    element.getClientRects().length > 0
  );
}

function challengeText(element) {
  return clean([
    element?.getAttribute?.("aria-label"),
    element?.getAttribute?.("title"),
    element?.getAttribute?.("data-mode"),
    element?.className,
    element?.textContent,
  ].filter(Boolean).join(" "));
}

function isChallengeRoot(element) {
  if (!element || !visible(element)) return false;

  if (
    element.matches?.(
      "[data-map-challenge], [data-r20-map-challenge], .map-challenge, .map-challenge-page, .map-challenge-screen, [class*='map-challenge'], [class*='mapChallenge']",
    )
  ) {
    return true;
  }

  const text =
    challengeText(element);

  return (
    /map challenge|تحدي الخرائط|تحدى الخرائط/.test(text) &&
    Boolean(
      element.querySelector(
        "svg, [data-r20-map-root], [data-map-stage], .map-stage, .map-viewer",
      ),
    )
  );
}

function findChallengeRoots() {
  const roots = new Set();

  for (const selector of ROOT_SELECTORS) {
    document.querySelectorAll(selector).forEach((root) => {
      if (isChallengeRoot(root)) roots.add(root);
    });
  }

  document.querySelectorAll(
    "[data-r20-map-root='true']",
  ).forEach((mapRoot) => {
    const parent =
      mapRoot.closest(
        "[data-map-challenge], [class*='challenge'], main, section",
      );

    if (
      parent &&
      /map challenge|تحدي الخرائط|تحدى الخرائط/.test(
        challengeText(parent),
      )
    ) {
      roots.add(parent);
    }
  });

  return [...roots];
}

function stateFor(root) {
  let state = stateByRoot.get(root);

  if (!state) {
    state = {
      boundaries: true,
      names: true,
      rivers: true,
      references: true,
      layersOpen: false,
    };
    stateByRoot.set(root, state);
  }

  return state;
}

function findMapSurface(root) {
  return (
    root.querySelector(
      "[data-r20-map-root='true']",
    ) ||
    root.querySelector(
      "[data-map-stage], .map-stage, .map-viewer, .challenge-map, [class*='challenge-map']",
    ) ||
    root.querySelector("svg")?.parentElement ||
    null
  );
}

function markMapSurface(root) {
  const surface =
    findMapSurface(root);

  if (!surface) return null;

  surface.setAttribute(
    "data-r20-map-challenge-map",
    "true",
  );

  if (
    !R20_MAP_CHALLENGE_HAS_NATIVE_GESTURES
  ) {
    surface.setAttribute(
      "data-r20-resource-kind",
      "map",
    );
  } else {
    surface.setAttribute(
      "data-r20-map-challenge-native-gestures",
      "true",
    );
  }

  return surface;
}

function semantic(element) {
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

function markChallengeLayers(root) {
  root.querySelectorAll(
    "[data-r20-atlas-boundary='true'], svg path, svg polygon, svg polyline, svg line",
  ).forEach((element) => {
    const value = semantic(element);

    if (
      element.matches(
        "[data-r20-atlas-boundary='true']",
      ) ||
      /boundary|border|حدود|country-border/.test(value)
    ) {
      element.setAttribute(
        "data-r20-challenge-layer",
        "boundaries",
      );
    }
  });

  root.querySelectorAll(
    "[data-r20-atlas-label='true'], svg text, svg textPath, .country-label",
  ).forEach((element) => {
    if (!clean(element.textContent)) return;

    element.setAttribute(
      "data-r20-challenge-layer",
      "names",
    );
  });

  root.querySelectorAll(
    "[data-r20-map-river='true'], svg path, svg polyline",
  ).forEach((element) => {
    const value = semantic(element);

    if (
      element.matches(
        "[data-r20-map-river='true']",
      ) ||
      /river|stream|nile|نهر|النيل|مجرى/.test(value)
    ) {
      element.setAttribute(
        "data-r20-challenge-layer",
        "rivers",
      );
    }
  });

  root.querySelectorAll(
    "svg line, svg path, svg polyline, [data-r20-map-reference-line], [data-latitude], [data-longitude]",
  ).forEach((element) => {
    const value = semantic(element);

    if (
      /latitude|longitude|greenwich|equator|graticule|خطوط العرض|دوائر العرض|جرينتش|الاستواء/.test(
        value,
      )
    ) {
      element.setAttribute(
        "data-r20-challenge-layer",
        "references",
      );
    }
  });
}

function markScrollablePanels(root, mapSurface) {
  const candidates =
    root.querySelectorAll(
      "aside, [class*='sidebar'], [class*='panel'], [class*='leaderboard'], [class*='ranking'], [class*='symbols'], [class*='tools']",
    );

  candidates.forEach((panel) => {
    if (
      panel === mapSurface ||
      panel.contains(mapSurface) ||
      mapSurface?.contains(panel)
    ) {
      return;
    }

    const rect =
      panel.getBoundingClientRect();

    if (
      rect.width < 90 ||
      rect.height < 60
    ) {
      return;
    }

    panel.setAttribute(
      "data-r20-map-challenge-panel",
      "true",
    );
  });
}

function markStudentCardInsideChallenge(root) {
  root.querySelectorAll(
    "[data-student-card], .student-card, [class*='student-card']",
  ).forEach((card) => {
    if (
      card.closest(
        "[class*='leaderboard'], [class*='ranking'], [data-r20-map-challenge-panel='true'] [class*='ranking']",
      )
    ) {
      return;
    }

    const rect =
      card.getBoundingClientRect();

    const label =
      challengeText(card);

    if (
      /بطاقة الطالب|student card/.test(label) ||
      (
        rect.width >= 120 &&
        rect.height >= 80
      )
    ) {
      card.setAttribute(
        "data-r20-map-challenge-student-card",
        "hidden",
      );
    }
  });
}

function makeLayerToggle(kind) {
  const config =
    LAYERS[kind];

  const button =
    document.createElement("button");

  button.type = "button";
  button.className =
    "r20-map-challenge-layer-toggle";

  button.setAttribute(
    "data-r20-map-challenge-layer-toggle",
    kind,
  );

  button.setAttribute(
    "aria-pressed",
    "true",
  );

  button.setAttribute(
    "title",
    config.label,
  );

  button.innerHTML = `
    <span aria-hidden="true">${config.icon}</span>
    <span>${config.label}</span>
  `;

  return button;
}

function ensureLayerControls(root) {
  let controls =
    root.querySelector(
      ":scope > [data-r20-map-challenge-layer-controls='true']",
    );

  if (!controls) {
    controls =
      document.createElement("div");

    controls.className =
      "r20-map-challenge-layer-controls";

    controls.setAttribute(
      "data-r20-map-challenge-layer-controls",
      "true",
    );

    const trigger =
      document.createElement("button");

    trigger.type = "button";
    trigger.className =
      "r20-map-challenge-layers-trigger";

    trigger.setAttribute(
      "data-r20-map-challenge-layers-trigger",
      "true",
    );

    trigger.setAttribute(
      "aria-expanded",
      "false",
    );

    trigger.innerHTML =
      '<span aria-hidden="true">◫</span><span>الطبقات</span>';

    const tray =
      document.createElement("div");

    tray.className =
      "r20-map-challenge-layers-tray";

    tray.setAttribute(
      "data-r20-map-challenge-layers-tray",
      "true",
    );

    Object.keys(LAYERS).forEach((kind) => {
      tray.appendChild(
        makeLayerToggle(kind),
      );
    });

    controls.append(
      trigger,
      tray,
    );

    root.appendChild(controls);
  }

  if (
    controls.dataset.r20Wired !==
    "true"
  ) {
    controls.dataset.r20Wired =
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
        const trigger =
          event.target.closest?.(
            "[data-r20-map-challenge-layers-trigger='true']",
          );

        if (trigger) {
          event.preventDefault();
          event.stopPropagation();

          const state =
            stateFor(root);

          state.layersOpen =
            !state.layersOpen;

          root.setAttribute(
            "data-r20-map-challenge-layers-open",
            state.layersOpen
              ? "true"
              : "false",
          );

          trigger.setAttribute(
            "aria-expanded",
            state.layersOpen
              ? "true"
              : "false",
          );

          return;
        }

        const toggle =
          event.target.closest?.(
            "[data-r20-map-challenge-layer-toggle]",
          );

        if (!toggle) return;

        event.preventDefault();
        event.stopPropagation();

        const kind =
          toggle.getAttribute(
            "data-r20-map-challenge-layer-toggle",
          );

        const state =
          stateFor(root);

        state[kind] =
          !state[kind];

        applyLayerState(
          root,
          state,
        );
      },
    );
  }

  return controls;
}

function applyLayerState(root, state) {
  Object.keys(LAYERS).forEach((kind) => {
    root.setAttribute(
      `data-r20-map-challenge-layer-${kind}`,
      state[kind]
        ? "on"
        : "off",
    );

    root.querySelectorAll(
      `[data-r20-map-challenge-layer-toggle="${kind}"]`,
    ).forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        state[kind]
          ? "true"
          : "false",
      );
    });
  });
}

function dashboardRoot() {
  return (
    document.querySelector(
      '[data-r20-dashboard-role="student"]',
    ) ||
    null
  );
}

function dashboardCards(root) {
  return [
    ...root.querySelectorAll(
      "[data-dashboard-card], [data-feature-card], .dashboard-card, .feature-card, .quick-action-card, .dashboard-action, .dashboard-tile, a[href], button",
    ),
  ];
}

function cardText(card) {
  return clean([
    card.getAttribute?.("aria-label"),
    card.getAttribute?.("title"),
    card.getAttribute?.("href"),
    card.textContent,
  ].filter(Boolean).join(" "));
}

function existingDashboardMapChallengeCard(root) {
  return dashboardCards(root).find((card) => {
    return (
      card.getAttribute(
        "data-r20-dashboard-feature",
      ) === "map-challenge" ||
      /map challenge|تحدي الخرائط|تحدى الخرائط/.test(
        cardText(card),
      )
    );
  }) || null;
}

function routeWithBase(path) {
  const value =
    String(path || "").trim();

  if (!value) return "";

  if (
    /^https?:\/\//i.test(value) ||
    value.startsWith("#")
  ) {
    return value;
  }

  return value.startsWith("/")
    ? value
    : `/${value}`;
}

export function openR20MapChallenge() {
  const root =
    dashboardRoot();

  if (root) {
    const existing =
      existingDashboardMapChallengeCard(
        root,
      );

    if (
      existing &&
      existing.getAttribute(
        "data-r20-map-challenge-injected",
      ) !== "true"
    ) {
      const anchor =
        existing.matches("a[href]")
          ? existing
          : existing.querySelector(
              "a[href]",
            );

      if (anchor) {
        anchor.click();
        return true;
      }
    }
  }

  if (
    String(
      R20_MAP_CHALLENGE_PATH ||
        "",
    ).startsWith("active:")
  ) {
    const screen =
      String(
        R20_MAP_CHALLENGE_PATH,
      ).slice(
        "active:".length,
      );

    window.dispatchEvent(
      new CustomEvent(
        "mobdea:r20-open-map-challenge",
        {
          detail: {
            screen,
          },
        },
      ),
    );

    return true;
  }

  const path =
    routeWithBase(
      R20_MAP_CHALLENGE_PATH,
    );

  if (!path) {
    window.dispatchEvent(
      new CustomEvent(
        "mobdea:r20-open-map-challenge",
      ),
    );
    return false;
  }

  if (
    /^https?:\/\//i.test(path)
  ) {
    window.location.assign(path);
    return true;
  }

  if (path.startsWith("#")) {
    window.location.hash =
      path.slice(1);
    return true;
  }

  window.history.pushState(
    {},
    "",
    path,
  );

  window.dispatchEvent(
    new PopStateEvent("popstate"),
  );

  return true;
}

function ensureStudentDashboardEntry() {
  const root =
    dashboardRoot();

  if (!root) return;

  if (
    root.getAttribute(
      "data-r20-dashboard-locked",
    ) === "true"
  ) {
    return;
  }

  const existing =
    existingDashboardMapChallengeCard(
      root,
    );

  if (existing) {
    existing.setAttribute(
      "data-r20-dashboard-feature",
      "map-challenge",
    );

    existing.setAttribute(
      "data-r20-dashboard-access",
      "allowed",
    );

    existing.setAttribute(
      "data-r20-map-challenge-dashboard-entry",
      "true",
    );

    return;
  }

  if (!R20_MAP_CHALLENGE_PATH) {
    root.setAttribute(
      "data-r20-map-challenge-dashboard-status",
      "missing-route",
    );
    return;
  }

  const grid =
    root.querySelector(
      ".dashboard-grid, .dashboard-feature-grid, [data-dashboard-grid], [class*='dashboard-grid']",
    ) ||
    root;

  const button =
    document.createElement("button");

  button.type = "button";

  button.className =
    "r20-map-challenge-dashboard-card";

  button.setAttribute(
    "data-dashboard-card",
    "true",
  );

  button.setAttribute(
    "data-r20-dashboard-feature",
    "map-challenge",
  );

  button.setAttribute(
    "data-r20-dashboard-access",
    "allowed",
  );

  button.setAttribute(
    "data-r20-map-challenge-dashboard-entry",
    "true",
  );

  button.setAttribute(
    "data-r20-map-challenge-injected",
    "true",
  );

  button.innerHTML = `
    <span class="r20-map-challenge-dashboard-card__icon" aria-hidden="true">🗺️</span>
    <span class="r20-map-challenge-dashboard-card__copy">
      <strong>تحدي الخرائط</strong>
      <small>اختبر مهاراتك الجغرافية</small>
    </span>
  `;

  button.addEventListener(
    "click",
    () => {
      openR20MapChallenge();
    },
  );

  grid.appendChild(button);

  root.setAttribute(
    "data-r20-map-challenge-dashboard-status",
    "ready",
  );
}

function markChallenge(root) {
  root.setAttribute(
    "data-r20-map-challenge-root",
    "true",
  );

  const mapSurface =
    markMapSurface(root);

  markChallengeLayers(root);

  markScrollablePanels(
    root,
    mapSurface,
  );

  markStudentCardInsideChallenge(root);

  ensureLayerControls(root);

  applyLayerState(
    root,
    stateFor(root),
  );
}

function run() {
  ensureStudentDashboardEntry();

  findChallengeRoots().forEach(
    markChallenge,
  );
}

export function installR20MapChallengeRuntime() {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return;
  }

  if (
    window.__MOBDEA_R20_MAP_CHALLENGE__
  ) {
    return;
  }

  window.__MOBDEA_R20_MAP_CHALLENGE__ =
    R20_MAP_CHALLENGE_MARKER;

  window.mobdeaR20MapChallenge =
    Object.freeze({
      marker:
        R20_MAP_CHALLENGE_MARKER,
      path:
        R20_MAP_CHALLENGE_PATH,
      hasNativeGestures:
        R20_MAP_CHALLENGE_HAS_NATIVE_GESTURES,
      open:
        openR20MapChallenge,
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
        "data-r20-dashboard-role",
        "data-r20-dashboard-feature",
        "data-r20-dashboard-access",
        "aria-label",
        "title",
      ],
    },
  );

  for (const eventName of [
    "mobdea:r20-portal-login",
    "mobdea:r20-password-changed",
    "popstate",
    "hashchange",
  ]) {
    window.addEventListener(
      eventName,
      schedule,
    );
  }

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
  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      installR20MapChallengeRuntime,
      { once: true },
    );
  } else {
    installR20MapChallengeRuntime();
  }
}
