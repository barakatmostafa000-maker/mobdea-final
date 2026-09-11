import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl =
  process.env.R20_COUNTRY_CARDS_URL ||
  "http://127.0.0.1:4173";
const out = path.resolve("r20-country-cards-smoke");
await fs.mkdir(out, { recursive: true });

const browser = await chromium.launch({ headless: true });

for (const viewport of [
  { name: "tablet-1280x800", width: 1280, height: 800 },
  { name: "tablet-1920x1080", width: 1920, height: 1080 },
]) {
  const context = await browser.newContext({ viewport });

  await context.addInitScript(() => {
    localStorage.setItem(
      "mobdea_mobile_auth_v2",
      JSON.stringify({
        role: "admin",
        name: "Country Cards Audit",
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
    '[data-r20-whiteboard-bottom-control="cards"],[data-r20-educational-cards-trigger="true"]',
  ).first();

  if (!(await trigger.count())) {
    trigger = page.getByText(/البطاقات|بطاقات|cards/i).first();
  }

  assert.ok(await trigger.count(), "Cards trigger missing");
  await trigger.click();
  await page.waitForTimeout(550);

  const country = page.locator('[data-r20-country-card="true"]').first();
  assert.ok(await country.count(), "Country card not detected");
  assert.equal(await country.isVisible(), true, "Country card hidden");

  const metrics = await country.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const media = element.querySelector('[data-r20-country-media="true"]');
    const mediaStyle = media ? getComputedStyle(media) : null;

    return {
      left: rect.left,
      right: rect.right,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      fitScale: element.getAttribute("data-r20-country-fit-scale"),
      normalization: element.getAttribute("data-r20-country-normalization"),
      mediaFit: mediaStyle?.objectFit || "",
    };
  });

  assert.equal(metrics.normalization, "complete");
  assert.ok(metrics.left >= -2, "Country card clipped left");
  assert.ok(
    metrics.right <= viewport.width + 2,
    "Country card clipped right",
  );
  assert.ok(
    metrics.scrollWidth <= metrics.clientWidth + 2,
    "Country card horizontal overflow",
  );
  assert.ok(Number(metrics.fitScale) >= 0.58, "Invalid auto-fit scale");

  if (metrics.mediaFit) {
    assert.equal(metrics.mediaFit, "contain");
  }

  assert.deepEqual(errors, [], errors.join("\n"));

  await page.screenshot({
    path: path.join(out, `${viewport.name}-country-card.png`),
    fullPage: true,
  });

  await context.close();
}

await browser.close();
