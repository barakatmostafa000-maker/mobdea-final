export const R20_EDUCATIONAL_CARDS_MARKER =
  "R20_FIX10_EDUCATIONAL_CARDS_V1";

const CARD_ROOT_SELECTORS = [
  "[data-educational-card]",
  "[data-card-type='term']",
  "[data-card-type='definition']",
  ".educational-card",
  ".definition-card",
  ".term-card",
  ".lesson-card",
  "[class*='definition-card']",
  "[class*='term-card']",
  "[class*='educational-card']",
];

const PANEL_SELECTORS = [
  ".cards-panel",
  ".educational-cards-panel",
  ".lesson-cards-panel",
  "[data-cards-panel]",
  "[class*='cards-panel']",
  "[class*='card-panel']",
];

const TITLE_SELECTORS = [
  "[data-card-term]",
  "[data-term]",
  ".card-term",
  ".term",
  ".definition-title",
  ".card-title",
  "h1",
  "h2",
  "h3",
];

const BODY_SELECTORS = [
  "[data-card-definition]",
  "[data-definition]",
  ".card-definition",
  ".definition",
  ".card-body",
  ".card-content",
  "p",
];

const processed = new WeakSet();

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function first(root, selectors) {
  for (const selector of selectors) {
    const found = root.querySelector(selector);
    if (found) return found;
  }
  return null;
}

function cardTextSignature(card) {
  return clean([
    card.getAttribute?.("aria-label"),
    card.getAttribute?.("title"),
    card.getAttribute?.("data-card-type"),
    card.className,
    card.textContent,
  ].filter(Boolean).join(" ")).toLowerCase();
}

function isCountryCard(card) {
  const text = cardTextSignature(card);
  return (
    /country|الدولة|العاصمة|القارة|العلم|population|capital|continent/.test(text) ||
    card.matches?.(
      "[data-card-type='country'], [data-country-card], .country-card, [class*='country-card']",
    )
  );
}

function isEducationalDefinitionCard(card) {
  if (!card || isCountryCard(card)) return false;

  const text = cardTextSignature(card);
  if (/مصطلح|تعريف|definition|term|مفهوم|concept/.test(text)) {
    return true;
  }

  const title = first(card, TITLE_SELECTORS);
  const body = first(card, BODY_SELECTORS);

  return Boolean(
    title &&
    body &&
    title !== body &&
    clean(title.textContent).length > 0 &&
    clean(body.textContent).length > 0
  );
}

export function cardTextClass(term = "", definition = "") {
  const titleLength = clean(term).length;
  const bodyLength = clean(definition).length;
  const total = titleLength + bodyLength;

  if (bodyLength > 420 || total > 500) return "xxlong";
  if (bodyLength > 270 || total > 340) return "xlong";
  if (bodyLength > 160 || total > 220) return "long";
  if (bodyLength > 90 || total > 140) return "medium";
  return "short";
}

export function cardFontScale(term = "", definition = "") {
  return {
    short: 1,
    medium: 0.92,
    long: 0.82,
    xlong: 0.72,
    xxlong: 0.64,
  }[cardTextClass(term, definition)] || 1;
}

function directMeaningfulChildren(card) {
  return [...card.children].filter((child) => {
    if (
      child.matches(
        "button, [role='button'], .card-actions, .card-controls, [data-card-actions]",
      )
    ) {
      return false;
    }
    return clean(child.textContent).length > 0;
  });
}

function resolveTitle(card) {
  const explicit = first(card, TITLE_SELECTORS);
  if (explicit) return explicit;

  return directMeaningfulChildren(card).find((child) => {
    const text = clean(child.textContent);
    return text.length > 0 && text.length <= 120;
  }) || null;
}

function resolveBody(card, title) {
  for (const selector of BODY_SELECTORS) {
    const candidates = [...card.querySelectorAll(selector)];
    const found = candidates.find(
      (candidate) =>
        candidate !== title &&
        !candidate.contains(title) &&
        clean(candidate.textContent).length > 0,
    );
    if (found) return found;
  }

  return directMeaningfulChildren(card).find(
    (child) =>
      child !== title &&
      !child.contains(title) &&
      clean(child.textContent).length > 0,
  ) || null;
}

function ensureUnifiedBody(card, title, body) {
  if (!title || !body) return null;

  let unified = card.querySelector(
    ":scope > [data-r20-educational-card-body='true']",
  );

  if (!unified) {
    unified = document.createElement("div");
    unified.setAttribute("data-r20-educational-card-body", "true");
    unified.className = "r20-educational-card__body";

    const content = document.createElement("div");
    content.setAttribute("data-r20-educational-card-content", "true");
    content.className = "r20-educational-card__content";
    unified.appendChild(content);

    const insertionPoint = directMeaningfulChildren(card)[0] || null;
    if (insertionPoint) card.insertBefore(unified, insertionPoint);
    else card.appendChild(unified);
  }

  const content = unified.querySelector(
    "[data-r20-educational-card-content='true']",
  );

  if (title.parentElement !== content && !content.contains(title)) {
    content.appendChild(title);
  }

  if (body.parentElement !== content && !content.contains(body)) {
    content.appendChild(body);
  }

  title.setAttribute("data-r20-educational-card-term", "true");
  body.setAttribute("data-r20-educational-card-definition", "true");

  return unified;
}

function normalizeLegacySeparators(card) {
  card.querySelectorAll(
    ".term-strip, .definition-strip, .card-strip, [class*='term-strip'], [class*='definition-strip']",
  ).forEach((strip) => {
    strip.setAttribute("data-r20-legacy-card-strip", "true");
  });
}

function measureOverflow(card) {
  return (
    card.scrollHeight > card.clientHeight + 2 ||
    card.scrollWidth > card.clientWidth + 2
  );
}

function fitCard(card, title, body) {
  const textClass = cardTextClass(
    title.textContent,
    body.textContent,
  );

  card.setAttribute("data-r20-card-text-class", textClass);

  const baseScale = cardFontScale(
    title.textContent,
    body.textContent,
  );

  card.style.setProperty("--r20-card-font-scale", String(baseScale));

  requestAnimationFrame(() => {
    let scale = baseScale;

    for (
      let attempt = 0;
      attempt < 7 && measureOverflow(card);
      attempt += 1
    ) {
      scale = Math.max(
        0.54,
        Number((scale - 0.055).toFixed(3)),
      );

      card.style.setProperty(
        "--r20-card-font-scale",
        String(scale),
      );
    }

    card.setAttribute(
      "data-r20-card-fit-scale",
      scale.toFixed(3),
    );
  });
}

function normalizeCard(card) {
  if (!card || processed.has(card) || !isEducationalDefinitionCard(card)) {
    return;
  }

  processed.add(card);

  const title = resolveTitle(card);
  const body = resolveBody(card, title);

  if (!title || !body || title === body) {
    card.setAttribute(
      "data-r20-card-normalization",
      "skipped-no-pair",
    );
    return;
  }

  card.setAttribute("data-r20-educational-card", "true");

  normalizeLegacySeparators(card);

  const unified = ensureUnifiedBody(card, title, body);

  if (!unified) {
    card.setAttribute(
      "data-r20-card-normalization",
      "failed",
    );
    return;
  }

  fitCard(card, title, body);

  card.setAttribute(
    "data-r20-card-normalization",
    "complete",
  );
}

function findCards() {
  const cards = new Set();

  for (const selector of CARD_ROOT_SELECTORS) {
    document.querySelectorAll(selector).forEach((card) => {
      cards.add(card);
    });
  }

  for (const selector of PANEL_SELECTORS) {
    document.querySelectorAll(selector).forEach((panel) => {
      [...panel.children].forEach((child) => {
        if (isEducationalDefinitionCard(child)) {
          cards.add(child);
        }
      });
    });
  }

  return [...cards];
}

function ensureCardsButtonPosition() {
  document
    .querySelectorAll(
      '[data-r20-whiteboard-bottom-control="cards"], [data-r20-control="cards"]',
    )
    .forEach((button) => {
      button.setAttribute(
        "data-r20-educational-cards-trigger",
        "true",
      );
    });
}

function run() {
  findCards().forEach(normalizeCard);
  ensureCardsButtonPosition();
}

export function installR20EducationalCards() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__MOBDEA_R20_EDUCATIONAL_CARDS__) return;

  window.__MOBDEA_R20_EDUCATIONAL_CARDS__ =
    R20_EDUCATIONAL_CARDS_MARKER;

  window.mobdeaR20EducationalCards = Object.freeze({
    marker: R20_EDUCATIONAL_CARDS_MARKER,
    cardTextClass,
    cardFontScale,
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
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "style", "data-card-type"],
    },
  );

  window.addEventListener("resize", schedule, { passive: true });
  run();
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      installR20EducationalCards,
      { once: true },
    );
  } else {
    installR20EducationalCards();
  }
}
