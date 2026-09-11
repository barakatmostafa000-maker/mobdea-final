from __future__ import annotations
import re, sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
OUT = Path("src/config/r20MonthlyEvaluationConfig.js")
REPORT = Path("/tmp/r20-fix25-monthly-sources.txt")
PROTECTED = Path("/tmp/r20-fix25-monthly-protected-sources.txt")

required = [
    Path("tests/student-ranking.test.mjs"),
    Path("src/services/r20ExamTracking.js"),
    Path("src/services/r20PortalDashboard.js"),
    Path("src/services/r20ReportsWhatsApp.js"),
]

for rel in required:
    if not (ROOT / rel).is_file():
        raise SystemExit(f"FIX25 prerequisite missing: {rel}")

SUFFIXES = {".js", ".jsx", ".ts", ".tsx", ".json", ".html"}
RANK = re.compile(r"student.?ranking|leaderboard|ranking|ترتيب", re.I)
POINTS = re.compile(r"classPoints|lessonPoints|participationPoints|attendancePoints|points|نقاط", re.I)
MONTHLY = re.compile(r"monthly|monthKey|monthlyEvaluation|تقييم.?شهري|شهري", re.I)
GROUP = re.compile(r"groupId|groupName|classGroup|batch|مجموعة|المجموعة", re.I)

sources = []
legacy_monthly = False
has_points = False
has_groups = False

for base in (ROOT / "src", ROOT / "public"):
    if not base.exists():
        continue

    for path in base.rglob("*"):
        if (
            not path.is_file()
            or path.suffix.lower() not in SUFFIXES
            or path.name.lower().startswith("r20")
        ):
            continue

        text = path.read_text(encoding="utf-8", errors="ignore")
        score = 0
        score += 5 if RANK.search(text) else 0
        score += 4 if POINTS.search(text) else 0
        score += 4 if GROUP.search(text) else 0
        score += 7 if MONTHLY.search(text) else 0

        if score >= 6:
            sources.append((score, path))

        legacy_monthly = legacy_monthly or bool(
            MONTHLY.search(text) and RANK.search(text)
        )
        has_points = has_points or bool(POINTS.search(text))
        has_groups = has_groups or bool(GROUP.search(text))

if not sources:
    raise SystemExit("FIX25 existing ranking/points/group source not found.")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(
    "\n".join([
        'export const R20_MONTHLY_EVALUATION_CONFIG_MARKER = "R20_FIX25_MONTHLY_EVALUATION_CONFIG_V1";',
        f'export const R20_MONTHLY_LEGACY_MONTHLY_FOUND = {str(legacy_monthly).lower()};',
        'export const R20_MONTHLY_HAS_RANKING = true;',
        f'export const R20_MONTHLY_HAS_CLASS_POINTS = {str(has_points).lower()};',
        f'export const R20_MONTHLY_HAS_GROUPS = {str(has_groups).lower()};',
        f'export const R20_MONTHLY_SOURCE_COUNT = {len(sources)};',
        "",
    ]),
    encoding="utf-8",
)

REPORT.write_text(
    f"legacy_monthly={legacy_monthly}\n"
    f"has_points={has_points}\n"
    f"has_groups={has_groups}\n"
    + "\n".join(
        f"score={score:02d} {path}"
        for score, path in sorted(
            sources,
            key=lambda item: (-item[0], str(item[1])),
        )
    )
    + "\n",
    encoding="utf-8",
)

protected = [
    str(path)
    for _, path in sources
    if path.name.lower() not in {
        "main.js", "main.jsx", "main.ts", "main.tsx"
    }
]

PROTECTED.write_text(
    "\n".join(sorted(set(protected))) + ("\n" if protected else ""),
    encoding="utf-8",
)

print(
    "FIX25 monthly audit:",
    {
        "legacy_monthly": legacy_monthly,
        "points": has_points,
        "groups": has_groups,
        "sources": len(sources),
    },
)
