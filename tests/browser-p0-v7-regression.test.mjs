import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PDF and images use shared pointer pinch zoom without resizing the media container', () => {
  const panzoom = read('src/components/classmode/PanZoomSurface.jsx');
  const media = read('src/components/classmode/MediaRenderer.jsx');
  const pdf = read('src/components/classmode/PdfCanvasPreview.jsx');
  const classMode = read('src/pages/ClassMode.jsx');
  assert.match(panzoom, /pointersRef = useRef\(new Map\(\)\)/);
  assert.match(panzoom, /kind: 'pinch'/);
  assert.match(media, /classmode-image-panzoom/);
  assert.match(pdf, /classmode-pdf-panzoom/);
  assert.doesNotMatch(classMode, /classmode-resource-preview" style=\{\{ '--board-zoom': mediaZoom \}\}/);
});

test('every Class Mode surface exposes the same focus/fullscreen control', () => {
  const source = read('src/pages/ClassMode.jsx');
  assert.match(source, /classmode-stage-focus-toggle/);
  assert.match(source, /contentMode === 'board' \? 'ملء السبورة' : 'ملء العرض'/);
  assert.doesNotMatch(source, /if \(contentMode !== 'board' && stageFocus\) setStageFocus\(false\)/);
});

test('media annotation canvas is a compact overlay and not scaled with media zoom', () => {
  const source = read('src/pages/ClassMode.jsx');
  const css = read('src/styles/v111.css');
  assert.match(source, /zoom=\{contentMode === 'board' \? zoom : 1\}/);
  assert.match(source, /media-annotation-tools/);
  assert.match(source, /media-annotation-toolbar/);
  assert.match(css, /media-annotation-tools[\s\S]*height:\s*46px !important/);
});

test('maps support silent blank maps and nine independent regions', () => {
  const studio = read('src/components/maps/LessonMapStudio.jsx');
  const challenge = read('src/pages/MapChallenge.jsx');
  const map = read('src/components/maps/ProfessionalMap.jsx');
  assert.match(studio, /northAmerica', 'southAmerica', 'australia'/);
  assert.match(challenge, /northAmerica', 'southAmerica', 'australia'/);
  assert.match(studio, /خريطة صماء/);
  assert.match(challenge, /خريطة صماء/);
  assert.match(map, /silent-map/);
  assert.match(map, /preserveAspectRatio="xMidYMid meet"/);
});

test('lesson-map symbol list no longer uses native draggable on every symbol button', () => {
  const source = read('src/components/maps/LessonMapStudio.jsx');
  const symbolSection = source.slice(source.indexOf('lesson-map-symbol-list'), source.indexOf('lesson-map-custom-label'));
  assert.doesNotMatch(symbolSection, /draggable/);
  assert.match(source, /startSymbolPointer/);
});

test('map challenge uses explicit landscape areas so the map stays in the main column', () => {
  const css = read('src/styles/v111.css');
  assert.match(css, /grid-template-areas:\s*"nav map question"/);
  assert.match(css, /\.map-game-main \{ grid-area:map/);
});
