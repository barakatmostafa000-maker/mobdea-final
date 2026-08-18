import { APP_VERSION, DATA_SCHEMA_VERSION } from "../config/version";
import {
  isHttpsUrl,
  normalizeHttpUrl,
  safeTrim,
  byteLength,
} from "../utils/safety";
import { prepareDataForTransfer } from "./storage";
import { getAssetBlob, getAssetMetadata, importAssetBlob } from "./assetStore";
import { collectLibraryAssetIds } from "./libraryModel";
import { sha256Blob } from "./incrementalSha256";
import { buildCloudUrl, timeoutFetch } from "./cloudTransport.js";

export { buildCloudUrl, timeoutFetch } from "./cloudTransport.js";

const MAX_SYNC_BYTES = 8_000_000;
const MAX_ASSET_BYTES = 500 * 1024 * 1024;
const MAX_SYNC_ASSETS = 500;

export const validateCloudConfig = (settings = {}) => {
  const config = settings.cloudSync || settings || {};
  const endpoint = normalizeHttpUrl(config.endpoint);
  const workspaceId = safeTrim(config.workspaceId, 80).replace(
    /[^a-zA-Z0-9_-]/g,
    "",
  );
  const token = safeTrim(config.token, 260);
  const revision = safeTrim(config.revision, 120);
  if (!endpoint || !isHttpsUrl(endpoint))
    throw new Error("أدخل رابط HTTPS صحيحًا لخادم المزامنة.");
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(workspaceId))
    throw new Error(
      "مساحة العمل يجب أن تكون من 3 إلى 80 حرفًا إنجليزيًا أو رقمًا أو _ أو -.",
    );
  if (token.length < 24) throw new Error("رمز مساحة العمل قصير أو غير صالح.");
  return { endpoint, workspaceId, token, revision };
};

export const cloudHeaders = (config, extra = {}) => ({
  "Content-Type": "application/json",
  "X-Mobdea-Workspace": config.workspaceId,
  "X-Mobdea-Client": `mobdea-mobile/${APP_VERSION}`,
  Authorization: `Bearer ${config.token}`,
  ...extra,
});

function collectReferencedAssetIds(data = {}) {
  const ids = new Set(collectLibraryAssetIds(data));
  for (const clip of data.settings?.voiceClips || [])
    if (clip.assetId) ids.add(String(clip.assetId));
  for (const recording of data.lessonRecordings || []) {
    if (recording.boardAssetId) ids.add(String(recording.boardAssetId));
    if (recording.videoAssetId) ids.add(String(recording.videoAssetId));
  }
  return [...ids].slice(0, MAX_SYNC_ASSETS);
}

function assetUrl(config, id) {
  return buildCloudUrl(config.endpoint, `/assets/${encodeURIComponent(id)}`);
}

async function readRemoteAssetHashes(ids, config) {
  if (!ids.length) return {};
  const response = await timeoutFetch(
    buildCloudUrl(config.endpoint, "/assets/status"),
    {
      method: "POST",
      headers: cloudHeaders(config),
      body: JSON.stringify({ ids }),
    },
    30000,
  );
  if (!response.ok)
    throw new Error(
      await readError(
        response,
        `تعذر فحص الملفات السحابية (${response.status})`,
      ),
    );
  const payload = await response.json();
  return payload?.assets && typeof payload.assets === "object"
    ? payload.assets
    : {};
}

async function pushCloudAssets(data, config) {
  const ids = collectReferencedAssetIds(data);
  const remoteHashes = await readRemoteAssetHashes(ids, config);
  const manifest = [];
  for (const id of ids) {
    const metadata = await getAssetMetadata(id);
    if (!metadata)
      throw new Error(
        `الملف المحلي ${id} غير موجود. أعد رفع المورد قبل المزامنة.`,
      );
    if (!metadata.sha256 || !/^[a-f0-9]{64}$/.test(metadata.sha256))
      throw new Error(`تعذر التحقق من بصمة الملف ${metadata.name}.`);
    if (metadata.size <= 0 || metadata.size > MAX_ASSET_BYTES)
      throw new Error(`حجم الملف ${metadata.name} غير صالح للمزامنة.`);
    const remoteHash = String(remoteHashes[id] || "").toLowerCase();
    if (remoteHash !== metadata.sha256) {
      const blob = await getAssetBlob(id);
      if (!blob) throw new Error(`تعذر قراءة الملف ${metadata.name}.`);
      const response = await timeoutFetch(
        assetUrl(config, id),
        {
          method: "PUT",
          headers: cloudHeaders(config, {
            "Content-Type": metadata.type || "application/octet-stream",
            "X-Mobdea-Asset-Name": encodeURIComponent(metadata.name || "file"),
            "X-Mobdea-Asset-Kind": encodeURIComponent(
              metadata.kind || "resource",
            ),
            "X-Mobdea-Asset-Sha256": metadata.sha256,
            "X-Mobdea-Asset-Size": String(metadata.size),
          }),
          body: blob,
        },
        300000,
      );
      if (!response.ok)
        throw new Error(
          await readError(
            response,
            `فشل رفع الملف ${metadata.name} (${response.status})`,
          ),
        );
    }
    manifest.push(metadata);
  }
  return manifest;
}

async function pullCloudAssets(manifest, config) {
  for (const item of Array.isArray(manifest)
    ? manifest.slice(0, MAX_SYNC_ASSETS)
    : []) {
    const id = safeTrim(item?.id, 100);
    const sha256 = safeTrim(item?.sha256, 64).toLowerCase();
    const size = Number(item?.size || 0);
    if (
      !id ||
      !/^[a-f0-9]{64}$/.test(sha256) ||
      size <= 0 ||
      size > MAX_ASSET_BYTES
    )
      throw new Error("قائمة الملفات السحابية غير صالحة.");
    const local = await getAssetMetadata(id);
    if (local?.sha256 === sha256 && local.size === size) continue;
    const response = await timeoutFetch(
      assetUrl(config, id),
      { method: "GET", headers: cloudHeaders(config, { Accept: "*/*" }) },
      300000,
    );
    if (!response.ok)
      throw new Error(
        await readError(
          response,
          `تعذر تنزيل الملف ${item.name || id} (${response.status})`,
        ),
      );
    const blob = await response.blob();
    if (blob.size !== size)
      throw new Error(
        `حجم الملف ${item.name || id} لا يطابق القائمة السحابية.`,
      );
    const actualHash = await sha256Blob(blob);
    if (actualHash !== sha256)
      throw new Error(`فشل التحقق من سلامة الملف ${item.name || id}.`);
    await importAssetBlob(blob, { ...item, id, sha256, size });
  }
}

async function readError(response, fallback) {
  try {
    const body = await response.json();
    if (body?.error === "revision_conflict")
      return "توجد نسخة سحابية أحدث. نزّلها أولًا ثم أعد الدمج والرفع.";
    if (body?.error === "rate_limited")
      return "تم تجاوز عدد الطلبات المسموح. حاول بعد قليل.";
    if (body?.error === "unauthorized") return "رمز مساحة العمل غير صحيح.";
    return body?.message || body?.error || fallback;
  } catch {
    return fallback;
  }
}

export function cloudConfigured(settings = {}) {
  try {
    validateCloudConfig(settings);
    return true;
  } catch {
    return false;
  }
}

export async function testCloudConnection(settings = {}) {
  const config = validateCloudConfig(settings);
  const response = await timeoutFetch(
    buildCloudUrl(config.endpoint, "/health"),
    { method: "GET", headers: cloudHeaders(config) },
  );
  if (!response.ok)
    throw new Error(
      await readError(response, `فشل الاتصال بالخادم (${response.status})`),
    );
  return response.json();
}

export async function pushCloudData(data) {
  const config = validateCloudConfig(data.settings);
  const transferable = prepareDataForTransfer(data);
  const assetManifest = await pushCloudAssets(transferable, config);
  const payload = {
    schemaVersion: DATA_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    workspaceId: config.workspaceId,
    updatedAt: new Date().toISOString(),
    baseRevision: config.revision,
    assetManifest,
    data: {
      ...transferable,
      settings: {
        ...transferable.settings,
        cloudSync: { ...transferable.settings.cloudSync, token: "" },
      },
    },
  };
  const body = JSON.stringify(payload);
  if (byteLength(body) > MAX_SYNC_BYTES)
    throw new Error(
      "حجم بيانات المزامنة يتجاوز 8 ميجابايت. احذف السجلات القديمة أو الملفات المضمّنة.",
    );
  const response = await timeoutFetch(
    buildCloudUrl(config.endpoint, "/sync"),
    {
      method: "PUT",
      headers: cloudHeaders(
        config,
        config.revision ? { "If-Match": config.revision } : {},
      ),
      body,
    },
    25000,
  );
  if (!response.ok)
    throw new Error(
      await readError(response, `فشل رفع البيانات (${response.status})`),
    );
  return response.json();
}

export async function pullCloudData(settings = {}) {
  const config = validateCloudConfig(settings);
  const response = await timeoutFetch(
    buildCloudUrl(config.endpoint, "/sync"),
    { method: "GET", headers: cloudHeaders(config) },
    25000,
  );
  if (response.status === 404) {
    const error = new Error("لا توجد نسخة سحابية محفوظة لهذه المساحة.");
    error.status = 404;
    throw error;
  }
  if (!response.ok)
    throw new Error(
      await readError(response, `فشل تنزيل البيانات (${response.status})`),
    );
  const payload = await response.json();
  if (
    !payload?.data ||
    !payload.revision ||
    Number(payload.schemaVersion || 0) > DATA_SCHEMA_VERSION
  )
    throw new Error("النسخة السحابية غير صالحة أو أحدث من إصدار التطبيق.");
  await pullCloudAssets(payload.assetManifest || [], config);
  return payload;
}

/**
 * Pull the workspace snapshot only when it already exists.
 * A first-time workspace has no snapshot yet, which is a normal state.
 * Authentication, network and server errors remain visible to the caller.
 */
export async function pullCloudDataIfExists(settings = {}) {
  try {
    return await pullCloudData(settings);
  } catch (error) {
    if (Number(error?.status) === 404) return null;
    throw error;
  }
}
