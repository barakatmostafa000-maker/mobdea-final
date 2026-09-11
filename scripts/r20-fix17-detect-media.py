from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
OUT = Path("src/config/r20MediaCapabilities.js")
REPORT = Path("/tmp/r20-fix17-media-sources.txt")
HASH_REPORT = Path("/tmp/r20-fix17-media-protected-sources.txt")

SUFFIXES = {
    ".js", ".jsx", ".ts", ".tsx", ".json",
    ".html", ".css", ".md",
}

EXCLUDE = {
    "r20MediaCapabilities.js",
    "r20MediaControls.js",
    "r20PowerPointMode.js",
    "r20-fix17-media.css",
    "r20-fix17-media.test.mjs",
    "r20-fix17-media-smoke.mjs",
    "r20-fix17-detect-media.py",
}

PATTERNS = {
    "video": re.compile(
        r"<video\b|video/|accept\s*=\s*['\"][^'\"]*video|"
        r"video\*|\.mp4\b|\.webm\b|\bvideo\b",
        re.I,
    ),
    "audio": re.compile(
        r"<audio\b|audio/|accept\s*=\s*['\"][^'\"]*audio|"
        r"audio\*|\.mp3\b|\.wav\b|\baudio\b",
        re.I,
    ),
    "powerpoint": re.compile(
        r"\.pptx?\b|powerpoint|presentationml|"
        r"application/vnd\.openxmlformats-officedocument\.presentationml\.presentation|"
        r"\bpptx\b|\bppt\b|بوربوينت|باوربوينت",
        re.I,
    ),
}

NAV_PATTERN = re.compile(
    r"next.?slide|prev(?:ious)?.?slide|slide.?index|current.?slide|"
    r"السابق|التالي|الشريحة|slide",
    re.I,
)

sources = {
    key: []
    for key in PATTERNS
}

ppt_nav_sources = []

roots = [
    path
    for path in (
        ROOT / "src",
        ROOT / "public",
    )
    if path.exists()
]

for base in roots:
    for path in base.rglob("*"):
        if not path.is_file():
            continue

        if path.name in EXCLUDE:
            continue

        if path.suffix.lower() not in SUFFIXES:
            continue

        text = path.read_text(
            encoding="utf-8",
            errors="ignore",
        )

        haystack = f"{path}\n{text}"

        for kind, pattern in PATTERNS.items():
            if pattern.search(haystack):
                sources[kind].append(str(path))

        if (
            PATTERNS["powerpoint"].search(haystack)
            and NAV_PATTERN.search(haystack)
        ):
            ppt_nav_sources.append(str(path))

capabilities = {
    "video": bool(sources["video"]),
    "audio": bool(sources["audio"]),
    "powerpoint": bool(sources["powerpoint"]),
    "powerpointNavigation": bool(ppt_nav_sources),
}

OUT.parent.mkdir(
    parents=True,
    exist_ok=True,
)

OUT.write_text(
    "\n".join([
        'export const R20_MEDIA_CAPABILITIES_MARKER = "R20_FIX17_MEDIA_CAPABILITIES_V1";',
        "export const R20_MEDIA_CAPABILITIES = Object.freeze(",
        json.dumps(
            capabilities,
            ensure_ascii=False,
            indent=2,
        ),
        ");",
        "",
    ]),
    encoding="utf-8",
)

report = []

for kind, values in sources.items():
    unique = sorted(set(values))
    report.append(
        f"[{kind}] count={len(unique)}"
    )
    report.extend(
        f"  {value}"
        for value in unique
    )

report.append(
    f"[powerpointNavigation] count={len(set(ppt_nav_sources))}"
)

report.extend(
    f"  {value}"
    for value in sorted(
        set(ppt_nav_sources)
    )
)

REPORT.write_text(
    "\n".join(report) + "\n",
    encoding="utf-8",
)

# Protect implementation files that FIX17 should not edit directly.
# main.* is intentionally excluded because FIX17 adds imports there.
protected = set()

for values in sources.values():
    for value in values:
        path = Path(value)
        if path.name.lower() in {
            "main.js",
            "main.jsx",
            "main.ts",
            "main.tsx",
        }:
            continue

        if path.name in EXCLUDE:
            continue

        protected.add(str(path))

HASH_REPORT.write_text(
    "\n".join(sorted(protected)) +
    ("\n" if protected else ""),
    encoding="utf-8",
)

print("R20 media capability audit:")
for key, value in capabilities.items():
    print(f"- {key}: {value}")
print(f"- protected sources: {len(protected)}")
