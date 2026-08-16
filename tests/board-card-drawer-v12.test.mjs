import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const classMode = await readFile(new URL('../src/pages/ClassMode.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/styles/v111.css', import.meta.url), 'utf8');
const cards = [
  'geographical-term','historical-term','event','date','place','timeline','note',
  'historical-witness','person','cause-result','thinking-question','comparison',
];

test('V12 exposes a dedicated board card drawer', () => {
  assert.match(classMode, /البطاقات التعليمية/);
  assert.match(classMode, /classmode-card-drawer/);
  assert.match(classMode, /application\/x-mobdea-board-card/);
  assert.match(styles, /\.classmode-card-drawer-list/);
  assert.match(styles, /overflow-y:auto/);
});

test('V12 uses teacher-supplied card assets', async () => {
  for (const card of cards) {
    assert.match(classMode, new RegExp(`/whiteboard/cards/${card}\\.png`));
    const info = await stat(new URL(`../public/whiteboard/cards/${card}.png`, import.meta.url));
    assert.ok(info.size > 20_000, `${card} asset is unexpectedly small`);
  }
});

test('V12 board cards are editable, movable and resizable', () => {
  assert.match(classMode, /kind: 'board-card'/);
  assert.match(classMode, /تعديل النص/);
  assert.match(classMode, /board-card-resize-handle/);
  assert.match(classMode, /onChange\(\{ \.\.\.action, x:/);
  assert.match(classMode, /mediaDataUrl/);
});

test('V12 does not keep map symbols inside the whiteboard tool list', () => {
  const toolsBlock = classMode.slice(classMode.indexOf('const toolOptions'), classMode.indexOf('const TEXT_TOOL_STYLES'));
  assert.doesNotMatch(toolsBlock, /historical-symbol/);
  assert.doesNotMatch(toolsBlock, /geographical-symbol/);
});

test('V12 includes cards in exported board snapshots', () => {
  assert.match(classMode, /drawBoardCardToCanvas/);
  assert.match(classMode, /boardActions\.filter\(\(action\) => action\.kind === 'board-card'\)/);
});
