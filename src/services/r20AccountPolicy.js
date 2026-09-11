export const R20_ACCOUNT_POLICY_MARKER =
  "R20_FIX04_STUDENT_PARENT_ACCOUNTS_V1";

export const MOBDEA_DEFAULT_PORTAL_PASSWORD = "123456";

export function normalizePortalDigits(value = "") {
  return String(value)
    .trim()
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

export function normalizePortalRole(value = "") {
  const role = String(value).trim().toLowerCase();
  if (role !== "student" && role !== "parent") {
    throw new Error("Unsupported portal role");
  }
  return role;
}

export function normalizePortalAccountId(value = "") {
  const id = normalizePortalDigits(value).replace(/\s+/g, "");
  if (!id) throw new Error("Portal account id is required");
  return id;
}

export function sanitizeLinkedStudentIds(values = []) {
  const source = Array.isArray(values) ? values : [values];
  return [...new Set(source.map((v) => String(v ?? "").trim()).filter(Boolean))];
}

export function canPortalAccountReadStudent(account, studentId) {
  if (!account) return false;
  const role = normalizePortalRole(account.role);
  const target = String(studentId ?? "").trim();
  if (!target) return false;

  if (role === "student") {
    const ownId = String(account.studentId || account.accountId || "").trim();
    return ownId === target;
  }

  return sanitizeLinkedStudentIds(account.linkedStudentIds).includes(target);
}

export function portalAccountStatus(account) {
  if (!account) return "not-created";
  if (account.mustChangePassword && account.resetAt) return "reset-pending";
  if (account.mustChangePassword) return "temporary-password";
  if (account.passwordChangedAt) return "password-changed";
  return "active";
}
