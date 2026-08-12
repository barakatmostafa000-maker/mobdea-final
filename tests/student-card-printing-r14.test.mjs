import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('top card print action prepares both faces', () => {
  const source = read('src/pages/StudentCards.jsx');
  assert.match(source, /startPrinting\('both'\)/);
  assert.match(source, /printCurrentView\('بطاقات طلاب المبدع', \{/);
  assert.match(source, /duplexMode: normalizedMode === 'both' \? nativeDuplexMode\(duplexMode\) : 'none'/);
  assert.match(source, /<DuplexPrintRun/);
  assert.match(source, /data-side="front"/);
  assert.match(source, /data-side="back"/);
  assert.ok(source.indexOf('duplex-front-page') < source.indexOf('duplex-back-page'));
});

test('native Android print waits for committed WebView visual state', () => {
  const source = read('android/app/src/main/java/com/mobdea/education/printing/MobdeaPrintPlugin.java');
  assert.match(source, /postVisualStateCallback/);
  assert.match(source, /DUPLEX_MODE_LONG_EDGE/);
  assert.match(source, /DUPLEX_MODE_SHORT_EDGE/);
});

test('R14 print stylesheet fixes A4 landscape sheet bounds and equal card ratio', () => {
  const source = read('src/styles/v109.css');
  assert.match(source, /size: A4 landscape/);
  assert.match(source, /width: 285mm/);
  assert.match(source, /height: 198mm/);
  assert.match(source, /aspect-ratio: 1536 \/ 572/);
});
