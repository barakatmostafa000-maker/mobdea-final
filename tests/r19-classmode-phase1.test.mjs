import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const classMode = fs.readFileSync("src/pages/ClassMode.jsx", "utf8");
const phase1Css = fs.readFileSync("src/styles/r19-classmode-phase1.css", "utf8");
const finalCss = fs.readFileSync("src/styles/r19-master-repairs.css", "utf8");
const countries = fs.readFileSync("src/data/countryCards.js", "utf8");

test("true fullscreen uses presentation-only chrome and an exit control", () => {
  assert.match(
    classMode,
    /fullscreen presentation-fullscreen stage-focus-mode/,
  );
  assert.match(classMode, /classmode-fullscreen-exit/);
  assert.match(
    phase1Css,
    /\.classmode-viewport\.presentation-fullscreen\s*>\s*\.classmode-viewport-header/,
  );
  assert.match(
    phase1Css,
    /\.classmode-viewport\.presentation-fullscreen\s+\.classmode-viewport-students/,
  );
});

test("historical board fills the viewport without the old fixed 3:2 shell", () => {
  assert.match(phase1Css, /class-board-canvas-shell\.board-theme-history/);
  assert.match(phase1Css, /width:\s*100%\s*!important;/);
  assert.match(phase1Css, /height:\s*100%\s*!important;/);
  assert.match(phase1Css, /aspect-ratio:\s*auto\s*!important;/);
  assert.match(finalCss, /MOBDEA_R19_FINAL/);
  assert.match(finalCss, /object-fit:\s*contain\s*!important;/);
});

test("educational cards capture their drag host and can shrink further", () => {
  assert.match(
    classMode,
    /const\s+host\s*=\s*event\.currentTarget\.parentElement\?\.getBoundingClientRect\?\.\(\);/s,
  );
  assert.match(
    classMode,
    /Math\.max\(\s*220\s*,\s*Math\.min\(\s*1050\s*,/s,
  );
  assert.match(classMode, /boardCardFieldScale/);
  assert.match(phase1Css, /container-type:\s*inline-size/);
});

test("country cards can shrink and expose capital and language metadata", () => {
  assert.match(
    classMode,
    /Math\.max\(\s*240\s*,\s*Math\.min\(\s*1120\s*,/s,
  );
  assert.match(classMode, /country-card-meta-strip/);
  assert.match(countries, /capital/);
  assert.match(countries, /language/);
  assert.match(countries, /["']القاهرة["']\s*,\s*["']العربية["']/);
});

test("corrected handwriting remains selectable and has manual size controls", () => {
  assert.match(classMode, /correctedFontSize/);
  assert.match(
    classMode,
    /setSelectedBoardActionId\(\s*nextAction\.id\s*\)/s,
  );
  assert.match(classMode, /adjustBoardTextSize/);
  assert.match(classMode, /classmode-text-size-value/);
});

test("Mobdea historical symbol renders the real project logo", () => {
  assert.match(classMode, /MOBDEA_LOGO_IMAGE/);
  assert.match(
    classMode,
    /ctx\.drawImage\(\s*MOBDEA_LOGO_IMAGE\s*,/s,
  );
  assert.match(classMode, /شعار المُبدع/);
});

test("placing cards and teaching symbols returns to writing instead of trapping the tool", () => {
  assert.match(classMode, /["']historical-symbol["']/);
  assert.match(classMode, /["']geographical-symbol["']/);
  assert.match(classMode, /["']shape["']/);
  assert.match(classMode, /["']arrow["']/);
  assert.match(
    classMode,
    /عادت السبورة إلى القلم للشرح مباشرة/,
  );
});
