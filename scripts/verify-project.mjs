import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const assert = (condition, message) => { if (!condition) errors.push(message); };

const pkg = JSON.parse(read('package.json'));
const versionSource = read('src/config/version.js');
const androidGradle = read('android/app/build.gradle');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const worker = read('cloud-worker/worker.js');
const seed = read('src/data/seed.js');
const updateManifest = JSON.parse(read('public/update.manifest.json'));

assert(versionSource.includes(`APP_VERSION = '${pkg.version}'`), 'Version source is not synchronized with package.json.');
assert(androidGradle.includes(`versionCode ${pkg.mobdea.versionCode}`), 'Android versionCode is not synchronized.');
assert(androidGradle.includes(`versionName "${pkg.version}"`), 'Android versionName is not synchronized.');
assert(updateManifest.version === pkg.version, 'Internal update manifest version is not synchronized.');
assert(!/adminPin:\s*['"]\d+/.test(seed) && !/teacherPin:\s*['"]\d+/.test(seed), 'Default staff PIN found in seed data.');
assert(manifest.includes('android:allowBackup="false"'), 'Android backup must be disabled.');
assert(manifest.includes('android:usesCleartextTraffic="false"'), 'Android cleartext traffic must be disabled.');
assert(!/Access-Control-Allow-Origin['"]?\s*:\s*['"]\*/.test(worker), 'Wildcard CORS found in cloud worker.');
assert(worker.includes('MOBDEA_WORKSPACE_TOKENS') && worker.includes('MOBDEA_ENCRYPTION_KEY'), 'Cloud worker secrets are not workspace-isolated/encrypted.');
assert(!read('package.json').includes('cap add android'), 'Android prepare script must not recreate the existing platform.');
assert(exists('android/app/src/main/java/com/mobdea/education/security/MobdeaSecureStorePlugin.java'), 'Secure store native plugin is missing.');
assert(exists('android/app/src/main/java/com/mobdea/education/update/MobdeaUpdaterPlugin.java'), 'Verified updater native plugin is missing.');
assert(exists('android/app/src/main/java/com/mobdea/education/pdf/MobdeaPdfRendererPlugin.java'), 'Native PDF renderer plugin is missing.');
const mainActivity = read('android/app/src/main/java/com/mobdea/education/MainActivity.java');
assert(mainActivity.includes('registerPlugin(MobdeaPdfRendererPlugin.class)'), 'Native PDF renderer is not registered.');
assert(read('src/App.jsx').includes("whiteboard: Whiteboard"), 'Whiteboard route is missing.');
assert(read('src/pages/Whiteboard.jsx').includes('usePdfPage'), 'Whiteboard PDF annotation support is missing.');
assert(read('src/pages/ClassMode.jsx').includes('boardLayers'), 'Class mode board layer persistence is missing.');
assert(read('src/pages/MapChallenge.jsx').includes('contest:') && read('src/pages/MapChallenge.jsx').includes('build:'), 'Map challenge modes are incomplete.');
assert(exists('src/utils/printLayout.js') && read('src/pages/StudentCards.jsx').includes('mirrorCardsForDuplex'), 'Duplex student-card printing support is missing.');
assert(!read('src/App.jsx').includes('nextOrUpdater(previous)'), 'Functional updates must use the current data reference.');
assert(read('src/services/secureVault.js').includes('web-crypto-indexeddb'), 'Encrypted web vault is missing.');
assert(worker.includes("'/assets/status'") && worker.includes('pruneWorkspaceAssets'), 'Cloud asset batching or cleanup is missing.');
assert(!read('scripts/create-update-manifest.mjs').includes('REPLACE_WITH_HTTPS_APK_URL'), 'Update manifest generator still permits a placeholder URL.');
assert(exists('PROJECT_AUDIT_AR.md'), 'Pre-implementation project audit is missing.');
assert(exists('src/services/libraryModel.js'), 'Unified library model service is missing.');
const libraryModel = read('src/services/libraryModel.js');
assert(libraryModel.includes('GRADE_TEXTBOOK') && libraryModel.includes('GRADE_EXAMS') && libraryModel.includes('LESSON_MEDIA'), 'Unified library kinds are incomplete.');
assert(libraryModel.includes('getLessonModeResources') && libraryModel.includes('collectLibraryAssetIds'), 'Library selectors or cloud asset collection are incomplete.');
const contentLibraryPage = read('src/pages/ContentLibrary.jsx');
assert(contentLibraryPage.includes('كتاب المنهج الرئيسي') && contentLibraryPage.includes('ملف الامتحانات الرئيسي'), 'Permanent grade source cards are missing.');
assert(contentLibraryPage.includes('pageStart') && contentLibraryPage.includes('recordingAssetId') && contentLibraryPage.includes('thumbnailAssetId'), 'Lesson editor fields are incomplete.');
const classMode = read('src/pages/ClassMode.jsx');
assert(classMode.includes('LessonMapStudio') && classMode.includes('getLessonModeResources'), 'Lesson mode is not connected to the unified library and map studio.');
assert(!classMode.includes('<MapChallenge'), 'Lesson mode must use the shared teaching map instead of embedding the challenge page.');
assert(classMode.includes('boardToolsVisible'), 'Inactive drawing toolbars must be hidden for media and maps.');
const geography = read('src/data/geography.js');
assert(geography.includes("defaultRegion: 'egypt'") && geography.includes("defaultRegion: 'arab'") && geography.includes("defaultRegion: 'africa'"), 'Curriculum map recommendations are incomplete.');
assert(geography.includes('ثروة سمكية') && geography.includes('هضاب') && geography.includes('منخفضات') && geography.includes('مضيق'), 'Geographic explanation symbols are incomplete.');
const lessonMap = read('src/components/maps/LessonMapStudio.jsx');
assert(lessonMap.includes('regionStates') && lessonMap.includes('onSaveState'), 'Per-region lesson map persistence is missing.');
assert(read('src/services/cloudSync.js').includes('collectLibraryAssetIds'), 'Cloud sync does not include all library assets.');
assert(read('src/pages/QuestionBankManager.jsx').includes('getGradeExams'), 'Question bank is not connected to the grade exams source.');
assert(read('src/pages/Reports.jsx').includes("tab === 'homework'") && read('src/pages/Reports.jsx').includes("tab === 'library'"), 'Homework or library readiness reports are missing.');
assert(!/url:\s*['"]#['"]/.test(seed), 'Seed data contains a placeholder resource URL.');

const sourceFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(entry.name)) sourceFiles.push(full);
  }
}
walk(path.join(root, 'src'));
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  if (/\b(?:adminPin|teacherPin)\s*:\s*['"]\d{4,10}['"]/.test(text)) errors.push(`${relative}: hard-coded PIN found.`);
  if (/https?:\/\/downloads\.example\.invalid/.test(text)) errors.push(`${relative}: invalid example update URL found.`);
  for (const match of text.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const base = path.resolve(path.dirname(file), match[1]);
    const candidates = [base, `${base}.js`, `${base}.jsx`, path.join(base, 'index.js'), path.join(base, 'index.jsx')];
    if (!candidates.some(fs.existsSync)) errors.push(`${relative}: unresolved import ${match[1]}`);
  }
}

if (errors.length) {
  console.error(`Project verification failed with ${errors.length} issue(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`Project verification passed (${sourceFiles.length} source files checked).`);
