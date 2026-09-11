from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
OUT = Path("src/config/r20GamesConfig.js")
REPORT = Path("/tmp/r20-fix18-games-sources.txt")
PROTECTED = Path("/tmp/r20-fix18-games-protected-sources.txt")

SUFFIXES = {".js", ".jsx", ".ts", ".tsx", ".json", ".html", ".md"}

EXCLUDE = {
    "r20GamesConfig.js",
    "r20GamesRuntime.js",
    "r20-fix18-games.css",
    "r20-fix18-games.test.mjs",
    "r20-fix18-games-smoke.mjs",
    "r20-fix18-detect-games.py",
}

GAME = re.compile(r"\bgames?\b|\bquiz\b|لعبة|ألعاب|العاب", re.I)
QUESTION = re.compile(
    r"\bquestions?\b|currentQuestion|questionIndex|questionText|سؤال|الأسئلة|الاسئلة",
    re.I,
)
ANSWER = re.compile(
    r"\banswers?\b|\boptions?\b|\bchoices?\b|correctAnswer|selectedAnswer|إجابة|اجابة|اختيار",
    re.I,
)
PROGRESSION = re.compile(
    r"\bscore\b|\bpoints?\b|\blives?\b|\bprogress\b|nextQuestion|set[A-Za-z]*Question|نتيجة|نقاط|محاولات|السؤال التالي",
    re.I,
)

def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")

def score(path: Path, text: str) -> int:
    value = 0
    stem = path.stem.lower()

    if "game" in stem:
        value += 8
    if "quiz" in stem:
        value += 6
    if GAME.search(text):
        value += 3
    if QUESTION.search(text):
        value += 4
    if ANSWER.search(text):
        value += 4
    if PROGRESSION.search(text):
        value += 3

    return value

files = []

for base in (ROOT / "src", ROOT / "public"):
    if not base.exists():
        continue

    for path in base.rglob("*"):
        if (
            not path.is_file()
            or path.suffix.lower() not in SUFFIXES
            or path.name in EXCLUDE
        ):
            continue

        text = read(path)
        value = score(path, text)

        if value >= 5:
            files.append((value, path, text))

files.sort(key=lambda item: (-item[0], str(item[1])))

if not files:
    raise SystemExit("FIX18 existing Games implementation not found")

combined = "\n\n".join(
    f"// FILE: {path}\n{text}"
    for _, path, text in files
)

has_question_flow = bool(
    QUESTION.search(combined)
    and ANSWER.search(combined)
    and PROGRESSION.search(combined)
)

route_patterns = [
    re.compile(
        r"<Route[\s\S]{0,800}?path\s*=\s*[\"'](?P<path>[^\"']+)[\"'][\s\S]{0,800}?(?:Games?|Quiz|ألعاب|العاب|لعبة)",
        re.I,
    ),
    re.compile(
        r"(?:Games?|Quiz|ألعاب|العاب|لعبة)[\s\S]{0,800}?<Route[\s\S]{0,800}?path\s*=\s*[\"'](?P<path>[^\"']+)[\"']",
        re.I,
    ),
    re.compile(
        r"(?:navigate|history\.push|history\.replace)\s*\(\s*[\"'](?P<path>[^\"']*(?:game|quiz)[^\"']*)[\"']",
        re.I,
    ),
    re.compile(
        r"(?:href|to)\s*=\s*[\"'](?P<path>[^\"']*(?:game|quiz)[^\"']*)[\"']",
        re.I,
    ),
]

routes = []

for pattern in route_patterns:
    for match in pattern.finditer(combined):
        value = match.group("path").strip()
        if value and value not in routes:
            routes.append(value)

def rank(value: str):
    lower = value.lower()
    value_score = 0

    if "games" in lower:
        value_score += 6
    elif "game" in lower:
        value_score += 4
    if "quiz" in lower:
        value_score += 3
    if value.startswith(("/", "#")):
        value_score += 2
    if "room" in lower:
        value_score -= 2
    if "online" in lower:
        value_score -= 2

    return (-value_score, len(value))

routes.sort(key=rank)
route = routes[0] if routes else ""

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(
    "\n".join([
        'export const R20_GAMES_CONFIG_MARKER = "R20_FIX18_GAMES_CONFIG_V1";',
        f"export const R20_GAMES_PATH = {json.dumps(route, ensure_ascii=False)};",
        f"export const R20_GAMES_HAS_QUESTION_FLOW = {str(has_question_flow).lower()};",
        f"export const R20_GAMES_SOURCE_COUNT = {len(files)};",
        "",
    ]),
    encoding="utf-8",
)

REPORT.write_text(
    "\n".join(
        f"score={value:02d} {path}"
        for value, path, _ in files
    ) + "\n",
    encoding="utf-8",
)

protected = []

for _, path, _ in files:
    if path.name.lower() in {"main.js", "main.jsx", "main.ts", "main.tsx"}:
        continue
    if path.name in EXCLUDE:
        continue
    protected.append(str(path))

PROTECTED.write_text(
    "\n".join(sorted(set(protected))) + ("\n" if protected else ""),
    encoding="utf-8",
)

print(f"Games sources: {len(files)}")
print(f"Detected route: {route or '<none>'}")
print(f"Question flow detected: {has_question_flow}")
