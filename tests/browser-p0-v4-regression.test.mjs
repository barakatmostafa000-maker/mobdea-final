import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PDF renderer uses bundled pdfjs-dist instead of a remote CDN', () => {
  const source = read('src/services/webPdfRenderer.js');
  assert.match(source, /pdfjs-dist\/build\/pdf\.mjs/);
  assert.match(source, /pdf\.worker\.min\.mjs\?url/);
  assert.doesNotMatch(source, /cdnjs\.cloudflare\.com/);
});

test('Class mode does not re-pin the preferred PDF after every media selection', () => {
  const source = read('src/pages/ClassMode.jsx');
  assert.match(source, /appliedPreferredResourceRef/);
  assert.match(source, /appliedPreferredResourceRef\.current === preferredResourceId/);
});

test('map placements render symbols without text cards by default', () => {
  const source = read('src/components/maps/ProfessionalMap.jsx');
  assert.match(source, /shape-only/);
  assert.match(source, /placement\.showLabel \|\| placement\.type === 'custom-label'/);
});

test('lesson map supports touch pointer placement and overlays drawer on full map', () => {
  const source = read('src/components/maps/LessonMapStudio.jsx');
  const css = read('src/styles/v111.css');
  assert.match(source, /startSymbolPointer/);
  assert.match(source, /elementFromPoint/);
  assert.match(css, /lesson-map-symbol-sidebar[\s\S]*position: absolute !important/);
});

test('board focus keeps the real historical canvas visible', () => {
  const css = read('src/styles/v111.css');
  assert.match(css, /stage-focus-mode \.class-board-canvas-shell\.board-theme-history/);
  assert.match(css, /stage-focus-mode \.classmode-board-lesson-ribbon[\s\S]*display: none !important/);
});

test('map challenge guarantees a real map viewport', () => {
  const css = read('src/styles/v111.css');
  const source = read('src/pages/MapChallenge.jsx');
  assert.match(css, /map-challenge-pro\.map-game-v103 \.map-game-canvas-shell[\s\S]*min-height: clamp\(320px, 54dvh, 620px\)/);
  assert.match(source, /finishPalettePointer/);
});
