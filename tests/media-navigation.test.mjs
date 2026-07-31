import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextResourceId,
  resourcesForContentMode,
} from '../src/services/mediaNavigation.js';

const resources = [
  { id: 'pdf-1', type: 'pdf' },
  { id: 'img-1', type: 'image' },
  { id: 'img-2', type: 'image' },
  { id: 'video-1', type: 'video' },
  { id: 'slides-1', type: 'slides' },
  { id: 'doc-1', type: 'document' },
];

test('class media navigator filters every supported lesson media type', () => {
  assert.deepEqual(resourcesForContentMode(resources, 'images').map((item) => item.id), ['img-1', 'img-2']);
  assert.deepEqual(resourcesForContentMode(resources, 'videos').map((item) => item.id), ['video-1']);
  assert.deepEqual(resourcesForContentMode(resources, 'files').map((item) => item.id), ['slides-1', 'doc-1']);
  assert.deepEqual(resourcesForContentMode(resources, 'pdf').map((item) => item.id), ['pdf-1']);
});

test('class media navigator moves forward and backward with wrap-around', () => {
  const images = resourcesForContentMode(resources, 'images');
  assert.equal(nextResourceId(images, 'img-1', 1), 'img-2');
  assert.equal(nextResourceId(images, 'img-2', 1), 'img-1');
  assert.equal(nextResourceId(images, 'img-1', -1), 'img-2');
});
