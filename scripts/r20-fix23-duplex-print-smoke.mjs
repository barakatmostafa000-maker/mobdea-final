import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

const baseUrl =
  process.env.R20_DUPLEX_URL ||
  "http://127.0.0.1:4173";

const out =
  path.resolve(
    "r20-duplex-print-smoke",
  );

await fs.mkdir(
  out,
  {
    recursive:
      true,
  },
);

const browser =
  await chromium.launch({
    headless:
      true,
  });

const context =
  await browser.newContext({
    viewport: {
      width:
        1280,
      height:
        800,
    },
  });

await context.addInitScript(() => {
  localStorage.setItem(
    "mobdea_mobile_auth_v2",
    JSON.stringify({
      role:
        "admin",
      name:
        "R20 Duplex Print Audit",
      expiresAt:
        Date.now() +
        60 * 60 * 1000,
    }),
  );
});

const page =
  await context.newPage();

const errors =
  [];

page.on(
  "pageerror",
  (error) =>
    errors.push(
      String(error),
    ),
);

await page.goto(
  baseUrl,
  {
    waitUntil:
      "networkidle",
  },
);

await page.waitForTimeout(
  400,
);

const audit =
  await page.evaluate(
    () => {
      const api =
        window
          .mobdeaR20DuplexPrinting;

      if (!api) {
        return null;
      }

      const fixture =
        document.createElement(
          "section",
        );

      fixture.id =
        "r20-duplex-fixture";

      fixture.style.display =
        "none";

      for (
        let index = 1;
        index <= 11;
        index += 1
      ) {
        const card =
          document.createElement(
            "article",
          );

        card.setAttribute(
          "data-student-card",
          "true",
        );

        card.setAttribute(
          "data-card-id",
          `CARD-${index}`,
        );

        const front =
          document.createElement(
            "div",
          );

        front.setAttribute(
          "data-card-side",
          "front",
        );

        front.innerHTML =
          `<strong>FRONT ${index}</strong><span>STUDENT ${index}</span>`;

        const back =
          document.createElement(
            "div",
          );

        back.setAttribute(
          "data-card-side",
          "back",
        );

        back.innerHTML =
          `<strong>BACK ${index}</strong><span>CODE ${1000 + index}</span>`;

        card.append(
          front,
          back,
        );

        fixture.appendChild(
          card,
        );
      }

      document.body
        .appendChild(
          fixture,
        );

      const prepared =
        api.preparePrint({
          root:
            fixture,
          flipEdge:
            "long-edge",
        });

      const root =
        prepared.root;

      const pages = [
        ...root.querySelectorAll(
          "[data-r20-duplex-sheet-page]",
        ),
      ];

      const front1 =
        pages[0];

      const back1 =
        pages[1];

      const front2 =
        pages[2];

      const back2 =
        pages[3];

      const idAt =
        (
          page,
          slot,
        ) =>
          page
            .querySelector(
              `[data-r20-duplex-slot="${slot}"]`,
            )
            ?.getAttribute(
              "data-r20-card-id",
            ) ||
          null;

      return {
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
        pageCount:
          pages.length,
        sequence:
          pages.map(
            (node) =>
              node.getAttribute(
                "data-r20-duplex-side",
              ),
          ),
        front1Slot0:
          idAt(
            front1,
            0,
          ),
        front1Slot1:
          idAt(
            front1,
            1,
          ),
        back1Slot0:
          idAt(
            back1,
            0,
          ),
        back1Slot1:
          idAt(
            back1,
            1,
          ),
        front2Slot0:
          idAt(
            front2,
            0,
          ),
        back2Slot0:
          idAt(
            back2,
            0,
          ),
        back2Slot1:
          idAt(
            back2,
            1,
          ),
      };
    },
  );

assert.ok(
  audit,
  "Duplex Printing runtime API missing",
);

assert.equal(
  audit.cardCount,
  11,
);

assert.equal(
  audit.sheetCount,
  2,
);

assert.equal(
  audit.physicalPageCount,
  4,
);

assert.equal(
  audit.pageCount,
  4,
);

assert.deepEqual(
  audit.sequence,
  [
    "front",
    "back",
    "front",
    "back",
  ],
  "Front/back are not separate physical pages in sheet-pair order",
);

assert.equal(
  audit.front1Slot0,
  "CARD-1",
);

assert.equal(
  audit.front1Slot1,
  "CARD-2",
);

assert.equal(
  audit.back1Slot0,
  "CARD-2",
  "Long-edge back page did not mirror the first row",
);

assert.equal(
  audit.back1Slot1,
  "CARD-1",
  "Long-edge back page did not align CARD-1 behind its front",
);

assert.equal(
  audit.front2Slot0,
  "CARD-11",
);

assert.equal(
  audit.back2Slot0,
  null,
);

assert.equal(
  audit.back2Slot1,
  "CARD-11",
  "Partial sheet back is not aligned for long-edge duplex",
);

await page.emulateMedia({
  media:
    "print",
});

const geometry =
  await page.evaluate(
    () => {
      const pages = [
        ...document.querySelectorAll(
          "[data-r20-duplex-sheet-page]",
        ),
      ];

      const output = [];

      for (
        const page of
        pages
      ) {
        const pageRect =
          page
            .getBoundingClientRect();

        const occupied =
          [
            ...page.querySelectorAll(
              '[data-r20-duplex-slot]:not([data-r20-empty-slot="true"])',
            ),
          ];

        const slots =
          occupied.map(
            (slot) => {
              const rect =
                slot
                  .getBoundingClientRect();

              return {
                left:
                  rect.left,
                top:
                  rect.top,
                right:
                  rect.right,
                bottom:
                  rect.bottom,
                width:
                  rect.width,
                height:
                  rect.height,
              };
            },
          );

        let overlap =
          false;

        for (
          let first = 0;
          first <
            slots.length;
          first += 1
        ) {
          for (
            let second =
              first + 1;
            second <
              slots.length;
            second += 1
          ) {
            const a =
              slots[first];

            const b =
              slots[second];

            const intersects =
              !(
                a.right <=
                  b.left +
                  .5 ||
                b.right <=
                  a.left +
                  .5 ||
                a.bottom <=
                  b.top +
                  .5 ||
                b.bottom <=
                  a.top +
                  .5
              );

            if (
              intersects
            ) {
              overlap =
                true;
            }
          }
        }

        const clipped =
          slots.some(
            (slot) =>
              slot.left <
                pageRect.left -
                1 ||
              slot.top <
                pageRect.top -
                1 ||
              slot.right >
                pageRect.right +
                1 ||
              slot.bottom >
                pageRect.bottom +
                1,
          );

        output.push({
          width:
            pageRect.width,
          height:
            pageRect.height,
          occupiedCount:
            slots.length,
          overlap,
          clipped,
        });
      }

      return output;
    },
  );

assert.equal(
  geometry.length,
  4,
);

for (
  const [
    index,
    item,
  ] of geometry.entries()
) {
  assert.ok(
    Math.abs(
      item.width -
      210 *
      96 /
      25.4
    ) <
      3,
    `Page ${index + 1} CSS width is not A4`,
  );

  assert.ok(
    Math.abs(
      item.height -
      297 *
      96 /
      25.4
    ) <
      4,
    `Page ${index + 1} CSS height is not A4`,
  );

  assert.equal(
    item.overlap,
    false,
    `Page ${index + 1} has overlapping card slots`,
  );

  assert.equal(
    item.clipped,
    false,
    `Page ${index + 1} has card slots outside the A4 page`,
  );
}

assert.equal(
  geometry[0]
    .occupiedCount,
  10,
);

assert.equal(
  geometry[1]
    .occupiedCount,
  10,
);

assert.equal(
  geometry[2]
    .occupiedCount,
  1,
);

assert.equal(
  geometry[3]
    .occupiedCount,
  1,
);

const pdfPath =
  path.join(
    out,
    "duplex-11-cards-a4.pdf",
  );

await page.pdf({
  path:
    pdfPath,
  printBackground:
    true,
  preferCSSPageSize:
    true,
});

const pdfBytes =
  await fs.readFile(
    pdfPath,
  );

const pdf =
  await PDFDocument.load(
    pdfBytes,
  );

const pdfPages =
  pdf.getPages();

assert.equal(
  pdfPages.length,
  4,
  "Printed PDF does not contain four separate physical pages",
);

const A4_WIDTH_PT =
  595.2756;

const A4_HEIGHT_PT =
  841.8898;

for (
  const [
    index,
    pdfPage,
  ] of pdfPages.entries()
) {
  const {
    width,
    height,
  } =
    pdfPage.getSize();

  assert.ok(
    Math.abs(
      width -
      A4_WIDTH_PT
    ) <
      1.5,
    `PDF page ${index + 1} width is not A4: ${width}`,
  );

  assert.ok(
    Math.abs(
      height -
      A4_HEIGHT_PT
    ) <
      1.5,
    `PDF page ${index + 1} height is not A4: ${height}`,
  );
}

assert.deepEqual(
  errors,
  [],
  errors.join(
    "\n",
  ),
);

await page.screenshot({
  path:
    path.join(
      out,
      "tablet-1280x800-duplex-runtime.png",
    ),
  fullPage:
    true,
});

await context.close();
await browser.close();
