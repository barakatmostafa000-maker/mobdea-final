import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../src/styles/project09-dashboard-responsive.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const dashboard = fs.readFileSync(new URL('../src/pages/Dashboard.jsx', import.meta.url), 'utf8');
const shell = fs.readFileSync(new URL('../src/components/AppShell.jsx', import.meta.url), 'utf8');

test('Project09 responsive owner is loaded last without removing dashboard functions', () => {
  assert.match(css, /PROJECT09_DASHBOARD_RESPONSIVE_V1/);
  assert.match(main, /project09-dashboard-responsive\.css/);
  for (const token of ['dashboard-reference-hero','dashboard-feature-grid','dashboard-reference-bottom','dashboard-today-panel']) {
    assert.ok(dashboard.includes(token), `Dashboard structure missing: ${token}`);
  }
  assert.ok(shell.includes('app-shell-v103'));
  assert.ok(shell.includes('sidebar sidebar-grid-area'));
});

test('tablet sidebar is an overlay drawer and cannot intercept content while closed', () => {
  assert.match(css, /\(pointer:\s*coarse\)\s*and\s*\(max-width:\s*1366px\)/);
  assert.match(css, /visibility:\s*hidden\s*!important/);
  assert.match(css, /pointer-events:\s*none\s*!important/);
  assert.match(css, /\.sidebar\.open[\s\S]*visibility:\s*visible\s*!important/);
  assert.match(css, /\.sidebar\.open[\s\S]*pointer-events:\s*auto\s*!important/);
});

test('homepage cards reflow instead of horizontal scrolling', () => {
  assert.match(css, /repeat\(auto-fit,\s*minmax\(168px,\s*1fr\)\)/);
  assert.match(css, /dashboard-feature-grid[\s\S]*overflow:\s*visible\s*!important/);
  assert.match(css, /repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
});

test('mobile and short landscape keep all dashboard sections reachable', () => {
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /@media\s*\(max-width:\s*420px\)/);
  assert.match(css, /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*560px\)/);
  assert.match(css, /dashboard-reference-bottom[\s\S]*display:\s*grid\s*!important/);
  assert.match(css, /dashboard-feature-card small[\s\S]*display:\s*block\s*!important/);
});

test('important dashboard touch controls are at least 44px high', () => {
  assert.match(css, /dashboard-reference-cta button[\s\S]*min-height:\s*44px\s*!important/);
  assert.match(css, /dashboard-today-list button[\s\S]*min-height:\s*44px\s*!important/);
});
