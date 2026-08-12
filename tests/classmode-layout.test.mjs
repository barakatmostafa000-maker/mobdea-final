import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('class mode owns five independent viewport slots', () => {
  const classMode = read('src/pages/ClassMode.jsx');
  const viewport = read('src/components/classmode/ClassModeViewport.jsx');

  for (const slot of ['Header', 'Stage', 'Students', 'Footer', 'Overlays']) {
    assert.match(classMode, new RegExp(`<ClassModeViewport\\.${slot}>`));
    assert.match(viewport, new RegExp(`ClassModeViewport\\.${slot} =`));
  }
  assert.match(classMode, /sceneRef=\{sceneRef\}/);
});

test('legacy class mode skin cannot own final viewport geometry', () => {
  const classMode = read('src/pages/ClassMode.jsx');
  const viewport = read('src/components/classmode/ClassModeViewport.jsx');
  const css = read('src/styles/v111.css');

  assert.doesNotMatch(classMode, /classmode-v103\s+classmode-final-layout|classmode-final-layout\s+classmode-v103/);
  assert.match(viewport, /classmode-viewport-skin classmode-v103/);
  assert.match(css, /\.classmode-viewport-skin\s*\{[\s\S]*display: contents !important/);
});

test('board tools and global overlays do not resize the teaching stage', () => {
  const css = read('src/styles/v111.css');

  assert.match(css, /\.classmode-viewport-stage \.classmode-board-surface\.with-tools[\s\S]*display: block !important/);
  assert.match(css, /\.classmode-viewport-stage \.classmode-board-surface\.with-tools \.classmode-board-stage[\s\S]*position: absolute !important/);
  assert.match(css, /\.classmode-viewport-stage \.classmode-board-sidebar-left[\s\S]*position: absolute !important/);
  assert.match(css, /\.classmode-viewport-stage \.classmode-toolbar[\s\S]*position: absolute !important/);
  assert.match(css, /\.classmode-viewport-overlays[\s\S]*position: absolute !important/);
});

test('safe areas and the real app viewport bound the classroom', () => {
  const css = read('src/styles/v111.css');

  assert.match(css, /width: var\(--mobdea-app-width, 100vw\) !important/);
  assert.match(css, /height: var\(--mobdea-app-height, 100dvh\) !important/);
  for (const edge of ['top', 'right', 'bottom', 'left']) {
    assert.match(css, new RegExp(`var\\(--mobdea-safe-${edge}\\)`));
  }
});

test('landscape phones use the student drawer and keep touch targets reachable', () => {
  const classMode = read('src/pages/ClassMode.jsx');
  const css = read('src/styles/v111.css');

  assert.match(css, /@media \(orientation: landscape\) and \(max-height: 620px\) and \(max-width: 960px\)[\s\S]*\.classmode-viewport-body\.classmode-layout[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /@media \(orientation: landscape\) and \(max-height: 620px\) and \(max-width: 960px\)[\s\S]*\.classmode-viewport-students[\s\S]*display: none/);
  assert.match(css, /min-height: 48px !important/);
  assert.match(css, /grid-template-rows: 54px minmax\(0, 1fr\) 42px !important/);
  assert.doesNotMatch(css, /grid-template-rows: 50px minmax\(0, 1fr\) 42px !important/);
  assert.match(classMode, /classmode-student-drawer-list[\s\S]*\{rankedStudents\.map/);
});

test('short landscape tablets keep the live student rail', () => {
  const css = read('src/styles/v111.css');
  const compactStart = css.indexOf('@media (orientation: landscape) and (max-height: 620px) {');
  const phoneStart = css.indexOf('@media (orientation: landscape) and (max-height: 620px) and (max-width: 960px) {');
  assert.ok(compactStart >= 0 && phoneStart > compactStart);
  assert.doesNotMatch(css.slice(compactStart, phoneStart), /\.classmode-viewport-students\s*\{\s*display:\s*none/);
});
