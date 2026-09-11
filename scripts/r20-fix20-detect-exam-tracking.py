from __future__ import annotations
import re, sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
OUT = Path("src/config/r20ExamTrackingConfig.js")
REPORT = Path("/tmp/r20-fix20-exam-sources.txt")
PROTECTED = Path("/tmp/r20-fix20-exam-protected-sources.txt")

SUFFIXES = {".js", ".jsx", ".ts", ".tsx", ".json", ".html"}
EXAM = re.compile(r"\bexam(?:s)?\b|\btest(?:s)?\b|\bquiz\b|امتحان|اختبار|اختبارات|امتحانات", re.I)
QUESTION = re.compile(r"\bquestion(?:s)?\b|questionIndex|currentQuestion|سؤال|الأسئلة|الاسئلة", re.I)
RESULT = re.compile(r"\bresult(?:s)?\b|\bscore\b|\bgrade(?:s)?\b|correct|wrong|incorrect|نتيجة|درجة|درجات|صحيح|خطأ", re.I)
FILE_IMPORT = re.compile(r"type\s*=\s*['\"]file['\"]|accept\s*=\s*['\"][^'\"]*(?:json|csv|xlsx|pdf|exam|question)|FileReader|arrayBuffer\(\)|\.files\b|ملف", re.I)
STUDENT = re.compile(r"studentId|student_id|studentCode|student.*result|طالب|الطالب", re.I)

files = []
for base in (ROOT / "src", ROOT / "public"):
    if not base.exists():
        continue
    for path in base.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in SUFFIXES or path.name.lower().startswith("r20"):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        score = 0
        score += 6 if EXAM.search(text) else 0
        score += 3 if QUESTION.search(text) else 0
        score += 4 if RESULT.search(text) else 0
        score += 3 if FILE_IMPORT.search(text) else 0
        score += 2 if STUDENT.search(text) else 0
        stem = path.stem.lower()
        score += 4 if "exam" in stem else 0
        score += 2 if "test" in stem else 0
        score += 2 if "result" in stem else 0
        if score >= 8:
            files.append((score, path, text))

files.sort(key=lambda x: (-x[0], str(x[1])))
if not files:
    raise SystemExit("FIX20 could not find the existing exam/test implementation.")

combined = "\n".join(text for _, _, text in files)
flags = {
    "exam": bool(EXAM.search(combined)),
    "questions": bool(QUESTION.search(combined)),
    "results": bool(RESULT.search(combined)),
    "fileImport": bool(FILE_IMPORT.search(combined)),
    "studentLink": bool(STUDENT.search(combined)),
}
if not (flags["exam"] and flags["questions"] and flags["results"]):
    raise SystemExit("FIX20 exam source lacks exam/question/result contracts.")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join([
    'export const R20_EXAM_TRACKING_CONFIG_MARKER = "R20_FIX20_EXAM_TRACKING_CONFIG_V1";',
    f'export const R20_EXAM_SOURCE_COUNT = {len(files)};',
    f'export const R20_EXAM_HAS_EXAM_UI = {str(flags["exam"]).lower()};',
    f'export const R20_EXAM_HAS_QUESTIONS = {str(flags["questions"]).lower()};',
    f'export const R20_EXAM_HAS_RESULTS = {str(flags["results"]).lower()};',
    f'export const R20_EXAM_HAS_FILE_IMPORT = {str(flags["fileImport"]).lower()};',
    f'export const R20_EXAM_HAS_STUDENT_LINK = {str(flags["studentLink"]).lower()};',
    "",
]), encoding="utf-8")

REPORT.write_text("\n".join(f"score={score:02d} {path}" for score, path, _ in files) + "\n", encoding="utf-8")
protected = [str(path) for _, path, _ in files if path.name.lower() not in {"main.js","main.jsx","main.ts","main.tsx"}]
PROTECTED.write_text("\n".join(sorted(set(protected))) + ("\n" if protected else ""), encoding="utf-8")

print("Exam source audit:", flags, "sources=", len(files))
