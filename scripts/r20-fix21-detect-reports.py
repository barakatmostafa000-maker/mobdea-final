from __future__ import annotations
import re, sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
OUT = Path("src/config/r20ReportsWhatsAppConfig.js")
REPORT = Path("/tmp/r20-fix21-report-sources.txt")
PROTECTED = Path("/tmp/r20-fix21-report-protected-sources.txt")

required = {
    "examTracking": Path("src/services/r20ExamTracking.js"),
    "portalAccounts": Path("src/services/r20PortalAccountRuntime.js"),
    "portalDashboard": Path("src/services/r20PortalDashboard.js"),
}

for name, rel in required.items():
    path = ROOT / rel
    if not path.is_file():
        raise SystemExit(f"FIX21 required prior source missing: {rel}")

exam = (ROOT / required["examTracking"]).read_text(encoding="utf-8", errors="ignore")
accounts = (ROOT / required["portalAccounts"]).read_text(encoding="utf-8", errors="ignore")
dashboard = (ROOT / required["portalDashboard"]).read_text(encoding="utf-8", errors="ignore")

checks = {
    "examResults": bool(re.search(r"getStudentWeakness|exam-result-ready|wrongCount|weakness", exam, re.I)),
    "parentPhone": bool(re.search(r"parentPhone|guardianPhone|parentPhoneNumber|guardianMobile", accounts, re.I)),
    "linkedStudents": bool(re.search(r"linkedStudentIds", accounts + dashboard, re.I)),
    "reportPermission": bool(re.search(r'["\']reports?["\']|تقارير|report', dashboard, re.I)),
}

if not all(checks.values()):
    raise SystemExit(f"FIX21 prerequisite contract failed: {checks}")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join([
    'export const R20_REPORTS_WHATSAPP_CONFIG_MARKER = "R20_FIX21_REPORTS_WHATSAPP_CONFIG_V1";',
    f'export const R20_REPORTS_HAS_EXAM_RESULTS = {str(checks["examResults"]).lower()};',
    f'export const R20_REPORTS_HAS_PARENT_PHONE = {str(checks["parentPhone"]).lower()};',
    f'export const R20_REPORTS_HAS_LINKED_STUDENTS = {str(checks["linkedStudents"]).lower()};',
    f'export const R20_REPORTS_HAS_PORTAL_PERMISSION = {str(checks["reportPermission"]).lower()};',
    '',
]), encoding="utf-8")

REPORT.write_text(
    "\n".join(
        f"{name}: {required[name]}"
        for name in required
    ) + "\n" +
    "\n".join(
        f"{key}={value}"
        for key, value in checks.items()
    ) + "\n",
    encoding="utf-8",
)

PROTECTED.write_text(
    "\n".join(str(required[name]) for name in required) + "\n",
    encoding="utf-8",
)

print("FIX21 prerequisites:", checks)
