from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ARAB_EN = [
    "Algeria","Bahrain","Comoros","Djibouti","Egypt","Iraq","Jordan",
    "Kuwait","Lebanon","Libya","Mauritania","Morocco","Oman","Palestine",
    "Qatar","Saudi Arabia","Somalia","Sudan","Syria","Tunisia",
    "United Arab Emirates","Yemen",
]

ARAB_AR = [
    "الجزائر","البحرين","جزر القمر","جيبوتي","مصر","العراق","الأردن",
    "الكويت","لبنان","ليبيا","موريتانيا","المغرب","عمان","فلسطين","قطر",
    "السعودية","الصومال","السودان","سوريا","تونس","الإمارات","اليمن",
]

NILE_EN = [
    "Burundi","Democratic Republic of the Congo","Egypt","Eritrea",
    "Ethiopia","Kenya","Rwanda","South Sudan","Sudan","Tanzania","Uganda",
]

NILE_AR = [
    "بوروندي","جمهورية الكونغو الديمقراطية","مصر","إريتريا","إثيوبيا",
    "كينيا","رواندا","جنوب السودان","السودان","تنزانيا","أوغندا",
]

ARAB_KEY = re.compile(
    r"(arab.*(?:world|countries|states)|(?:world|countries).*arab|"
    r"الوطن.?العربي|الدول.?العربية)",
    re.I,
)

NILE_KEY = re.compile(
    r"(nile.*(?:basin|countries|states)|(?:basin|countries).*nile|"
    r"حوض.?النيل|دول.?حوض.?النيل)",
    re.I,
)

ARABIC = re.compile(r"[\u0600-\u06ff]")

STRING_ARRAY = re.compile(
    r"(?P<prefix>(?:(?:const|let|var)\s+)?"
    r"(?P<key>[A-Za-z_$\u0600-\u06ff][\w$\u0600-\u06ff-]*)"
    r"\s*(?:=|:)\s*)"
    r"\[(?P<body>\s*(?:['\"][^'\"]+['\"]\s*,?\s*)+)\]",
    re.S,
)

def preferred(values, en, ar):
    score = sum(bool(ARABIC.search(v)) for v in values)
    return ar if score > len(values) / 2 else en

def complete(values, target):
    out = []
    seen = set()
    for value in values:
        if value not in seen:
            seen.add(value)
            out.append(value)
    for value in target:
        if value not in seen:
            seen.add(value)
            out.append(value)
    return out

def patch_json_value(value, key_hint=""):
    changed = False

    if isinstance(value, dict):
        for key in list(value):
            new_value, child_changed = patch_json_value(
                value[key],
                f"{key_hint} {key}",
            )
            value[key] = new_value
            changed = changed or child_changed
        return value, changed

    if isinstance(value, list):
        if value and all(isinstance(item, str) for item in value):
            if ARAB_KEY.search(key_hint):
                target = preferred(value, ARAB_EN, ARAB_AR)
                new = complete(value, target)
                return new, new != value
            if NILE_KEY.search(key_hint):
                target = preferred(value, NILE_EN, NILE_AR)
                new = complete(value, target)
                return new, new != value

        new_items = []
        for item in value:
            new_item, child_changed = patch_json_value(item, key_hint)
            new_items.append(new_item)
            changed = changed or child_changed
        return new_items, changed

    return value, False

def patch_json(path):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return False

    data, changed = patch_json_value(data)

    if changed:
        path.write_text(
            json.dumps(
                data,
                ensure_ascii=False,
                indent=2,
            ) + "\n",
            encoding="utf-8",
        )

    return changed

def parse_strings(body):
    return re.findall(r"['\"]([^'\"]+)['\"]", body)

def patch_js_text(text):
    changed = False

    def repl(match):
        nonlocal changed

        key = match.group("key")
        values = parse_strings(match.group("body"))

        if not values:
            return match.group(0)

        if ARAB_KEY.search(key):
            target = preferred(values, ARAB_EN, ARAB_AR)
        elif NILE_KEY.search(key):
            target = preferred(values, NILE_EN, NILE_AR)
        else:
            return match.group(0)

        new_values = complete(values, target)

        if new_values == values:
            return match.group(0)

        changed = True
        quote = '"'
        body = ",\n  ".join(
            json.dumps(v, ensure_ascii=False)
            for v in new_values
        )

        return (
            match.group("prefix")
            + "[\n  "
            + body
            + "\n]"
        )

    return STRING_ARRAY.sub(repl, text), changed

def patch_js(path):
    text = path.read_text(encoding="utf-8", errors="ignore")
    updated, changed = patch_js_text(text)

    if changed:
        path.write_text(updated, encoding="utf-8")

    return changed

def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "src")
    patched = []

    for path in root.rglob("*"):
        if not path.is_file():
            continue

        if path.name.startswith("r20Geography"):
            continue

        suffix = path.suffix.lower()

        try:
            if suffix in {".json", ".geojson"}:
                changed = patch_json(path)
            elif suffix in {".js", ".jsx", ".ts", ".tsx"}:
                changed = patch_js(path)
            else:
                changed = False
        except Exception:
            changed = False

        if changed:
            patched.append(str(path))

    report = Path("/tmp/r20-fix14-geography-patched.txt")
    report.write_text(
        "\n".join(patched) + ("\n" if patched else ""),
        encoding="utf-8",
    )

    print(f"R20 geography source arrays patched: {len(patched)}")
    for path in patched:
        print(path)

if __name__ == "__main__":
    main()
