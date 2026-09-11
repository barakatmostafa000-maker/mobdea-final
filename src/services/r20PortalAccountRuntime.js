import {
  changePortalPassword,
  ensurePortalAccount,
  getPortalAccountStatus,
  resetPortalPassword,
  resolveR20PortalAuthConfig,
  MOBDEA_DEFAULT_PORTAL_PASSWORD,
} from "./r20PortalAuthClient.js";

export const R20_ACCOUNT_RUNTIME_MARKER =
  "R20_FIX04_ACCOUNT_RUNTIME_V1";

const wiredRows = new WeakSet();
let gate = null;
let bootstrapTimer = 0;

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeDigits(value = "") {
  return clean(value)
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

function removeGate() {
  gate?.remove();
  gate = null;
}

function showForcedPasswordGate(session) {
  if (!session?.mustChangePassword || typeof document === "undefined") return;
  removeGate();

  const overlay = document.createElement("div");
  overlay.className = "r20-password-gate";
  overlay.setAttribute("data-r20-password-gate", "true");
  overlay.innerHTML = `
    <form class="r20-password-gate__card" autocomplete="off">
      <div class="r20-password-gate__icon">🔐</div>
      <h2>غيّر كلمة المرور قبل الدخول</h2>
      <p>
        كلمة المرور الحالية مؤقتة:
        <strong>${MOBDEA_DEFAULT_PORTAL_PASSWORD}</strong>
        ويجب استبدالها الآن.
      </p>
      <label>
        كلمة المرور الجديدة
        <input name="newPassword" type="password" minlength="6"
          autocomplete="new-password" required />
      </label>
      <label>
        تأكيد كلمة المرور
        <input name="confirmPassword" type="password" minlength="6"
          autocomplete="new-password" required />
      </label>
      <p class="r20-password-gate__error" aria-live="polite"></p>
      <button type="submit">حفظ والمتابعة</button>
    </form>
  `;

  const form = overlay.querySelector("form");
  const error = overlay.querySelector(".r20-password-gate__error");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const first = clean(data.get("newPassword"));
    const second = clean(data.get("confirmPassword"));

    if (first.length < 6) {
      error.textContent = "كلمة المرور يجب ألا تقل عن 6 أحرف أو أرقام.";
      return;
    }
    if (first === MOBDEA_DEFAULT_PORTAL_PASSWORD) {
      error.textContent = "لا يمكن استخدام 123456 ككلمة المرور الجديدة.";
      return;
    }
    if (first !== second) {
      error.textContent = "تأكيد كلمة المرور غير مطابق.";
      return;
    }

    const button = form.querySelector("button");
    button.disabled = true;
    error.textContent = "";
    try {
      const changedSession = await changePortalPassword({ newPassword: first });
      removeGate();
      window.dispatchEvent(new CustomEvent("mobdea:r20-password-changed", { detail: changedSession }));
    } catch (failure) {
      error.textContent = failure?.message || "تعذر تغيير كلمة المرور.";
      button.disabled = false;
    }
  });

  document.body.appendChild(overlay);
  gate = overlay;
}

function attachTeacherAccountActions(row) {
  if (!row || wiredRows.has(row)) return;
  const studentId = clean(row.getAttribute("data-student-id"));
  if (!studentId) return;
  wiredRows.add(row);

  const actions = document.createElement("span");
  actions.className = "r20-account-row-actions";
  actions.setAttribute("data-r20-account-actions", "true");
  actions.innerHTML = `
    <span class="r20-account-status" title="حالة حساب الطالب">🔐</span>
    <button type="button" class="r20-account-reset"
      title="Reset كلمة المرور إلى 123456"
      aria-label="Reset كلمة مرور الطالب">↺</button>
  `;
  row.appendChild(actions);

  const status = actions.querySelector(".r20-account-status");
  const reset = actions.querySelector(".r20-account-reset");

  async function refreshStatus() {
    try {
      const result = await getPortalAccountStatus({
        role: "student",
        accountId: studentId,
      });
      status.dataset.status = result?.account?.status || "not-created";
    } catch {
      status.dataset.status = "offline";
    }
  }

  reset.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (
      !window.confirm(
        `إعادة كلمة مرور الطالب إلى ${MOBDEA_DEFAULT_PORTAL_PASSWORD}؟`,
      )
    ) {
      return;
    }

    reset.disabled = true;
    try {
      await ensurePortalAccount({
        role: "student",
        accountId: studentId,
        displayName: clean(row.textContent).slice(0, 100),
      });
      await resetPortalPassword({ role: "student", accountId: studentId });
      await refreshStatus();
    } catch (failure) {
      window.alert(failure?.message || "تعذر Reset كلمة المرور.");
    } finally {
      reset.disabled = false;
    }
  });

  void refreshStatus();
}

function scanStudentRows() {
  document
    .querySelectorAll("[data-student-id]")
    .forEach(attachTeacherAccountActions);
}

function collectStudents(value, out, depth = 0) {
  if (!value || typeof value !== "object" || depth > 5) return;

  if (Array.isArray(value)) {
    value.forEach((item) => collectStudents(item, out, depth + 1));
    return;
  }

  if (Array.isArray(value.students)) {
    for (const student of value.students) {
      if (!student || typeof student !== "object") continue;

      const studentId = clean(student.id);
      const accountId = normalizeDigits(
        student.studentCode ??
          student.code ??
          student.loginCode ??
          student.id ??
          "",
      ).replace(/\s+/g, "");

      if (!studentId || !accountId) continue;

      const parentId = normalizeDigits(
        student.parentPhone ??
          student.guardianPhone ??
          student.parentPhoneNumber ??
          student.guardianMobile ??
          "",
      ).replace(/\s+/g, "");

      out.set(studentId, {
        studentId,
        accountId,
        displayName: clean(student.name ?? student.fullName),
        parentId,
      });
    }
  }

  Object.values(value).forEach((item) => {
    if (item && typeof item === "object") {
      collectStudents(item, out, depth + 1);
    }
  });
}

export async function autoBootstrapR20PortalAccounts() {
  if (typeof localStorage === "undefined") return;

  const config = resolveR20PortalAuthConfig();
  if (!config.baseUrl || !config.teacherKey) return;

  const students = new Map();

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    try {
      collectStudents(JSON.parse(localStorage.getItem(key)), students);
    } catch {
      // Ignore non-JSON storage entries.
    }
  }

  for (const item of students.values()) {
    try {
      await ensurePortalAccount({
        role: "student",
        accountId: item.studentId,
        studentId: item.studentId,
        loginCode: item.accountId,
        displayName: item.displayName,
      });

      if (item.parentId) {
        await ensurePortalAccount({
          role: "parent",
          accountId: item.parentId,
          displayName: `ولي أمر ${item.displayName}`.trim(),
          linkedStudentIds: [item.studentId],
        });
      }
    } catch {
      // Cloud/offline failure must never block the teacher UI.
    }
  }
}

function scheduleBootstrap() {
  clearTimeout(bootstrapTimer);
  bootstrapTimer = window.setTimeout(() => {
    void autoBootstrapR20PortalAccounts();
  }, 900);
}

export function installR20PortalAccountRuntime() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__MOBDEA_R20_ACCOUNT_RUNTIME__) return;

  window.__MOBDEA_R20_ACCOUNT_RUNTIME__ = R20_ACCOUNT_RUNTIME_MARKER;
  window.mobdeaR20PortalAccounts = Object.freeze({
    defaultPassword: MOBDEA_DEFAULT_PORTAL_PASSWORD,
    ensurePortalAccount,
    resetPortalPassword,
    getPortalAccountStatus,
    changePortalPassword,
    autoBootstrapR20PortalAccounts,
  });

  window.addEventListener("mobdea:r20-portal-login", (event) => {
    showForcedPasswordGate(event.detail);
  });

  scanStudentRows();
  scheduleBootstrap();

  new MutationObserver(() => {
    scanStudentRows();
    scheduleBootstrap();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      installR20PortalAccountRuntime,
      { once: true },
    );
  } else {
    installR20PortalAccountRuntime();
  }
}
