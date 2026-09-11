import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  allowedPortalFeatures,
  canRoleUseDashboardFeature,
  classifyDashboardFeature,
  portalWelcomeText,
} from "../src/services/r20PortalDashboard.js";

test("student dashboard exposes only student tools", () => {
  const allowed = allowedPortalFeatures("student");
  for (const feature of [
    "games",
    "map-challenge",
    "reports",
    "grades",
    "weaknesses",
    "exams",
    "assistant",
  ]) {
    assert.equal(allowed.has(feature), true, feature);
    assert.equal(
      canRoleUseDashboardFeature("student", feature),
      true,
      feature,
    );
  }

  for (const denied of [
    "student-management",
    "add-student",
    "exam-monitoring",
    "class-mode",
    "settings-admin",
  ]) {
    assert.equal(
      canRoleUseDashboardFeature("student", denied),
      false,
      denied,
    );
  }
});

test("parent dashboard exposes child monitoring only", () => {
  for (const feature of [
    "reports",
    "grades",
    "weaknesses",
    "progress",
  ]) {
    assert.equal(
      canRoleUseDashboardFeature("parent", feature),
      true,
      feature,
    );
  }

  for (const denied of [
    "games",
    "map-challenge",
    "assistant",
    "exams",
    "student-management",
    "class-mode",
  ]) {
    assert.equal(
      canRoleUseDashboardFeature("parent", denied),
      false,
      denied,
    );
  }
});

test("dashboard feature classifier recognises Arabic primary labels", () => {
  assert.equal(classifyDashboardFeature("الألعاب"), "games");
  assert.equal(
    classifyDashboardFeature("تحدي الخرائط"),
    "map-challenge",
  );
  assert.equal(classifyDashboardFeature("التقارير"), "reports");
  assert.equal(classifyDashboardFeature("نقاط الضعف"), "weaknesses");
  assert.equal(classifyDashboardFeature("مساعد المبدع"), "assistant");
  assert.equal(
    classifyDashboardFeature("إدارة الطلاب"),
    "student-management",
  );
});

test("welcome string uses requested brand and learner name", () => {
  assert.equal(
    portalWelcomeText({ displayName: "أحمد" }),
    "مرحبًا بك يا أحمد في منصة المُبدع مصطفى بركات، نتمنى لك تعلّمًا ممتعًا",
  );
});

test("FIX05 is imported and uses role-specific hiding rather than separate app", () => {
  const main = fs.readFileSync("src/main.jsx", "utf8");
  const css = fs.readFileSync(
    "src/styles/r20-fix05-role-dashboard.css",
    "utf8",
  );
  const runtime = fs.readFileSync(
    "src/services/r20PortalDashboard.js",
    "utf8",
  );

  assert.match(main, /r20PortalDashboard\.js/);
  assert.match(main, /r20-fix05-role-dashboard\.css/);
  assert.match(runtime, /R20_FIX05_ROLE_DASHBOARD_V1/);
  assert.match(runtime, /dashboard-v103/);
  assert.match(css, /data-r20-dashboard-role="student"/);
  assert.match(css, /data-r20-dashboard-role="parent"/);
});
