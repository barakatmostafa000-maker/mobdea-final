import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function localImports(relative) {
  const source = read(relative);
  const directory = path.dirname(path.join(root, relative));
  const imports = [...source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)].map((match) => match[1]);
  return imports.filter((item) => item.startsWith('.')).map((item) => path.resolve(directory, item));
}

function resolvesLocalImport(base) {
  const candidates = [base, `${base}.js`, `${base}.jsx`, `${base}.css`, path.join(base, 'index.js'), path.join(base, 'index.jsx')];
  return candidates.some((candidate) => fs.existsSync(candidate));
}

test('R15 entrypoint local imports are complete', () => {
  for (const imported of localImports('src/main.jsx')) {
    assert.equal(resolvesLocalImport(imported), true, `Missing main.jsx import: ${imported}`);
  }
});

test('R15 keeps current staff security APIs without a legacy compatibility file', () => {
  const security = read('src/utils/security.js');
  for (const name of ['normalizeStaffPassword', 'createStaffPasswordSecret', 'hasStaffPasswordSecret', 'verifyFactoryStaffPassword', 'verifyStaffPasswordSecret']) {
    assert.match(security, new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\b`));
  }
  assert.equal(fs.existsSync(path.join(root, 'src/utils/securityStaffLegacy.js')), false);
});

test('R15 includes automatic OCR discovery and official-only game bank behavior', () => {
  const library = read('src/pages/ContentLibrary.jsx');
  const questions = read('src/services/contentQuestions.js');
  assert.match(library, /autoDetectQuestionsFromPdfAsset/);
  assert.match(library, /اكتشاف صفحات الأسئلة تلقائيًا/);
  assert.match(questions, /official-textbook/);
  assert.match(questions, /official-exams/);
  assert.match(questions, /const hasOfficial = generated\.some/);
  assert.match(questions, /generated\.filter\(\(question\) => \['official-textbook', 'official-exams'\]\.includes\(question\.questionOrigin\)\)/);
});

test('R15 contains richer board, map and layout-aware PowerPoint paths', () => {
  const classMode = read('src/pages/ClassMode.jsx');
  const map = read('src/components/maps/ProfessionalMap.jsx');
  const mapChallenge = read('src/pages/MapChallenge.jsx');
  const pptPreview = read('src/components/classmode/PptxPreview.jsx');
  const pptNative = read('android/app/src/main/java/com/mobdea/education/pptx/MobdeaPptxRendererPlugin.java');
  const mainActivity = read('android/app/src/main/java/com/mobdea/education/MainActivity.java');
  assert.match(classMode, /function BoardThemeDecor/);
  assert.match(classMode, /drawBoardThemeMotifs/);
  assert.match(map, /function MapReferenceOverlay/);
  assert.match(map, /function MapFurniture/);
  assert.match(map, /active && showActiveLabel/);
  assert.match(mapChallenge, /showActiveLabel=\{mode !== 'naming' \|\| labels\}/);
  assert.match(pptPreview, /slide\.elements/);
  assert.match(pptNative, /slide\.put\("elements"/);
  assert.match(pptNative, /positionObject\(geometry\.isEmpty\(\) \? "text" : "shape"/);
  assert.match(pptNative, /normalizeShapeKind/);
  assert.match(pptNative, /positionObject\("image"/);
  assert.match(mainActivity, /registerPlugin\(MobdeaPptxRendererPlugin\.class\)/);
  assert.match(mainActivity, /registerPlugin\(MobdeaPdfOcrPlugin\.class\)/);
});
