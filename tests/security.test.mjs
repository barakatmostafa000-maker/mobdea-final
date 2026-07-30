import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPinSecret,
  createRecoverySecret,
  verifyPinSecret,
  verifyRecoverySecret,
  recordLoginFailure,
  assertLoginAllowed,
  clearLoginFailures,
} from '../src/utils/security.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}
globalThis.localStorage = new MemoryStorage();

test('PBKDF2 PIN secrets verify and reject wrong values', async () => {
  const secret = await createPinSecret('638291', 'admin');
  assert.equal(secret.adminPinAlgorithm, 'PBKDF2-SHA256');
  assert.equal(await verifyPinSecret('638291', secret, 'admin'), true);
  assert.equal(await verifyPinSecret('638292', secret, 'admin'), false);
});

test('recovery phrase requires and verifies a long phrase', async () => {
  await assert.rejects(() => createRecoverySecret('short'));
  const secret = await createRecoverySecret('عبارة سرية طويلة لا يعرفها أحد');
  assert.equal(await verifyRecoverySecret('عبارة سرية طويلة لا يعرفها أحد', secret), true);
  assert.equal(await verifyRecoverySecret('عبارة أخرى غير صحيحة', secret), false);
});

test('login attempts are throttled after repeated failures', () => {
  const scope = `test-${Date.now()}`;
  clearLoginFailures(scope);
  for (let index = 0; index < 5; index += 1) recordLoginFailure(scope);
  assert.throws(() => assertLoginAllowed(scope), /المحاولات/);
  clearLoginFailures(scope);
  assert.doesNotThrow(() => assertLoginAllowed(scope));
});
