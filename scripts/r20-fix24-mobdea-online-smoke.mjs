import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl =
  process.env.R20_MOBDEA_ONLINE_URL ||
  "http://127.0.0.1:4173";

const out = path.resolve("r20-mobdea-online-smoke");
await fs.mkdir(out,{recursive:true});

const browser = await chromium.launch({headless:true});
const context = await browser.newContext({
  viewport:{width:1280,height:800},
});

await context.addInitScript(() => {
  localStorage.setItem(
    "mobdea_mobile_auth_v2",
    JSON.stringify({
      role:"admin",
      name:"R20 Social Audit",
      expiresAt:Date.now()+60*60*1000,
    }),
  );
});

const page = await context.newPage();
const errors = [];
page.on("pageerror",(error) => errors.push(String(error)));

await page.goto(baseUrl,{waitUntil:"networkidle"});
await page.waitForTimeout(450);

const ready = await page.evaluate(() => ({
  api:Boolean(window.mobdeaR20Online),
  ready:window.mobdeaR20Online?.ready(),
  links:window.mobdeaR20Online?.links(),
}));

assert.equal(ready.api,true,"Mobdea Online API missing");
assert.equal(ready.ready,true,"Mobdea Online exact social links are incomplete");
assert.equal(ready.links.length,3);

const roots = page.locator(
  "[data-r20-dashboard-role], [data-r20-teacher-dashboard], .teacher-dashboard, .dashboard"
);

assert.ok(await roots.count() >= 1,"Dashboard root missing");

const card = page.locator("[data-r20-mobdea-online-card='true']").first();
assert.ok(await card.count(),"Mobdea Online dashboard card missing");
assert.equal(await card.isVisible(),true);

await card.click();

const dialog = page.locator("[data-r20-mobdea-online-dialog='true']");
assert.equal(await dialog.isVisible(),true,"Mobdea Online dialog did not open");

for (const platform of ["youtube","facebook","tiktok"]) {
  const link = dialog.locator(`[data-r20-social="${platform}"]`);
  assert.equal(await link.count(),1,`${platform} link missing`);
  const href = await link.getAttribute("href");
  assert.match(href,/^https?:\/\//);
  assert.equal(await link.getAttribute("target"),"_blank");
  assert.match(await link.getAttribute("rel"),/noopener/);
}

const text = await dialog.textContent();
assert.ok(text.includes("المبدع أونلاين"));
assert.ok(text.includes("YouTube"));
assert.ok(text.includes("Facebook"));
assert.ok(text.includes("TikTok"));

const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - innerWidth
);
assert.ok(overflow <= 4,`Social UI horizontal overflow=${overflow}`);
assert.deepEqual(errors,[],errors.join("\n"));

await page.screenshot({
  path:path.join(out,"tablet-1280x800-mobdea-online.png"),
  fullPage:true,
});

await context.close();
await browser.close();
