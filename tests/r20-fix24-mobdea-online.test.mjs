import assert from "node:assert/strict";
import test from "node:test";

const {
  R20_MOBDEA_SOCIALS,
  socialLinksReady,
} = await import("../src/services/r20MobdeaOnline.js");

test("FIX24 has exactly three creator platforms", () => {
  assert.deepEqual(
    R20_MOBDEA_SOCIALS.map((item) => item.id),
    ["youtube", "facebook", "tiktok"],
  );
});

test("FIX24 uses exact verified YouTube URL", () => {
  assert.equal(
    R20_MOBDEA_SOCIALS.find((item) => item.id === "youtube").url,
    'https://youtube.com/@mostafabarakat21?si=j81UCr73vvnZtpPn',
  );
});

test("FIX24 uses exact verified Facebook URL", () => {
  assert.equal(
    R20_MOBDEA_SOCIALS.find((item) => item.id === "facebook").url,
    'https://www.facebook.com/share/18DaQCzDzT/',
  );
});

test("FIX24 uses exact verified TikTok URL", () => {
  assert.equal(
    R20_MOBDEA_SOCIALS.find((item) => item.id === "tiktok").url,
    'https://www.tiktok.com/@mostafabarakat210?_r=1&_t=ZS-99GSdfl3yi0',
  );
});

test("FIX24 all verified links are ready external URLs", () => {
  assert.equal(socialLinksReady(), true);
  for (const item of R20_MOBDEA_SOCIALS) {
    assert.match(item.url, /^https?:\/\//);
  }
});

test("FIX24 Mobdea Online stays independent from Online Lesson", async () => {
  const fs = await import("node:fs");
  const source = fs.readFileSync("src/services/r20MobdeaOnline.js", "utf8");
  assert.match(source, /data-r20-dashboard-feature","mobdea-online/);
  assert.doesNotMatch(source, /online-lesson-management/);
  assert.doesNotMatch(source, /class-mode/);
});
