import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptBackupEnvelope, encryptBackupBody } from '../src/utils/backupCrypto.js';

const body = { students: [{ id: 1, name: 'طالب تجريبي' }], assets: [] };

test('AES-GCM backup body round-trip succeeds with the correct password', async () => {
  const payload = await encryptBackupBody(body, 'correct horse battery staple');
  assert.equal(payload.format, 'mobdea-encrypted-backup');
  assert.equal(JSON.stringify(payload).includes('طالب تجريبي'), false);
  assert.deepEqual(await decryptBackupEnvelope(payload, 'correct horse battery staple'), body);
});

test('AES-GCM backup body rejects a wrong password and tampering', async () => {
  const payload = await encryptBackupBody(body, 'correct horse battery staple');
  await assert.rejects(() => decryptBackupEnvelope(payload, 'totally wrong password'), /كلمة مرور/);
  const tampered = { ...payload, ciphertext: `${payload.ciphertext.slice(0, -2)}AA` };
  await assert.rejects(() => decryptBackupEnvelope(tampered, 'correct horse battery staple'), /تم تعديله/);
});
