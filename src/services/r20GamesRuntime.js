import {
  R20_GAMES_PATH,
  R20_GAMES_HAS_QUESTION_FLOW,
} from "../config/r20GamesConfig.js";

export const R20_GAMES_MARKER =
  "R20_FIX18_GAMES_V1";

const HUB_SELECTORS = [
  "[data-games]",
  "[data-game-hub]",
  "[data-games-grid]",
  ".games-page",
  ".games-hub",
  ".games-grid",
  ".game-selection",
  "[class*='games-page']",
  "[class*='games-grid']",
  "[class*='game-selection']",
];

const GAME_ROOT_SELECTORS = [
  "[data-game-root]",
  "[data-active-game]",
  ".game-screen",
  ".game-container",
  ".quiz-container",
  ".quiz-screen",
  "[class*='game-screen']",
  "[class*='quiz-container']",
];

const QUESTION_SELECTORS = [
  "[data-game-question]",
  "[data-question]",
  "[data-question-text]",
  ".game-question",
  ".question-text",
  ".quiz-question",
  "[class*='game-question']",
  "[class*='question-text']",
];

const ANSWER_SELECTORS = [
  "[data-game-answer]",
  "[data-answer]",
  "[data-option]",
  ".answer-option",
  ".game-answer",
  ".quiz-option",
  ".choice",
  "[class*='answer-option']",
  "[class*='quiz-option']",
];

const SCORE_SELECTORS = [
  "[data-game-score]",
  "[data-score]",
  "[data-points]",
  "[data-lives]",
  ".game-score",
  ".score",
  ".lives",
  ".progress",
  "[class*='score']",
  "[class*='lives']",
  "[class*='progress']",
];

const stateByRoot = new WeakMap();

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

function semantic(element) {
  return clean([
    element?.getAttribute?.("aria-label"),
    element?.getAttribute?.("title"),
    element?.getAttribute?.("data-game"),
    element?.getAttribute?.("data-game-id"),
    element?.getAttribute?.("data-action"),
    element?.className,
    element?.textContent,
  ].filter(Boolean).join(" "));
}

function dashboardRoot() {
  return document.querySelector(
    '[data-r20-dashboard-role="student"]',
  );
}

function dashboardCards(root) {
  return [
    ...root.querySelectorAll(
      "[data-dashboard-card], [data-feature-card], .dashboard-card, .feature-card, .quick-action-card, .dashboard-action, .dashboard-tile, a[href], button",
    ),
  ];
}

function existingGamesEntry(root) {
  return (
    dashboardCards(root).find((card) => {
      const feature = card.getAttribute(
        "data-r20-dashboard-feature",
      );

      return (
        feature === "games" ||
        /games?|الألعاب|العاب|ألعاب/.test(
          semantic(card),
        )
      );
    }) || null
  );
}

function routeWithBase(value) {
  const route = String(value || "").trim();
  if (!route) return "";

  if (
    /^https?:\/\//i.test(route) ||
    route.startsWith("#")
  ) {
    return route;
  }

  return route.startsWith("/")
    ? route
    : `/${route}`;
}

export function openR20Games() {
  const dashboard = dashboardRoot();

  if (dashboard) {
    const existing = existingGamesEntry(dashboard);

    if (
      existing &&
      existing.getAttribute(
        "data-r20-games-injected",
      ) !== "true"
    ) {
      const anchor = existing.matches("a[href]")
        ? existing
        : existing.querySelector("a[href]");

      if (anchor) {
        anchor.click();
        return true;
      }
    }
  }

  const route = routeWithBase(R20_GAMES_PATH);

  if (!route) {
    window.dispatchEvent(
      new CustomEvent("mobdea:r20-open-games"),
    );
    return false;
  }

  if (/^https?:\/\//i.test(route)) {
    window.location.assign(route);
    return true;
  }

  if (route.startsWith("#")) {
    window.location.hash = route.slice(1);
    return true;
  }

  window.history.pushState({}, "", route);
  window.dispatchEvent(
    new PopStateEvent("popstate"),
  );

  return true;
}

function ensureStudentGamesEntry() {
  const dashboard = dashboardRoot();
  if (!dashboard) return;

  if (
    dashboard.getAttribute(
      "data-r20-dashboard-locked",
    ) === "true"
  ) {
    return;
  }

  const existing = existingGamesEntry(dashboard);

  if (existing) {
    existing.setAttribute(
      "data-r20-dashboard-feature",
      "games",
    );
    existing.setAttribute(
      "data-r20-dashboard-access",
      "allowed",
    );
    existing.setAttribute(
      "data-r20-games-dashboard-entry",
      "true",
    );
    return;
  }

  if (!R20_GAMES_PATH) {
    dashboard.setAttribute(
      "data-r20-games-dashboard-status",
      "missing-route",
    );
    return;
  }

  const grid =
    dashboard.querySelector(
      ".dashboard-grid, .dashboard-feature-grid, [data-dashboard-grid], [class*='dashboard-grid']",
    ) || dashboard;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "r20-games-dashboard-card";
  button.setAttribute("data-dashboard-card", "true");
  button.setAttribute("data-r20-dashboard-feature", "games");
  button.setAttribute("data-r20-dashboard-access", "allowed");
  button.setAttribute("data-r20-games-dashboard-entry", "true");
  button.setAttribute("data-r20-games-injected", "true");

  button.innerHTML = `
    <span class="r20-games-dashboard-card__icon" aria-hidden="true">🎮</span>
    <span class="r20-games-dashboard-card__copy">
      <strong>الألعاب التعليمية</strong>
      <small>اختر لعبة وابدأ التحدي</small>
    </span>
  `;

  button.addEventListener("click", openR20Games);
  grid.appendChild(button);

  dashboard.setAttribute(
    "data-r20-games-dashboard-status",
    "ready",
  );
}

function findHub() {
  for (const selector of HUB_SELECTORS) {
    const node = [
      ...document.querySelectorAll(selector),
    ].find(visible);

    if (node) return node;
  }

  return [
    ...document.querySelectorAll("main, section, div"),
  ].find((node) => {
    if (!visible(node)) return false;

    if (
      !/games?|الألعاب|العاب|ألعاب/.test(
        semantic(node),
      )
    ) {
      return false;
    }

    return (
      node.querySelectorAll(
        "button, a[href], [role='button'], [data-game], [data-game-id], .game-card, [class*='game-card']",
      ).length >= 2
    );
  }) || null;
}

function markHub(hub) {
  hub.setAttribute("data-r20-games-hub", "true");

  const cards = [
    ...hub.querySelectorAll(
      "[data-game], [data-game-id], .game-card, [class*='game-card'], button, a[href], [role='button']",
    ),
  ].filter((card) => {
    if (
      card.closest(
        '[data-r20-game-question-flow="true"]',
      )
    ) {
      return false;
    }

    return (
      /game|quiz|لعبة|تحدي|مسابقة/.test(
        semantic(card),
      ) ||
      card.matches(
        "[data-game], [data-game-id], .game-card, [class*='game-card']",
      )
    );
  });

  cards.forEach((card) => {
    card.setAttribute("data-r20-game-card", "true");
  });

  hub.setAttribute(
    "data-r20-game-card-count",
    String(cards.length),
  );
}

function firstVisible(root, selectors) {
  for (const selector of selectors) {
    const node = [
      ...root.querySelectorAll(selector),
    ].find(
      (item) =>
        visible(item) &&
        clean(item.textContent),
    );

    if (node) return node;
  }

  return null;
}

function questionNode(root) {
  return firstVisible(root, QUESTION_SELECTORS);
}

function answerNodes(root) {
  const output = [];

  for (const selector of ANSWER_SELECTORS) {
    root.querySelectorAll(selector).forEach((node) => {
      if (
        visible(node) &&
        !output.includes(node)
      ) {
        output.push(node);
      }
    });
  }

  if (output.length >= 2) return output;

  root.querySelectorAll(
    "button, [role='button']",
  ).forEach((node) => {
    if (
      !visible(node) ||
      output.includes(node) ||
      node.closest("[data-r20-game-controls='true']")
    ) {
      return;
    }

    const text = clean(node.textContent);

    if (
      text &&
      !/التالي|السابق|إنهاء|انهاء|خروج|ابدأ|start|next|previous|finish|exit/i.test(
        text,
      )
    ) {
      output.push(node);
    }
  });

  return output;
}

function scoreSignature(root) {
  const output = [];

  for (const selector of SCORE_SELECTORS) {
    root.querySelectorAll(selector).forEach((node) => {
      if (visible(node)) {
        output.push(
          clean(node.textContent),
        );
      }
    });
  }

  return output.join("|");
}

function questionSignature(root) {
  return clean(
    questionNode(root)?.textContent || "",
  );
}

function activeGameRoots() {
  const roots = new Set();

  for (const selector of GAME_ROOT_SELECTORS) {
    document.querySelectorAll(selector).forEach((root) => {
      if (visible(root)) {
        roots.add(root);
      }
    });
  }

  const question = [
    ...document.querySelectorAll(
      QUESTION_SELECTORS.join(","),
    ),
  ].find(visible);

  if (question) {
    const root = question.closest(
      "[data-game-root], [data-active-game], .game-screen, .game-container, .quiz-container, .quiz-screen, main, section",
    );

    if (root && visible(root)) {
      roots.add(root);
    }
  }

  return [...roots];
}

function stateFor(root) {
  let state = stateByRoot.get(root);

  if (!state) {
    state = { wired: false };
    stateByRoot.set(root, state);
  }

  return state;
}

function markQuestionFlow(root) {
  if (!R20_GAMES_HAS_QUESTION_FLOW) return;

  const question = questionNode(root);
  const answers = answerNodes(root);

  if (!question || answers.length < 2) return;

  root.setAttribute(
    "data-r20-game-question-flow",
    "true",
  );

  question.setAttribute(
    "data-r20-game-current-question",
    "true",
  );

  answers.forEach((answer) => {
    answer.setAttribute(
      "data-r20-game-answer",
      "true",
    );
  });

  root.setAttribute(
    "data-r20-game-answer-count",
    String(answers.length),
  );

  const state = stateFor(root);
  if (state.wired) return;
  state.wired = true;

  root.addEventListener(
    "click",
    (event) => {
      const answer = event.target.closest?.(
        '[data-r20-game-answer="true"]',
      );

      if (!answer) return;

      const beforeQuestion = questionSignature(root);
      const beforeScore = scoreSignature(root);

      root.setAttribute(
        "data-r20-game-question-transition",
        "pending",
      );

      const verify = () => {
        const afterQuestion = questionSignature(root);
        const afterScore = scoreSignature(root);

        const changed =
          (
            afterQuestion &&
            afterQuestion !== beforeQuestion
          ) ||
          (
            afterScore &&
            afterScore !== beforeScore
          );

        root.setAttribute(
          "data-r20-game-question-transition",
          changed ? "true" : "pending",
        );
      };

      requestAnimationFrame(verify);
      setTimeout(verify, 120);
      setTimeout(verify, 450);
    },
    true,
  );
}

function markGameRoot(root) {
  root.setAttribute(
    "data-r20-game-active-root",
    "true",
  );

  root.querySelectorAll(
    "aside, [class*='sidebar'], [class*='panel'], [class*='leaderboard'], [class*='ranking'], [class*='help'], [class*='instructions']",
  ).forEach((panel) => {
    if (visible(panel)) {
      panel.setAttribute(
        "data-r20-game-side-panel",
        "true",
      );
    }
  });

  markQuestionFlow(root);
}

function run() {
  ensureStudentGamesEntry();

  const hub = findHub();
  if (hub) markHub(hub);

  activeGameRoots().forEach(markGameRoot);
}

export function installR20GamesRuntime() {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return;
  }

  if (window.__MOBDEA_R20_GAMES__) return;

  window.__MOBDEA_R20_GAMES__ = R20_GAMES_MARKER;

  window.mobdeaR20Games = Object.freeze({
    marker: R20_GAMES_MARKER,
    path: R20_GAMES_PATH,
    hasQuestionFlow: R20_GAMES_HAS_QUESTION_FLOW,
    open: openR20Games,
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
        "data-game",
        "data-game-id",
        "data-question",
        "data-answer",
        "data-score",
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
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      installR20GamesRuntime,
      { once: true },
    );
  } else {
    installR20GamesRuntime();
  }
}
