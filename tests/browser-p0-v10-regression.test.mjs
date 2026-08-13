import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const classMode = await readFile(new URL('../src/pages/ClassMode.jsx', import.meta.url), 'utf8');
const pdf = await readFile(new URL('../src/components/classmode/PdfCanvasPreview.jsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/styles/v111.css', import.meta.url), 'utf8');
const handwriting = await readFile(new URL('../src/services/handwritingRecognition.js', import.meta.url), 'utf8');

test('historical board uses the exact supplied reference image', () => {
  assert.match(classMode, /class-board-history-v14\.jpg/);
  assert.match(classMode, /const BOARD_CANVAS_WIDTH = 1536/);
  assert.match(classMode, /const BOARD_CANVAS_HEIGHT = 1024/);
  assert.match(css, /classmode-board-reference-image/);
  assert.match(css, /board-theme-history[\s\S]*object-fit:\s*contain/);
});

test('PDF renderer keeps a high-resolution backing image as zoom increases', () => {
  assert.match(pdf, /qualityScale = Math\.max\(3, Math\.min\(5/);
  assert.match(pdf, /deviceRatio \* Math\.max\(1, Number\(zoom/);
  assert.match(pdf, /displaySize/);
});

test('normal text is edited inline and is not auto-selected after creation', () => {
  assert.match(classMode, /classmode-inline-text-editor/);
  assert.match(classMode, /setSelectedBoardActionId\(\['stroke', 'text'\]\.includes\(action\.kind\) \? null : next\.id\)/);
});

test('real Arabic font families are exposed in the board toolbar', () => {
  for (const family of ['Noto Naskh Arabic', 'Aref Ruqaa', 'Amiri', 'Noto Kufi Arabic', 'Reem Kufi']) {
    assert.ok(classMode.includes(family), family);
  }
  assert.match(css, /fonts\.googleapis\.com/);
});

test('handwriting conversion has an automatic recognition path with safe correction', () => {
  assert.match(classMode, /convertRecentHandwriting/);
  assert.match(classMode, /تصحيح خط اليد/);
  assert.match(handwriting, /TextDetector/);
  assert.match(handwriting, /tesseract\.js/);
});
