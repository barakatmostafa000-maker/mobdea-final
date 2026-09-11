export const R20_WORKER_ACCOUNT_MARKER =
  "R20_FIX04_STUDENT_PARENT_ACCOUNTS_V1";
export const R20_DEFAULT_PASSWORD = "123456";
export const R20_PBKDF2_ITERATIONS = 120000;

const ACCOUNT_PREFIX = "r20-portal-account:";
const SESSION_PREFIX = "r20-portal-session:";
const R20_PORTAL_ALIAS_PREFIX = "r20-portal-alias:";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const encoder = new TextEncoder();

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Mobdea-Teacher-Key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
  };
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function normalizeDigits(value = "") {
  return String(value)
    .trim()
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

function normalizeRole(value = "") {
  const role = String(value).trim().toLowerCase();
  if (role !== "student" && role !== "parent") {
    throw new Error("invalid-role");
  }
  return role;
}

function normalizeAccountId(value = "") {
  const id = normalizeDigits(value).replace(/\s+/g, "");
  if (!id || id.length > 160) throw new Error("invalid-account-id");
  return id;
}

function cleanStudentIds(values = []) {
  const source = Array.isArray(values) ? values : [values];
  return [...new Set(source.map((v) => String(v ?? "").trim()).filter(Boolean))];
}

function accountKey(role, accountId) {
  return `${ACCOUNT_PREFIX}${role}:${accountId}`;
}

function sessionKey(token) {
  return `${SESSION_PREFIX}${token}`;
}

function aliasKey(role, loginId) { return `${R20_PORTAL_ALIAS_PREFIX}${role}:${loginId}`; }
async function resolveAccountId(store, role, loginId) { if (role !== "student") return loginId; const alias=await storeGet(store, aliasKey(role, loginId)); return String(alias?.accountId || loginId); }

function toBase64(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary);
}

function fromBase64(value) {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomBase64(size = 24) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return toBase64(bytes);
}

async function derivePasswordHash(password, passwordSalt) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(String(password ?? "")),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromBase64(passwordSalt),
      iterations: R20_PBKDF2_ITERATIONS,
    },
    key,
    256,
  );

  return toBase64(new Uint8Array(bits));
}

function safeEqual(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  let mismatch = a.length ^ b.length;
  const size = Math.max(a.length, b.length);

  for (let i = 0; i < size; i += 1) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

async function makePasswordFields(password) {
  const passwordSalt = randomBase64(18);
  const passwordHash = await derivePasswordHash(password, passwordSalt);
  return { passwordSalt, passwordHash };
}

async function verifyPassword(account, password) {
  if (!account?.passwordSalt || !account?.passwordHash) return false;
  const calculated = await derivePasswordHash(password, account.passwordSalt);
  return safeEqual(calculated, account.passwordHash);
}

function resolveStore(env = {}) {
  for (const name of [
    "MOBDEA_ACCOUNT_KV",
    "MOBDEA_KV",
    "SYNC_KV",
    "DATA_KV",
    "PORTAL_KV",
  ]) {
    const candidate = env[name];
    if (
      candidate &&
      typeof candidate.get === "function" &&
      typeof candidate.put === "function"
    ) {
      return candidate;
    }
  }

  for (const candidate of Object.values(env)) {
    if (
      candidate &&
      typeof candidate === "object" &&
      typeof candidate.get === "function" &&
      typeof candidate.put === "function"
    ) {
      return candidate;
    }
  }

  throw new Error("portal-account-storage-unavailable");
}

async function storeGet(store, key) {
  const raw = await store.get(key);
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

async function storePut(store, key, value, options = {}) {
  try {
    await store.put(key, JSON.stringify(value), options);
  } catch {
    await store.put(key, JSON.stringify(value));
  }
}

async function storeDelete(store, key) {
  if (typeof store.delete === "function") {
    await store.delete(key);
  }
}

function adminSecret(env = {}) {
  return String(
    env.MOBDEA_ACCOUNT_ADMIN_KEY ||
      env.MOBDEA_WORKSPACE_TOKEN ||
      env.WORKSPACE_TOKEN ||
      "",
  ).trim();
}

function bearerToken(request) {
  const header = String(request.headers.get("Authorization") || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function requireAdmin(request, env) {
  const expected = adminSecret(env);
  if (!expected) {
    return {
      ok: false,
      response: json({ error: "teacher-key-not-configured" }, 503),
    };
  }

  const supplied = String(
    request.headers.get("X-Mobdea-Teacher-Key") || bearerToken(request),
  ).trim();

  if (!safeEqual(expected, supplied)) {
    return {
      ok: false,
      response: json({ error: "teacher-authorization-required" }, 401),
    };
  }

  return { ok: true };
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("invalid-json");
  }
}

function publicAccount(account) {
  if (!account) return null;

  return {
    accountId: account.accountId,
    studentId: account.studentId || null,
    loginCode: account.loginCode || null,
    role: account.role,
    displayName: account.displayName || "",
    linkedStudentIds: cleanStudentIds(account.linkedStudentIds),
    mustChangePassword: Boolean(account.mustChangePassword),
    passwordState: account.passwordState || "temporary",
    firstLoginAt: account.firstLoginAt || null,
    passwordChangedAt: account.passwordChangedAt || null,
    resetAt: account.resetAt || null,
    sessionVersion: Number(account.sessionVersion || 1),
    status:
      account.mustChangePassword && account.resetAt
        ? "reset-pending"
        : account.mustChangePassword
          ? "temporary-password"
          : account.passwordChangedAt
            ? "password-changed"
            : "active",
  };
}

async function getAccount(store, role, accountId) {
  return storeGet(store, accountKey(role, accountId));
}

async function createSession(store, account) {
  const token = randomBase64(32).replace(/[+/=]/g, "");
  const now = Date.now();

  const session = {
    accountId: account.accountId,
    studentId: account.studentId || null,
    loginCode: account.loginCode || null,
    role: account.role,
    displayName: account.displayName || "",
    linkedStudentIds: cleanStudentIds(account.linkedStudentIds),
    studentId:
      account.role === "student"
        ? account.studentId || account.accountId
        : null,
    mustChangePassword: Boolean(account.mustChangePassword),
    canAccessPortal: !account.mustChangePassword,
    sessionVersion: Number(account.sessionVersion || 1),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_SECONDS * 1000).toISOString(),
  };

  await storePut(store, sessionKey(token), session, {
    expirationTtl: SESSION_TTL_SECONDS,
  });

  return { ...session, sessionToken: token };
}

async function readSession(request, store) {
  const token = bearerToken(request);
  if (!token) return null;

  const session = await storeGet(store, sessionKey(token));
  if (!session) return null;
  if (Date.parse(session.expiresAt || "") <= Date.now()) return null;

  const account = await getAccount(
    store,
    session.role,
    session.accountId,
  );
  if (!account) return null;

  if (
    Number(account.sessionVersion || 1) !==
    Number(session.sessionVersion || 0)
  ) {
    return null;
  }

  return { token, session, account };
}

export function assertR20PortalScope(session, studentId) {
  const target = String(studentId ?? "").trim();
  if (!target) return false;

  if (session?.role === "student") {
    return (
      String(session.studentId || session.accountId || "").trim() === target
    );
  }

  if (session?.role === "parent") {
    return cleanStudentIds(session.linkedStudentIds).includes(target);
  }

  return false;
}

async function handleBootstrap(request, env, store) {
  const admin = requireAdmin(request, env);
  if (!admin.ok) return admin.response;

  const body = await readBody(request);
  const role = normalizeRole(body.role);
  const requestedId = normalizeAccountId(body.accountId);
  const studentId = role === "student" ? String(body.studentId || requestedId).trim() : null;
  const loginCode = role === "student" ? normalizeAccountId(body.loginCode || requestedId) : null;
  const accountId = role === "student" ? normalizeAccountId(studentId) : requestedId;
  const displayName = String(body.displayName || "").trim();
  const links = role === "parent" ? cleanStudentIds(body.linkedStudentIds) : [];

  const existing = await getAccount(store, role, accountId);

  if (existing) {
    existing.displayName = displayName || existing.displayName || "";
    if (role === "student") { existing.studentId = studentId || existing.studentId || accountId; existing.loginCode = loginCode || existing.loginCode || accountId; }
    if (role === "parent") {
      existing.linkedStudentIds = cleanStudentIds([
        ...(existing.linkedStudentIds || []),
        ...links,
      ]);
    }
    existing.updatedAt = new Date().toISOString();
    await storePut(store, accountKey(role, accountId), existing);
    if (role === "student" && existing.loginCode) await storePut(store, aliasKey(role, existing.loginCode), { accountId: existing.accountId });
    return json({ created: false, account: publicAccount(existing) });
  }

  const passwordFields = await makePasswordFields(R20_DEFAULT_PASSWORD);
  const now = new Date().toISOString();

  const account = {
    schema: 1,
    accountId,
    studentId,
    loginCode,
    role,
    displayName,
    linkedStudentIds: links,
    mustChangePassword: true,
    passwordState: "temporary",
    sessionVersion: 1,
    firstLoginAt: null,
    passwordChangedAt: null,
    resetAt: null,
    createdAt: now,
    updatedAt: now,
    ...passwordFields,
  };

  await storePut(store, accountKey(role, accountId), account);
  if (role === "student" && loginCode) await storePut(store, aliasKey(role, loginCode), { accountId });
  return json({ created: true, account: publicAccount(account) }, 201);
}

async function handleLogin(request, store) {
  const body = await readBody(request);
  const role = normalizeRole(body.role);
  const loginId = normalizeAccountId(body.accountId);
  const accountId = await resolveAccountId(store, role, loginId);
  const account = await getAccount(store, role, accountId);

  if (!account || !(await verifyPassword(account, String(body.password ?? "")))) {
    return json({ error: "invalid-credentials" }, 401);
  }

  if (!account.firstLoginAt) {
    account.firstLoginAt = new Date().toISOString();
    account.updatedAt = account.firstLoginAt;
    await storePut(store, accountKey(role, accountId), account);
  }

  return json(await createSession(store, account));
}

async function handleChangePassword(request, store) {
  const authenticated = await readSession(request, store);
  if (!authenticated) {
    return json({ error: "invalid-or-expired-session" }, 401);
  }

  const body = await readBody(request);
  const nextPassword = String(body.newPassword ?? "").trim();

  if (nextPassword.length < 6) {
    return json({ error: "password-too-short" }, 400);
  }

  if (nextPassword === R20_DEFAULT_PASSWORD) {
    return json({ error: "choose-password-other-than-default" }, 400);
  }

  const account = authenticated.account;
  const passwordFields = await makePasswordFields(nextPassword);
  const now = new Date().toISOString();

  account.passwordSalt = passwordFields.passwordSalt;
  account.passwordHash = passwordFields.passwordHash;
  account.mustChangePassword = false;
  account.passwordState = "changed";
  account.passwordChangedAt = now;
  account.updatedAt = now;
  account.sessionVersion = Number(account.sessionVersion || 1) + 1;

  await storePut(
    store,
    accountKey(account.role, account.accountId),
    account,
  );
  await storeDelete(store, sessionKey(authenticated.token));

  return json(await createSession(store, account));
}

async function handleReset(request, env, store) {
  const admin = requireAdmin(request, env);
  if (!admin.ok) return admin.response;

  const body = await readBody(request);
  const role = normalizeRole(body.role);
  const loginId = normalizeAccountId(body.accountId);
  const accountId = await resolveAccountId(store, role, loginId);
  const account = await getAccount(store, role, accountId);

  if (!account) return json({ error: "account-not-found" }, 404);

  const passwordFields = await makePasswordFields(R20_DEFAULT_PASSWORD);
  const now = new Date().toISOString();

  account.passwordSalt = passwordFields.passwordSalt;
  account.passwordHash = passwordFields.passwordHash;
  account.mustChangePassword = true;
  account.passwordState = "temporary";
  account.resetAt = now;
  account.updatedAt = now;
  account.sessionVersion = Number(account.sessionVersion || 1) + 1;

  await storePut(store, accountKey(role, accountId), account);

  return json({
    reset: true,
    account: publicAccount(account),
  });
}

async function handleStatus(request, env, store, url) {
  const admin = requireAdmin(request, env);
  if (!admin.ok) return admin.response;

  const role = normalizeRole(url.searchParams.get("role"));
  const accountId = normalizeAccountId(
    url.searchParams.get("accountId"),
  );

  return json({
    account: publicAccount(await getAccount(store, role, accountId)),
  });
}

async function handleSession(request, store) {
  const authenticated = await readSession(request, store);
  if (!authenticated) {
    return json({ error: "invalid-or-expired-session" }, 401);
  }

  return json({
    ...authenticated.session,
    account: publicAccount(authenticated.account),
    mustChangePassword: Boolean(authenticated.account.mustChangePassword),
    canAccessPortal: !authenticated.account.mustChangePassword,
  });
}

async function handleAuthorizeStudent(request, store, url) { const a=await readSession(request, store); if(!a)return json({error:"invalid-or-expired-session"},401); const studentId=String(url.searchParams.get("studentId")||"").trim(); if(!studentId)return json({error:"student-id-required"},400); if(!assertR20PortalScope(a.session,studentId))return json({error:"forbidden-student-scope"},403); return json({allowed:true,studentId}); }

export async function maybeHandleR20PortalAccounts(request, env = {}) {
  const url = new URL(request.url);

  if (!url.pathname.startsWith("/portal-auth/")) {
    return null;
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  let store;
  try {
    store = resolveStore(env);
  } catch (failure) {
    return json(
      { error: failure?.message || "portal-account-storage-unavailable" },
      503,
    );
  }

  try {
    if (
      url.pathname === "/portal-auth/account" &&
      request.method === "POST"
    ) {
      return await handleBootstrap(request, env, store);
    }

    if (
      url.pathname === "/portal-auth/login" &&
      request.method === "POST"
    ) {
      return await handleLogin(request, store);
    }

    if (
      url.pathname === "/portal-auth/change-password" &&
      request.method === "POST"
    ) {
      return await handleChangePassword(request, store);
    }

    if (
      url.pathname === "/portal-auth/reset" &&
      request.method === "POST"
    ) {
      return await handleReset(request, env, store);
    }

    if (
      url.pathname === "/portal-auth/status" &&
      request.method === "GET"
    ) {
      return await handleStatus(request, env, store, url);
    }

    if (
      url.pathname === "/portal-auth/session" &&
      request.method === "GET"
    ) {
      return await handleSession(request, store);
    }

    if (url.pathname === "/portal-auth/authorize-student" && request.method === "GET") { return await handleAuthorizeStudent(request, store, url); }

    return json({ error: "portal-auth-route-not-found" }, 404);
  } catch (failure) {
    const message = String(
      failure?.message || failure || "portal-auth-error",
    );
    return json(
      { error: message },
      message.startsWith("invalid-") ? 400 : 500,
    );
  }
}
