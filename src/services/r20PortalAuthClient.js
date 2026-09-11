import {
  MOBDEA_DEFAULT_PORTAL_PASSWORD,
  normalizePortalAccountId,
  normalizePortalRole,
  sanitizeLinkedStudentIds,
} from "./r20AccountPolicy.js";

const SESSION_KEY = "mobdea-r20-portal-session";
export const DEFAULT_R20_WORKER_URL = "https://mobdea-platform-api.barakatmostafa000.workers.dev";

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function cleanUrl(value = "") {
  return String(value).trim().replace(/\/+$/, "");
}

function scanObjectForConfig(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 4) return {};
  let baseUrl = "";
  let teacherKey = "";

  for (const [key, item] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (
      !baseUrl &&
      typeof item === "string" &&
      /^https?:\/\//i.test(item) &&
      /(worker|cloud|sync).*(url|endpoint)|baseurl/.test(lower)
    ) {
      baseUrl = item;
    }
    if (
      !teacherKey &&
      typeof item === "string" &&
      /(workspace.*token|teacher.*key|cloud.*token|sync.*token)/.test(lower)
    ) {
      teacherKey = item;
    }
    if (item && typeof item === "object") {
      const nested = scanObjectForConfig(item, depth + 1);
      baseUrl ||= nested.baseUrl || "";
      teacherKey ||= nested.teacherKey || "";
    }
  }
  baseUrl ||= DEFAULT_R20_WORKER_URL;
  return { baseUrl, teacherKey };
}

export function resolveR20PortalAuthConfig(explicit = {}) {
  let baseUrl = cleanUrl(explicit.baseUrl);
  let teacherKey = String(explicit.teacherKey || "").trim();

  if (typeof localStorage !== "undefined") {
    const urlKeys = [
      "mobdeaCloudWorkerUrl",
      "mobdea-cloud-worker-url",
      "cloudWorkerUrl",
      "cloudSyncUrl",
    ];
    const keyKeys = [
      "mobdeaWorkspaceToken",
      "mobdea-workspace-token",
      "workspaceToken",
      "cloudSyncToken",
    ];

    for (const key of urlKeys) {
      baseUrl ||= cleanUrl(localStorage.getItem(key));
    }
    for (const key of keyKeys) {
      teacherKey ||= String(localStorage.getItem(key) || "").trim();
    }

    if (!baseUrl || !teacherKey) {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        const parsed = key ? parseJson(localStorage.getItem(key)) : null;
        if (!parsed) continue;
        const found = scanObjectForConfig(parsed);
        baseUrl ||= cleanUrl(found.baseUrl);
        teacherKey ||= found.teacherKey || "";
        if (baseUrl && teacherKey) break;
      }
    }
  }

  return { baseUrl, teacherKey };
}

async function requestPortal(
  path,
  { method = "GET", baseUrl, teacherKey, sessionToken, body } = {},
) {
  const config = resolveR20PortalAuthConfig({ baseUrl, teacherKey });
  if (!config.baseUrl) throw new Error("Cloud Worker URL is not configured");

  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (config.teacherKey) headers["X-Mobdea-Teacher-Key"] = config.teacherKey;
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;

  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      payload?.error || `Portal request failed (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function getStoredR20PortalSession() {
  if (typeof sessionStorage === "undefined") return null;
  return parseJson(sessionStorage.getItem(SESSION_KEY));
}

export function storeR20PortalSession(session) {
  if (typeof sessionStorage === "undefined") return;
  if (!session) sessionStorage.removeItem(SESSION_KEY);
  else sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function ensurePortalAccount({
  role,
  accountId,
  displayName = "",
  studentId = "",
  loginCode = "",
  linkedStudentIds = [],
  baseUrl,
  teacherKey,
} = {}) {
  return requestPortal("/portal-auth/account", {
    method: "POST",
    baseUrl,
    teacherKey,
    body: {
      role: normalizePortalRole(role),
      accountId: normalizePortalAccountId(accountId),
      displayName: String(displayName || "").trim(),
      studentId: String(studentId || "").trim(),
      loginCode: String(loginCode || "").trim(),
      linkedStudentIds: sanitizeLinkedStudentIds(linkedStudentIds),
    },
  });
}

export async function loginPortalAccount({
  role,
  accountId,
  password,
  baseUrl,
} = {}) {
  const payload = await requestPortal("/portal-auth/login", {
    method: "POST",
    baseUrl,
    body: {
      role: normalizePortalRole(role),
      accountId: normalizePortalAccountId(accountId),
      password: String(password ?? ""),
    },
  });
  storeR20PortalSession(payload);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("mobdea:r20-portal-login", { detail: payload }),
    );
  }
  return payload;
}

export async function changePortalPassword({
  newPassword,
  sessionToken,
  baseUrl,
} = {}) {
  const current = getStoredR20PortalSession();
  const token = sessionToken || current?.sessionToken;
  if (!token) throw new Error("Portal session is missing");

  const payload = await requestPortal("/portal-auth/change-password", {
    method: "POST",
    baseUrl,
    sessionToken: token,
    body: { newPassword: String(newPassword ?? "") },
  });
  storeR20PortalSession(payload);
  return payload;
}

export async function resetPortalPassword({
  role,
  accountId,
  baseUrl,
  teacherKey,
} = {}) {
  return requestPortal("/portal-auth/reset", {
    method: "POST",
    baseUrl,
    teacherKey,
    body: {
      role: normalizePortalRole(role),
      accountId: normalizePortalAccountId(accountId),
    },
  });
}

export async function getPortalAccountStatus({
  role,
  accountId,
  baseUrl,
  teacherKey,
} = {}) {
  const query = new URLSearchParams({
    role: normalizePortalRole(role),
    accountId: normalizePortalAccountId(accountId),
  });
  return requestPortal(`/portal-auth/status?${query}`, {
    baseUrl,
    teacherKey,
  });
}

export async function getPortalSession({ sessionToken, baseUrl } = {}) {
  const current = getStoredR20PortalSession();
  return requestPortal("/portal-auth/session", {
    baseUrl,
    sessionToken: sessionToken || current?.sessionToken,
  });
}

export { MOBDEA_DEFAULT_PORTAL_PASSWORD };
