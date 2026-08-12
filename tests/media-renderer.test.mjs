import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const renderer = fs.readFileSync(new URL('../src/components/classmode/MediaRenderer.jsx', import.meta.url), 'utf8');
const classMode = fs.readFileSync(new URL('../src/pages/ClassMode.jsx', import.meta.url), 'utf8');
const assetHook = fs.readFileSync(new URL('../src/hooks/useAssetSource.js', import.meta.url), 'utf8');
const pptxPreview = fs.readFileSync(new URL('../src/components/classmode/PptxPreview.jsx', import.meta.url), 'utf8');
const pptxNative = fs.readFileSync(new URL('../android/app/src/main/java/com/mobdea/education/pptx/MobdeaPptxRendererPlugin.java', import.meta.url), 'utf8');

test('class mode delegates every supported asset to one media renderer', () => {
  assert.match(classMode, /<MediaRenderer/);
  assert.doesNotMatch(classMode, /<PptxPreview/);
  for (const type of ['image', 'video', 'audio', 'pdf', 'textbook', 'slides']) {
    assert.match(renderer, new RegExp(`['\"]${type}['\"]`));
  }
});

test('assetId never falls back to a temporary URL after an Asset Store miss', () => {
  const branchStart = assetHook.indexOf("setState({ url: '', blob: null, loading: true");
  const assetIdBranch = assetHook.slice(branchStart, assetHook.indexOf('return state;'));
  assert.match(assetIdBranch, /url: ''/);
  assert.doesNotMatch(assetIdBranch, /url: fallback/);
});

test('video and images use the full in-class display surface', () => {
  assert.match(renderer, /className="unified-media-image"/);
  assert.match(renderer, /className="unified-media-video"/);
  assert.match(renderer, /controls/);
  assert.match(renderer, /playsInline/);
  assert.match(renderer, /preload="metadata"/);
});

test('PowerPoint keeps positioned text, images and common vector shapes', () => {
  assert.match(pptxNative, /normalizeShapeKind/);
  assert.match(pptxNative, /shapeKind/);
  assert.match(pptxNative, /strokeWidth/);
  assert.match(pptxNative, /rotation/);
  assert.match(pptxPreview, /element\.type === 'shape'/);
  assert.match(pptxPreview, /pptx-layout-shape/);
});
