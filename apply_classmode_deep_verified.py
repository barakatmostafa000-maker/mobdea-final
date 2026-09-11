from pathlib import Path
from datetime import datetime
import re
import shutil
import subprocess
import sys

ROOT = Path("/workspaces/mobdea-r20-test")
JSX = ROOT / "src/pages/ClassMode.jsx"
MAIN = ROOT / "src/main.jsx"
FINAL_CSS = ROOT / "src/styles/user-classmode-final-verified.css"
MARKER = "MOBDEA_CLASSMODE_DEEP_VERIFIED_20260911"

CSS_TEXT = r"""
/* MOBDEA_CLASSMODE_DEEP_VERIFIED_20260911 */

/* وضع الحصة يملأ مساحة التطبيق */
.classmode-scene.classmode-v103.classmode-final-layout {
  position: fixed !important;
  inset: 0 !important;
  z-index: 8000 !important;
  width: 100dvw !important;
  height: 100dvh !important;
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: none !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  background: #070b12 !important;
}

/* شريط المحتوى العلوي مضغوط، من غير ما نخفي أدوات السبورة نفسها */
.classmode-v103 .classmode-top-header {
  height: 58px !important;
  min-height: 58px !important;
  padding: 4px 9px !important;
  display: grid !important;
  grid-template-columns: minmax(60px, 1fr) auto minmax(60px, 1fr) !important;
  align-items: center !important;
  gap: 7px !important;
  background: #070b12 !important;
  border-bottom: 1px solid rgba(221,179,74,.25) !important;
}

.classmode-v103 .classmode-header-brand > div,
.classmode-v103 .classmode-header-meta > :not(.book-icon) {
  display: none !important;
}

.classmode-v103 .classmode-header-tabs {
  justify-self: center !important;
  display: flex !important;
  align-items: center !important;
  gap: 5px !important;
  max-width: calc(100dvw - 150px) !important;
  padding: 4px !important;
  overflow-x: auto !important;
  scrollbar-width: none !important;
  border: 1px solid rgba(221,179,74,.28) !important;
  border-radius: 14px !important;
  background: rgba(11,14,20,.97) !important;
}

.classmode-v103 .classmode-header-tabs::-webkit-scrollbar {
  display: none !important;
}

.classmode-v103 .classmode-header-tabs > button {
  width: 56px !important;
  min-width: 56px !important;
  height: 42px !important;
  min-height: 42px !important;
  padding: 0 !important;
  display: grid !important;
  place-items: center !important;
  border-radius: 10px !important;
}

.classmode-v103 .classmode-header-tabs > button span {
  display: none !important;
}

/* استغلال باقي الشاشة للمحتوى */
.classmode-v103 .classmode-layout {
  width: 100% !important;
  height: calc(100dvh - 58px) !important;
  min-width: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}

.classmode-v103 .classmode-side-column {
  display: none !important;
}

.classmode-v103 .classmode-board-panel {
  position: relative !important;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  min-width: 0 !important;
  min-height: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}

/* مهم: لا نخفي classmode-board-topbar حتى لا تختفي أدوات السبورة */
.classmode-v103 .classmode-board-frame {
  flex: 1 1 auto !important;
  width: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}

.classmode-v103 .classmode-board-surface,
.classmode-v103 .classmode-board-stage {
  width: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
}

/* زر ملء الشاشة الموجود أصلًا: سهم فقط أعلى اليمين */
.classmode-v103 button[title="ملء الشاشة"]:not(.classmode-stage-focus-toggle) {
  display: none !important;
}

.classmode-v103 .classmode-stage-focus-toggle {
  position: absolute !important;
  top: 8px !important;
  right: 8px !important;
  left: auto !important;
  bottom: auto !important;
  z-index: 650 !important;
  width: 42px !important;
  height: 42px !important;
  min-width: 42px !important;
  min-height: 42px !important;
  padding: 0 !important;
  display: grid !important;
  place-items: center !important;
  border: 1px solid rgba(229,190,92,.72) !important;
  border-radius: 12px !important;
  background: rgba(7,10,16,.86) !important;
  color: #efc76e !important;
}

.classmode-v103 .classmode-stage-focus-toggle span {
  display: none !important;
}

/* شريط الأسفل: نخفي الأزرار الوسطية الزائدة فقط،
   ونُبقي الخروج/إنهاء الحصة حتى لا نفقد طريقة الخروج من وضع الحصة */
.classmode-v103 .classmode-bottom-actions {
  position: fixed !important;
  right: 12px !important;
  bottom: 10px !important;
  left: auto !important;
  top: auto !important;
  z-index: 8500 !important;
  width: auto !important;
  min-width: 0 !important;
  min-height: 0 !important;
  padding: 5px !important;
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  border: 1px solid rgba(222,181,78,.5) !important;
  border-radius: 15px !important;
  background: rgba(5,8,14,.9) !important;
  transform: none !important;
}

.classmode-v103 .classmode-bottom-actions-mid {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  min-width: 0 !important;
}

.classmode-v103 .classmode-bottom-actions-mid > * {
  display: none !important;
}

.classmode-v103 .classmode-bottom-actions-mid > .classmode-quick-save,
.classmode-v103 .classmode-bottom-actions-mid > .classmode-quick-students {
  display: grid !important;
  place-items: center !important;
  width: 48px !important;
  height: 48px !important;
  min-width: 48px !important;
  min-height: 48px !important;
  padding: 0 !important;
  border: 1px solid rgba(225,185,84,.56) !important;
  border-radius: 12px !important;
  background: #0c1018 !important;
  color: #efc970 !important;
}

.classmode-v103 .classmode-exit-btn {
  width: 42px !important;
  height: 42px !important;
  min-width: 42px !important;
  padding: 0 !important;
}

.classmode-v103 .classmode-exit-btn .action-label {
  display: none !important;
}

.classmode-v103 .classmode-end-btn {
  min-height: 42px !important;
}

/* إدارة الطلاب */
.classmode-v103 .classmode-student-drawer-backdrop {
  position: fixed !important;
  inset: 0 !important;
  z-index: 9000 !important;
  display: grid !important;
  place-items: center !important;
  padding: 2dvh 2dvw !important;
  background: rgba(2,5,10,.76) !important;
}

.classmode-v103 .classmode-student-drawer {
  width: min(1240px,96dvw) !important;
  height: min(780px,95dvh) !important;
  max-width: none !important;
  max-height: none !important;
  padding: 10px !important;
  display: grid !important;
  grid-template-rows: auto minmax(0,1fr) auto !important;
  gap: 8px !important;
  overflow: hidden !important;
  border: 1px solid rgba(222,181,78,.5) !important;
  border-radius: 20px !important;
  background: linear-gradient(155deg,#0b111a,#060910) !important;
}

.classmode-v103 .classmode-student-drawer > header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 8px !important;
  min-height: 50px !important;
  padding: 3px 4px 8px !important;
}

.classmode-v103 .classmode-random-student-btn {
  height: 40px !important;
  padding: 0 12px !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 7px !important;
  border: 1px solid rgba(227,187,86,.56) !important;
  border-radius: 11px !important;
  background: rgba(212,164,40,.12) !important;
  color: #efc86f !important;
  font-weight: 800 !important;
}

/* 10 => 5+5 ، 12 => 6+6 ، 14 => 7+7 */
.classmode-v103 .classmode-student-drawer-list {
  min-width: 0 !important;
  min-height: 0 !important;
  height: 100% !important;
  padding: 1px !important;
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0,1fr)) !important;
  grid-auto-flow: row !important;
  grid-auto-rows: minmax(0,1fr) !important;
  gap: 6px 9px !important;
  overflow: hidden !important;
}

.classmode-v103 .classmode-student-drawer-row {
  min-width: 0 !important;
  min-height: 0 !important;
  height: 100% !important;
  padding: 5px 8px !important;
  overflow: hidden !important;
}

/* PDF / الخرائط / السبورة تملأ المساحة المتاحة */
.classmode-v103 .classmode-resource-preview,
.classmode-v103 .classmode-map-embed,
.classmode-v103 .resource-preview-body {
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: 100% !important;
  max-height: 100% !important;
}
"""


def enclosing_button(text, token_pos, lower_bound=0, upper_bound=None):
    if upper_bound is None:
        upper_bound = len(text)
    start = text.rfind("<button", lower_bound, token_pos)
    end = text.find("</button>", token_pos, upper_bound)
    if start < 0 or end < 0:
        raise ValueError("تعذر تحديد حدود الزر")
    return start, end + len("</button>")


def patch_jsx(src):
    original = src

    required_import_tokens = ("Save,", "Users,", "Dices,", "ArrowUpRight,")
    for token in required_import_tokens:
        if token not in src[:2500]:
            raise ValueError(f"الـ import المطلوب غير موجود: {token}")

    if "const randomStudent" not in src:
        raise ValueError("randomStudent غير موجود")
    if "const saveLessonState" not in src:
        raise ValueError("saveLessonState غير موجود")

    # 1) منطقة الشريط السفلي الحقيقية.
    bottom_class = src.find("classmode-bottom-actions")
    if bottom_class < 0:
        raise ValueError("classmode-bottom-actions غير موجود")
    bottom_start = src.rfind("<div", 0, bottom_class)
    students_condition = src.find("{view === 'students'", bottom_class)
    if bottom_start < 0 or students_condition < 0:
        raise ValueError("تعذر تحديد منطقة الشريط السفلي")

    # زر الحفظ داخل الشريط السفلي فقط.
    bottom_region = src[bottom_start:students_condition]
    if "classmode-quick-save" not in bottom_region:
        save_token = "onClick={saveBoard}"
        save_local = bottom_region.find(save_token)
        if save_local < 0:
            raise ValueError("زر saveBoard غير موجود داخل الشريط السفلي")
        save_pos = bottom_start + save_local
        a, b = enclosing_button(src, save_pos, bottom_start, students_condition)
        save_button = (
            '<button type="button" className="secondary-btn classmode-quick-save" '
            'onClick={saveLessonState} title="حفظ الحصة" aria-label="حفظ الحصة">'
            '<Save size={20} /></button>'
        )
        src = src[:a] + save_button + src[b:]

    # إعادة تحديد المنطقة بعد تغير طول النص.
    bottom_class = src.find("classmode-bottom-actions")
    bottom_start = src.rfind("<div", 0, bottom_class)
    students_condition = src.find("{view === 'students'", bottom_class)
    bottom_region = src[bottom_start:students_condition]

    if "classmode-quick-students" not in bottom_region:
        student_tokens = ("setView('students')", 'setView("students")')
        found = [(tok, bottom_region.find(tok)) for tok in student_tokens]
        found = [(tok, pos) for tok, pos in found if pos >= 0]
        if not found:
            raise ValueError("زر الطلاب غير موجود داخل الشريط السفلي")
        token, local = found[0]
        pos = bottom_start + local
        a, b = enclosing_button(src, pos, bottom_start, students_condition)
        students_button = (
            '<button type="button" className="secondary-btn classmode-quick-students" '
            "onClick={() => setView('students')} title=\"عرض الطلاب\" aria-label=\"عرض الطلاب\">"
            '<Users size={20} /></button>'
        )
        src = src[:a] + students_button + src[b:]

    # 2) زر ملء الشاشة الموجود أصلًا، بدون إضافة/حذف أي Wrapper.
    focus_pos = src.find("classmode-stage-focus-toggle")
    if focus_pos < 0:
        raise ValueError("classmode-stage-focus-toggle غير موجود")
    focus_start = src.rfind("<button", 0, focus_pos)
    focus_open_end = src.find(">", focus_pos)
    focus_end = src.find("</button>", focus_pos)
    if min(focus_start, focus_open_end, focus_end) < 0:
        raise ValueError("تعذر تحديد زر ملء الشاشة")
    focus_body = src[focus_open_end + 1:focus_end]
    if "<ArrowUpRight" not in focus_body:
        if "<Maximize2" not in focus_body:
            raise ValueError("أيقونة Maximize2 غير موجودة داخل زر ملء الشاشة")
        src = src[:focus_open_end + 1] + "<ArrowUpRight size={23} />" + src[focus_end:]

    # 3) زر الاختيار العشوائي داخل Header إدارة الطلاب.
    drawer_pos = src.find('className="classmode-student-drawer"')
    if drawer_pos < 0:
        raise ValueError("classmode-student-drawer غير موجود")
    header_start = src.find("<header", drawer_pos)
    header_open_end = src.find(">", header_start)
    header_end = src.find("</header>", header_open_end)
    if min(header_start, header_open_end, header_end) < 0:
        raise ValueError("تعذر تحديد Header إدارة الطلاب")

    header = src[header_start:header_end]
    if "classmode-random-student-btn" not in header:
        board_tokens = ("setView('board')", 'setView("board")')
        found = [(tok, header.find(tok)) for tok in board_tokens]
        found = [(tok, pos) for tok, pos in found if pos >= 0]
        if not found:
            raise ValueError("زر إغلاق إدارة الطلاب غير موجود داخل الـ Header")
        _, local = found[0]
        close_pos = header_start + local
        a, b = enclosing_button(src, close_pos, header_start, header_end)
        random_button = (
            '<button className="classmode-random-student-btn" type="button" '
            'onClick={randomStudent} title="اختيار طالب عشوائي" aria-label="اختيار طالب عشوائي">'
            '<Dices size={19} /><span>اختيار عشوائي</span></button>\n              '
        )
        src = src[:a] + random_button + src[a:]

    # 4) فحص عدم كسر الهيكل.
    structural_tags = (
        "<section", "</section>",
        "<aside", "</aside>",
        "<header", "</header>",
        "<footer", "</footer>",
        "<div", "</div>",
    )
    for tag in structural_tags:
        if original.count(tag) != src.count(tag):
            raise ValueError(f"تغير غير مسموح في عدد الوسوم: {tag}")

    # المسموح فقط إضافة زر الاختيار العشوائي مرة واحدة.
    before_buttons = original.count("<button")
    after_buttons = src.count("<button")
    expected_delta = 0 if "classmode-random-student-btn" in original else 1
    if after_buttons - before_buttons != expected_delta:
        raise ValueError("عدد الأزرار تغير بصورة غير متوقعة")
    if original.count("</button>") + expected_delta != src.count("</button>"):
        raise ValueError("توازن إغلاق الأزرار غير صحيح")

    for token in (
        "classmode-quick-save",
        "classmode-quick-students",
        "classmode-random-student-btn",
        "classmode-stage-focus-toggle",
        "<ArrowUpRight",
    ):
        if token not in src:
            raise ValueError(f"فحص ما بعد التعديل فشل: {token}")

    return src


def patch_main(main_text):
    # إزالة أي imports تجريبية سابقة تخص محاولاتنا فقط.
    lines = [
        line for line in main_text.splitlines()
        if "styles/user-classmode-" not in line
    ]

    final_import = "import './styles/user-classmode-final-verified.css';"
    if final_import not in lines:
        import_indices = [i for i, line in enumerate(lines) if line.startswith("import ")]
        insert_at = (max(import_indices) + 1) if import_indices else 0
        lines.insert(insert_at, final_import)

    return "\n".join(lines) + "\n"


def rollback(backup, css_existed):
    shutil.copy2(backup / JSX.name, JSX)
    shutil.copy2(backup / MAIN.name, MAIN)
    if css_existed:
        shutil.copy2(backup / FINAL_CSS.name, FINAL_CSS)
    elif FINAL_CSS.exists():
        FINAL_CSS.unlink()


def main():
    if not JSX.exists() or not MAIN.exists():
        print("ERROR: مشروع R20 غير موجود")
        return 1

    vite_bin = ROOT / "node_modules/.bin/vite"
    if not vite_bin.exists():
        print("ERROR: vite غير مثبت داخل mobdea-r20-test")
        return 1

    original_jsx = JSX.read_text(encoding="utf-8")
    original_main = MAIN.read_text(encoding="utf-8")
    css_existed = FINAL_CSS.exists()

    # Preflight كامل في الذاكرة، قبل لمس أي ملف.
    try:
        patched_jsx = patch_jsx(original_jsx)
        patched_main = patch_main(original_main)
    except Exception as exc:
        print("PREFLIGHT_FAILED:", exc)
        print("NOTHING_CHANGED")
        return 1

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = ROOT / ".mobdea-backups" / f"classmode-deep-verified-{stamp}"
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(JSX, backup / JSX.name)
    shutil.copy2(MAIN, backup / MAIN.name)
    if css_existed:
        shutil.copy2(FINAL_CSS, backup / FINAL_CSS.name)

    print("PREFLIGHT_OK")
    print("BACKUP:", backup)

    try:
        JSX.write_text(patched_jsx, encoding="utf-8")
        MAIN.write_text(patched_main, encoding="utf-8")
        FINAL_CSS.write_text(CSS_TEXT, encoding="utf-8")

        # فحص whitespace / patch.
        diff_check = subprocess.run(
            ["git", "diff", "--check", "--",
             "src/pages/ClassMode.jsx",
             "src/main.jsx",
             "src/styles/user-classmode-final-verified.css"],
            cwd=str(ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        if diff_check.returncode != 0:
            raise RuntimeError("git diff --check failed:\n" + diff_check.stdout)

        # نبني مباشرة بـ Vite؛ لا نشغّل sync-version حتى لا نغيّر ملفات إصدار أخرى.
        build = subprocess.run(
            [str(vite_bin), "build"],
            cwd=str(ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        print(build.stdout[-7000:])
        if build.returncode != 0:
            raise RuntimeError("VITE_BUILD_FAILED")

    except Exception as exc:
        print("APPLY_FAILED:", exc)
        rollback(backup, css_existed)
        print("ROLLBACK_OK")
        return 1

    print("CLASSMODE_DEEP_VERIFIED_OK")
    print("VITE_BUILD_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
