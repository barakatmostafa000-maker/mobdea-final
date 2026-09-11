from __future__ import annotations
import re, sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
OUT = Path("src/config/r20QuestionBankConfig.js")
REPORT = Path("/tmp/r20-fix19-question-bank-sources.txt")
PROTECTED = Path("/tmp/r20-fix19-question-bank-protected-sources.txt")

SUFFIXES = {".js", ".jsx", ".ts", ".tsx", ".json"}

BANK = re.compile(
    r"question.?bank|bank.?question|بنك.?الأسئلة|بنك.?الاسئلة|"
    r"quizQuestions|examQuestions|questions\s*[:=]",
    re.I,
)
PROMPT = re.compile(
    r"questionText|question_text|prompt|stem|question\s*:|السؤال",
    re.I,
)
OPTIONS = re.compile(
    r"options\s*:|answers\s*:|choices\s*:|اختيارات|الإجابات|الاجابات",
    re.I,
)
CORRECT = re.compile(
    r"correctAnswer|correct_answer|correctIndex|correctOption|"
    r"answer\s*:|isCorrect|الإجابة.?الصحيحة|الاجابة.?الصحيحة",
    re.I,
)
META = re.compile(
    r"subject|grade|unit|lesson|pageNumber|documentId|difficulty|"
    r"المادة|الصف|الوحدة|الدرس|الصفحة",
    re.I,
)

files = []

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

        text = path.read_text(
            encoding="utf-8",
            errors="ignore",
        )

        score = 0
        score += 6 if BANK.search(text) else 0
        score += 3 if PROMPT.search(text) else 0
        score += 4 if OPTIONS.search(text) else 0
        score += 4 if CORRECT.search(text) else 0
        score += 1 if META.search(text) else 0

        stem = path.stem.lower()
        score += 3 if "question" in stem else 0
        score += 2 if "quiz" in stem else 0
        score += 1 if "exam" in stem else 0

        if score >= 7:
            files.append({
                "score": score,
                "path": path,
                "prompt": bool(PROMPT.search(text)),
                "options": bool(OPTIONS.search(text)),
                "correct": bool(CORRECT.search(text)),
                "metadata": bool(META.search(text)),
            })

files.sort(
    key=lambda item: (
        -item["score"],
        str(item["path"]),
    )
)

if not files:
    raise SystemExit(
        "FIX19 existing question-bank/question-source implementation not found"
    )

has_prompt = any(x["prompt"] for x in files)
has_options = any(x["options"] for x in files)
has_correct = any(x["correct"] for x in files)
has_metadata = any(x["metadata"] for x in files)

if not (has_prompt and has_options and has_correct):
    raise SystemExit(
        "FIX19 question source lacks prompt/options/correct-answer shape"
    )

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(
    "\n".join([
        'export const R20_QUESTION_BANK_CONFIG_MARKER = "R20_FIX19_QUESTION_BANK_CONFIG_V1";',
        f'export const R20_QUESTION_BANK_SOURCE_COUNT = {len(files)};',
        f'export const R20_QUESTION_BANK_HAS_PROMPT = {str(has_prompt).lower()};',
        f'export const R20_QUESTION_BANK_HAS_OPTIONS = {str(has_options).lower()};',
        f'export const R20_QUESTION_BANK_HAS_CORRECT_ANSWER = {str(has_correct).lower()};',
        f'export const R20_QUESTION_BANK_HAS_METADATA = {str(has_metadata).lower()};',
        "",
    ]),
    encoding="utf-8",
)

REPORT.write_text(
    "\n".join(
        f'score={item["score"]:02d} {item["path"]}'
        for item in files
    ) + "\n",
    encoding="utf-8",
)

protected = []
for item in files:
    path = item["path"]

    if path.name.lower() in {
        "main.js",
        "main.jsx",
        "main.ts",
        "main.tsx",
    }:
        continue

    protected.append(str(path))

PROTECTED.write_text(
    "\n".join(sorted(set(protected))) +
    ("\n" if protected else ""),
    encoding="utf-8",
)

print(f"Question-bank sources: {len(files)}")
print(f"Prompt: {has_prompt}")
print(f"Options: {has_options}")
print(f"Correct answer: {has_correct}")
print(f"Metadata: {has_metadata}")
