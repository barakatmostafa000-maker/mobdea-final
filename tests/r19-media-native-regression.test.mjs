import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');

test('R19 accepts 500 MB local/native textbook assets', () => {
  assert.match(read('src/services/assetStore.js'), /MAX_ASSET_BYTES = 500 \* 1024 \* 1024/);
  assert.match(
    read('android/app/src/main/java/com/mobdea/education/assets/MobdeaNativeAssetPlugin.java'),
    /MAX_ASSET_BYTES = 500L \* 1024L \* 1024L/,
  );
  assert.match(
    read('android/app/src/main/java/com/mobdea/education/pdf/MobdeaPdfRendererPlugin.java'),
    /MAX_PDF_BYTES = 500L \* 1024L \* 1024L/,
  );
  assert.match(
    read('android/app/src/main/java/com/mobdea/education/ocr/MobdeaPdfOcrPlugin.java'),
    /MAX_PDF_BYTES = 500L \* 1024L \* 1024L/,
  );
});

test('native staging reads JavaScript numeric sizes safely and stays chunked', () => {
  const bridge = read('src/services/nativeAssetBridge.js');
  const native = read('android/app/src/main/java/com/mobdea/education/assets/MobdeaNativeAssetPlugin.java');
  assert.match(bridge, /const CHUNK_BYTES = 384 \* 1024/);
  assert.match(bridge, /NativeAsset\.begin\(\{ size: blob\.size \}\)/);
  assert.match(bridge, /NativeAsset\.append/);
  assert.match(native, /call\.getDouble\("size", 0d\)/);
  assert.match(native, /long expectedSize = readAssetSize\(call\);/);
  assert.doesNotMatch(native, /call\.getLong\("size"/);
});

test('ClassMode keeps real multi-resource previous and next controls', () => {
  const source = read('src/pages/ClassMode.jsx');
  assert.match(source, /classmode-inline-media-switcher/);
  assert.match(source, /cycleModeResource\(-1\)/);
  assert.match(source, /cycleModeResource\(1\)/);
  assert.match(source, /classmode-page-nav/);
});

test('Android registers PDF, OCR, PowerPoint and native asset plugins', () => {
  const source = read('android/app/src/main/java/com/mobdea/education/MainActivity.java');
  for (const plugin of [
    'MobdeaPdfRendererPlugin.class',
    'MobdeaPdfOcrPlugin.class',
    'MobdeaPptxRendererPlugin.class',
    'MobdeaNativeAssetPlugin.class',
  ]) {
    assert.ok(source.includes(`registerPlugin(${plugin})`), `Missing registration for ${plugin}`);
  }
});
