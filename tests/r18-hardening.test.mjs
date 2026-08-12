import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  removeGeneratedQuestions,
  upsertGeneratedQuestions,
} from '../src/services/contentQuestions.js';
import { selectQuestionRound } from '../src/services/questionRotation.js';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('teacher-authored questions outrank generated fallback and auto questions stay out while preferred sources exist', () => {
  const questions = [
    { id: 'auto-1', text: 'سؤال تلقائي', source: 'auto', questionOrigin: 'lesson-content' },
    { id: 'custom-1', text: 'سؤال المعلم', source: 'custom' },
    { id: 'exam-1', text: 'سؤال الامتحان', questionOrigin: 'official-exams' },
    { id: 'book-1', text: 'سؤال الكتاب', questionOrigin: 'official-textbook' },
  ];
  const round = selectQuestionRound(questions, [], 10, () => 0.5);
  assert.deepEqual(round.map((item) => item.id), ['book-1', 'exam-1', 'custom-1']);
});

test('regenerating lesson questions never deletes a manual question that shares the lesson id', () => {
  const bank = [
    { id: 'teacher-q', lessonId: 'lesson-1', resourceId: 'lesson-1', source: 'custom', text: 'سؤال يدوي' },
    { id: 'auto-old', lessonId: 'lesson-1', resourceId: 'lesson-1', generated: true, text: 'قديم' },
  ];
  const generated = [{ id: 'auto-new', lessonId: 'lesson-1', resourceId: 'lesson-1', generated: true, text: 'جديد' }];
  const updated = upsertGeneratedQuestions(bank, { id: 'lesson-1' }, generated);
  assert.deepEqual(updated.map((item) => item.id), ['teacher-q', 'auto-new']);
  assert.deepEqual(removeGeneratedQuestions(updated, 'lesson-1').map((item) => item.id), ['teacher-q']);
});

test('class mode remembers PDF page and media zoom independently and exposes separate board tool states', () => {
  const source = read('src/pages/ClassMode.jsx');
  assert.match(source, /resourcePageMemoryRef\s*=\s*useRef\(new Map\(\)\)/);
  assert.match(source, /resourceZoomMemoryRef\s*=\s*useRef\(new Map\(\)\)/);
  for (const tool of ['normal-text', 'historical-term', 'geographical-term', 'important-event', 'date-term', 'person-term', 'place-term']) {
    assert.match(source, new RegExp(`key: '${tool}'`));
  }
  assert.match(source, /const canvasTool = TEXT_TOOL_STYLES\[tool\] \? 'text' : tool/);
});

test('screen recording has an explicit microphone state that reaches native start and saved metadata', () => {
  const source = read('src/pages/ClassMode.jsx');
  assert.match(source, /const \[recordingWithAudio, setRecordingWithAudio\] = useState\(true\)/);
  assert.match(source, /withAudio: recordingWithAudio/);
  assert.match(source, /microphoneEnabled: recordingWithAudio/);
  assert.match(source, /<Mic size=\{17\} \/> : <MicOff size=\{17\} \/>/);
});

test('lesson map state is autosaved and flushed on unmount while map challenge uses region-aware borders', () => {
  const studio = read('src/components/maps/LessonMapStudio.jsx');
  const challenge = read('src/pages/MapChallenge.jsx');
  const geography = read('src/data/geography.js');
  const professional = read('src/components/maps/ProfessionalMap.jsx');
  assert.match(studio, /latestDirtyRef/);
  assert.match(studio, /changeVersionRef/);
  assert.match(studio, /changeVersionRef\.current === scheduledVersion/);
  assert.match(studio, /window\.setTimeout\([\s\S]*?900\)/);
  assert.match(studio, /saveCallbackRef\.current\(latestStateRef\.current\)/);
  assert.match(challenge, /<ProfessionalMap region=\{region\}/);
  assert.match(geography, /borders:\s*\{\s*title:\s*'الحدود'/);
  assert.match(professional, /layerKey === 'borders' \? 'borders-only'/);
});

test('final card print owner locks A4 landscape geometry and identical fixed front/back grids', () => {
  const main = read('src/main.jsx');
  const source = read('src/styles/student-cards-print.css');
  assert.match(main, /import '\.\/styles\/student-cards-print\.css';/);
  assert.match(source, /size:\s*A4 landscape/);
  assert.match(source, /width:\s*297mm !important/);
  assert.match(source, /height:\s*210mm !important/);
  assert.match(source, /width:\s*281mm !important/);
  assert.match(source, /height:\s*194mm !important/);
  assert.match(source, /grid-template-columns:\s*repeat\(var\(--print-columns\), minmax\(0, 1fr\)\) !important/);
  assert.match(source, /grid-template-rows:\s*repeat\(var\(--print-rows\), minmax\(0, 1fr\)\) !important/);
});

test('online game student explicitly asks the host to resync after network or visibility recovery', () => {
  const source = read('src/components/live/StudentOnlineGameRoom.jsx');
  assert.match(source, /type: 'game-ready'/);
  assert.match(source, /reconnect: true/);
  assert.match(source, /addEventListener\?\.\('online', requestReconnect\)/);
  assert.match(source, /addEventListener\?\.\('visibilitychange', onVisibility\)/);
});

test('native OCR cleanup catches native linkage failures and PPTX renderer inherits slide layouts without duplicate image arrays', () => {
  const ocr = read('android/app/src/main/java/com/mobdea/education/ocr/MobdeaPdfOcrPlugin.java');
  const pptx = read('android/app/src/main/java/com/mobdea/education/pptx/MobdeaPptxRendererPlugin.java');
  assert.match(ocr, /catch \(LinkageError/);
  assert.match(ocr, /catch \(Throwable cleanupError\)/);
  const preview = read('src/components/classmode/PptxPreview.jsx');
  const layout = read('src/services/pptxLayout.js');
  assert.match(pptx, /ppt\/slideLayouts\//);
  assert.match(pptx, /extractRelationshipTarget\(slideRelationshipBytes, slideEntry\.path, "\/slideLayout"\)/);
  assert.match(pptx, /extractBackground\(slideBytes, layoutBytes\)/);
  assert.match(pptx, /readBox\(block, inheritedBlock\)/);
  assert.match(pptx, /slide\.put\("images", new JSArray\(\)\)/);
  assert.match(preview, /item\.type\.includes\('\/slideLayout'\)/);
  assert.match(preview, /layoutXml,/);
  assert.match(layout, /layoutPlaceholders\.get\(placeholderKey\(node\)\)/);
  assert.match(layout, /transformOf\(node, slideWidth, slideHeight, inheritedNode\)/);
});
