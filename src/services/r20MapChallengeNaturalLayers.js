import {
  R20_NATURAL_LAYER_AVAILABILITY,
} from "../config/r20MapChallengeNaturalLayersConfig.js";

export const R20_NATURAL_LAYERS_MARKER =
  "R20_FIX16_MAP_NATURAL_LAYERS_V1";

const NATURAL_LAYERS = Object.freeze({
  terrain: {
    label: "التضاريس",
    title: "التضاريس: جبال، هضاب، سهول، جزر",
    icon: "⛰",
  },
  minerals: {
    label: "الثروات المعدنية",
    title: "الثروات المعدنية",
    icon: "◆",
  },
  forests: {
    label: "الغابات",
    title: "الغابات",
    icon: "♣",
  },
  grasslands: {
    label: "الحشائش",
    title: "الحشائش والمراعي الطبيعية",
    icon: "≋",
  },
  deserts: {
    label: "الصحاري",
    title: "الصحاري",
    icon: "⌁",
  },
});

const TERRAIN_KIND_PATTERNS = Object.freeze({
  mountains:
    /mountain|mountains|mount|جبال|جبل/i,
  plateaus:
    /plateau|plateaus|plateaux|هضاب|هضبة/i,
  plains:
    /plain|plains|سهول|سهل/i,
  islands:
    /island|islands|جزر|جزيرة/i,
});

const LAYER_PATTERNS = Object.freeze({
  minerals:
    /mineral|mining|iron|phosphate|manganese|gold|copper|bauxite|ثروات.?معدنية|معادن|حديد|فوسفات|منجنيز|ذهب|نحاس|بوكسيت/i,
  forests:
    /forest|woodland|غابات|غابة/i,
  grasslands:
    /grassland|savanna|steppe|grass|حشائش|سافانا|استبس|السهوب|سهب/i,
  deserts:
    /desert|sahara|صحاري|صحراء/i,
});

const stateByRoot =
  new WeakMap();

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function semantic(element) {
  return clean([
    element.id,
    element.className?.baseVal ||
      element.className,
    element.getAttribute?.("data-layer"),
    element.getAttribute?.("data-type"),
    element.getAttribute?.("data-feature"),
    element.getAttribute?.("data-symbol"),
    element.getAttribute?.("data-name"),
    element.getAttribute?.("aria-label"),
    element.getAttribute?.("title"),
    element.getAttribute?.("alt"),
    element.getAttribute?.("href"),
    element.getAttribute?.("src"),
    element.textContent,
  ].filter(Boolean).join(" "));
}

function rootState(root) {
  let state =
    stateByRoot.get(root);

  if (!state) {
    state = {
      terrain: true,
      minerals: true,
      forests: true,
      grasslands: true,
      deserts: true,
    };

    stateByRoot.set(
      root,
      state,
    );
  }

  return state;
}

function challengeRoots() {
  return [
    ...document.querySelectorAll(
      '[data-r20-map-challenge-root="true"]',
    ),
  ];
}

function isControlElement(element) {
  return Boolean(
    element.closest?.(
      "button, [role='button'], [data-r20-map-challenge-layer-controls='true'], [class*='legend'], [data-r20-map-symbols-control]",
    ),
  );
}

function candidateElements(root) {
  return [
    ...root.querySelectorAll(
      "svg path, svg polygon, svg polyline, svg circle, svg ellipse, svg g, svg use, svg image, svg text, [data-map-feature], [data-feature], [data-symbol], [class*='symbol'], img[alt], img[title]",
    ),
  ];
}

function markTerrain(element, value) {
  for (
    const [
      kind,
      pattern,
    ] of Object.entries(
      TERRAIN_KIND_PATTERNS,
    )
  ) {
    if (
      pattern.test(value)
    ) {
      element.setAttribute(
        "data-r20-natural-layer",
        "terrain",
      );

      element.setAttribute(
        "data-r20-terrain-kind",
        kind,
      );

      return true;
    }
  }

  return false;
}

function markNaturalLayers(root) {
  const counts = {
    terrain: 0,
    mountains: 0,
    plateaus: 0,
    plains: 0,
    islands: 0,
    minerals: 0,
    forests: 0,
    grasslands: 0,
    deserts: 0,
  };

  candidateElements(root).forEach((element) => {
    if (
      isControlElement(element)
    ) {
      return;
    }

    const value =
      semantic(element);

    if (!value) return;

    if (
      markTerrain(
        element,
        value,
      )
    ) {
      counts.terrain += 1;

      const kind =
        element.getAttribute(
          "data-r20-terrain-kind",
        );

      if (
        kind &&
        kind in counts
      ) {
        counts[kind] += 1;
      }

      return;
    }

    for (
      const [
        layer,
        pattern,
      ] of Object.entries(
        LAYER_PATTERNS,
      )
    ) {
      if (
        pattern.test(value)
      ) {
        element.setAttribute(
          "data-r20-natural-layer",
          layer,
        );

        counts[layer] += 1;
        break;
      }
    }
  });

  root.setAttribute(
    "data-r20-natural-layer-counts",
    JSON.stringify(counts),
  );

  for (
    const [
      layer,
      available,
    ] of Object.entries(
      R20_NATURAL_LAYER_AVAILABILITY,
    )
  ) {
    root.setAttribute(
      `data-r20-natural-layer-source-${layer}`,
      available
        ? "available"
        : "missing",
    );
  }

  return counts;
}

function makeButton(layer) {
  const config =
    NATURAL_LAYERS[layer];

  const button =
    document.createElement(
      "button",
    );

  button.type =
    "button";

  button.className =
    "r20-natural-layer-toggle";

  button.setAttribute(
    "data-r20-natural-layer-toggle",
    layer,
  );

  button.setAttribute(
    "aria-pressed",
    "true",
  );

  button.setAttribute(
    "title",
    config.title,
  );

  button.setAttribute(
    "aria-label",
    config.title,
  );

  button.innerHTML = `
    <span aria-hidden="true">${config.icon}</span>
    <span>${config.label}</span>
  `;

  return button;
}

function ensureButtons(root) {
  const tray =
    root.querySelector(
      '[data-r20-map-challenge-layers-tray="true"]',
    );

  if (!tray) return;

  for (
    const layer of
    Object.keys(
      NATURAL_LAYERS,
    )
  ) {
    if (
      tray.querySelector(
        `[data-r20-natural-layer-toggle="${layer}"]`,
      )
    ) {
      continue;
    }

    tray.appendChild(
      makeButton(layer),
    );
  }

  if (
    tray.dataset.r20NaturalLayersWired ===
    "true"
  ) {
    return;
  }

  tray.dataset.r20NaturalLayersWired =
    "true";

  tray.addEventListener(
    "click",
    (event) => {
      const button =
        event.target.closest?.(
          "[data-r20-natural-layer-toggle]",
        );

      if (!button) return;

      event.preventDefault();
      event.stopPropagation();

      const layer =
        button.getAttribute(
          "data-r20-natural-layer-toggle",
        );

      const state =
        rootState(root);

      state[layer] =
        !state[layer];

      applyState(
        root,
        state,
      );
    },
  );
}

function applyState(root, state) {
  for (
    const layer of
    Object.keys(
      NATURAL_LAYERS,
    )
  ) {
    root.setAttribute(
      `data-r20-natural-layer-${layer}`,
      state[layer]
        ? "on"
        : "off",
    );

    root.querySelectorAll(
      `[data-r20-natural-layer-toggle="${layer}"]`,
    ).forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        state[layer]
          ? "true"
          : "false",
      );
    });
  }
}

function verifyLiveAvailability(root, counts) {
  const terrainReady =
    counts.mountains > 0 &&
    counts.plateaus > 0 &&
    counts.plains > 0 &&
    counts.islands > 0;

  const live = {
    terrain:
      terrainReady,
    minerals:
      counts.minerals > 0,
    forests:
      counts.forests > 0,
    grasslands:
      counts.grasslands > 0,
    deserts:
      counts.deserts > 0,
  };

  for (
    const [
      layer,
      available,
    ] of Object.entries(
      live,
    )
  ) {
    root.setAttribute(
      `data-r20-natural-layer-live-${layer}`,
      available
        ? "ready"
        : "missing",
    );
  }
}

function run() {
  challengeRoots().forEach((root) => {
    const counts =
      markNaturalLayers(root);

    ensureButtons(root);

    applyState(
      root,
      rootState(root),
    );

    verifyLiveAvailability(
      root,
      counts,
    );
  });
}

export function installR20MapChallengeNaturalLayers() {
  if (
    typeof window ===
      "undefined" ||
    typeof document ===
      "undefined"
  ) {
    return;
  }

  if (
    window.__MOBDEA_R20_NATURAL_LAYERS__
  ) {
    return;
  }

  window.__MOBDEA_R20_NATURAL_LAYERS__ =
    R20_NATURAL_LAYERS_MARKER;

  let queued = false;

  const schedule = () => {
    if (queued) return;

    queued = true;

    requestAnimationFrame(() => {
      queued = false;
      run();
    });
  };

  new MutationObserver(
    schedule,
  ).observe(
    document.documentElement,
    {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: [
        "class",
        "id",
        "data-layer",
        "data-type",
        "data-feature",
        "data-symbol",
        "data-name",
        "aria-label",
        "title",
        "href",
        "src",
      ],
    },
  );

  run();
}

if (
  typeof window !==
  "undefined"
) {
  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      installR20MapChallengeNaturalLayers,
      {
        once: true,
      },
    );
  } else {
    installR20MapChallengeNaturalLayers();
  }
}
