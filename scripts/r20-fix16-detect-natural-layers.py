from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
OUT = Path("src/config/r20MapChallengeNaturalLayersConfig.js")
REPORT = Path("/tmp/r20-fix16-natural-layer-sources.txt")

TEXT_SUFFIXES = {
    ".js", ".jsx", ".ts", ".tsx", ".json", ".geojson",
    ".svg", ".css", ".html", ".md", ".txt",
}

PATTERNS = {
    "mountains": re.compile(
        r"\bmountains?\b|\bmount\b|جبال|جبل",
        re.I,
    ),
    "plateaus": re.compile(
        r"\bplateaus?\b|\bplateaux\b|هضاب|هضبة",
        re.I,
    ),
    "plains": re.compile(
        r"\bplains?\b|سهول|سهل",
        re.I,
    ),
    "islands": re.compile(
        r"\bislands?\b|جزر|جزيرة",
        re.I,
    ),
    "minerals": re.compile(
        r"\bminerals?\b|\bmining\b|\biron\b|\bphosphate\b|"
        r"\bmanganese\b|\bgold\b|\bcopper\b|\bbauxite\b|"
        r"ثروات.?معدنية|معادن|حديد|فوسفات|منجنيز|ذهب|نحاس|بوكسيت",
        re.I,
    ),
    "forests": re.compile(
        r"\bforests?\b|\bwoodlands?\b|غابات|غابة",
        re.I,
    ),
    "grasslands": re.compile(
        r"\bgrasslands?\b|\bsavann?ah?\b|\bsteppe\b|\bgrass\b|"
        r"حشائش|سافانا|استبس|السهوب|سهب",
        re.I,
    ),
    "deserts": re.compile(
        r"\bdeserts?\b|\bsahara\b|صحاري|صحراء",
        re.I,
    ),
}

EXCLUDE_NAMES = {
    "r20MapChallengeNaturalLayers.js",
    "r20MapChallengeNaturalLayersConfig.js",
    "r20-fix16-map-natural-layers.test.mjs",
    "r20-fix16-map-natural-layers-smoke.mjs",
    "r20-fix16-detect-natural-layers.py",
}

roots = [
    p
    for p in (
        ROOT / "src",
        ROOT / "public",
    )
    if p.exists()
]

matches = {
    key: []
    for key in PATTERNS
}

for base in roots:
    for path in base.rglob("*"):
        if not path.is_file():
            continue

        if path.name in EXCLUDE_NAMES:
            continue

        path_text = str(path).lower()

        content = ""
        if path.suffix.lower() in TEXT_SUFFIXES:
            try:
                content = path.read_text(
                    encoding="utf-8",
                    errors="ignore",
                )
            except Exception:
                content = ""

        haystack = f"{path_text}\n{content}"

        for key, pattern in PATTERNS.items():
            if pattern.search(haystack):
                matches[key].append(str(path))

terrain_ready = all(
    bool(matches[key])
    for key in (
        "mountains",
        "plateaus",
        "plains",
        "islands",
    )
)

availability = {
    "terrain": terrain_ready,
    "minerals": bool(matches["minerals"]),
    "forests": bool(matches["forests"]),
    "grasslands": bool(matches["grasslands"]),
    "deserts": bool(matches["deserts"]),
}

OUT.parent.mkdir(
    parents=True,
    exist_ok=True,
)

lines = [
    'export const R20_NATURAL_LAYERS_CONFIG_MARKER = "R20_FIX16_NATURAL_LAYERS_CONFIG_V1";',
    "export const R20_NATURAL_LAYER_AVAILABILITY = Object.freeze(",
    json.dumps(
        availability,
        ensure_ascii=False,
        indent=2,
    ).replace(
        "true",
        "true",
    ).replace(
        "false",
        "false",
    ),
    ");",
    "export const R20_NATURAL_LAYER_SOURCE_COUNTS = Object.freeze(",
    json.dumps(
        {
            key: len(value)
            for key, value in matches.items()
        },
        ensure_ascii=False,
        indent=2,
    ),
    ");",
    "",
]

OUT.write_text(
    "\n".join(lines),
    encoding="utf-8",
)

report_lines = []

for key in PATTERNS:
    report_lines.append(
        f"[{key}] count={len(matches[key])}"
    )
    report_lines.extend(
        f"  {value}"
        for value in sorted(
            set(matches[key])
        )
    )

REPORT.write_text(
    "\n".join(report_lines) + "\n",
    encoding="utf-8",
)

print("Natural layer source audit:")
for key, value in matches.items():
    print(
        f"- {key}: {len(value)}"
    )

print("Availability:")
for key, value in availability.items():
    print(
        f"- {key}: {value}"
    )
