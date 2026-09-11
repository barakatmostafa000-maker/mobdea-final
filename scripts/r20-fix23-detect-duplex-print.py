from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
OUT = Path("src/config/r20DuplexPrintConfig.js")
REPORT = Path("/tmp/r20-fix23-print-sources.txt")
PROTECTED = Path("/tmp/r20-fix23-print-protected-sources.txt")

legacy_test = ROOT / "tests/student-card-printing-r14.test.mjs"

if not legacy_test.is_file():
    raise SystemExit(
        "FIX23 legacy student-card-printing-r14 regression test is missing."
    )

SUFFIXES = {
    ".js", ".jsx", ".ts", ".tsx",
    ".css", ".scss", ".html",
}

PRINT = re.compile(
    r"window\.print\s*\(|@media\s+print|beforeprint|afterprint|"
    r"print(?:ing)?|طباعة",
    re.I,
)

CARD = re.compile(
    r"student.?card|card.?print|print.?card|id.?card|"
    r"بطاق(?:ة|ات)|كارت|طالب",
    re.I,
)

DUPLEX = re.compile(
    r"duplex|front|back|وجه|ظهر|double.?side",
    re.I,
)

files = []

for base in (
    ROOT / "src",
    ROOT / "public",
):
    if not base.exists():
        continue

    for path in base.rglob("*"):
        if (
            not path.is_file()
            or path.suffix.lower() not in SUFFIXES
            or path.name.lower().startswith("r20")
        ):
            continue

        text = path.read_text(
            encoding="utf-8",
            errors="ignore",
        )

        score = 0
        score += 7 if PRINT.search(text) else 0
        score += 5 if CARD.search(text) else 0
        score += 2 if DUPLEX.search(text) else 0

        stem = path.stem.lower()
        score += 4 if "print" in stem else 0
        score += 3 if "card" in stem else 0

        if score >= 10:
            files.append(
                (
                    score,
                    path,
                    bool(PRINT.search(text)),
                    bool(CARD.search(text)),
                    bool(DUPLEX.search(text)),
                )
            )

files.sort(
    key=lambda item: (
        -item[0],
        str(item[1]),
    )
)

if not files:
    raise SystemExit(
        "FIX23 could not find the existing student-card printing implementation."
    )

has_print = any(item[2] for item in files)
has_cards = any(item[3] for item in files)

if not (
    has_print
    and has_cards
):
    raise SystemExit(
        "FIX23 existing source lacks print + student-card contracts."
    )

OUT.parent.mkdir(
    parents=True,
    exist_ok=True,
)

OUT.write_text(
    "\n".join([
        'export const R20_DUPLEX_PRINT_CONFIG_MARKER = "R20_FIX23_DUPLEX_PRINT_CONFIG_V1";',
        f"export const R20_DUPLEX_EXISTING_SOURCE_COUNT = {len(files)};",
        f"export const R20_DUPLEX_HAS_PRINT = {str(has_print).lower()};",
        f"export const R20_DUPLEX_HAS_STUDENT_CARDS = {str(has_cards).lower()};",
        'export const R20_DUPLEX_DEFAULT_FLIP_EDGE = "long-edge";',
        "export const R20_DUPLEX_A4_WIDTH_MM = 210;",
        "export const R20_DUPLEX_A4_HEIGHT_MM = 297;",
        "export const R20_DUPLEX_CARD_WIDTH_MM = 85.6;",
        "export const R20_DUPLEX_CARD_HEIGHT_MM = 54;",
        "export const R20_DUPLEX_COLUMNS = 2;",
        "export const R20_DUPLEX_ROWS = 5;",
        "",
    ]),
    encoding="utf-8",
)

REPORT.write_text(
    "\n".join(
        f"score={score:02d} print={p} cards={c} duplex={d} {path}"
        for score, path, p, c, d in files
    ) + "\n",
    encoding="utf-8",
)

protected = [
    str(path)
    for _, path, *_ in files
    if path.name.lower() not in {
        "main.js",
        "main.jsx",
        "main.ts",
        "main.tsx",
    }
]

PROTECTED.write_text(
    "\n".join(
        sorted(
            set(protected)
        )
    ) +
    ("\n" if protected else ""),
    encoding="utf-8",
)

print(
    f"FIX23 printing sources={len(files)} "
    f"print={has_print} cards={has_cards}"
)
