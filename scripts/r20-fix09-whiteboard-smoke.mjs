import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.R20_WHITEBOARD_URL || "http://127.0.0.1:4173";
const out = path.resolve("r20-whiteboard-smoke");
await fs.mkdir(out, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function adminContext(viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    localStorage.setItem(
      "mobdea_mobile_auth_v2",
      JSON.stringify({
        role:"admin",
        name:"Whiteboard Audit",
        expiresAt:Date.now()+60*60*1000,
      }),
    );
  });
  return context;
}

async function openWhiteboard(page) {
  await page.goto(baseUrl, {waitUntil:"networkidle"});
  await page.waitForTimeout(400);

  const classMode = page.getByText(/وضع الحصة|class mode/i).first();
  assert.ok(await classMode.count(), "Class Mode entry missing");
  await classMode.click();
  await page.waitForTimeout(500);

  const whiteboard = page.getByText(/السبورة|سبورة|whiteboard/i).first();
  assert.ok(await whiteboard.count(), "Whiteboard entry missing");
  await whiteboard.click();
  await page.waitForTimeout(700);
}

for (const viewport of [
  {name:"tablet-1280x800",width:1280,height:800},
  {name:"tablet-1920x1080",width:1920,height:1080},
]) {
  const context = await adminContext(viewport);
  const page = await context.newPage();

  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  await openWhiteboard(page);

  const root = page.locator('[data-r20-whiteboard-root="true"]').first();
  assert.ok(await root.count(), "R20 whiteboard root not detected");
  assert.equal(await root.isVisible(), true, "Whiteboard root hidden");

  const canvas = page.locator('[data-r20-whiteboard-canvas="true"]').first();
  assert.ok(await canvas.count(), "Whiteboard canvas missing");
  assert.equal(await canvas.isVisible(), true, "Whiteboard canvas hidden");

  const canvasBox = await canvas.boundingBox();
  assert.ok(canvasBox && canvasBox.width > 200 && canvasBox.height > 150);
  assert.ok(canvasBox.x >= -2, "Whiteboard canvas clipped left");
  assert.ok(
    canvasBox.x + canvasBox.width <= viewport.width + 2,
    "Whiteboard canvas clipped right",
  );

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  assert.ok(overflow <= 4, `Whiteboard horizontal overflow=${overflow}`);

  const tools = page.locator(
    '[data-r20-whiteboard-bottom-control="tools"]',
  ).first();
  const cards = page.locator(
    '[data-r20-whiteboard-bottom-control="cards"]',
  ).first();

  assert.ok(await tools.count(), "Whiteboard tools control missing");
  assert.ok(await cards.count(), "Cards control missing");

  const toolsBox = await tools.boundingBox();
  const cardsBox = await cards.boundingBox();
  assert.ok(toolsBox.width <= 44 && toolsBox.height <= 44);
  assert.ok(cardsBox.width <= 44 && cardsBox.height <= 44);

  await tools.click();
  await page.waitForTimeout(250);

  const blackCover = await page.evaluate(() => {
    const root = document.querySelector(
      '[data-r20-whiteboard-root="true"]',
    );
    if (!root) return true;

    const rr = root.getBoundingClientRect();
    const area = Math.max(1, rr.width * rr.height);

    return [...root.querySelectorAll("*")].some((el) => {
      if (el.matches("canvas")) return false;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      const bg = String(s.backgroundColor).replace(/\s+/g,"");
      const ratio = (r.width*r.height)/area;
      return (
        ratio >= .7 &&
        (bg === "rgb(0,0,0)" || bg === "rgba(0,0,0,1)") &&
        s.visibility !== "hidden" &&
        Number(s.opacity || 1) > .9
      );
    });
  });

  assert.equal(blackCover, false, "Board tools opened an opaque black cover");
  assert.deepEqual(pageErrors, [], pageErrors.join("\n"));

  await page.screenshot({
    path:path.join(out,`${viewport.name}-whiteboard.png`),
    fullPage:true,
  });

  await context.close();
}

await browser.close();
