import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('web PDF renders directly into a live canvas with bundled pdfjs legacy build', () => {
  const renderer = read('src/components/classmode/PdfCanvasPreview.jsx');
  const media = read('src/components/classmode/MediaRenderer.jsx');
  assert.match(renderer, /pdfjs-dist\/legacy\/build\/pdf\.mjs/);
  assert.match(renderer, /pdfPage\.render/);
  assert.match(renderer, /ResizeObserver/);
  assert.match(media, /<PdfCanvasPreview/);
});

test('PDF and image annotation canvas cannot paint parchment over media', () => {
  const css = read('src/styles/v111.css');
  assert.match(css, /board-theme-history\.has-resource-head[\s\S]*background: transparent !important/);
  assert.match(css, /class-board-canvas-shell\.has-resource-head[\s\S]*pointer-events: none !important/);
});

test('class mode resolves media independently by active content mode and exposes switching controls', () => {
  const source = read('src/pages/ClassMode.jsx');
  assert.match(source, /const modeResources = useMemo/);
  assert.match(source, /const displayResource = useMemo/);
  assert.match(source, /classmode-inline-media-switcher/);
  assert.match(source, /cycleModeResource/);
});

test('lesson map is map-first and has independent symbols and map controls drawers', () => {
  const source = read('src/components/maps/LessonMapStudio.jsx');
  const css = read('src/styles/v111.css');
  assert.match(source, /lesson-map-drawer-symbols/);
  assert.match(source, /lesson-map-drawer-controls/);
  assert.match(source, /الخرائط والتحديد/);
  assert.match(css, /lesson-map-canvas-shell-v5[\s\S]*position: absolute !important/);
  assert.match(css, /lesson-map-symbol-scroll[\s\S]*overflow-y: auto !important/);
});

test('routine lesson-map movements no longer trigger the large class-mode save toast', () => {
  const studio = read('src/components/maps/LessonMapStudio.jsx');
  const classMode = read('src/pages/ClassMode.jsx');
  assert.doesNotMatch(studio, /تم حفظ تغييرات الخريطة تلقائيًا داخل الدرس/);
  assert.doesNotMatch(classMode, /setShareNotice\('تم حفظ الخريطة التعليمية داخل الدرس\.'/);
});

test('map symbols use dimensional SVG relief and board exposes historical relief symbols', () => {
  const map = read('src/components/maps/ProfessionalMap.jsx');
  const classMode = read('src/pages/ClassMode.jsx');
  assert.match(map, /feDropShadow/);
  assert.match(map, /relief-glyph/);
  assert.match(classMode, /historicalSymbolOptions/);
  assert.match(classMode, /stamp\.kind === 'historical-symbol'/);
  assert.match(classMode, /classmode-historical-symbol-row/);
});

test('map challenge is forced into a non-collapsing full viewport', () => {
  const css = read('src/styles/v111.css');
  assert.match(css, /map-challenge-pro\.map-game-v103[\s\S]*position: fixed !important/);
  assert.match(css, /height: 100dvh !important/);
  assert.match(css, /map-game-canvas-shell[\s\S]*height: 100% !important/);
});
