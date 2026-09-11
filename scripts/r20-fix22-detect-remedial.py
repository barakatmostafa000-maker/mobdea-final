from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
OUT = Path("src/config/r20RemedialAssistantConfig.js")
REPORT = Path("/tmp/r20-fix22-remedial-sources.txt")
PROTECTED = Path("/tmp/r20-fix22-remedial-protected-sources.txt")

required = {
    "questionBank": Path("src/services/r20QuestionBankPipeline.js"),
    "examTracking": Path("src/services/r20ExamTracking.js"),
    "reports": Path("src/services/r20ReportsWhatsApp.js"),
    "dashboard": Path("src/services/r20PortalDashboard.js"),
}

for name, rel in required.items():
    if not (ROOT / rel).is_file():
        raise SystemExit(
            f"FIX22 required prior source missing: {rel}"
        )

question_bank = (ROOT / required["questionBank"]).read_text(
    encoding="utf-8",
    errors="ignore",
)

exam_tracking = (ROOT / required["examTracking"]).read_text(
    encoding="utf-8",
    errors="ignore",
)

reports = (ROOT / required["reports"]).read_text(
    encoding="utf-8",
    errors="ignore",
)

dashboard = (ROOT / required["dashboard"]).read_text(
    encoding="utf-8",
    errors="ignore",
)

checks = {
    "questionBankQuery": bool(
        re.search(
            r"\bquery\s*[:(]|\bquery\(filters",
            question_bank,
            re.I,
        )
    ),
    "questionBankTake": bool(
        re.search(
            r"\btake\s*[:(]|\btake\(\{",
            question_bank,
            re.I,
        )
    ),
    "examWeakness": bool(
        re.search(
            r"getStudentWeakness|weaknessByStudent",
            exam_tracking,
            re.I,
        )
    ),
    "examAttempts": bool(
        re.search(
            r"listAttemptsByStudent|startAttempt|finalizeAttempt",
            exam_tracking,
            re.I,
        )
    ),
    "reportsReady": bool(
        re.search(
            r"R20_FIX21_REPORTS_WHATSAPP_V1|student-report-ready",
            reports,
            re.I,
        )
    ),
    "assistantDashboard": bool(
        re.search(
            r'["\']assistant["\']|مساعد المبدع|المساعد',
            dashboard,
            re.I,
        )
    ),
}

if not all(checks.values()):
    raise SystemExit(
        f"FIX22 prerequisite contract failed: {checks}"
    )

OUT.parent.mkdir(
    parents=True,
    exist_ok=True,
)

OUT.write_text(
    "\n".join([
        'export const R20_REMEDIAL_ASSISTANT_CONFIG_MARKER = "R20_FIX22_REMEDIAL_ASSISTANT_CONFIG_V1";',
        f'export const R20_REMEDIAL_HAS_QUESTION_QUERY = {str(checks["questionBankQuery"]).lower()};',
        f'export const R20_REMEDIAL_HAS_QUESTION_TAKE = {str(checks["questionBankTake"]).lower()};',
        f'export const R20_REMEDIAL_HAS_WEAKNESS = {str(checks["examWeakness"]).lower()};',
        f'export const R20_REMEDIAL_HAS_ATTEMPTS = {str(checks["examAttempts"]).lower()};',
        f'export const R20_REMEDIAL_HAS_REPORTS = {str(checks["reportsReady"]).lower()};',
        f'export const R20_REMEDIAL_HAS_ASSISTANT_DASHBOARD = {str(checks["assistantDashboard"]).lower()};',
        "",
    ]),
    encoding="utf-8",
)

REPORT.write_text(
    "\n".join(
        f"{name}: {rel}"
        for name, rel in required.items()
    ) + "\n" +
    "\n".join(
        f"{key}={value}"
        for key, value in checks.items()
    ) + "\n",
    encoding="utf-8",
)

PROTECTED.write_text(
    "\n".join(
        str(rel)
        for rel in required.values()
    ) + "\n",
    encoding="utf-8",
)

print("FIX22 prerequisites:", checks)
