import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COUNTRY_CARD_CATEGORIES,
  COUNTRY_CARDS,
  COUNTRY_CARD_MAP,
  DEFAULT_COUNTRY_CARD,
  countryCardsForCategory,
} from '../src/data/countryCards.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const classMode = await readFile(path.join(root, 'src/pages/ClassMode.jsx'), 'utf8');
const css = await readFile(path.join(root, 'src/styles/v111.css'), 'utf8');
const handwriting = await readFile(path.join(root, 'src/services/handwritingRecognition.js'), 'utf8');
const nativeInk = await readFile(path.join(root, 'android/app/src/main/java/com/mobdea/education/handwriting/MobdeaDigitalInkPlugin.java'), 'utf8');
const mainActivity = await readFile(path.join(root, 'android/app/src/main/java/com/mobdea/education/MainActivity.java'), 'utf8');
const appGradle = await readFile(path.join(root, 'android/app/build.gradle'), 'utf8');

function pngInfo(buffer) {
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25],
  };
}

test('V14 country card library has 35 countries plus one default card in four requested categories', () => {
  assert.deepEqual(COUNTRY_CARD_CATEGORIES.map((item) => item.label), [
    'الوطن العربي', 'أفريقيا', 'أوروبا وآسيا', 'الأمريكتان وأستراليا',
  ]);
  assert.equal(COUNTRY_CARDS.length, 35);
  assert.equal(Object.keys(COUNTRY_CARD_MAP).length, 36);
  assert.equal(DEFAULT_COUNTRY_CARD.key, '00');
  assert.equal(DEFAULT_COUNTRY_CARD.isDefault, true);
  assert.equal(new Set(COUNTRY_CARDS.map((item) => item.key)).size, 35);
  assert.equal(COUNTRY_CARDS.filter((item) => item.category === 'arab').length, 8);
  assert.equal(COUNTRY_CARDS.filter((item) => item.category === 'africa').length, 4);
  assert.equal(COUNTRY_CARDS.filter((item) => item.category === 'europe-asia').length, 15);
  assert.equal(COUNTRY_CARDS.filter((item) => item.category === 'americas-australia').length, 8);
  assert.equal(COUNTRY_CARDS.filter((item) => item.name === 'مصر').length, 1);
  assert.equal(COUNTRY_CARDS.find((item) => item.name === 'مصر')?.category, 'arab');
  assert.deepEqual(countryCardsForCategory('arab').map((item) => item.name),
    countryCardsForCategory('arab').map((item) => item.name).slice().sort((a, b) => a.localeCompare(b, 'ar')));
});

test('all 36 supplied country cards are kept as 1024x768 transparent PNG assets', async () => {
  for (let index = 0; index <= 35; index += 1) {
    const key = String(index).padStart(2, '0');
    const file = path.join(root, 'public/whiteboard/country-cards', `${key}.png`);
    const fileStat = await stat(file);
    assert.ok(fileStat.size > 5000, `${key} asset is unexpectedly small`);
    const info = pngInfo(await readFile(file));
    assert.equal(info.width, 1024, `${key} width`);
    assert.equal(info.height, 768, `${key} height`);
    assert.equal(info.colorType, 6, `${key} must remain RGBA`);
  }
});

test('V14 uses the exact teacher-supplied 1536x1024 board background without cover cropping', async () => {
  const file = path.join(root, 'public/identity/class-board-history-v14.jpg');
  const buffer = await readFile(file);
  assert.equal(buffer[0], 0xff);
  assert.equal(buffer[1], 0xd8);
  assert.equal(createHash('sha256').update(buffer).digest('hex'), '5a425369248668876f19a40a48657ebdd7687e20adde68fee7c761b64335aea6');
  assert.match(classMode, /class-board-history-v14\.jpg/);
  assert.match(classMode, /const BOARD_CANVAS_WIDTH = 1536/);
  assert.match(classMode, /const BOARD_CANVAS_HEIGHT = 1024/);
  assert.match(css, /board-theme-history[\s\S]*object-fit:\s*contain/);
});

test('country cards have a dedicated board drawer with typed RTL editable fields and board export support', () => {
  assert.match(classMode, /بطاقات الدول/);
  assert.match(classMode, /country-card-category-tabs/);
  assert.match(classMode, /application\/x-mobdea-country-card/);
  assert.match(classMode, /country-card-field-editor/);
  assert.match(classMode, /<textarea[\s\S]*dir="rtl"/);
  assert.match(classMode, /kind:\s*'country-card'/);
  assert.match(classMode, /drawCountryCardToCanvas/);
  assert.match(classMode, /boardActions\.filter\(\(action\) => action\.kind === 'country-card'\)/);
});

test('V14 exposes real distinct Arabic font families and four fixed writing presets', () => {
  for (const family of ['Noto Naskh Arabic', 'Aref Ruqaa', 'Amiri', 'Noto Kufi Arabic', 'Reem Kufi']) {
    assert.ok(classMode.includes(family), family);
  }
  for (const label of ['رئيسي', 'عنوان', 'شرح', 'ملاحظة']) assert.ok(classMode.includes(`label: '${label}'`), label);
  assert.match(classMode, /document\.fonts\?\.load/);
  assert.match(classMode, /fontReady/);
  assert.match(css, /fonts\.googleapis\.com/);
});

test('handwriting correction keeps original strokes on low confidence and applies the selected preset on success', () => {
  assert.match(classMode, /recentHandwritingStrokes/);
  assert.match(classMode, /handwritingSnapshot/);
  assert.match(classMode, /confidence < 22/);
  assert.match(classMode, /أبقيت خط اليد كما هو/);
  assert.match(classMode, /handwritingSourceStrokes/);
  assert.match(classMode, /fontSize,/);
  assert.match(classMode, /fontWeight,/);
  assert.match(classMode, /lineHeight:\s*activeTextPreset\.lineHeight/);
  assert.match(classMode, /textPreset,/);
  assert.match(handwriting, /TextDetector/);
  assert.match(handwriting, /tesseract\.js/);
  assert.match(handwriting, /confidence/);
  assert.match(handwriting, /tessedit_pageseg_mode/);
  assert.match(classMode, /getCoalescedEvents/);
  assert.match(classMode, /quadraticCurveTo/);
  assert.match(classMode, /setPointerCapture/);
  assert.match(classMode, /BOARD_CANVAS_WIDTH = 1536/);
  assert.match(classMode, /BOARD_CANVAS_HEIGHT = 1024/);
});


test('Android V14 prefers vector digital-ink recognition and keeps browser OCR as fallback', () => {
  assert.match(handwriting, /registerPlugin\('MobdeaDigitalInk'\)/);
  assert.match(handwriting, /recognizeHandwritingStrokes/);
  assert.match(handwriting, /Capacitor\.isNativePlatform/);
  assert.match(nativeInk, /DigitalInkRecognitionModelIdentifier\.fromLanguageTag/);
  assert.match(nativeInk, /RecognitionContext/);
  assert.match(nativeInk, /WritingArea/);
  assert.match(nativeInk, /RemoteModelManager/);
  assert.match(nativeInk, /getScore\(\)/);
  assert.doesNotMatch(nativeInk, /confidence\", best == null .*100/);
  assert.match(mainActivity, /registerPlugin\(MobdeaDigitalInkPlugin\.class\)/);
  assert.match(appGradle, /com\.google\.mlkit:digital-ink-recognition:19\.0\.0/);
});
