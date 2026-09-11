import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl =
  process.env.R20_GAMES_URL ||
  "http://127.0.0.1:4173";

const out = path.resolve(
  "r20-games-smoke",
);

await fs.mkdir(
  out,
  { recursive: true },
);

const browser = await chromium.launch({
  headless: true,
});

for (const viewport of [
  {
    name: "tablet-1280x800",
    width: 1280,
    height: 800,
  },
  {
    name: "tablet-1920x1080",
    width: 1920,
    height: 1080,
  },
  {
    name: "mobile-landscape-844x390",
    width: 844,
    height: 390,
  },
]) {
  const context = await browser.newContext({
    viewport,
  });

  const page = await context.newPage();
  const errors = [];

  page.on(
    "pageerror",
    (error) => errors.push(String(error)),
  );

  await page.goto(
    baseUrl,
    { waitUntil: "networkidle" },
  );

  await page.evaluate(() => {
    sessionStorage.setItem(
      "mobdea-r20-portal-session",
      JSON.stringify({
        role: "student",
        accountId: "R20-GAME-STUDENT",
        displayName: "طالب الألعاب",
        mustChangePassword: false,
        canAccessPortal: true,
        linkedStudentIds: [],
        sess: "local-games-smoke",
      }),
    );
  });

  await page.reload({
    waitUntil: "networkidle",
  });

  await page.waitForTimeout(850);

  const dashboard = page.locator(
    '[data-r20-dashboard-role="student"]',
  ).first();

  assert.ok(
    await dashboard.count(),
    "Student dashboard was not activated",
  );

  const entry = dashboard.locator(
    '[data-r20-games-dashboard-entry="true"]',
  ).first();

  assert.ok(
    await entry.count(),
    "Games entry missing from student dashboard",
  );

  assert.equal(
    await entry.isVisible(),
    true,
    "Games dashboard entry hidden",
  );

  assert.equal(
    await entry.getAttribute(
      "data-r20-dashboard-access",
    ),
    "allowed",
  );

  await entry.click();
  await page.waitForTimeout(900);

  let hub = page.locator(
    '[data-r20-games-hub="true"]',
  ).first();

  assert.ok(
    await hub.count(),
    "Games hub did not open",
  );

  assert.equal(
    await hub.isVisible(),
    true,
    "Games hub hidden",
  );

  const hubOverflow = await hub.evaluate(
    (node) =>
      getComputedStyle(node).overflowY,
  );

  assert.ok(
    ["auto", "scroll"].includes(hubOverflow),
    `Games hub is not scrollable: ${hubOverflow}`,
  );

  let opened = false;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    hub = page.locator(
      '[data-r20-games-hub="true"]',
    ).first();

    const cards = hub.locator(
      '[data-r20-game-card="true"]',
    );

    const count = await cards.count();

    if (!count) break;

    const index = Math.min(
      attempt,
      count - 1,
    );

    const card = cards.nth(index);

    if (!await card.isVisible()) {
      continue;
    }

    await card.click();
    await page.waitForTimeout(650);

    const flow = page.locator(
      '[data-r20-game-question-flow="true"]',
    ).first();

    if (await flow.count()) {
      opened = true;
      break;
    }

    await page.goBack({
      waitUntil: "networkidle",
    }).catch(() => {});

    await page.waitForTimeout(450);
  }

  assert.equal(
    opened,
    true,
    "No game entered a real question flow",
  );

  const flow = page.locator(
    '[data-r20-game-question-flow="true"]',
  ).first();

  const question = flow.locator(
    '[data-r20-game-current-question="true"]',
  ).first();

  const answers = flow.locator(
    '[data-r20-game-answer="true"]',
  );

  assert.equal(
    await question.isVisible(),
    true,
    "Game question hidden",
  );

  assert.ok(
    await answers.count() >= 2,
    "Game has fewer than two answer choices",
  );

  const before = await flow.evaluate(
    (root) => {
      const questionNode = root.querySelector(
        '[data-r20-game-current-question="true"]',
      );

      const scoreNode = root.querySelector(
        "[data-game-score], [data-score], [data-points], [data-lives], .game-score, .score, .lives, .progress, [class*='score'], [class*='lives'], [class*='progress']",
      );

      return {
        question:
          questionNode?.textContent
            ?.replace(/\s+/g, " ")
            .trim() || "",
        score:
          scoreNode?.textContent
            ?.replace(/\s+/g, " ")
            .trim() || "",
      };
    },
  );

  await answers.first().click();
  await page.waitForTimeout(600);

  const after = await flow.evaluate(
    (root) => {
      const questionNode = root.querySelector(
        '[data-r20-game-current-question="true"]',
      );

      const scoreNode = root.querySelector(
        "[data-game-score], [data-score], [data-points], [data-lives], .game-score, .score, .lives, .progress, [class*='score'], [class*='lives'], [class*='progress']",
      );

      return {
        question:
          questionNode?.textContent
            ?.replace(/\s+/g, " ")
            .trim() || "",
        score:
          scoreNode?.textContent
            ?.replace(/\s+/g, " ")
            .trim() || "",
        transition:
          root.getAttribute(
            "data-r20-game-question-transition",
          ),
      };
    },
  );

  const progressed =
    (
      after.question &&
      after.question !== before.question
    ) ||
    (
      after.score &&
      after.score !== before.score
    ) ||
    after.transition === "true";

  assert.equal(
    progressed,
    true,
    "Answer did not progress question flow or update score/lives/progress",
  );

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      innerWidth,
  );

  assert.ok(
    overflow <= 4,
    `Games horizontal overflow=${overflow}`,
  );

  assert.deepEqual(
    errors,
    [],
    errors.join("\n"),
  );

  await page.screenshot({
    path: path.join(
      out,
      `${viewport.name}-games.png`,
    ),
    fullPage: true,
  });

  await context.close();
}

await browser.close();
