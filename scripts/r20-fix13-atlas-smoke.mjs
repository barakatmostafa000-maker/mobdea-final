import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl =
  process.env.R20_ATLAS_URL ||
  "http://127.0.0.1:4173";

const out =
  path.resolve(
    "r20-atlas-smoke",
  );

await fs.mkdir(
  out,
  { recursive: true },
);

const browser =
  await chromium.launch({
    headless: true,
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
]) {
  const context =
    await browser.newContext({
      viewport,
    });

  await context.addInitScript(() => {
    localStorage.setItem(
      "mobdea_mobile_auth_v2",
      JSON.stringify({
        role:
          "admin",
        name:
          "Atlas Audit",
        expiresAt:
          Date.now() +
          60 * 60 * 1000,
      }),
    );
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
    page
      .getByText(
        /وضع الحصة|class mode/i,
      )
      .first();

  assert.ok(
    await classMode.count(),
    "Class Mode entry missing",
  );

  await classMode.click();

  await page.waitForTimeout(
    500,
  );

  const atlasEntry =
    page
      .getByText(
        /الأطلس|الاطلس|أطلس|atlas/i,
      )
      .first();

  assert.ok(
    await atlasEntry.count(),
    "Atlas entry missing",
  );

  await atlasEntry.click();

  await page.waitForTimeout(
    750,
  );

  const root =
    page
      .locator(
        '[data-r20-atlas-root="true"]',
      )
      .first();

  assert.ok(
    await root.count(),
    "Atlas root missing",
  );

  assert.equal(
    await root.isVisible(),
    true,
    "Atlas root hidden",
  );

  const boundaries =
    root.locator(
      '[data-r20-atlas-boundary="true"]',
    );

  const labels =
    root.locator(
      '[data-r20-atlas-label="true"]',
    );

  assert.ok(
    await boundaries.count() >
      0,
    "No Atlas boundaries detected",
  );

  assert.ok(
    await labels.count() >
      0,
    "No Atlas labels detected",
  );

  const boundariesButton =
    root
      .locator(
        '[data-r20-atlas-toggle="boundaries"]',
      )
      .first();

  const namesButton =
    root
      .locator(
        '[data-r20-atlas-toggle="names"]',
      )
      .first();

  assert.equal(
    await boundariesButton.isVisible(),
    true,
    "Boundaries control hidden",
  );

  assert.equal(
    await namesButton.isVisible(),
    true,
    "Names control hidden",
  );

  const transformBefore =
    await root.evaluate(
      (element) => {
        const map =
          element.matches(
            "[data-r20-map-root='true']",
          )
            ? element
            : element.querySelector(
                "[data-r20-map-root='true']",
              );

        const content =
          element.querySelector(
            "[data-r20-map-content='true']",
          );

        return {
          scale:
            map?.getAttribute(
              "data-r20-map-scale",
            ) || "",
          x:
            map?.getAttribute(
              "data-r20-map-pan-x",
            ) || "",
          y:
            map?.getAttribute(
              "data-r20-map-pan-y",
            ) || "",
          transform:
            content
              ? getComputedStyle(
                  content,
                ).transform
              : "",
        };
      },
    );

  await boundariesButton.click();

  await page.waitForTimeout(
    100,
  );

  assert.equal(
    await root.getAttribute(
      "data-r20-atlas-boundaries-visible",
    ),
    "false",
  );

  const boundaryOpacity =
    await boundaries
      .first()
      .evaluate(
        (element) =>
          getComputedStyle(
            element,
          ).strokeOpacity,
      );

  assert.equal(
    Number(
      boundaryOpacity,
    ),
    0,
    "Boundary stroke remains visible",
  );

  await namesButton.click();

  await page.waitForTimeout(
    100,
  );

  assert.equal(
    await root.getAttribute(
      "data-r20-atlas-names-visible",
    ),
    "false",
  );

  const labelDisplay =
    await labels
      .first()
      .evaluate(
        (element) =>
          getComputedStyle(
            element,
          ).display,
      );

  assert.equal(
    labelDisplay,
    "none",
    "Atlas name remains visible",
  );

  const transformAfter =
    await root.evaluate(
      (element) => {
        const map =
          element.matches(
            "[data-r20-map-root='true']",
          )
            ? element
            : element.querySelector(
                "[data-r20-map-root='true']",
              );

        const content =
          element.querySelector(
            "[data-r20-map-content='true']",
          );

        return {
          scale:
            map?.getAttribute(
              "data-r20-map-scale",
            ) || "",
          x:
            map?.getAttribute(
              "data-r20-map-pan-x",
            ) || "",
          y:
            map?.getAttribute(
              "data-r20-map-pan-y",
            ) || "",
          transform:
            content
              ? getComputedStyle(
                  content,
                ).transform
              : "",
        };
      },
    );

  assert.deepEqual(
    transformAfter,
    transformBefore,
    "Atlas toggles changed map transform",
  );

  await boundariesButton.click();
  await namesButton.click();

  await page.waitForTimeout(
    100,
  );

  assert.equal(
    await root.getAttribute(
      "data-r20-atlas-boundaries-visible",
    ),
    "true",
  );

  assert.equal(
    await root.getAttribute(
      "data-r20-atlas-names-visible",
    ),
    "true",
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
    `Atlas horizontal overflow=${overflow}`,
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
        `${viewport.name}-atlas.png`,
      ),
    fullPage:
      true,
  });

  await context.close();
}

await browser.close();
