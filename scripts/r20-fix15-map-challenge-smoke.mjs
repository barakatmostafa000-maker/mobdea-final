import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl =
  process.env.R20_MAP_CHALLENGE_URL ||
  "http://127.0.0.1:4173";

const out =
  path.resolve(
    "r20-map-challenge-smoke",
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
          "R20-STUDENT-SMOKE",
        displayName:
          "طالب الاختبار",
        mustChangePassword:
          false,
        canAccessPortal:
          true,
        linkedStudentIds:
          [],
        sess:
          "local-smoke-session",
      }),
    );
  });

  await page.reload({
    waitUntil:
      "networkidle",
  });

  await page.waitForTimeout(
    850,
  );

  const dashboard =
    page
      .locator(
        '[data-r20-dashboard-role="student"]',
      )
      .first();

  assert.ok(
    await dashboard.count(),
    "Student dashboard was not activated",
  );

  const entry =
    dashboard
      .locator(
        '[data-r20-map-challenge-dashboard-entry="true"]',
      )
      .first();

  assert.ok(
    await entry.count(),
    "Map Challenge is missing from student dashboard",
  );

  assert.equal(
    await entry.isVisible(),
    true,
    "Map Challenge student dashboard entry is hidden",
  );

  assert.equal(
    await entry.getAttribute(
      "data-r20-dashboard-access",
    ),
    "allowed",
  );

  await entry.click();

  await page.waitForTimeout(
    900,
  );

  const root =
    page
      .locator(
        '[data-r20-map-challenge-root="true"]',
      )
      .first();

  assert.ok(
    await root.count(),
    "Map Challenge root did not open",
  );

  assert.equal(
    await root.isVisible(),
    true,
    "Map Challenge root is hidden",
  );

  const map =
    root
      .locator(
        '[data-r20-map-challenge-map="true"]',
      )
      .first();

  assert.ok(
    await map.count(),
    "Map Challenge map surface missing",
  );

  assert.equal(
    await map.isVisible(),
    true,
    "Map Challenge map surface hidden",
  );

  const rootBox =
    await root.boundingBox();

  const mapBox =
    await map.boundingBox();

  assert.ok(
    rootBox &&
      mapBox,
    "Map Challenge layout boxes unavailable",
  );

  assert.ok(
    mapBox.width >=
      rootBox.width * 0.55 ||
      viewport.width < 900,
    "Map is not the dominant challenge area",
  );

  const panels =
    root.locator(
      '[data-r20-map-challenge-panel="true"]',
    );

  if (
    await panels.count()
  ) {
    const panelOverflow =
      await panels
        .first()
        .evaluate(
          (element) =>
            getComputedStyle(
              element,
            ).overflowY,
        );

    assert.ok(
      ["auto", "scroll"].includes(
        panelOverflow,
      ),
      `Challenge panel not scrollable: ${panelOverflow}`,
    );
  }

  const layersTrigger =
    root
      .locator(
        '[data-r20-map-challenge-layers-trigger="true"]',
      )
      .first();

  assert.equal(
    await layersTrigger.isVisible(),
    true,
    "Layers control hidden",
  );

  await layersTrigger.click();

  const layerButtons =
    root.locator(
      "[data-r20-map-challenge-layer-toggle]",
    );

  assert.equal(
    await layerButtons.count(),
    4,
    "Expected exactly four challenge layer controls",
  );

  const layerElements =
    root.locator(
      "[data-r20-challenge-layer]",
    );

  assert.ok(
    await layerElements.count() > 0,
    "No real challenge layers were detected",
  );

  const firstLayerButton =
    layerButtons.first();

  const kind =
    await firstLayerButton.getAttribute(
      "data-r20-map-challenge-layer-toggle",
    );

  await firstLayerButton.click();

  assert.equal(
    await root.getAttribute(
      `data-r20-map-challenge-layer-${kind}`,
    ),
    "off",
  );

  await firstLayerButton.click();

  assert.equal(
    await root.getAttribute(
      `data-r20-map-challenge-layer-${kind}`,
    ),
    "on",
  );

  const mapRuntimeRoot =
    map.locator(
      '[data-r20-map-root="true"]',
    ).first();

  const directMapRuntime =
    await map.getAttribute(
      "data-r20-map-root",
    );

  const nativeGestures =
    await map.getAttribute(
      "data-r20-map-challenge-native-gestures",
    );

  if (
    directMapRuntime === "true" ||
    await mapRuntimeRoot.count()
  ) {
    const gestureRoot =
      directMapRuntime === "true"
        ? map
        : mapRuntimeRoot;

    await gestureRoot.evaluate(
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
            rect.width * .82,
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
        await gestureRoot.getAttribute(
          "data-r20-map-scale",
        ),
      );

    assert.ok(
      scale > 1.05,
      `Map Challenge pinch failed: ${scale}`,
    );

    const panBefore =
      await gestureRoot.evaluate(
        (element) => ({
          x:
            Number(
              element.getAttribute(
                "data-r20-map-pan-x",
              ) || 0,
            ),
          y:
            Number(
              element.getAttribute(
                "data-r20-map-pan-y",
              ) || 0,
            ),
        }),
      );

    await gestureRoot.evaluate(
      (element) => {
        const rect =
          element.getBoundingClientRect();

        const start = {
          x:
            rect.left +
            rect.width * .5,
          y:
            rect.top +
            rect.height * .5,
        };

        const end = {
          x:
            start.x + 55,
          y:
            start.y + 24,
        };

        const fire =
          (type, point) => {
            element.dispatchEvent(
              new PointerEvent(
                type,
                {
                  pointerId:
                    11,
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

    const panAfter =
      await gestureRoot.evaluate(
        (element) => ({
          x:
            Number(
              element.getAttribute(
                "data-r20-map-pan-x",
              ) || 0,
            ),
          y:
            Number(
              element.getAttribute(
                "data-r20-map-pan-y",
              ) || 0,
            ),
        }),
      );

    assert.notDeepEqual(
      panAfter,
      panBefore,
      "Map Challenge pan did not move",
    );
  } else {
    assert.equal(
      nativeGestures,
      "true",
      "Challenge has neither R20 map gestures nor detected native gestures",
    );

    const zoomControl =
      root
        .getByRole(
          "button",
          {
            name:
              /zoom|تكبير|\+|تصغير|-/i,
          },
        )
        .first();

    assert.ok(
      await zoomControl.count(),
      "Native challenge gestures detected but no zoom control is exposed",
    );
  }

  const overflow =
    await page.evaluate(
      () =>
        document.documentElement
          .scrollWidth -
        innerWidth,
    );

  assert.ok(
    overflow <= 4,
    `Map Challenge horizontal overflow=${overflow}`,
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
        `${viewport.name}-map-challenge.png`,
      ),
    fullPage:
      true,
  });

  await context.close();
}

await browser.close();
