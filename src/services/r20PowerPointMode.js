import {
  R20_MEDIA_CAPABILITIES,
} from "../config/r20MediaCapabilities.js";

export const R20_POWERPOINT_MARKER =
  "R20_FIX17_POWERPOINT_MODE_V1";

const ROOT_SELECTORS = [
  '[data-r20-resource-kind="powerpoint"]',
  "[data-powerpoint-viewer]",
  "[data-ppt-viewer]",
  ".powerpoint-viewer",
  ".ppt-viewer",
  ".pptx-viewer",
  ".presentation-viewer",
  "[class*='powerpoint']",
  "[class*='ppt-viewer']",
  "[class*='pptx-viewer']",
];

const PREV =
  /previous.?slide|prev.?slide|back.?slide|السابق|الشريحة السابقة/i;

const NEXT =
  /next|forward.?slide|التالي|الشريحة التالية|تقدم/i;

const STATUS =
  /slide|page|شريحة|صفحة/i;

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function classModeRoot(element) {
  return (
    element.closest(
      '[data-r20-classmode-root="true"]',
    ) ||
    element.closest(
      ".classmode-v103, .classmode-page, .lesson-mode-shell",
    )
  );
}

function controlText(element) {
  return clean([
    element.getAttribute?.(
      "aria-label",
    ),
    element.getAttribute?.(
      "title",
    ),
    element.getAttribute?.(
      "data-action",
    ),
    element.textContent,
  ].filter(Boolean).join(" "));
}

function rootLooksLikePowerPoint(root) {
  if (!root) return false;

  if (
    root.matches?.(
      '[data-r20-resource-kind="powerpoint"], [data-powerpoint-viewer], [data-ppt-viewer], .powerpoint-viewer, .ppt-viewer, .pptx-viewer, .presentation-viewer, [class*="powerpoint"], [class*="ppt-viewer"], [class*="pptx-viewer"]',
    )
  ) {
    return true;
  }

  const text =
    clean([
      root.getAttribute?.(
        "aria-label",
      ),
      root.getAttribute?.(
        "title",
      ),
      root.className,
      root.parentElement?.textContent,
    ].filter(Boolean).join(" "));

  return /powerpoint|pptx?|بوربوينت|باوربوينت/i.test(
    text,
  );
}

function findRoot() {
  if (
    !R20_MEDIA_CAPABILITIES.powerpoint
  ) {
    return null;
  }

  for (
    const selector of
    ROOT_SELECTORS
  ) {
    for (
      const root of
      document.querySelectorAll(
        selector,
      )
    ) {
      if (
        classModeRoot(root) &&
        rootLooksLikePowerPoint(
          root,
        )
      ) {
        return root;
      }
    }
  }

  const classRoot =
    document.querySelector(
      '[data-r20-classmode-root="true"]',
    );

  if (!classRoot) return null;

  const candidates =
    [
      ...classRoot.querySelectorAll(
        "section, div",
      ),
    ];

  return (
    candidates.find(
      rootLooksLikePowerPoint,
    ) ||
    null
  );
}

function navControls(
  root,
) {
  const classRoot =
    classModeRoot(root);

  const scope =
    classRoot || root;

  const buttons =
    [
      ...scope.querySelectorAll(
        "button, [role='button'], [data-action]",
      ),
    ].filter(
      (button) =>
        !button.closest(
          "[data-r20-ppt-controls='true']",
        ),
    );

  const prev =
    buttons.find(
      (button) =>
        PREV.test(
          controlText(button),
        ),
    ) ||
    null;

  const next =
    buttons.find(
      (button) =>
        NEXT.test(
          controlText(button),
        ),
    ) ||
    null;

  const status =
    [
      ...scope.querySelectorAll(
        "[data-slide-number], [data-current-slide], .slide-number, .page-number, [class*='slide-count'], [class*='slide-number']",
      ),
    ].find(
      (element) =>
        STATUS.test(
          controlText(element),
        ) ||
        /\d+\s*\/\s*\d+/.test(
          element.textContent || "",
        ),
    ) ||
    null;

  return {
    prev,
    next,
    status,
  };
}

function slideSurface(root) {
  return (
    root.querySelector(
      "[data-slide], .slide, .ppt-slide, .presentation-slide, .slide-container, [class*='slide-container'], [class*='ppt-slide']",
    ) ||
    root.querySelector(
      "canvas, iframe, embed, object, img, svg",
    )?.parentElement ||
    root
  );
}

function signature(root) {
  const current =
    root.querySelector(
      "[data-current-slide], [data-slide].active, .slide.active, .ppt-slide.active, [aria-current='true']",
    );

  const surface =
    slideSurface(root);

  const canvas =
    root.querySelector(
      "canvas",
    );

  let canvasSample =
    "";

  if (canvas) {
    try {
      canvasSample =
        canvas.toDataURL(
          "image/png",
        ).slice(
          -160,
        );
    } catch {}
  }

  return clean([
    root.getAttribute(
      "data-current-slide",
    ),
    current?.getAttribute?.(
      "data-slide",
    ),
    current?.getAttribute?.(
      "data-current-slide",
    ),
    current?.textContent,
    surface?.textContent,
    root.querySelector(
      "img",
    )?.currentSrc,
    canvasSample,
  ].filter(Boolean).join("|")).slice(
    0,
    700,
  );
}

function updateSignature(
  root,
) {
  root.setAttribute(
    "data-r20-ppt-slide-signature",
    signature(root),
  );
}

function proxyButton(
  kind,
  label,
  text,
) {
  const button =
    document.createElement(
      "button",
    );

  button.type =
    "button";

  button.className =
    "r20-ppt-control-button";

  button.setAttribute(
    "data-r20-ppt-action",
    kind,
  );

  button.setAttribute(
    "aria-label",
    label,
  );

  button.setAttribute(
    "title",
    label,
  );

  button.textContent =
    text;

  return button;
}

function ensureControls(
  root,
) {
  const nav =
    navControls(root);

  if (
    !nav.prev ||
    !nav.next
  ) {
    root.setAttribute(
      "data-r20-ppt-navigation-status",
      "missing",
    );

    return;
  }

  let controls =
    root.querySelector(
      ":scope > [data-r20-ppt-controls='true']",
    );

  if (!controls) {
    controls =
      document.createElement(
        "div",
      );

    controls.className =
      "r20-ppt-controls";

    controls.setAttribute(
      "data-r20-ppt-controls",
      "true",
    );

    const prev =
      proxyButton(
        "previous",
        "الشريحة السابقة",
        "‹",
      );

    const indicator =
      document.createElement(
        "span",
      );

    indicator.className =
      "r20-ppt-indicator";

    indicator.setAttribute(
      "data-r20-ppt-indicator",
      "true",
    );

    indicator.textContent =
      nav.status?.textContent?.trim() ||
      "PowerPoint";

    const next =
      proxyButton(
        "next",
        "الشريحة التالية",
        "›",
      );

    controls.append(
      prev,
      indicator,
      next,
    );

    root.appendChild(
      controls,
    );
  }

  nav.prev.setAttribute(
    "data-r20-ppt-source-control",
    "previous",
  );

  nav.next.setAttribute(
    "data-r20-ppt-source-control",
    "next",
  );

  if (
    nav.status
  ) {
    nav.status.setAttribute(
      "data-r20-ppt-source-status",
      "true",
    );
  }

  if (
    controls.dataset.r20PptWired !==
    "true"
  ) {
    controls.dataset.r20PptWired =
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
            "[data-r20-ppt-action]",
          );

        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        const currentNav =
          navControls(root);

        const action =
          button.getAttribute(
            "data-r20-ppt-action",
          );

        const source =
          action ===
            "previous"
            ? currentNav.prev
            : currentNav.next;

        if (!source) {
          root.setAttribute(
            "data-r20-ppt-navigation-status",
            "missing",
          );
          return;
        }

        const before =
          signature(root);

        source.click();

        root.setAttribute(
          "data-r20-ppt-nav-event",
          action,
        );

        requestAnimationFrame(
          () => {
            updateSignature(
              root,
            );

            setTimeout(
              () => {
                updateSignature(
                  root,
                );

                const indicator =
                  root.querySelector(
                    "[data-r20-ppt-indicator='true']",
                  );

                const fresh =
                  navControls(
                    root,
                  );

                if (
                  indicator
                ) {
                  indicator.textContent =
                    fresh.status?.textContent?.trim() ||
                    "PowerPoint";
                }

                root.setAttribute(
                  "data-r20-ppt-slide-changed",
                  signature(root) !==
                    before
                    ? "true"
                    : "pending",
                );
              },
              120,
            );
          },
        );
      },
    );
  }

  root.setAttribute(
    "data-r20-ppt-navigation-status",
    "ready",
  );
}

function markRoot(
  root,
) {
  root.setAttribute(
    "data-r20-ppt-root",
    "true",
  );

  const surface =
    slideSurface(root);

  if (
    surface &&
    surface !== root
  ) {
    surface.setAttribute(
      "data-r20-ppt-slide-surface",
      "true",
    );
  } else {
    root.setAttribute(
      "data-r20-ppt-slide-surface",
      "true",
    );
  }

  ensureControls(
    root,
  );

  updateSignature(
    root,
  );
}

function run() {
  const root =
    findRoot();

  if (root) {
    markRoot(root);
  }
}

export function installR20PowerPointMode() {
  if (
    typeof window ===
      "undefined" ||
    typeof document ===
      "undefined"
  ) {
    return;
  }

  if (
    window.__MOBDEA_R20_POWERPOINT_MODE__
  ) {
    return;
  }

  window.__MOBDEA_R20_POWERPOINT_MODE__ =
    R20_POWERPOINT_MARKER;

  let queued =
    false;

  const schedule =
    () => {
      if (queued) return;

      queued = true;

      requestAnimationFrame(
        () => {
          queued = false;
          run();
        },
      );
    };

  new MutationObserver(
    schedule,
  ).observe(
    document.documentElement,
    {
      childList:
        true,
      subtree:
        true,
      attributes:
        true,
      characterData:
        true,
      attributeFilter: [
        "class",
        "style",
        "src",
        "data-current-slide",
        "aria-current",
        "aria-label",
        "title",
      ],
    },
  );

  window.addEventListener(
    "resize",
    schedule,
    {
      passive:
        true,
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
      installR20PowerPointMode,
      {
        once: true,
      },
    );
  } else {
    installR20PowerPointMode();
  }
}
