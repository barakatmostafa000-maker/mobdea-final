import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import worldCountries from '../src/data/world-countries.json' with { type: 'json' };
import { getRegionCountries } from '../src/data/geography.js';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the six required map regions have real country geometry', () => {
  for (const key of ['egypt', 'arab', 'africa', 'asia', 'europe', 'world']) {
    const countries = getRegionCountries(worldCountries, key);
    assert.ok(countries.length > 0, `${key} should contain country geometry`);
    assert.ok(countries.every((feature) => feature?.geometry?.coordinates?.length), `${key} geometry should not be empty`);
  }
});

test('PDF browser renderer publishes a rendered image rather than browser PDF chrome', () => {
  const source = read('src/components/classmode/PdfCanvasPreview.jsx');
  assert.match(source, /canvasBlob\(canvas\)/);
  assert.match(source, /classmode-pdf-rendered-image/);
  assert.match(source, /pdfPage\.render/);
  assert.doesNotMatch(source, /<iframe|<embed|<object/);
});

test('lesson map exposes the nine core maps in one map drawer', () => {
  const source = read('src/components/maps/LessonMapStudio.jsx');
  assert.match(source, /CORE_REGION_KEYS = \['egypt', 'arab', 'africa', 'asia', 'europe', 'northAmerica', 'southAmerica', 'australia', 'world'\]/);
  assert.match(source, /lesson-map-region-grid/);
  assert.match(source, /lesson-map-symbol-scroll/);
});

test('symbol drawer keeps vertical touch scrolling available', () => {
  const css = read('src/styles/v111.css');
  assert.match(css, /lesson-map-symbol-scroll[\s\S]*overflow-y:\s*auto !important/);
  assert.match(css, /lesson-map-symbol-list button[\s\S]*touch-action:\s*pan-y !important/);
});

test('placed map symbols use dimensional relief SVGs', () => {
  const source = read('src/components/maps/ProfessionalMap.jsx');
  assert.match(source, /terrain-3d mountain-3d/);
  assert.match(source, /terrain-3d plateau-3d/);
  assert.match(source, /preserveAspectRatio="xMidYMid meet"/);
});

test('historical board includes dimensional artifacts and a premium frame', () => {
  const source = read('src/pages/ClassMode.jsx');
  const css = read('src/styles/v111.css');
  assert.match(source, /historyRelief/);
  assert.match(source, /historyStone/);
  assert.match(source, /historyPapyrus/);
  assert.match(css, /board-theme-history:not\(\.has-resource-head\)/);
});

test('map challenge exposes nine independent regional maps', () => {
  const source = read('src/pages/MapChallenge.jsx');
  assert.match(source, /coreRegionKeys = \['egypt', 'arab', 'africa', 'asia', 'europe', 'northAmerica', 'southAmerica', 'australia', 'world'\]/);
  assert.match(source, /map-region-tabs-core/);
});
