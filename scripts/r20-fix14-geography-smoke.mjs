import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl =
  process.env.R20_GEOGRAPHY_URL ||
  "http://127.0.0.1:4173";

const out =
  path.resolve(
    "r20-geography-smoke",
  );

await fs.mkdir(
  out,
  { recursive: true },
);

const browser =
  await chromium.launch({
    headless: true,
  });

const context =
  await browser.newContext({
    viewport: {
      width: 1280,
      height: 800,
    },
  });

const page =
  await context.newPage();

const errors = [];
page.on(
  "pageerror",
  (error) =>
    errors.push(String(error)),
);

await page.goto(
  baseUrl,
  {
    waitUntil: "networkidle",
  },
);

await page.waitForTimeout(400);

const truth =
  await page.evaluate(() => {
    const api =
      window.mobdeaR20GeographyTruth;

    if (!api) return null;

    return {
      arabCount:
        api.arabWorld.length,
      nileCount:
        api.nileBasin.length,
      hasDjibouti:
        api.arabWorld.includes("Djibouti"),
      hasSomalia:
        api.arabWorld.includes("Somalia"),
      hasComoros:
        api.arabWorld.includes("Comoros"),
      nileDestination:
        api.nile.deltaDestination,
    };
  });

assert.ok(
  truth,
  "Geography truth API missing",
);
assert.equal(
  truth.arabCount,
  22,
);
assert.equal(
  truth.nileCount,
  11,
);
assert.equal(
  truth.hasDjibouti,
  true,
);
assert.equal(
  truth.hasSomalia,
  true,
);
assert.equal(
  truth.hasComoros,
  true,
);
assert.equal(
  truth.nileDestination,
  "Mediterranean Sea",
);

const repair =
  await page.evaluate(() => {
    const fn =
      window.mobdeaR20RepairGeographyData;

    const input = {
      arabWorldCountries: [
        "Egypt",
        "Sudan",
      ],
      nileBasinCountries: [
        "Egypt",
        "Sudan",
      ],
    };

    const result =
      fn(input);

    return {
      arabCount:
        result.arabWorldCountries.length,
      nileCount:
        result.nileBasinCountries.length,
      hasDjibouti:
        result.arabWorldCountries.includes(
          "Djibouti",
        ),
      hasComoros:
        result.arabWorldCountries.includes(
          "Comoros",
        ),
    };
  });

assert.equal(
  repair.arabCount,
  22,
);
assert.equal(
  repair.nileCount,
  11,
);
assert.equal(
  repair.hasDjibouti,
  true,
);
assert.equal(
  repair.hasComoros,
  true,
);

const synthetic =
  await page.evaluate(() => {
    const root =
      document.createElement("div");

    root.className =
      "geography-map";

    root.setAttribute(
      "data-r20-map-root",
      "true",
    );

    root.setAttribute(
      "aria-label",
      "الوطن العربي",
    );

    for (const country of [
      "Egypt",
      "Sudan",
      "Djibouti",
      "Somalia",
      "Comoros",
    ]) {
      const item =
        document.createElement("span");

      item.setAttribute(
        "data-country",
        country,
      );

      if (
        ["Djibouti", "Somalia", "Comoros"].includes(
          country,
        )
      ) {
        item.hidden = true;
        item.style.display = "none";
      }

      root.appendChild(item);
    }

    document.body.appendChild(root);

    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve({
            status:
              root.getAttribute(
                "data-r20-arab-world-status",
              ),
            djiboutiHidden:
              root.querySelector(
                '[data-country="Djibouti"]',
              ).hidden,
            djiboutiDisplay:
              root.querySelector(
                '[data-country="Djibouti"]',
              ).style.display,
            marked:
              root.querySelector(
                '[data-country="Djibouti"]',
              ).getAttribute(
                "data-r20-geography-required-country",
              ),
          });

          root.remove();
        });
      });
    });
  });

assert.equal(
  synthetic.djiboutiHidden,
  false,
);
assert.equal(
  synthetic.djiboutiDisplay,
  "",
);
assert.equal(
  synthetic.marked,
  "Djibouti",
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
      "tablet-1280x800-geography.png",
    ),
  fullPage: true,
});

await context.close();
await browser.close();
