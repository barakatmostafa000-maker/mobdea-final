import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRunAutoBackup } from '../src/services/autoBackup.js';

const valid = {
  cloudSync: {
    autoBackup: true,
    endpoint: 'https://sync.example.com',
    workspaceId: 'school_one',
    token: '0123456789abcdef0123456789abcdef',
    autoBackupIntervalHours: 24,
  },
};

test('auto backup runs when enabled and no previous backup exists', () => {
  assert.equal(shouldRunAutoBackup(valid, Date.now()), true);
});

test('auto backup waits until configured interval', () => {
  const now = Date.now();
  assert.equal(shouldRunAutoBackup({ cloudSync: { ...valid.cloudSync, lastAutoBackupAt: new Date(now - 1000).toISOString() } }, now), false);
  assert.equal(shouldRunAutoBackup({ cloudSync: { ...valid.cloudSync, lastAutoBackupAt: new Date(now - 25 * 60 * 60 * 1000).toISOString() } }, now), true);
});
