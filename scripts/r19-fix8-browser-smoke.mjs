import { chromium } from "playwright";
import fs from "node:fs/promises";

const baseUrl = process.env.R19_SMOKE_URL || "http://127.0.0.1:4173";
const outputs = "r19-fix8-smoke";
await fs.mkdir(outputs, { recursive: true });

const viewports = [
  { name: "tablet-1280x800", width: 1280, height: 800 },
  { name: "tablet-1920x1080", width: 1920, height: 1080 },
];

for (const viewport of viewports) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    const auth = {
      role: "admin",
      name: "R19 Smoke Admin",
      expiresAt: Date.now() + 60 * 60 * 1000,
    };
    localStorage.setItem("mobdea_mobile_auth_v2", JSON.stringify(auth));
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) =>
    pageErrors.push(String(error?.stack || error)),
  );

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator("body").waitFor({ state: "visible" });

    const dashboard = page.locator(".dashboard-page, .dashboard-v103").first();
    await dashboard.waitFor({ state: "visible", timeout: 30000 });

    const primaryClassButton = page
      .locator("button.hero-primary")
      .filter({ hasText: /ابدأ الحصة/ })
      .first();
    if (await primaryClassButton.count()) {
      await primaryClassButton.waitFor({ state: "visible", timeout: 15000 });
      await primaryClassButton.click();
    } else {
      const classButtons = page
        .locator("button, a")
        .filter({ hasText: /ابدأ الحصة|وضع الحصة|الحصة الآن/ });
      await classButtons.first().waitFor({ state: "visible", timeout: 15000 });
      await classButtons.first().click();
    }

    const classRoot = page
      .locator(".classmode-v103, .classmode-page, .lesson-mode-shell")
      .first();
    await classRoot.waitFor({ state: "visible", timeout: 30000 });
    await page.waitForTimeout(1300);

    const geometry = await classRoot.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        width: rect.width,
        height: rect.height,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        text: (node.textContent || "").trim().slice(0, 500),
      };
    });
    if (geometry.width < 500 || geometry.height < 260) {
      throw new Error(
        `وضع الحصة ظهر بمساحة غير صالحة: ${JSON.stringify(geometry)}`,
      );
    }
    if (
      geometry.display === "none" ||
      geometry.visibility === "hidden" ||
      Number(geometry.opacity) === 0
    ) {
      throw new Error(`وضع الحصة مخفي بعد الفتح: ${JSON.stringify(geometry)}`);
    }
    if (await page.locator(".runtime-error-screen").count()) {
      throw new Error("ظهرت شاشة خطأ React داخل وضع الحصة.");
    }
    if (!geometry.text)
      throw new Error("وضع الحصة مفتوح لكن بدون أي محتوى نصي.");

    await page.screenshot({
      path: `${outputs}/${viewport.name}.png`,
      fullPage: true,
    });
    if (pageErrors.length) {
      throw new Error(
        `أخطاء runtime أثناء فتح وضع الحصة:\n${pageErrors.join("\n")}`,
      );
    }
    console.log(`PASS ${viewport.name}`, geometry.width, geometry.height);
  } catch (error) {
    await page
      .screenshot({
        path: `${outputs}/${viewport.name}-FAILED.png`,
        fullPage: true,
      })
      .catch(() => null);
    throw error;
  } finally {
    await browser.close();
  }
}
