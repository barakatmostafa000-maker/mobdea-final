import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const defaults = fs.readFileSync(new URL('../src/config/projectSocialDefaults.js', import.meta.url), 'utf8');
const social = fs.readFileSync(new URL('../src/components/settings/Project13SocialLinkSettings.jsx', import.meta.url), 'utf8');
const hub = fs.readFileSync(new URL('../src/components/links/Project13LinkHub.jsx', import.meta.url), 'utf8');
const youtube = fs.readFileSync(new URL('../src/services/project14YoutubeSync.js', import.meta.url), 'utf8');
const worker = fs.readFileSync(new URL('../cloud-worker/worker.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assets = fs.readFileSync(new URL('../src/services/projectFinalStudentAssets.js', import.meta.url), 'utf8');

test('supplied social pages are exact permanent defaults', () => {
  assert.ok(defaults.includes('https://youtube.com/@mostafabarakat21?si=FczgywNrmc9FTBsl'));
  assert.ok(defaults.includes('https://www.facebook.com/share/1AyBatYgJv/'));
  assert.ok(defaults.includes('https://www.tiktok.com/@mostafabarakat210?_r=1&_t=ZS-996NuPuPOy1'));
  assert.match(social, /PROJECT_SOCIAL_DEFAULTS/);
  assert.match(hub, /PROJECT_SOCIAL_DEFAULTS/);
  assert.match(youtube, /PROJECT_SOCIAL_DEFAULTS/);
});

test('student cloud images are private and retrievable on another device', () => {
  assert.match(assets, /PROJECT_FINAL_STUDENT_ASSET_SYNC_V1/);
  assert.match(assets, /X-Mobdea-Student-Token/);
  assert.match(app, /syncStudentPortalImages/);
  assert.match(worker, /handleProjectFinalStudentAsset/);
  assert.match(worker, /forbidden_asset/);
  assert.match(worker, /\/student\/assets\//);
});

test('worker keeps teacher token private while providing social defaults', () => {
  assert.match(worker, /PROJECT_FINAL_SOCIAL_DEFAULTS_V1/);
  assert.match(worker, /socialLinks:\{\.\.\.PROJECT_FINAL_SOCIAL_DEFAULTS_V1/);
  assert.match(worker, /token:''/);
});
