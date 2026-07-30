import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeSharePayload, encodeSharePayload, sanitizePayloadForSharing } from '../src/utils/shareCodec.js';

test('share payload round-trips Arabic and rejects malformed Base64', () => {
  const payload = { title: 'حصة تجريبية', questions: [{ id: 1, text: 'أين تقع مصر؟' }] };
  assert.deepEqual(decodeSharePayload(encodeSharePayload(payload)), payload);
  assert.equal(decodeSharePayload('%%%not-base64%%%'), null);
});

test('share sanitizer removes credentials, phones and attendance', () => {
  const result = sanitizePayloadForSharing({
    title: 'حصة',
    adminPinHash: 'secret-hash',
    guardianPhone: '01000000000',
    attendance: [{ studentId: 1, present: true }],
    players: [{ id: 1, name: 'أحمد', code: 1234, studentPinSalt: 'salt' }],
  });
  assert.deepEqual(result, { title: 'حصة', players: [{ id: 1, name: 'أحمد' }] });
});
