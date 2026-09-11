import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  R20_ARAB_WORLD,
  R20_NILE_BASIN_COUNTRIES,
  R20_EGYPT_REFERENCE,
  R20_NILE_REFERENCE,
  canonicalCountryName,
  ensureArabWorldMembership,
  ensureNileBasinMembership,
  validateArabWorld,
  validateNileBasin,
} from "../src/services/r20GeographyTruth.js";

test("FIX14 Arab World is complete 22 including Djibouti Somalia Comoros", () => {
  assert.equal(R20_ARAB_WORLD.length, 22);

  for (const name of [
    "Djibouti",
    "Somalia",
    "Comoros",
  ]) {
    assert.ok(
      R20_ARAB_WORLD.includes(name),
      `missing ${name}`,
    );
  }
});

test("FIX14 Nile basin is complete 11-state geographic basin set", () => {
  assert.equal(
    R20_NILE_BASIN_COUNTRIES.length,
    11,
  );

  for (const name of [
    "Burundi",
    "Democratic Republic of the Congo",
    "Egypt",
    "Eritrea",
    "Ethiopia",
    "Kenya",
    "Rwanda",
    "South Sudan",
    "Sudan",
    "Tanzania",
    "Uganda",
  ]) {
    assert.ok(
      R20_NILE_BASIN_COUNTRIES.includes(name),
      `missing ${name}`,
    );
  }
});

test("FIX14 Arabic aliases normalize key countries", () => {
  assert.equal(
    canonicalCountryName("جيبوتي"),
    "Djibouti",
  );
  assert.equal(
    canonicalCountryName("الصومال"),
    "Somalia",
  );
  assert.equal(
    canonicalCountryName("جزر القمر"),
    "Comoros",
  );
  assert.equal(
    canonicalCountryName("جنوب السودان"),
    "South Sudan",
  );
  assert.equal(
    canonicalCountryName("الكونغو الديمقراطية"),
    "Democratic Republic of the Congo",
  );
});

test("FIX14 completion helpers repair incomplete membership", () => {
  const arab =
    ensureArabWorldMembership([
      "Egypt",
      "Sudan",
    ]);

  const nile =
    ensureNileBasinMembership([
      "Egypt",
      "Sudan",
    ]);

  assert.equal(arab.length, 22);
  assert.equal(nile.length, 11);
  assert.equal(
    validateArabWorld(arab).ok,
    true,
  );
  assert.equal(
    validateNileBasin(nile).ok,
    true,
  );
});

test("FIX14 Egypt and Nile reference facts remain coherent", () => {
  assert.equal(
    R20_EGYPT_REFERENCE.continent,
    "Africa",
  );
  assert.equal(
    R20_EGYPT_REFERENCE.capital,
    "Cairo",
  );
  assert.ok(
    R20_EGYPT_REFERENCE.seas.includes(
      "Mediterranean Sea",
    ),
  );
  assert.ok(
    R20_EGYPT_REFERENCE.seas.includes(
      "Red Sea",
    ),
  );

  assert.ok(
    R20_NILE_REFERENCE.whiteNileHeadwaterSystem.includes(
      "Kagera River",
    ),
  );
  assert.ok(
    R20_NILE_REFERENCE.whiteNileHeadwaterSystem.includes(
      "Lake Victoria",
    ),
  );
  assert.ok(
    R20_NILE_REFERENCE.majorTributaries.includes(
      "Blue Nile",
    ),
  );
  assert.ok(
    R20_NILE_REFERENCE.majorTributaries.includes(
      "Sobat",
    ),
  );
  assert.ok(
    R20_NILE_REFERENCE.majorTributaries.includes(
      "Atbara",
    ),
  );
  assert.equal(
    R20_NILE_REFERENCE.blueNileOrigin,
    "Lake Tana",
  );
  assert.equal(
    R20_NILE_REFERENCE.deltaDestination,
    "Mediterranean Sea",
  );
});

test("FIX14 runtime never rewrites map geometry or coordinates", () => {
  const runtime =
    fs.readFileSync(
      "src/services/r20GeographyCorrectnessRuntime.js",
      "utf8",
    );

  assert.doesNotMatch(
    runtime,
    /setAttribute\(["'](?:d|points|x1|x2|y1|y2|cx|cy|transform|lat|lng|lon|latitude|longitude)["']/,
  );
});

test("FIX14 source patcher repairs English and Arabic fixture arrays", () => {
  const tmp =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        "r20-geo-",
      ),
    );

  const source =
    path.join(
      tmp,
      "sample.js",
    );

  fs.writeFileSync(
    source,
    `
const arabWorldCountries = ["Egypt", "Sudan"];
const nileBasinCountries = ["Egypt", "Sudan"];
const الوطن_العربي = ["مصر", "السودان"];
`,
    "utf8",
  );

  const run =
    spawnSync(
      "python3",
      [
        "scripts/r20-fix14-patch-geography-data.py",
        tmp,
      ],
      {
        encoding: "utf8",
      },
    );

  assert.equal(
    run.status,
    0,
    run.stderr,
  );

  const updated =
    fs.readFileSync(
      source,
      "utf8",
    );

  for (const token of [
    "Djibouti",
    "Somalia",
    "Comoros",
    "South Sudan",
    "Democratic Republic of the Congo",
    "جيبوتي",
    "الصومال",
    "جزر القمر",
  ]) {
    assert.match(
      updated,
      new RegExp(token),
    );
  }
});

test("FIX14 stays wired after Maps and Atlas", () => {
  const main =
    fs.readFileSync(
      "src/main.jsx",
      "utf8",
    );

  assert.match(
    main,
    /r20MapsRuntime\.js/,
  );
  assert.match(
    main,
    /r20AtlasRuntime\.js/,
  );
  assert.match(
    main,
    /r20GeographyTruth\.js/,
  );
  assert.match(
    main,
    /r20GeographyCorrectnessRuntime\.js/,
  );
  assert.match(
    main,
    /r20-fix14-geography-correctness\.css/,
  );
});
