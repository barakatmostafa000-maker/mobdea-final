import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const classMode = fs.readFileSync('src/pages/ClassMode.jsx', 'utf8');
const css = fs.readFileSync('src/styles/r19-classmode-phase1.css', 'utf8');
const countries = fs.readFileSync('src/data/countryCards.js', 'utf8');

test('true fullscreen uses presentation-only chrome and an exit control', () => {
  assert.match(classMode, /fullscreen presentation-fullscreen stage-focus-mode/);
  assert.match(classMode, /classmode-fullscreen-exit/);
  assert.match(css, /\.classmode-viewport\.presentation-fullscreen > \.classmode-viewport-header/);
  assert.match(css, /\.classmode-viewport\.presentation-fullscreen \.classmode-viewport-students/);
});

test('historical board fills the viewport without the old fixed 3:2 shell', () => {
  assert.match(css, /class-board-canvas-shell\.board-theme-history/);
  assert.match(css, /width: 100% !important;/);
  assert.match(css, /height: 100% !important;/);
  assert.match(css, /aspect-ratio: auto !important;/);
  assert.match(css, /object-fit: contain !important;/);
});

test('educational cards capture their drag host and can shrink further', () => {
  assert.match(classMode, /const host = event\.currentTarget\.parentElement\?\.getBoundingClientRect\?\.\(\);/);
  assert.match(classMode, /Math\.max\(220, Math\.min\(1050/);
  assert.match(classMode, /boardCardFieldScale/);
  assert.match(css, /container-type: inline-size/);
});

test('country cards can shrink and expose capital and language metadata', () => {
  assert.match(classMode, /Math\.max\(240, Math\.min\(1120/);
  assert.match(classMode, /country-card-meta-strip/);
  assert.match(countries, /capital/);
  assert.match(countries, /language/);
  assert.match(countries, /'القاهرة', 'العربية'/);
});

test('corrected handwriting remains selectable and has manual size controls', () => {
  assert.match(classMode, /correctedFontSize/);
  assert.match(classMode, /setSelectedBoardActionId\(nextAction\.id\)/);
  assert.match(classMode, /adjustBoardTextSize/);
  assert.match(classMode, /classmode-text-size-value/);
});

test('Mobdea historical symbol renders the real project logo', () => {
  assert.match(classMode, /MOBDEA_LOGO_IMAGE/);
  assert.match(classMode, /ctx\.drawImage\(MOBDEA_LOGO_IMAGE/);
  assert.match(classMode, /شعار المُبدع/);
});

test('placing cards and teaching symbols returns to writing instead of trapping the tool', () => {
  assert.match(classMode, /\['historical-symbol', 'geographical-symbol', 'shape', 'arrow'\]\.includes\(action\.kind\)/);
  assert.match(classMode, /عادت السبورة إلى القلم للشرح مباشرة/);
});
