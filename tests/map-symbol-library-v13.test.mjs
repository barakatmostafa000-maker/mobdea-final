import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAP_SYMBOL_GROUPS, MAP_SYMBOLS } from '../src/data/mapSymbolCatalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function pngInfo(buffer) {
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25],
  };
}

test('V13 map library contains exactly 19 categories and 181 unique symbols', () => {
  assert.equal(MAP_SYMBOL_GROUPS.length, 19);
  assert.equal(MAP_SYMBOLS.length, 181);
  assert.equal(new Set(MAP_SYMBOLS.map((item) => item.id)).size, 181);
  assert.deepEqual(MAP_SYMBOL_GROUPS.map((group) => group.label), [
    'التضاريس', 'المسطحات المائية', 'نهر النيل', 'العناصر البشرية والاقتصادية', 'المعادن',
    'رموز الخرائط والحركة', 'الطاقة', 'الغطاء النباتي', 'الحيوانات', 'المحاصيل', 'السكان',
    'الهجرة', 'النقل', 'الحدود السياسية والإدارية', 'السياحة والمعالم', 'الصناعة',
    'الثروة الحيوانية', 'الثروة السمكية', 'الزراعة',
  ]);
  assert.deepEqual(MAP_SYMBOL_GROUPS[0].items.map((item) => item.label), [
    'جبل منفرد', 'سلسلة جبال', 'هضبة', 'منخفض', 'وادٍ', 'كثبان رملية', 'صحراء', 'واحة',
  ]);
  assert.deepEqual(MAP_SYMBOL_GROUPS[1].items.map((item) => item.label), [
    'نهر', 'فرع نهر', 'منبع نهر', 'مصب نهر', 'دلتا', 'بحيرة', 'شلال', 'بحر', 'محيط', 'خليج', 'مضيق', 'جزيرة', 'شبه جزيرة',
  ]);
});

test('every V13 symbol asset exists as a 512x512 RGBA PNG', async () => {
  for (const item of MAP_SYMBOLS) {
    assert.match(item.asset, /^\/map-symbols\/[a-z0-9-]+\.png$/);
    const file = path.join(root, 'public', item.asset);
    const fileStat = await stat(file);
    assert.ok(fileStat.size > 1000, `${item.id} asset is unexpectedly small`);
    const info = pngInfo(await readFile(file));
    assert.equal(info.width, 512, `${item.id} width`);
    assert.equal(info.height, 512, `${item.id} height`);
    assert.equal(info.colorType, 6, `${item.id} must be RGBA`);
  }
});

test('map classroom drawer and challenge use V13 symbols with move/resize/delete controls', async () => {
  const studio = await readFile(path.join(root, 'src/components/maps/LessonMapStudio.jsx'), 'utf8');
  const professional = await readFile(path.join(root, 'src/components/maps/ProfessionalMap.jsx'), 'utf8');
  const challenge = await readFile(path.join(root, 'src/pages/MapChallenge.jsx'), 'utf8');
  assert.match(studio, /19 تصنيفًا • 181 رمزًا/);
  assert.match(studio, /onResizePlacement/);
  assert.match(studio, /selectedPlacementId/);
  assert.match(professional, /map-pro-placement-actions/);
  assert.match(professional, /onResizePlacement\?\./);
  assert.match(challenge, /terrain-single-mountain/);
  assert.match(challenge, /selectedBuildPlacementId/);
});
