import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('whiteboard exposes separate historical and geography symbol systems', () => {
  const source = read('src/pages/ClassMode.jsx');
  assert.match(source, /geographicalSymbolOptions/);
  assert.match(source, /key: 'mountain'/);
  assert.match(source, /key: 'river'/);
  assert.match(source, /key: 'globe'/);
  assert.match(source, /key: 'contours'/);
  assert.match(source, /key: 'latlon'/);
  assert.match(source, /geographical-symbol/);
});

test('historical board contains premium identity and extra dimensional teaching stamps', () => {
  const source = read('src/pages/ClassMode.jsx');
  assert.match(source, /key: 'sphinx'/);
  assert.match(source, /key: 'temple'/);
  assert.match(source, /key: 'mobdea-seal'/);
  assert.match(source, /identity\.teacherName/);
  assert.match(source, /مصطفى بركات/);
});

test('term cards remain distinct and include semantic labels', () => {
  const source = read('src/pages/ClassMode.jsx');
  assert.match(source, /مصطلح تاريخي/);
  assert.match(source, /مصطلح جغرافي/);
  assert.match(source, /حدث مهم/);
  assert.match(source, /شخصية/);
  assert.match(source, /تعريف/);
  assert.match(source, /بطاقة تعليمية/);
});

test('premium board CSS preserves writing area and scrollable tool trays', () => {
  const css = read('src/styles/v111.css');
  assert.match(css, /R18 browser V8: premium historical\/geography whiteboard/);
  assert.match(css, /classmode-geographical-symbol-row/);
  assert.match(css, /max-height:clamp\(80px,18dvh,136px\)/);
  assert.match(css, /touch-action:pan-x pan-y/);
});

test('fullscreen board is the same board surface rather than a replacement screen', () => {
  const css = read('src/styles/v111.css');
  const source = read('src/pages/ClassMode.jsx');
  assert.match(css, /stage-focus-mode \.class-board-canvas-shell:not\(\.has-resource-head\)/);
  assert.match(source, /contentMode === 'board' \? 'ملء السبورة' : 'ملء العرض'/);
});
