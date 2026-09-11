from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "src")
OUT = Path("src/config/r20MapChallengeConfig.js")
REPORT = Path("/tmp/r20-fix15-map-challenge-sources.txt")

SOURCE_SUFFIXES = {".js", ".jsx", ".ts", ".tsx"}

CHALLENGE_MARKERS = (
    "MapChallenge",
    "map challenge",
    "map-challenge",
    "تحدي الخرائط",
    "تحدى الخرائط",
)

GESTURE_MARKERS = (
    "pointerdown",
    "pointermove",
    "onPointerDown",
    "onPointerMove",
    "touchstart",
    "touchmove",
    "onTouchStart",
    "onTouchMove",
    "wheel",
    "onWheel",
    "pinch",
    "scale",
    "zoom",
)

LAYER_MARKERS = (
    "layer",
    "layers",
    "boundary",
    "borders",
    "river",
    "latitude",
    "longitude",
    "greenwich",
    "labels",
    "طبقات",
    "حدود",
    "أنهار",
    "خطوط العرض",
    "جرينتش",
)

def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")

def challenge_score(path: Path, text: str) -> int:
    lower = text.lower()
    score = 0

    if "mapchallenge" in path.stem.lower():
        score += 12
    if "map-challenge" in path.stem.lower():
        score += 12
    if "challenge" in path.stem.lower() and "map" in path.stem.lower():
        score += 10

    for marker in CHALLENGE_MARKERS:
        if marker.lower() in lower:
            score += 4

    if "leaderboard" in lower or "الترتيب" in text:
        score += 2
    if "lives" in lower or "المحاولات" in text:
        score += 1
    if "score" in lower or "النتيجة" in text:
        score += 1

    return score

files = []
for path in ROOT.rglob("*"):
    if not path.is_file() or path.suffix.lower() not in SOURCE_SUFFIXES:
        continue

    if path.name.startswith("r20MapChallenge"):
        continue

    text = read(path)
    score = challenge_score(path, text)

    if score > 0:
        files.append((score, path, text))

files.sort(key=lambda item: (-item[0], str(item[1])))

if not files:
    raise SystemExit("FIX15 could not find the existing Map Challenge implementation.")

report_body = "\n".join(str(item_path) for _, item_path, _ in files) + "\n"
REPORT.write_text(
    report_body,
    encoding="utf-8",
)

combined = "\n\n".join(
    f"// FILE: {path}\n{text}"
    for _, path, text in files
)

route_candidates = []

patterns = [
    re.compile(
        r"<Route[\s\S]{0,900}?path\s*=\s*[\"'](?P<path>[^\"']+)[\"'][\s\S]{0,900}?"
        r"(?:MapChallenge|map.?challenge|تحدي الخرائط)",
        re.I,
    ),
    re.compile(
        r"(?:MapChallenge|map.?challenge|تحدي الخرائط)[\s\S]{0,900}?"
        r"<Route[\s\S]{0,900}?path\s*=\s*[\"'](?P<path>[^\"']+)[\"']",
        re.I,
    ),
    re.compile(
        r"(?:navigate|history\.push|history\.replace)\s*\(\s*[\"']"
        r"(?P<path>[^\"']*(?:map|challenge)[^\"']*)[\"']",
        re.I,
    ),
    re.compile(
        r"(?:href|to)\s*=\s*[\"'](?P<path>[^\"']*(?:map|challenge)[^\"']*)[\"']",
        re.I,
    ),
    re.compile(
        r"path\s*:\s*[\"'](?P<path>[^\"']*(?:map|challenge)[^\"']*)[\"']",
        re.I,
    ),
]

for pattern in patterns:
    for match in pattern.finditer(combined):
        candidate = match.group("path").strip()
        if not candidate:
            continue
        if candidate not in route_candidates:
            route_candidates.append(candidate)

def route_rank(value: str) -> tuple[int, int]:
    lower = value.lower()
    score = 0

    if "map" in lower:
        score += 4
    if "challenge" in lower:
        score += 5
    if "تحدي" in lower:
        score += 5
    if value.startswith("/"):
        score += 2
    if value.startswith("#"):
        score += 2
    if "join" in lower:
        score -= 4
    if "room" in lower:
        score -= 2

    return (-score, len(value))

route_candidates.sort(key=route_rank)
route = route_candidates[0] if route_candidates else ""

# The current Mobdea app uses a screen-key router instead of URL routes.
# Detect the real App.jsx screen map and preserve that routing model.
if (
    not route
    and re.search(r"\bmapChallenge\s*:\s*MapChallenge\b", combined)
    and re.search(r"\bmapChallenge\s*:\s*\{[^}]*navigate\s*:\s*setActive", combined, re.S)
):
    route = "active:mapChallenge"

primary_text = files[0][2]
all_text = "\n".join(text for _, _, text in files)

has_native_gestures = sum(
    marker.lower() in all_text.lower()
    for marker in GESTURE_MARKERS
) >= 2

has_layer_logic = sum(
    marker.lower() in all_text.lower()
    for marker in LAYER_MARKERS
) >= 2

OUT.parent.mkdir(parents=True, exist_ok=True)
config_body = "\n".join([
    'export const R20_MAP_CHALLENGE_CONFIG_MARKER = "R20_FIX15_MAP_CHALLENGE_CONFIG_V1";',
    f"export const R20_MAP_CHALLENGE_PATH = {json.dumps(route, ensure_ascii=False)};",
    f"export const R20_MAP_CHALLENGE_HAS_NATIVE_GESTURES = {str(has_native_gestures).lower()};",
    f"export const R20_MAP_CHALLENGE_HAS_LAYER_LOGIC = {str(has_layer_logic).lower()};",
    f"export const R20_MAP_CHALLENGE_SOURCE_COUNT = {len(files)};",
    "",
])
OUT.write_text(
    config_body,
    encoding="utf-8",
)

print(f"Map Challenge sources: {len(files)}")
for score, path, _ in files:
    print(f"  score={score:02d} {path}")
print(f"Detected route: {route or '<none>'}")
print(f"Native gestures detected: {has_native_gestures}")
print(f"Layer logic detected: {has_layer_logic}")
