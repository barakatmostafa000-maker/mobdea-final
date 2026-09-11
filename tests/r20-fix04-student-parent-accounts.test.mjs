import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  MOBDEA_DEFAULT_PORTAL_PASSWORD,
  canPortalAccountReadStudent,
  normalizePortalDigits,
} from "../src/services/r20AccountPolicy.js";

import {
  R20_DEFAULT_PASSWORD,
  R20_PBKDF2_ITERATIONS,
  assertR20PortalScope,
  maybeHandleR20PortalAccounts,
} from "../cloud-worker/r20PortalAccounts.js";

class MemoryKv {
  constructor() {
    this.map = new Map();
  }
  async get(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  async put(key, value) {
    this.map.set(key, value);
  }
  async delete(key) {
    this.map.delete(key);
  }
}

function makeEnv() {
  return {
    MOBDEA_ACCOUNT_KV: new MemoryKv(),
    MOBDEA_ACCOUNT_ADMIN_KEY: "teacher-secret",
  };
}

async function call(
  env,
  path,
  { method = "GET", body, headers = {} } = {},
) {
  const response = await maybeHandleR20PortalAccounts(
    new Request(`https://worker.example${path}`, {
      method,
      headers: {
        ...headers,
        ...(body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );

  assert.ok(response, `Route ${path} was not handled`);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

const teacherHeaders = {
  "X-Mobdea-Teacher-Key": "teacher-secret",
};

test("temporary password is exactly 123456 and digit normalization works", () => {
  assert.equal(MOBDEA_DEFAULT_PORTAL_PASSWORD, "123456");
  assert.equal(R20_DEFAULT_PASSWORD, "123456");
  assert.equal(normalizePortalDigits("١٢٣٤٥٦"), "123456");
  assert.ok(R20_PBKDF2_ITERATIONS >= 100000);
});

test("student first login is restricted until password changes", async () => {
  const env = makeEnv();

  let result = await call(env, "/portal-auth/account", {
    method: "POST",
    headers: teacherHeaders,
    body: {
      role: "student",
      accountId: "ST-100",
      displayName: "أحمد",
    },
  });

  assert.equal(result.response.status, 201);
  assert.equal(result.payload.account.mustChangePassword, true);

  result = await call(env, "/portal-auth/login", {
    method: "POST",
    body: {
      role: "student",
      accountId: "ST-100",
      password: "123456",
    },
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.payload.mustChangePassword, true);
  assert.equal(result.payload.canAccessPortal, false);
  const token = result.payload.sessionToken;

  result = await call(env, "/portal-auth/change-password", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { newPassword: "new-secure-password" },
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.payload.mustChangePassword, false);
  assert.equal(result.payload.canAccessPortal, true);

  result = await call(env, "/portal-auth/login", {
    method: "POST",
    body: {
      role: "student",
      accountId: "ST-100",
      password: "123456",
    },
  });

  assert.equal(result.response.status, 401);
});

test("teacher reset restores 123456 and forces a new change", async () => {
  const env = makeEnv();

  await call(env, "/portal-auth/account", {
    method: "POST",
    headers: teacherHeaders,
    body: { role: "student", accountId: "S-2" },
  });

  let result = await call(env, "/portal-auth/login", {
    method: "POST",
    body: {
      role: "student",
      accountId: "S-2",
      password: "123456",
    },
  });

  const token = result.payload.sessionToken;

  await call(env, "/portal-auth/change-password", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { newPassword: "another-password" },
  });

  result = await call(env, "/portal-auth/reset", {
    method: "POST",
    headers: teacherHeaders,
    body: { role: "student", accountId: "S-2" },
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.payload.account.status, "reset-pending");

  result = await call(env, "/portal-auth/login", {
    method: "POST",
    body: {
      role: "student",
      accountId: "S-2",
      password: "123456",
    },
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.payload.mustChangePassword, true);
  assert.equal(result.payload.canAccessPortal, false);
});

test("parent is limited to linked children and student to self", async () => {
  const parent = {
    role: "parent",
    accountId: "P-1",
    linkedStudentIds: ["s1", "s2"],
  };

  assert.equal(assertR20PortalScope(parent, "s1"), true);
  assert.equal(assertR20PortalScope(parent, "s3"), false);
  assert.equal(canPortalAccountReadStudent(parent, "s2"), true);
  assert.equal(canPortalAccountReadStudent(parent, "s9"), false);

  const student = {
    role: "student",
    accountId: "s1",
    studentId: "s1",
  };

  assert.equal(assertR20PortalScope(student, "s1"), true);
  assert.equal(assertR20PortalScope(student, "s2"), false);
});

test("public API never exposes hash/salt and legacy portal contract remains", async () => {
  const env = makeEnv();

  const result = await call(env, "/portal-auth/account", {
    method: "POST",
    headers: teacherHeaders,
    body: { role: "student", accountId: "SAFE-1" },
  });

  assert.doesNotMatch(
    JSON.stringify(result.payload),
    /passwordHash|passwordSalt/,
  );

  const worker = fs.readFileSync("cloud-worker/worker.js", "utf8");
  assert.match(worker, /R20_FIX04_WORKER_WRAPPER_V1/);
  assert.match(worker, /R20_LEGACY_WORKER/);
  assert.match(worker, /student-session:/);
  assert.match(worker, /studentPinHash/);
  assert.match(worker, /studentPinSalt/);
});

test("FIX04 runtime and styles are installed from main entry", () => {
  const main = fs.readFileSync("src/main.jsx", "utf8");
  assert.match(main, /r20PortalAccountRuntime\.js/);
  assert.match(main, /r20-fix04-accounts\.css/);
});
