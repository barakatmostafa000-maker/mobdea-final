// PROJECT_FINAL_STUDENT_ASSET_SYNC_V1
import { getAssetMetadata, importAssetBlob } from './assetStore.js';
import { buildCloudUrl, timeoutFetch } from './cloudTransport.js';

function collectImageAssetIds(data = {}) {
  const ids = new Set();
  for (const item of data.contentLibrary || []) {
    if (!item || item.studentVisible === false || item.published === false) continue;
    const type = String(item.type || '').toLowerCase();
    const kind = String(item.kind || '').toLowerCase();
    if (type === 'image' || kind === 'lesson-media' || kind === 'lesson-image') {
      if (item.assetId) ids.add(String(item.assetId));
    }
    if (item.thumbnailAssetId) ids.add(String(item.thumbnailAssetId));
  }
  return [...ids].slice(0, 120);
}

function decodeHeader(value = '') {
  try { return decodeURIComponent(String(value || '')); } catch { return String(value || ''); }
}

async function sha256Hex(blob) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function syncStudentPortalImages(settings = {}, studentToken = '', data = {}) {
  const cloud = settings.cloudSync || {};
  const endpoint = String(cloud.endpoint || '').replace(/\/$/, '');
  const workspaceId = String(cloud.workspaceId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!/^https:\/\//i.test(endpoint) || !workspaceId || !studentToken) return { synced: 0, skipped: 0 };

  let synced = 0;
  let skipped = 0;
  for (const id of collectImageAssetIds(data)) {
    const local = await getAssetMetadata(id).catch(() => null);
    if (local?.size > 0 && local?.sha256) {
      skipped += 1;
      continue;
    }

    const response = await timeoutFetch(buildCloudUrl(endpoint, `/student/assets/${encodeURIComponent(id)}`), {
      method: 'GET',
      headers: {
        Accept: 'image/*,*/*',
        'X-Mobdea-Workspace': workspaceId,
        'X-Mobdea-Student-Token': String(studentToken),
        'X-Mobdea-Client': 'mobdea-student-assets/final14',
      },
    }, 90000);

    if (!response.ok) {
      skipped += 1;
      continue;
    }

    const declared = Number(response.headers.get('X-Mobdea-Asset-Size') || response.headers.get('Content-Length') || 0);
    if (declared > 30 * 1024 * 1024) {
      skipped += 1;
      continue;
    }

    const blob = await response.blob();
    if (!blob.size || blob.size > 30 * 1024 * 1024) {
      skipped += 1;
      continue;
    }

    const expectedHash = String(response.headers.get('X-Mobdea-Asset-Sha256') || '').toLowerCase();
    const actualHash = await sha256Hex(blob);
    if (expectedHash && expectedHash !== actualHash) {
      skipped += 1;
      continue;
    }

    await importAssetBlob(blob, {
      id,
      name: decodeHeader(response.headers.get('X-Mobdea-Asset-Name') || 'lesson-image.png'),
      kind: decodeHeader(response.headers.get('X-Mobdea-Asset-Kind') || 'lesson-image'),
      type: response.headers.get('Content-Type') || blob.type || 'image/png',
      size: blob.size,
      sha256: actualHash,
    });
    synced += 1;
  }
  return { synced, skipped };
}
