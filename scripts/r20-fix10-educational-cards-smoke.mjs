import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.R20_CARDS_URL || "http://127.0.0.1:4173";
const out = path.resolve("r20-educational-cards-smoke");
await fs.mkdir(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
});

await context.addInitScript(() => {
  localStorage.setItem(
    "mobdea_mobile_auth_v2",
    JSON.stringify({
      role: "admin",
      name: "Cards Audit",
      expiresAt: Date.now() + 60 * 60 * 1000,
    }),
  );
});

const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.waitForTimeout(450);

const classMode = page.getByText(/وضع الحصة|class mode/i).first();
assert.ok(await classMode.count(), "Class Mode entry missing");
await classMode.click();
await page.waitForTimeout(500);

let trigger = page.locator(
  '[data-r20-whiteboard-bottom-control="cards"], [data-r20-educational-cards-trigger="true"]',
).first();

if (!(await trigger.count())) {
  trigger = page.getByText(/البطاقات|بطاقات|cards/i).first();
}

assert.ok(await trigger.count(), "Educational cards trigger missing");
await trigger.click();
await page.waitForTimeout(500);

const card = page.locator('[data-r20-educational-card="true"]').first();
assert.ok(await card.count(), "Unified educational card not detected");
assert.equal(await card.isVisible(), true, "Educational card hidden");

const term = card.locator('[data-r20-educational-card-term="true"]').first();
const definition = card.locator(
  '[data-r20-educational-card-definition="true"]',
).first();

assert.ok(await term.count(), "Term missing");
assert.ok(await definition.count(), "Definition missing");

const layout = await card.evaluate((element) => ({
  clientWidth: element.clientWidth,
  scrollWidth: element.scrollWidth,
  fitScale: element.getAttribute("data-r20-card-fit-scale"),
  normalization: element.getAttribute("data-r20-card-normalization"),
  termParent:
    element
      .querySelector('[data-r20-educational-card-term="true"]')
      ?.parentElement
      ?.getAttribute("data-r20-educational-card-content"),
  definitionParent:
    element
      .querySelector('[data-r20-educational-card-definition="true"]')
      ?.parentElement
      ?.getAttribute("data-r20-educational-card-content"),
}));

assert.equal(layout.normalization, "complete");
assert.equal(layout.termParent, "true");
assert.equal(layout.definitionParent, "true");
assert.ok(
  layout.scrollWidth <= layout.clientWidth + 2,
  "Educational card horizontal overflow",
);
assert.ok(Number(layout.fitScale) >= 0.54, "Invalid auto-fit scale");
assert.deepEqual(errors, [], errors.join("\n"));

await page.screenshot({
  path: path.join(out, "tablet-1280x800-educational-card.png"),
  fullPage: true,
});

await context.close();
await browser.close();
