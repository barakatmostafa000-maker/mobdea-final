import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl =
  process.env.R20_IMAGE_MODE_URL ||
  "http://127.0.0.1:4173";

const out =
  path.resolve(
    "r20-image-mode-smoke",
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

for (const viewport of [
  {
    name:
      "tablet-1280x800",
    width:
      1280,
    height:
      800,
  },
  {
    name:
      "tablet-1920x1080",
    width:
      1920,
    height:
      1080,
  },
  {
    name:
      "mobile-landscape-844x390",
    width:
      844,
    height:
      390,
  },
]) {
  const context =
    await browser.newContext({
      viewport,
    });

  const page =
    await context.newPage();

  const errors = [];

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
    450,
  );

  const classMode =
    page.getByText(
      /وضع الحصة|class mode/i,
    ).first();

  assert.ok(
    await classMode.count(),
    "Class Mode entry missing",
  );

  await classMode.click();

  await page.waitForTimeout(
    500,
  );

  const imageEntry =
    page.getByText(
      /^صور?$|image|photo/i,
    ).first();

  assert.ok(
    await imageEntry.count(),
    "Image mode entry missing",
  );

  await imageEntry.click();

  await page.waitForTimeout(
    350,
  );

  const input =
    page.locator(
      'input[type="file"][accept*="image"]',
    ).first();

  assert.ok(
    await input.count(),
    "Image upload input missing",
  );

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
      width="1600"
      height="1200"
      viewBox="0 0 1600 1200">
      <rect width="1600" height="1200" fill="#f5f5f5"/>
      <circle cx="800" cy="600" r="420" fill="#d0d0d0"/>
      <text x="800" y="620"
        text-anchor="middle"
        font-size="120">R20 IMAGE</text>
    </svg>
  `;

  await input.setInputFiles({
    name:
      "r20-image-smoke.svg",
    mimeType:
      "image/svg+xml",
    buffer:
      Buffer.from(
        svg,
      ),
  });

  await page.waitForTimeout(
    650,
  );

  const surface =
    page.locator(
      '[data-r20-image-surface="true"]',
    ).first();

  const image =
    surface.locator(
      '[data-r20-image-target="true"]',
    ).first();

  assert.ok(
    await surface.count(),
    "R20 image surface missing",
  );

  assert.equal(
    await surface.isVisible(),
    true,
    "Image surface hidden",
  );

  assert.ok(
    await image.count(),
    "R20 image target missing",
  );

  const box =
    await surface.boundingBox();

  assert.ok(
    box &&
    box.width > 220 &&
    box.height > 120,
    "Image surface too small",
  );

  assert.ok(
    box.x >= -2,
    "Image surface clipped left",
  );

  assert.ok(
    box.x +
    box.width <=
    viewport.width + 2,
    "Image surface clipped right",
  );

  const fit =
    await image.evaluate(
      (node) => ({
        objectFit:
          getComputedStyle(
            node,
          ).objectFit,
        maxWidth:
          getComputedStyle(
            node,
          ).maxWidth,
        maxHeight:
          getComputedStyle(
            node,
          ).maxHeight,
      }),
    );

  assert.equal(
    fit.objectFit,
    "contain",
  );

  await surface.evaluate(
    (element) => {
      const rect =
        element.getBoundingClientRect();

      const p1 = {
        x:
          rect.left +
          rect.width * .38,
        y:
          rect.top +
          rect.height * .5,
      };

      const p2 = {
        x:
          rect.left +
          rect.width * .62,
        y:
          rect.top +
          rect.height * .5,
      };

      const p2m = {
        x:
          rect.left +
          rect.width * .84,
        y:
          rect.top +
          rect.height * .5,
      };

      const fire =
        (
          type,
          id,
          point,
        ) => {
          element.dispatchEvent(
            new PointerEvent(
              type,
              {
                pointerId:
                  id,
                pointerType:
                  "touch",
                clientX:
                  point.x,
                clientY:
                  point.y,
                bubbles:
                  true,
                cancelable:
                  true,
              },
            ),
          );
        };

      fire(
        "pointerdown",
        1,
        p1,
      );

      fire(
        "pointerdown",
        2,
        p2,
      );

      fire(
        "pointermove",
        2,
        p2m,
      );

      fire(
        "pointerup",
        2,
        p2m,
      );

      fire(
        "pointerup",
        1,
        p1,
      );
    },
  );

  const scale =
    Number(
      await surface.getAttribute(
        "data-r20-image-scale",
      ),
    );

  assert.ok(
    scale > 1.05,
    `Image pinch failed: ${scale}`,
  );

  const before =
    await surface.evaluate(
      (element) => ({
        x:
          Number(
            element.getAttribute(
              "data-r20-image-pan-x",
            ) || 0,
          ),
        y:
          Number(
            element.getAttribute(
              "data-r20-image-pan-y",
            ) || 0,
          ),
      }),
    );

  await surface.evaluate(
    (element) => {
      const rect =
        element.getBoundingClientRect();

      const start = {
        x:
          rect.left +
          rect.width / 2,
        y:
          rect.top +
          rect.height / 2,
      };

      const end = {
        x:
          start.x + 60,
        y:
          start.y + 28,
      };

      const fire =
        (
          type,
          point,
        ) => {
          element.dispatchEvent(
            new PointerEvent(
              type,
              {
                pointerId:
                  15,
                pointerType:
                  "touch",
                clientX:
                  point.x,
                clientY:
                  point.y,
                bubbles:
                  true,
                cancelable:
                  true,
              },
            ),
          );
        };

      fire(
        "pointerdown",
        start,
      );

      fire(
        "pointermove",
        end,
      );

      fire(
        "pointerup",
        end,
      );
    },
  );

  const after =
    await surface.evaluate(
      (element) => ({
        x:
          Number(
            element.getAttribute(
              "data-r20-image-pan-x",
            ) || 0,
          ),
        y:
          Number(
            element.getAttribute(
              "data-r20-image-pan-y",
            ) || 0,
          ),
      }),
    );

  assert.notDeepEqual(
    after,
    before,
    "Image pan did not move",
  );

  const overflow =
    await page.evaluate(
      () =>
        document.documentElement
          .scrollWidth -
        innerWidth,
    );

  assert.ok(
    overflow <= 4,
    `Image mode horizontal overflow=${overflow}`,
  );

  assert.deepEqual(
    errors,
    [],
    errors.join("\n"),
  );

  await page.screenshot({
    path:
      path.join(
        out,
        `${viewport.name}-image-mode.png`,
      ),
    fullPage:
      true,
  });

  await context.close();
}

await browser.close();
