import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.R20_MAPS_URL || "http://127.0.0.1:4173";
const out = path.resolve("r20-maps-smoke");
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
        name: "Map Audit",
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

  const mapEntry = page.getByText(/الخريطة|الخرائط|map|maps/i).first();
  assert.ok(await mapEntry.count(), "Map entry missing");
  await mapEntry.click();
  await page.waitForTimeout(700);

  const root = page.locator('[data-r20-map-root="true"]').first();
  assert.ok(await root.count(), "R20 map root missing");
  assert.equal(await root.isVisible(), true, "Map root hidden");

  const box = await root.boundingBox();
  assert.ok(box && box.width > 220 && box.height > 160, "Map root too small");
  assert.ok(box.x >= -2, "Map clipped left");
  assert.ok(box.x + box.width <= viewport.width + 2, "Map clipped right");

  const badBlack = await root.evaluate((element) =>
    [...element.querySelectorAll('[data-r20-map-land-black="corrected"]')]
      .some((land) => {
        const fill = String(getComputedStyle(land).fill)
          .replace(/\s+/g, "")
          .toLowerCase();
        return fill === "rgb(0,0,0)" || fill === "rgba(0,0,0,1)";
      })
  );
  assert.equal(badBlack, false, "Corrected land is still black");

  const nativeMode =
    await root.getAttribute("data-r20-map-native-interaction");

  if (nativeMode !== "true") {
    await root.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const p1 = {
        x: rect.left + rect.width * 0.38,
        y: rect.top + rect.height * 0.5,
      };
      const p2 = {
        x: rect.left + rect.width * 0.62,
        y: rect.top + rect.height * 0.5,
      };
      const p2m = {
        x: rect.left + rect.width * 0.80,
        y: rect.top + rect.height * 0.5,
      };

      const fire = (type, id, p) => {
        element.dispatchEvent(
          new PointerEvent(type, {
            pointerId: id,
            pointerType: "touch",
            clientX: p.x,
            clientY: p.y,
            bubbles: true,
            cancelable: true,
          }),
        );
      };

      fire("pointerdown", 1, p1);
      fire("pointerdown", 2, p2);
      fire("pointermove", 2, p2m);
      fire("pointerup", 2, p2m);
      fire("pointerup", 1, p1);
    });

    const zoom = Number(
      await root.getAttribute("data-r20-map-scale"),
    );
    assert.ok(zoom > 1.05, `Map pinch did not zoom: ${zoom}`);

    const symbol = root.locator(
      '[data-r20-map-symbols-control="true"]',
    ).first();

    if (await symbol.count()) {
      const before = await root.evaluate((element) => ({
        scale: element.getAttribute("data-r20-map-scale"),
        x: element.getAttribute("data-r20-map-pan-x"),
        y: element.getAttribute("data-r20-map-pan-y"),
      }));

      await symbol.click();
      await page.waitForTimeout(120);

      const after = await root.evaluate((element) => ({
        scale: element.getAttribute("data-r20-map-scale"),
        x: element.getAttribute("data-r20-map-pan-x"),
        y: element.getAttribute("data-r20-map-pan-y"),
      }));

      assert.deepEqual(after, before, "Symbols button changed map transform");
    }
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  assert.ok(overflow <= 4, `Map horizontal overflow=${overflow}`);
  assert.deepEqual(errors, [], errors.join("\n"));

  await page.screenshot({
    path: path.join(out, `${viewport.name}-map.png`),
    fullPage: true,
  });

  await context.close();
}

await browser.close();
