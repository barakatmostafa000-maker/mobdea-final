
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');
const classMode = read('src/pages/ClassMode.jsx');
const contentLibrary = read('src/pages/ContentLibrary.jsx');
const pdfRenderer = read('src/services/pdfRenderer.js');
const pdfOcr = read('src/services/pdfQuestionOcr.js');
const pptx = read('src/components/classmode/PptxPreview.jsx');
const mapStudio = read('src/components/maps/LessonMapStudio.jsx');
const mapChallenge = read('src/pages/MapChallenge.jsx');
const css = read('src/styles/r19-master-repairs.css');

test('PDF display and OCR both accept the 500 MB textbook limit', () => {
  assert.match(pdfRenderer, /blob\.size > 500 \* 1024 \* 1024/);
  assert.match(pdfOcr, /blob\.size > 500 \* 1024 \* 1024/);
  assert.doesNotMatch(pdfRenderer, /200 ميجابايت/);
  assert.doesNotMatch(pdfOcr, /200 ميجابايت/);
});

test('OCR page number inputs can be cleared and retyped', () => {
  assert.match(contentLibrary, /value=\{form\.questionPageStart \?\? ''\}/);
  assert.match(contentLibrary, /value=\{form\.questionPageEnd \?\? ''\}/);
  assert.doesNotMatch(contentLibrary, /value=\{form\.questionPageStart \|\| form\.pageStart \|\| 1\}/);
});

test('PowerPoint retries browser parsing if native parsing fails', () => {
  assert.match(pptx, /parsePptxNative\(blob\)\.catch\(async \(nativeError\)/);
  assert.match(pptx, /return await parsePptxInBrowser\(blob, url\)/);
});

test('Class Mode exposes one collapsible management surface', () => {
  assert.match(classMode, /managementOpen/);
  assert.match(classMode, /classmode-management-toggle/);
  assert.match(classMode, /management-open/);
  assert.match(classMode, /management-closed/);
  assert.match(css, /\.classmode-viewport\.management-closed \.classmode-viewport-students/);
  assert.match(css, /\.classmode-viewport\.management-open \.classmode-viewport-students/);
});

test('student progress is persisted by session and can sort most improved', () => {
  assert.match(classMode, /classPointSessions/);
  assert.match(classMode, /studentProgress/);
  assert.match(classMode, /studentSortMode/);
  assert.match(classMode, /الأكثر تحسنًا/);
  assert.match(classMode, /↑ \+\{studentProgress\[student\.id\]\.delta\}/);
});

test('previous and next media controls remain visible as stage-edge actions', () => {
  assert.match(classMode, /classmode-media-edge-nav/);
  assert.match(classMode, /classmode-pdf-edge-nav/);
  assert.match(classMode, /aria-label="الصفحة السابقة"/);
  assert.match(classMode, /aria-label="الصفحة التالية"/);
  assert.match(classMode, /cycleModeResource\(-1\)/);
  assert.match(classMode, /cycleModeResource\(1\)/);
  assert.match(css, /\.classmode-media-edge-nav button/);
});

test('lesson maps retain explicit symbol and map-selection launchers', () => {
  assert.match(mapStudio, /lesson-map-drawer-toggle symbols/);
  assert.match(mapStudio, /lesson-map-drawer-toggle controls/);
  assert.match(mapStudio, />الرموز</);
  assert.match(mapStudio, />الخرائط والتحديد</);
  assert.match(css, /lesson-map-floating-drawers/);
  assert.match(css, /overflow: auto !important/);
});

test('Map Challenge uses the same ProfessionalMap engine with map-first styling', () => {
  assert.match(mapChallenge, /<ProfessionalMap/);
  assert.match(mapChallenge, /map-game-canvas-shell/);
  assert.match(css, /\.map-challenge-pro \.map-game-canvas-shell/);
  assert.match(css, /aspect-ratio: 1000 \/ 620/);
  assert.match(css, /\.map-challenge-pro \.map-game-question-panel/);
});

test('Arabic and English OCR models are bundled into the Android app', () => {
  for (const name of ['ara.traineddata.gz', 'eng.traineddata.gz']) {
    const path = `android/app/src/main/assets/${name}`;
    assert.ok(fs.existsSync(path), `${name} is missing`);
    assert.ok(fs.statSync(path).size > 100_000, `${name} is unexpectedly small`);
  }
});


test('board pointer mapping is clamped to the exact visible canvas rectangle', () => {
  assert.match(classMode, /const localX = Math\.max\(0, Math\.min\(rect\.width/);
  assert.match(classMode, /const localY = Math\.max\(0, Math\.min\(rect\.height/);
  assert.match(classMode, /x: \(localX \/ rect\.width\) \* canvas\.width/);
  assert.match(classMode, /y: \(localY \/ rect\.height\) \* canvas\.height/);
});

test('recording online screenshot and navigation controls live inside the collapsible management drawer', () => {
  assert.match(classMode, /classmode-management-actions-panel/);
  assert.match(classMode, /classmode-management-actions-grid/);
  assert.match(classMode, /onClick=\{toggleClassRecording\}/);
  assert.match(classMode, /onClick=\{persistCurrentBoardLayer\}/);
  assert.match(classMode, /onClick=\{saveBoard\}/);
  assert.match(classMode, /setLiveStartRequest\(Date\.now\(\)\)/);
  assert.match(css, /classmode-bottom-actions-mid/);
  assert.match(css, /display: none !important/);
});

test('professional map title is compact and centered while lesson rivers are thin', () => {
  const professionalMap = read('src/components/maps/ProfessionalMap.jsx');
  assert.match(professionalMap, /map-pro-region-plaque" transform="translate\(385 18\)"/);
  assert.match(professionalMap, /textAnchor="middle" className="title"/);
  assert.match(css, /stroke-width: 4\.2 !important/);
  assert.match(css, /stroke-width: 1\.45 !important/);
});


test('all selectable Arabic board fonts are bundled locally and referenced by CSS', () => {
  const legacyR18Css = read('src/styles/r18-classmode-viewport-fix.css');
  assert.doesNotMatch(legacyR18Css, /fonts\.googleapis\.com/);
  const expected = [
    ['Noto Naskh Arabic', 'public/fonts/NotoNaskhArabic-Variable.ttf', 'NotoNaskhArabic-Variable.ttf'],
    ['Noto Kufi Arabic', 'public/fonts/NotoKufiArabic-Variable.ttf', 'NotoKufiArabic-Variable.ttf'],
    ['Aref Ruqaa', 'public/fonts/ArefRuqaa-Regular.ttf', 'ArefRuqaa-Regular.ttf'],
    ['Amiri', 'public/fonts/Amiri-Regular.ttf', 'Amiri-Regular.ttf'],
    ['Reem Kufi', 'public/fonts/ReemKufi-Variable.ttf', 'ReemKufi-Variable.ttf'],
  ];
  for (const [family, path, file] of expected) {
    assert.ok(fs.existsSync(path), `${family} local font is missing`);
    assert.ok(fs.statSync(path).size > 50_000, `${family} local font is unexpectedly small`);
    assert.match(css, new RegExp(`font-family:'${family.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}'`));
    assert.ok(css.includes(`/fonts/${file}`), `${family} CSS source is missing`);
    assert.match(classMode, new RegExp(family.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')));
  }
});


test('shared ProfessionalMap supports real pan after zoom without breaking tap selection', () => {
  const professionalMap = read('src/components/maps/ProfessionalMap.jsx');
  assert.match(professionalMap, /const \[pan, setPan\] = useState\(\{ x: 0, y: 0 \}\)/);
  assert.match(professionalMap, /startMapPan/);
  assert.match(professionalMap, /moveMapPan/);
  assert.match(professionalMap, /suppressStageClickRef/);
  assert.match(professionalMap, /translate3d\(\$\{pan\.x\}px, \$\{pan\.y\}px, 0\) scale\(\$\{zoom\}\)/);
  assert.match(css, /\.map-pro-stage\.can-pan \{ cursor: grab/);
  assert.match(css, /touch-action: none !important/);
});


test('collapsing management does not unmount live controls or student state', () => {
  assert.match(classMode, /<ClassModeViewport\.Students>/);
  assert.doesNotMatch(classMode, /\{managementOpen\s*&&\s*\(?\s*<ClassModeViewport\.Students>/);
  assert.match(classMode, /<TeacherLivePanel/);
  assert.match(classMode, /<OnlineGameHostPanel/);
});

test('entering or leaving fullscreen does not reset the active board or resource state', () => {
  const match = classMode.match(/const toggleFullscreen = async \(\) => \{([\s\S]*?)\n  \};/);
  assert.ok(match, 'toggleFullscreen implementation is missing');
  assert.doesNotMatch(match[1], /setBoardActions|setSelectedResourceId|setContentMode|clearBoard/);
  assert.match(classMode, /presentation-fullscreen stage-focus-mode/);
  assert.match(classMode, /classmode-fullscreen-exit/);
});

test('Android keeps the functional plugins needed by the repaired classroom', () => {
  const mainActivity = read('android/app/src/main/java/com/mobdea/education/MainActivity.java');
  for (const plugin of [
    'MobdeaPdfRendererPlugin.class',
    'MobdeaPdfOcrPlugin.class',
    'MobdeaPptxRendererPlugin.class',
    'MobdeaScreenRecorderPlugin.class',
    'MobdeaNativeAssetPlugin.class',
    'MobdeaDigitalInkPlugin.class',
  ]) assert.ok(mainActivity.includes(`registerPlugin(${plugin})`), `${plugin} is not registered`);
});


test('educational card fields mask baked template examples and replace them with teacher text', () => {
  assert.match(classMode, /empty-mask/);
  assert.match(classMode, /saved card field mask start|if \(!value\) continue/);
  const phaseCss = read('src/styles/r19-classmode-phase1.css');
  assert.match(phaseCss, /\.board-card-field\.empty-mask/);
  assert.match(phaseCss, /color: transparent !important/);
});


test('500 MB textbook support remains aligned across storage staging PDF and OCR', () => {
  const assetStore = read('src/services/assetStore.js');
  const nativeAsset = read('android/app/src/main/java/com/mobdea/education/assets/MobdeaNativeAssetPlugin.java');
  const nativePdf = read('android/app/src/main/java/com/mobdea/education/pdf/MobdeaPdfRendererPlugin.java');
  const nativeOcr = read('android/app/src/main/java/com/mobdea/education/ocr/MobdeaPdfOcrPlugin.java');
  assert.match(assetStore, /MAX_ASSET_BYTES = 500 \* 1024 \* 1024/);
  assert.match(nativeAsset, /MAX_ASSET_BYTES = 500L \* 1024L \* 1024L/);
  assert.match(nativePdf, /MAX_PDF_BYTES = 500L \* 1024L \* 1024L/);
  assert.match(nativeOcr, /MAX_PDF_BYTES = 500L \* 1024L \* 1024L/);
  assert.match(nativeAsset, /call\.getDouble\("size", 0d\)/);
  assert.doesNotMatch(nativeAsset, /call\.getLong\("size"/);
});


test('OCR keeps both automatic discovery and teacher-selected page extraction', () => {
  assert.match(contentLibrary, /autoDetectQuestionsFromPdfAsset/);
  assert.match(contentLibrary, /extractQuestionsFromPdfAsset/);
  assert.match(contentLibrary, /autoDetectLessonOcr\(\)/);
  assert.match(contentLibrary, /runLessonOcr\(\)/);
  assert.match(contentLibrary, /اكتشاف صفحات الأسئلة تلقائيًا/);
  assert.match(contentLibrary, /استخراج الأسئلة من PDF \(صفحات محددة\)/);
});

test('PowerPoint retains slide previous and next controls in addition to file navigation', () => {
  assert.match(pptx, /pptx-slide-controls/);
  assert.match(pptx, /السابق/);
  assert.match(pptx, /التالي/);
  assert.match(pptx, /setIndex\(\(value\) => \(value - 1 \+ slides\.length\) % slides\.length\)/);
  assert.match(pptx, /setIndex\(\(value\) => \(value \+ 1\) % slides\.length\)/);
});


test('final repaired APK carries a newer installable app version', () => {
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(packageJson.version, '10.14.0');
  assert.equal(Number(packageJson.mobdea?.versionCode), 117);
});
