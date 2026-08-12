import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

test('lucide map icon never shadows the native JavaScript Map constructor', () => {
  const classMode = read('src/pages/ClassMode.jsx');
  const library = read('src/pages/ContentLibrary.jsx');
  assert.match(classMode, /Map as MapIcon/);
  assert.match(classMode, /new Map\(\)/);
  assert.doesNotMatch(classMode, /\n\s*Map,\n/);
  assert.match(library, /Map as MapIcon/);
  assert.match(library, /new Map\(/);
});

test('classroom game tolerates the initial null question before the round effect runs', () => {
  const source = read('src/components/classmode/ClassroomGamePanel.jsx');
  assert.match(source, /if \(!question \|\| typeof question !== 'object'\) return \[\];/);
});

test('web PDF pages use a real PDF renderer instead of an iframe-only fallback', () => {
  const hook = read('src/hooks/usePdfPage.js');
  const renderer = read('src/services/webPdfRenderer.js');
  assert.match(hook, /renderWebPdfBlob/);
  assert.match(hook, /renderWebPdfPage/);
  assert.match(renderer, /pdfjs-dist\/build\/pdf\.mjs/);
  assert.match(renderer, /canvas\.toDataURL/);
  const directRenderer = read('src/components/classmode/PdfCanvasPreview.jsx');
  assert.match(directRenderer, /pdfjs-dist\/legacy\/build\/pdf\.mjs/);
  assert.match(directRenderer, /classmode-pdf-rendered-image/);
});

test('closed lesson map drawer leaves the map canvas as the only grid row', () => {
  const css = read('src/styles/v107.css');
  assert.match(css, /lesson-map-studio\.tools-closed \.lesson-map-main \{\s*grid-template-rows: minmax\(0, 1fr\) !important;/s);
});

test('class mode exposes a board-only focus mode and map challenge has a guaranteed viewport', () => {
  const classMode = read('src/pages/ClassMode.jsx');
  const css = read('src/styles/v111.css');
  assert.match(classMode, /classmode-board-focus-toggle/);
  assert.match(classMode, /stage-focus-mode/);
  assert.match(css, /\.classmode-viewport\.stage-focus-mode/);
  assert.match(css, /\.map-challenge-pro\.map-game-v103 \.map-game-canvas-shell/);
});
