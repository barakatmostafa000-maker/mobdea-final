export const R20_GEOGRAPHY_TRUTH_MARKER =
  "R20_FIX14_GEOGRAPHY_CORRECTNESS_V1";

export const R20_ARAB_WORLD = Object.freeze([
  "Algeria",
  "Bahrain",
  "Comoros",
  "Djibouti",
  "Egypt",
  "Iraq",
  "Jordan",
  "Kuwait",
  "Lebanon",
  "Libya",
  "Mauritania",
  "Morocco",
  "Oman",
  "Palestine",
  "Qatar",
  "Saudi Arabia",
  "Somalia",
  "Sudan",
  "Syria",
  "Tunisia",
  "United Arab Emirates",
  "Yemen",
]);

export const R20_NILE_BASIN_COUNTRIES = Object.freeze([
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
]);

export const R20_EGYPT_REFERENCE = Object.freeze({
  country: "Egypt",
  arabicName: "مصر",
  capital: "Cairo",
  continent: "Africa",
  subregion: "Northern Africa",
  seas: Object.freeze([
    "Mediterranean Sea",
    "Red Sea",
  ]),
  nileFlowsThrough: true,
});

export const R20_NILE_REFERENCE = Object.freeze({
  whiteNileHeadwaterSystem: Object.freeze([
    "Kagera River",
    "Lake Victoria",
    "Victoria Nile",
    "Lake Kyoga",
    "Lake Albert",
    "Albert Nile",
    "Bahr el Jebel",
    "White Nile",
  ]),
  majorTributaries: Object.freeze([
    "Blue Nile",
    "Sobat",
    "Atbara",
  ]),
  blueNileOrigin: "Lake Tana",
  atbaraOriginRegion: "Ethiopian Highlands",
  deltaDestination: "Mediterranean Sea",
});

const ALIASES = Object.freeze({
  "مصر": "Egypt",
  "egypt": "Egypt",
  "جيبوتي": "Djibouti",
  "djibouti": "Djibouti",
  "الصومال": "Somalia",
  "somalia": "Somalia",
  "جزر القمر": "Comoros",
  "comoros": "Comoros",
  "فلسطين": "Palestine",
  "palestine": "Palestine",
  "السودان": "Sudan",
  "sudan": "Sudan",
  "جنوب السودان": "South Sudan",
  "south sudan": "South Sudan",
  "إريتريا": "Eritrea",
  "اريتريا": "Eritrea",
  "eritrea": "Eritrea",
  "إثيوبيا": "Ethiopia",
  "اثيوبيا": "Ethiopia",
  "ethiopia": "Ethiopia",
  "أوغندا": "Uganda",
  "اوغندا": "Uganda",
  "uganda": "Uganda",
  "كينيا": "Kenya",
  "kenya": "Kenya",
  "تنزانيا": "Tanzania",
  "tanzania": "Tanzania",
  "رواندا": "Rwanda",
  "rwanda": "Rwanda",
  "بوروندي": "Burundi",
  "burundi": "Burundi",
  "الكونغو الديمقراطية":
    "Democratic Republic of the Congo",
  "جمهورية الكونغو الديمقراطية":
    "Democratic Republic of the Congo",
  "democratic republic of the congo":
    "Democratic Republic of the Congo",
  "dr congo":
    "Democratic Republic of the Congo",
  "drc":
    "Democratic Republic of the Congo",
});

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalCountryName(value) {
  const raw = clean(value);
  if (!raw) return "";
  return ALIASES[raw.toLowerCase()] || raw;
}

export function ensureArabWorldMembership(values = []) {
  const result = new Set(
    values
      .map(canonicalCountryName)
      .filter(Boolean),
  );

  R20_ARAB_WORLD.forEach(
    (country) => result.add(country),
  );

  return [...result];
}

export function ensureNileBasinMembership(values = []) {
  const result = new Set(
    values
      .map(canonicalCountryName)
      .filter(Boolean),
  );

  R20_NILE_BASIN_COUNTRIES.forEach(
    (country) => result.add(country),
  );

  return [...result];
}

export function validateArabWorld(values = []) {
  const found = new Set(
    values
      .map(canonicalCountryName)
      .filter(Boolean),
  );

  const missing = R20_ARAB_WORLD.filter(
    (country) => !found.has(country),
  );

  return {
    ok: missing.length === 0,
    expectedCount: 22,
    missing,
  };
}

export function validateNileBasin(values = []) {
  const found = new Set(
    values
      .map(canonicalCountryName)
      .filter(Boolean),
  );

  const missing = R20_NILE_BASIN_COUNTRIES.filter(
    (country) => !found.has(country),
  );

  return {
    ok: missing.length === 0,
    expectedCount: 11,
    missing,
  };
}

if (typeof window !== "undefined") {
  window.mobdeaR20GeographyTruth =
    Object.freeze({
      marker: R20_GEOGRAPHY_TRUTH_MARKER,
      arabWorld: R20_ARAB_WORLD,
      nileBasin: R20_NILE_BASIN_COUNTRIES,
      egypt: R20_EGYPT_REFERENCE,
      nile: R20_NILE_REFERENCE,
      canonicalCountryName,
      ensureArabWorldMembership,
      ensureNileBasinMembership,
      validateArabWorld,
      validateNileBasin,
    });
}
