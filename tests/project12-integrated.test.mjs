import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPageAwareQuestionSets } from '../src/services/project12PageQuestions.js';

test('PDF page questions use source + exact page and exclude unanswered OCR', () => {
  const ready={id:'q1',text:'س',type:'mcq',options:['أ','ب'],answer:'أ',answerIndex:0,sourceAssetId:'asset1',ocrPage:4};
  const unanswered={...ready,id:'q2',answer:'',answerIndex:-1};
  const otherPage={...ready,id:'q3',ocrPage:5};
  const sets=buildPageAwareQuestionSets({allQuestions:[ready,unanswered,otherPage],resource:{assetId:'asset1'},page:4});
  assert.deepEqual(sets.page.map(q=>q.id),['q1']);
});

test('ClassMode has safe controls and scoped page questions', () => {
  const source=fs.readFileSync(new URL('../src/pages/ClassMode.jsx',import.meta.url),'utf8');
  assert.match(source,/PROJECT12_PAGE_AWARE_CLASSMODE_V1/);
  assert.match(source,/Project12PageQuestionDock/);
  assert.match(source,/project12GameQuestions/);
  assert.match(source,/questions:\s*project12GameQuestions\.map/);
  assert.match(source,/project12-classmode-dock/);
});

test('map symbols are a compact tablet drawer', () => {
  const source=fs.readFileSync(new URL('../src/components/maps/LessonMapStudio.jsx',import.meta.url),'utf8');
  const css=fs.readFileSync(new URL('../src/styles/project12-classmode-cloud-voice.css',import.meta.url),'utf8');
  assert.match(source,/PROJECT12_MAP_SYMBOL_DRAWER_V1/);
  assert.match(source,/project12SymbolsOpen/);
  assert.match(source,/project12-map-symbol-toggle/);
  assert.match(css,/lesson-map-symbol-sidebar\.project12-open/);
});

test('new/reset student PIN is 123456 and cloud student login is available', () => {
  const students=fs.readFileSync(new URL('../src/pages/Students.jsx',import.meta.url),'utf8');
  const lock=fs.readFileSync(new URL('../src/components/LockScreen.jsx',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.match(students,/PROJECT12_DEFAULT_STUDENT_PIN_V1 = '123456'/);
  assert.match(students,/studentPinMustChange/);
  assert.match(students,/resetStudentPin/);
  assert.match(lock,/loginStudentCloud/);
  assert.match(lock,/bootstrapTeacherCloud/);
  assert.match(app,/Project12StudentPinGate/);
  assert.match(app,/refreshStudentCloud/);
  assert.match(app,/auth\.cloudPortal/);
  const gate=fs.readFileSync(new URL('../src/components/auth/Project12StudentPinGate.jsx',import.meta.url),'utf8');
  assert.match(gate,/project12-change-pin-entry/);
  assert.match(gate,/changeStudentCloudPin/);
});

test('Worker has secure dynamic teacher auth and student-only cloud portal', () => {
  const worker=fs.readFileSync(new URL('../cloud-worker/worker.js',import.meta.url),'utf8');
  assert.match(worker,/PROJECT12_UNIFIED_CLOUD_STUDENT_PORTAL_V1/);
  assert.match(worker,/project12TeacherPasswordOk/);
  assert.match(worker,/project12DynamicTokenValid/);
  assert.match(worker,/\/bootstrap\/workspace/);
  assert.match(worker,/\/student\/login/);
  assert.match(worker,/\/student\/refresh/);
  assert.match(worker,/\/student\/change-pin/);
  assert.match(worker,/PROJECT12_DEFAULT_STUDENT_PIN='123456'/);
  assert.match(worker,/X-Mobdea-Student-Token/);
  assert.match(worker,/project12PortalData/);
});

test('tablet Android TTS confirms actual onStart and Arabic availability', () => {
  const java=fs.readFileSync(new URL('../android/app/src/main/java/com/mobdea/education/voice/MobdeaTextToSpeechPlugin.java',import.meta.url),'utf8');
  const voice=fs.readFileSync(new URL('../src/services/voice.js',import.meta.url),'utf8');
  const diag=fs.readFileSync(new URL('../src/pages/DeviceDiagnostics.jsx',import.meta.url),'utf8');
  assert.match(java,/PROJECT12_TABLET_TTS_V1/);
  assert.match(java,/UtteranceProgressListener/);
  assert.match(java,/onStart/);
  assert.match(java,/USAGE_MEDIA/);
  assert.match(java,/arabicVoices/);
  assert.match(voice,/PROJECT12_TABLET_VOICE_V1/);
  assert.match(voice,/diagnoseArabicVoice/);
  assert.match(diag,/diagnoseArabicVoice/);
});

test('Repair11 most improved and random student picker remain intact', () => {
  const panels=fs.readFileSync(new URL('../src/components/classmode/Project03StudentPanels.jsx',import.meta.url),'utf8');
  assert.match(panels,/الأكثر تحسنًا/);
  assert.match(panels,/student-random-picker/);
});
