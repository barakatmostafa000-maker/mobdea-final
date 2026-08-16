import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {
  clearAssets,
  getAsset,
  getAssetBlob,
  listAssetMetadata,
  storeAsset,
} from '../src/services/assetStore.js';
import { IncrementalSha256 } from '../src/services/incrementalSha256.js';

test('incremental SHA-256 matches standard vectors across update boundaries', () => {
  const hash = new IncrementalSha256();
  hash.update(new TextEncoder().encode('a'));
  hash.update(new TextEncoder().encode('bc'));
  assert.equal(hash.digestHex(), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('asset store encrypts large files in bounded chunks and reconstructs them exactly', async () => {
  await clearAssets();
  const bytes = new Uint8Array((5 * 1024 * 1024) + 137);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (index * 31) % 251;
  const saved = await storeAsset(new Blob([bytes], { type: 'application/pdf' }), {
    id: 'large-pdf-test',
    name: 'large.pdf',
    kind: 'textbook',
  });

  assert.equal(saved.size, bytes.length);
  assert.match(saved.sha256, /^[a-f0-9]{64}$/);
  const parent = await getAsset(saved.id);
  assert.equal(parent.format, 'mobdea-local-chunked-v1');
  assert.equal(parent.chunkCount, 3);
  assert.equal((await getAsset(`${saved.id}:chunk:0`)).internalAssetChunk, true);
  assert.deepEqual((await listAssetMetadata()).map((item) => item.id), [saved.id]);

  const restored = new Uint8Array(await (await getAssetBlob(saved.id)).arrayBuffer());
  assert.deepEqual(restored, bytes);
  await clearAssets();
});
