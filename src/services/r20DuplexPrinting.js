import {
  R20_DUPLEX_EXISTING_SOURCE_COUNT,
  R20_DUPLEX_HAS_PRINT,
  R20_DUPLEX_HAS_STUDENT_CARDS,
  R20_DUPLEX_DEFAULT_FLIP_EDGE,
  R20_DUPLEX_A4_WIDTH_MM,
  R20_DUPLEX_A4_HEIGHT_MM,
  R20_DUPLEX_CARD_WIDTH_MM,
  R20_DUPLEX_CARD_HEIGHT_MM,
  R20_DUPLEX_COLUMNS,
  R20_DUPLEX_ROWS,
} from "../config/r20DuplexPrintConfig.js";

export const R20_DUPLEX_PRINT_MARKER =
  "R20_FIX23_DUPLEX_PRINTING_V1";

export const R20_DUPLEX_PAGE = Object.freeze({
  widthMm:
    R20_DUPLEX_A4_WIDTH_MM,
  heightMm:
    R20_DUPLEX_A4_HEIGHT_MM,
  cardWidthMm:
    R20_DUPLEX_CARD_WIDTH_MM,
  cardHeightMm:
    R20_DUPLEX_CARD_HEIGHT_MM,
  columns:
    R20_DUPLEX_COLUMNS,
  rows:
    R20_DUPLEX_ROWS,
  capacity:
    R20_DUPLEX_COLUMNS *
    R20_DUPLEX_ROWS,
});

const PRINT_ROOT_ID =
  "r20-duplex-print-root";

const CARD_ROOT_SELECTORS = Object.freeze([
  "[data-student-card]",
  "[data-card-print]",
  "[data-print-card]",
  ".student-card",
  ".student-id-card",
  ".id-card",
  "[class*='student-card']",
]);

const FRONT_SELECTORS = Object.freeze([
  '[data-card-side="front"]',
  "[data-card-front]",
  ".card-front",
  ".student-card-front",
  "[class*='card-front']",
  "[class*='front-side']",
]);

const BACK_SELECTORS = Object.freeze([
  '[data-card-side="back"]',
  "[data-card-back]",
  ".card-back",
  ".student-card-back",
  "[class*='card-back']",
  "[class*='back-side']",
]);

const clean =
  (value) =>
    String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();

function normalizeFlipEdge(
  value,
) {
  const normalized =
    clean(
      value,
    )
      .toLowerCase();

  return normalized ===
    "short-edge"
      ? "short-edge"
      : "long-edge";
}

function slotRow(
  slotIndex,
) {
  return Math.floor(
    slotIndex /
    R20_DUPLEX_COLUMNS,
  );
}

function slotColumn(
  slotIndex,
) {
  return (
    slotIndex %
    R20_DUPLEX_COLUMNS
  );
}

export function physicalBackSlotIndex(
  frontSlotIndex,
  flipEdge =
    R20_DUPLEX_DEFAULT_FLIP_EDGE,
) {
  const index =
    Number(
      frontSlotIndex,
    );

  if (
    !Number.isInteger(
      index,
    ) ||
    index < 0 ||
    index >=
      R20_DUPLEX_PAGE
        .capacity
  ) {
    throw new Error(
      "R20 invalid duplex front slot index.",
    );
  }

  const edge =
    normalizeFlipEdge(
      flipEdge,
    );

  const row =
    slotRow(
      index,
    );

  const column =
    slotColumn(
      index,
    );

  if (
    edge ===
      "short-edge"
  ) {
    return (
      (
        R20_DUPLEX_ROWS -
        1 -
        row
      ) *
      R20_DUPLEX_COLUMNS +
      column
    );
  }

  return (
    row *
      R20_DUPLEX_COLUMNS +
    (
      R20_DUPLEX_COLUMNS -
      1 -
      column
    )
  );
}

function cardId(
  record,
  index,
) {
  return (
    clean(
      record?.cardId ??
      record?.id ??
      "",
    ) ||
    `r20-card-${index + 1}`
  );
}

function normalizedRecord(
  record,
  index,
) {
  if (
    !record ||
    !record.front ||
    !record.back
  ) {
    throw new Error(
      `R20 duplex card ${index + 1} is missing a real front or back side.`,
    );
  }

  return {
    ...record,
    cardId:
      cardId(
        record,
        index,
      ),
  };
}

export function buildDuplexManifest(
  records,
  {
    flipEdge =
      R20_DUPLEX_DEFAULT_FLIP_EDGE,
  } = {},
) {
  if (
    !Array.isArray(
      records,
    ) ||
    !records.length
  ) {
    throw new Error(
      "R20 duplex printing requires at least one front/back card pair.",
    );
  }

  const edge =
    normalizeFlipEdge(
      flipEdge,
    );

  const normalized =
    records.map(
      normalizedRecord,
    );

  const capacity =
    R20_DUPLEX_PAGE
      .capacity;

  const sheets = [];

  for (
    let start = 0;
    start <
      normalized.length;
    start +=
      capacity
  ) {
    const chunk =
      normalized.slice(
        start,
        start +
          capacity,
      );

    const frontSlots =
      Array(
        capacity,
      ).fill(
        null,
      );

    const backSlots =
      Array(
        capacity,
      ).fill(
        null,
      );

    chunk.forEach(
      (
        record,
        localIndex,
      ) => {
        frontSlots[
          localIndex
        ] = {
          slotIndex:
            localIndex,
          cardIndex:
            start +
            localIndex,
          cardId:
            record.cardId,
          side:
            "front",
        };

        const backIndex =
          physicalBackSlotIndex(
            localIndex,
            edge,
          );

        backSlots[
          backIndex
        ] = {
          slotIndex:
            backIndex,
          frontSlotIndex:
            localIndex,
          cardIndex:
            start +
            localIndex,
          cardId:
            record.cardId,
          side:
            "back",
        };
      },
    );

    sheets.push({
      sheetIndex:
        sheets.length,
      flipEdge:
        edge,
      count:
        chunk.length,
      startCardIndex:
        start,
      frontSlots,
      backSlots,
    });
  }

  return {
    marker:
      R20_DUPLEX_PRINT_MARKER,
    flipEdge:
      edge,
    page:
      {
        ...R20_DUPLEX_PAGE,
      },
    cardCount:
      normalized.length,
    sheetCount:
      sheets.length,
    physicalPageCount:
      sheets.length *
      2,
    sheets,
  };
}

function firstMatch(
  root,
  selectors,
) {
  for (
    const selector of
    selectors
  ) {
    const found =
      root.matches?.(
        selector,
      )
        ? root
        : root.querySelector?.(
            selector,
          );

    if (found) {
      return found;
    }
  }

  return null;
}

function candidateRoots(
  root,
) {
  const output =
    new Set();

  for (
    const selector of
    CARD_ROOT_SELECTORS
  ) {
    root
      .querySelectorAll?.(
        selector,
      )
      .forEach(
        (node) =>
          output.add(
            node,
          ),
      );
  }

  return [
    ...output,
  ];
}

function pairFromRoot(
  root,
  index,
) {
  const front =
    firstMatch(
      root,
      FRONT_SELECTORS,
    );

  const back =
    firstMatch(
      root,
      BACK_SELECTORS,
    );

  if (
    !front ||
    !back ||
    front ===
      back
  ) {
    return null;
  }

  const id =
    clean(
      root.getAttribute?.(
        "data-card-id",
      ) ||
      root.getAttribute?.(
        "data-student-id",
      ) ||
      root.id ||
      front.getAttribute?.(
        "data-card-id",
      ) ||
      ""
    ) ||
    `r20-dom-card-${index + 1}`;

  return {
    cardId:
      id,
    root,
    front,
    back,
  };
}

export function collectDuplexCards(
  root =
    typeof document !==
      "undefined"
      ? document
      : null,
) {
  if (!root) {
    return [];
  }

  const records = [];

  candidateRoots(
    root,
  ).forEach(
    (
      candidate,
      index,
    ) => {
      const pair =
        pairFromRoot(
          candidate,
          index,
        );

      if (pair) {
        records.push(
          pair,
        );
      }
    },
  );

  if (
    records.length
  ) {
    return records;
  }

  const fronts = [];

  for (
    const selector of
    FRONT_SELECTORS
  ) {
    root
      .querySelectorAll?.(
        selector,
      )
      .forEach(
        (node) => {
          if (
            !fronts.includes(
              node,
            )
          ) {
            fronts.push(
              node,
            );
          }
        },
      );
  }

  const backs = [];

  for (
    const selector of
    BACK_SELECTORS
  ) {
    root
      .querySelectorAll?.(
        selector,
      )
      .forEach(
        (node) => {
          if (
            !backs.includes(
              node,
            )
          ) {
            backs.push(
              node,
            );
          }
        },
      );
  }

  if (
    fronts.length !==
      backs.length
  ) {
    return [];
  }

  return fronts
    .map(
      (
        front,
        index,
      ) => ({
        cardId:
          clean(
            front.getAttribute?.(
              "data-card-id",
            ) ||
            front.getAttribute?.(
              "data-student-id",
            ) ||
            ""
          ) ||
          `r20-dom-card-${index + 1}`,
        front,
        back:
          backs[index],
      }),
    );
}

function cloneSide(
  side,
) {
  const clone =
    side.cloneNode(
      true,
    );

  clone.removeAttribute?.(
    "id",
  );

  clone.setAttribute?.(
    "data-r20-duplex-clone",
    "true",
  );

  return clone;
}

function pageElement(
  side,
  sheetIndex,
  flipEdge,
) {
  const page =
    document.createElement(
      "section",
    );

  page.className =
    "r20-duplex-sheet-page";

  page.setAttribute(
    "data-r20-duplex-sheet-page",
    "true",
  );

  page.setAttribute(
    "data-r20-duplex-side",
    side,
  );

  page.setAttribute(
    "data-r20-duplex-sheet-index",
    String(
      sheetIndex,
    ),
  );

  page.setAttribute(
    "data-r20-duplex-flip-edge",
    flipEdge,
  );

  const grid =
    document.createElement(
      "div",
    );

  grid.className =
    "r20-duplex-sheet-grid";

  grid.setAttribute(
    "data-r20-duplex-grid",
    "true",
  );

  page.appendChild(
    grid,
  );

  return {
    page,
    grid,
  };
}

function slotElement(
  slotIndex,
  side,
) {
  const slot =
    document.createElement(
      "div",
    );

  slot.className =
    "r20-duplex-card-slot";

  slot.setAttribute(
    "data-r20-duplex-slot",
    String(
      slotIndex,
    ),
  );

  slot.setAttribute(
    "data-r20-duplex-side",
    side,
  );

  return slot;
}

function appendPageSlots(
  grid,
  slots,
  records,
) {
  for (
    let slotIndex = 0;
    slotIndex <
      R20_DUPLEX_PAGE
        .capacity;
    slotIndex += 1
  ) {
    const slot =
      slotElement(
        slotIndex,
        slots[
          slotIndex
        ]?.side ||
        "empty",
      );

    const manifestSlot =
      slots[
        slotIndex
      ];

    if (
      manifestSlot
    ) {
      const record =
        records[
          manifestSlot
            .cardIndex
        ];

      const side =
        manifestSlot.side ===
          "front"
          ? record.front
          : record.back;

      slot.setAttribute(
        "data-r20-card-id",
        manifestSlot
          .cardId,
      );

      slot.setAttribute(
        "data-r20-card-index",
        String(
          manifestSlot
            .cardIndex,
        ),
      );

      if (
        manifestSlot
          .frontSlotIndex !==
        undefined
      ) {
        slot.setAttribute(
          "data-r20-front-slot-index",
          String(
            manifestSlot
              .frontSlotIndex,
          ),
        );
      }

      const content =
        document.createElement(
          "div",
        );

      content.className =
        "r20-duplex-card-content";

      content.appendChild(
        cloneSide(
          side,
        ),
      );

      slot.appendChild(
        content,
      );
    } else {
      slot.setAttribute(
        "data-r20-empty-slot",
        "true",
      );
    }

    grid.appendChild(
      slot,
    );
  }
}

export function buildPrintRoot(
  records,
  {
    flipEdge =
      R20_DUPLEX_DEFAULT_FLIP_EDGE,
  } = {},
) {
  if (
    typeof document ===
      "undefined"
  ) {
    throw new Error(
      "R20 duplex DOM printing requires document.",
    );
  }

  const normalized =
    records.map(
      normalizedRecord,
    );

  const manifest =
    buildDuplexManifest(
      normalized,
      {
        flipEdge,
      },
    );

  document
    .getElementById(
      PRINT_ROOT_ID,
    )
    ?.remove();

  const root =
    document.createElement(
      "main",
    );

  root.id =
    PRINT_ROOT_ID;

  root.className =
    "r20-duplex-print-root";

  root.setAttribute(
    "data-r20-duplex-print-root",
    "true",
  );

  root.setAttribute(
    "data-r20-duplex-page-count",
    String(
      manifest
        .physicalPageCount,
    ),
  );

  root.setAttribute(
    "data-r20-duplex-flip-edge",
    manifest
      .flipEdge,
  );

  for (
    const sheet of
    manifest.sheets
  ) {
    const front =
      pageElement(
        "front",
        sheet.sheetIndex,
        manifest
          .flipEdge,
      );

    appendPageSlots(
      front.grid,
      sheet.frontSlots,
      normalized,
    );

    root.appendChild(
      front.page,
    );

    const back =
      pageElement(
        "back",
        sheet.sheetIndex,
        manifest
          .flipEdge,
      );

    appendPageSlots(
      back.grid,
      sheet.backSlots,
      normalized,
    );

    root.appendChild(
      back.page,
    );
  }

  document.body
    .appendChild(
      root,
    );

  return {
    root,
    manifest,
  };
}

export function cleanupPrintRoot() {
  document
    ?.getElementById?.(
      PRINT_ROOT_ID,
    )
    ?.remove();
}

function configuredFlipEdge() {
  return normalizeFlipEdge(
    document
      .documentElement
      .getAttribute(
        "data-r20-duplex-flip-edge",
      ) ||
    document
      .body
      ?.getAttribute(
        "data-r20-duplex-flip-edge",
      ) ||
    R20_DUPLEX_DEFAULT_FLIP_EDGE,
  );
}

export function prepareDuplexPrint({
  root =
    document,
  flipEdge =
    configuredFlipEdge(),
} = {}) {
  const records =
    collectDuplexCards(
      root,
    );

  if (
    !records.length
  ) {
    throw new Error(
      "R20 could not find complete student-card front/back pairs for duplex printing.",
    );
  }

  const prepared =
    buildPrintRoot(
      records,
      {
        flipEdge,
      },
    );

  window.dispatchEvent(
    new CustomEvent(
      "mobdea:r20-duplex-print-ready",
      {
        detail: {
          cardCount:
            prepared
              .manifest
              .cardCount,
          sheetCount:
            prepared
              .manifest
              .sheetCount,
          physicalPageCount:
            prepared
              .manifest
              .physicalPageCount,
          flipEdge:
            prepared
              .manifest
              .flipEdge,
        },
      },
    ),
  );

  return prepared;
}

function looksLikeStudentCardPrintControl(
  element,
) {
  if (
    !element ||
    !element.matches?.(
      "button, [role='button'], a"
    )
  ) {
    return false;
  }

  const text =
    clean([
      element.textContent,
      element.getAttribute(
        "aria-label",
      ),
      element.getAttribute(
        "title",
      ),
      element.id,
      element.className,
    ].join(
      " ",
    ))
      .toLowerCase();

  const hasPrint =
    /print|طباعة/.test(
      text,
    );

  const hasCard =
    /card|student|بطاق|كارت|طالب/.test(
      text,
    );

  return (
    hasPrint &&
    hasCard
  );
}

let explicitPrintIntent =
  false;

function markPrintIntent(
  event,
) {
  const control =
    event.target
      ?.closest?.(
        "button, [role='button'], a",
      );

  if (
    !looksLikeStudentCardPrintControl(
      control,
    )
  ) {
    return;
  }

  explicitPrintIntent =
    true;

  control.setAttribute(
    "data-r20-duplex-print-control",
    "true",
  );
}

function beforePrintHandler() {
  if (
    document.getElementById(
      PRINT_ROOT_ID,
    )
  ) {
    return;
  }

  const records =
    collectDuplexCards(
      document,
    );

  if (
    !records.length
  ) {
    return;
  }

  if (
    !explicitPrintIntent &&
    !document.querySelector(
      "[data-r20-duplex-print-control='true']",
    )
  ) {
    // Existing code can call window.print() without a click marker.
    // Complete front/back card pairs are enough to activate the print-only root.
  }

  buildPrintRoot(
    records,
    {
      flipEdge:
        configuredFlipEdge(),
    },
  );
}

function afterPrintHandler() {
  explicitPrintIntent =
    false;

  cleanupPrintRoot();
}

export function installR20DuplexPrinting() {
  if (
    typeof window ===
      "undefined" ||
    typeof document ===
      "undefined"
  ) {
    return;
  }

  if (
    window
      .__MOBDEA_R20_DUPLEX_PRINTING__
  ) {
    return;
  }

  if (
    !(
      R20_DUPLEX_HAS_PRINT &&
      R20_DUPLEX_HAS_STUDENT_CARDS &&
      R20_DUPLEX_EXISTING_SOURCE_COUNT >
        0
    )
  ) {
    throw new Error(
      "R20 duplex printing prerequisites are not ready.",
    );
  }

  window
    .__MOBDEA_R20_DUPLEX_PRINTING__ =
    R20_DUPLEX_PRINT_MARKER;

  window
    .mobdeaR20DuplexPrinting =
    Object.freeze({
      marker:
        R20_DUPLEX_PRINT_MARKER,
      page:
        R20_DUPLEX_PAGE,
      physicalBackSlotIndex,
      buildDuplexManifest,
      collectDuplexCards,
      buildPrintRoot,
      preparePrint:
        prepareDuplexPrint,
      cleanup:
        cleanupPrintRoot,
      setFlipEdge:
        (
          edge,
        ) => {
          const normalized =
            normalizeFlipEdge(
              edge,
            );

          document
            .documentElement
            .setAttribute(
              "data-r20-duplex-flip-edge",
              normalized,
            );

          return normalized;
        },
    });

  document.addEventListener(
    "click",
    markPrintIntent,
    true,
  );

  window.addEventListener(
    "beforeprint",
    beforePrintHandler,
  );

  window.addEventListener(
    "afterprint",
    afterPrintHandler,
  );
}

if (
  typeof window !==
    "undefined" &&
  typeof document !==
    "undefined"
) {
  if (
    document.readyState ===
      "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      installR20DuplexPrinting,
      {
        once:
          true,
      },
    );
  } else {
    installR20DuplexPrinting();
  }
}
