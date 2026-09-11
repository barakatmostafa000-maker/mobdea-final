import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl =
  process.env.R20_NATURAL_LAYERS_URL ||
  "http://127.0.0.1:4173";

const out =
  path.resolve(
    "r20-natural-layers-smoke",
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

await page.evaluate(() => {
  sessionStorage.setItem(
    "mobdea-r20-portal-session",
    JSON.stringify({
      role:
        "student",
      accountId:
        "R20-NATURAL-LAYERS",
      displayName:
        "طالب الخرائط",
      mustChangePassword:
        false,
      canAccessPortal:
        true,
      linkedStudentIds:
        [],
      sess:
        "local-layer-smoke",
    }),
  );
});

await page.reload({
  waitUntil:
    "networkidle",
});

await page.waitForTimeout(
  800,
);

const entry =
  page.locator(
    '[data-r20-map-challenge-dashboard-entry="true"]',
  ).first();

assert.ok(
  await entry.count(),
  "Map Challenge dashboard entry missing",
);

await entry.click();

await page.waitForTimeout(
  900,
);

const root =
  page.locator(
    '[data-r20-map-challenge-root="true"]',
  ).first();

assert.ok(
  await root.count(),
  "Map Challenge root missing",
);

const trigger =
  root.locator(
    '[data-r20-map-challenge-layers-trigger="true"]',
  ).first();

await trigger.click();

for (const layer of [
  "terrain",
  "minerals",
  "forests",
  "grasslands",
  "deserts",
]) {
  const button =
    root.locator(
      `[data-r20-natural-layer-toggle="${layer}"]`,
    ).first();

  assert.equal(
    await button.isVisible(),
    true,
    `${layer} layer button hidden`,
  );

  assert.equal(
    await root.getAttribute(
      `data-r20-natural-layer-source-${layer}`,
    ),
    "available",
    `${layer} source unavailable`,
  );

  assert.equal(
    await root.getAttribute(
      `data-r20-natural-layer-live-${layer}`,
    ),
    "ready",
    `${layer} live layer missing`,
  );

  const element =
    root.locator(
      `[data-r20-natural-layer="${layer}"]`,
    ).first();

  assert.ok(
    await element.count(),
    `${layer} has no live layer elements`,
  );

  await button.click();

  assert.equal(
    await root.getAttribute(
      `data-r20-natural-layer-${layer}`,
    ),
    "off",
  );

  const opacity =
    await element.evaluate(
      (node) =>
        getComputedStyle(
          node,
        ).opacity,
    );

  assert.equal(
    Number(opacity),
    0,
    `${layer} did not hide`,
  );

  await button.click();

  assert.equal(
    await root.getAttribute(
      `data-r20-natural-layer-${layer}`,
    ),
    "on",
  );
}

const terrainKinds =
  await root.evaluate(
    (element) => {
      const found =
        new Set(
          [
            ...element.querySelectorAll(
              "[data-r20-terrain-kind]",
            ),
          ].map(
            (node) =>
              node.getAttribute(
                "data-r20-terrain-kind",
              ),
          ),
        );

      return [
        ...found,
      ];
    },
  );

for (const kind of [
  "mountains",
  "plateaus",
  "plains",
  "islands",
]) {
  assert.ok(
    terrainKinds.includes(
      kind,
    ),
    `Terrain subtype missing: ${kind}`,
  );
}

assert.deepEqual(
  errors,
  [],
  errors.join("\n"),
);

await page.screenshot({
  path:
    path.join(
      out,
      "tablet-1280x800-natural-layers.png",
    ),
  fullPage:
    true,
});

await context.close();
await browser.close();
