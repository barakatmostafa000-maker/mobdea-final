import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  countryCardTextClass,
  countryCardFontScale,
} from "../src/services/r20CountryCards.js";

const read = (path) => fs.readFileSync(path, "utf8");

test("FIX11 font scale decreases for long country content", () => {
  assert.equal(countryCardTextClass("مصر"), "short");
  assert.equal(countryCardTextClass("أ".repeat(160)), "medium");
  assert.equal(countryCardTextClass("ب".repeat(390)), "xlong");
  assert.equal(countryCardTextClass("ج".repeat(550)), "xxlong");
  assert.ok(
    countryCardFontScale("أ".repeat(550)) <
    countryCardFontScale("مصر")
  );
});

test("FIX11 marks country fields without rewriting values or media source", () => {
  const runtime = read("src/services/r20CountryCards.js");
  assert.match(runtime, /data-r20-country-name/);
  assert.match(runtime, /data-r20-country-media/);
  assert.match(runtime, /data-r20-country-details/);
  assert.doesNotMatch(runtime, /\.textContent\s*=/);
  assert.doesNotMatch(runtime, /\.src\s*=/);
});

test("FIX11 uses real overflow auto-fit", () => {
  const runtime = read("src/services/r20CountryCards.js");
  assert.match(runtime, /hasOverflow/);
  assert.match(runtime, /scrollWidth > card\.clientWidth/);
  assert.match(runtime, /scrollHeight > card\.clientHeight/);
  assert.match(runtime, /--r20-country-font-scale/);
  assert.match(runtime, /scale - 0\.05/);
});

test("FIX11 only removes unsafe giant inline dimensions and offsets", () => {
  const runtime = read("src/services/r20CountryCards.js");
  assert.match(runtime, /neutralizeUnsafeInlineSizing/);
  assert.match(runtime, /width > 900/);
  assert.match(runtime, /minWidth > 700/);
  assert.match(runtime, /Math\.abs\(left\) > 300/);
  assert.match(runtime, /Math\.abs\(right\) > 300/);
});

test("FIX11 responsive layout contains media and wraps details", () => {
  const css = read("src/styles/r20-fix11-country-cards.css");
  assert.match(css, /data-r20-country-card="true"/);
  assert.match(css, /object-fit:\s*contain\s*!important/);
  assert.match(css, /overflow-wrap:\s*anywhere\s*!important/);
  assert.match(css, /grid-template-columns/);
  assert.match(css, /max-width:\s*699px/);
  assert.match(css, /orientation:\s*landscape/);
});

test("FIX11 keeps educational cards separate", () => {
  const runtime = read("src/services/r20CountryCards.js");
  const educational = read("src/services/r20EducationalCards.js");
  assert.match(runtime, /excluded-educational-card/);
  assert.match(educational, /function isCountryCard/);
  assert.match(educational, /!isEducationalDefinitionCard\(card\)/);
});

test("FIX11 does not implement geography correction", () => {
  const runtime = read("src/services/r20CountryCards.js");
  assert.doesNotMatch(
    runtime,
    /Djibouti|Somalia|Comoros|Nile|Greenwich|latitude/i
  );
});

test("FIX11 is imported after educational cards", () => {
  const main = read("src/main.jsx");
  assert.match(main, /r20EducationalCards\.js/);
  assert.match(main, /r20CountryCards\.js/);
  assert.match(main, /r20-fix11-country-cards\.css/);
});
