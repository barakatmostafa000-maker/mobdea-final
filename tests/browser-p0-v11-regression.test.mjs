import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { COUNTRY_AR_NAMES, MAP_RIVER_LINES, NILE_BASIN_ISO, NILE_POINTS, countryInfo } from '../src/data/mapEnrichment.js';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('country labels are statically Arabic and country info includes capital/fact/flag', () => {
  assert.equal(COUNTRY_AR_NAMES.EGY, 'مصر');
  assert.equal(COUNTRY_AR_NAMES.LBR, 'ليبيريا');
  const info = countryInfo({ properties: { iso_a3: 'EGY', name: 'Egypt', continent: 'Africa' } });
  assert.equal(info.name, 'مصر');
  assert.equal(info.capital, 'القاهرة');
  assert.match(info.fact, /النيل/);
  assert.ok(info.flag.length >= 2);
});

test('Nile teaching dataset includes tributaries, dams, lakes and basin countries', () => {
  const africa = MAP_RIVER_LINES.africa.map((item) => item.name);
  assert.ok(africa.includes('النيل الأبيض'));
  assert.ok(africa.includes('النيل الأزرق'));
  assert.ok(africa.includes('نهر عطبرة'));
  assert.ok(NILE_POINTS.some((item) => item.name === 'السد العالي'));
  assert.ok(NILE_POINTS.some((item) => item.name === 'سد النهضة'));
  assert.ok(NILE_POINTS.some((item) => item.name === 'بحيرة فيكتوريا'));
  assert.ok(NILE_BASIN_ISO.includes('EGY') && NILE_BASIN_ISO.includes('ETH') && NILE_BASIN_ISO.includes('UGA'));
});

test('professional map renders full coordinate lines, fixed rivers and custom symbol assets', () => {
  const source = read('src/components/maps/ProfessionalMap.jsx');
  assert.match(source, /MapCoordinateFocusOverlay/);
  assert.match(source, /map-pro-river-lines/);
  assert.match(source, /lineFeatures = \[\]/);
  assert.match(source, /pointFeatures = \[\]/);
  assert.match(source, /highlightCountryIsos = \[\]/);
  assert.match(source, /\/map-symbols\/\$\{safeType\}\.png/);
});

test('lesson map has external quick drawbar, info panel, voice and Nile mode', () => {
  const source = read('src/components/maps/LessonMapStudio.jsx');
  assert.match(source, /lesson-map-quick-drawbar/);
  assert.match(source, /lesson-map-info-card/);
  assert.match(source, /speechSynthesis/);
  assert.match(source, /lesson-map-nile-toggle/);
  assert.match(source, /lineFeatures=\{riverLines\}/);
  assert.doesNotMatch(source, /<label>أدوات الشرح<\/label>/);
});

test('Class Mode no longer renders share notices as teaching-area popup', () => {
  const source = read('src/pages/ClassMode.jsx');
  assert.match(source, /\{lastPraise && \(/);
  assert.doesNotMatch(source, /\{\(lastPraise \|\| shareNotice\) && \(/);
});

test('handwriting recognition prefers bundled tesseract before CDN fallback', () => {
  const source = read('src/services/handwritingRecognition.js');
  assert.match(source, /import\('tesseract\.js'\)/);
  assert.match(source, /loadBundledTesseract/);
  assert.match(source, /detectWithBrowserApi/);
});

test('challenge and focus mode have v11 map-first and true full screen rules', () => {
  const challenge = read('src/pages/MapChallenge.jsx');
  const css = read('src/styles/v111.css');
  assert.match(challenge, /map-game-v11/);
  assert.match(challenge, /lineFeatures=\{riverLines\}/);
  assert.match(css, /Map Challenge v11: map-first/);
  assert.match(css, /aspect-ratio:auto !important/);
  assert.match(css, /map-pro-coordinate-focus line/);
  assert.match(css, /map-pro-river-line/);
});
