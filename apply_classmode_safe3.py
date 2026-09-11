from pathlib import Path
from datetime import datetime
import re
import shutil
import subprocess
import sys

ROOT = Path("/workspaces/mobdea-r20-test")
CLASSMODE = ROOT / "src/pages/ClassMode.jsx"
MAIN = ROOT / "src/main.jsx"
CSS = ROOT / "src/styles/user-classmode-safe3.css"
MARK = "MOBDEA_CLASSMODE_SAFE3_20260911"

def fail(msg):
    print("ERROR:", msg)
    sys.exit(1)

if not CLASSMODE.exists() or not MAIN.exists():
    fail("R20 test project not found")

src = CLASSMODE.read_text(encoding="utf-8")
main = MAIN.read_text(encoding="utf-8")

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = ROOT / ".mobdea-backups" / f"classmode-safe3-{stamp}"
backup.mkdir(parents=True, exist_ok=True)
for p in (CLASSMODE, MAIN, CSS):
    if p.exists():
        shutil.copy2(p, backup / p.name)
print("BACKUP:", backup)

# Locate the existing footer only. We do not remove or replace its wrappers.
bottom_pos = src.find("classmode-bottom-actions")
footer_end = src.find("</ClassModeViewport.Footer>", bottom_pos)
if bottom_pos < 0 or footer_end < 0:
    fail("ClassMode footer region not found")

footer = src[bottom_pos:footer_end]
if "onClick={saveBoard}" not in footer:
    fail("saveBoard button not found inside footer")
if "setView('students')" not in footer and 'setView("students")' not in footer:
    fail("students button not found inside footer")

# Existing stage fullscreen control.
focus_rx = re.compile(
    r'(<button\b[^>]*className=["\'][^"\']*classmode-stage-focus-toggle[^"\']*["\'][^>]*>)(.*?)(</button>)',
    re.S,
)
focus = focus_rx.search(src)
if not focus:
    fail("stage fullscreen control not found")

# Existing student drawer header.
drawer_pos = src.find("classmode-student-drawer")
if drawer_pos < 0:
    fail("student drawer not found")
header_start = src.find("<header>", drawer_pos)
header_end = src.find("</header>", header_start)
if header_start < 0 or header_end < 0:
    fail("student drawer header not found")
header_end += len("</header>")

if MARK not in src:
    # 1) Change only the icon INSIDE the existing fullscreen button.
    body = focus.group(2)
    body2, n = re.subn(r"<Maximize2\b[^>]*/>", "<ArrowUpRight size={23} />", body, count=1, flags=re.S)
    if n != 1:
        fail("Maximize2 icon not found inside stage fullscreen control")
    new_focus = focus.group(1) + body2 + focus.group(3)
    src = src[:focus.start()] + new_focus + src[focus.end():]

    # Re-locate footer after earlier edit.
    bottom_pos = src.find("classmode-bottom-actions")
    footer_end = src.find("</ClassModeViewport.Footer>", bottom_pos)
    footer = src[bottom_pos:footer_end]

    # 2) Reuse existing screenshot button as SAVE.
    footer2 = footer.replace("onClick={saveBoard}", "onClick={saveLessonState}", 1)
    # Change the title/aria only in that same button vicinity.
    save_idx = footer2.find("onClick={saveLessonState}")
    button_start = footer2.rfind("<button", 0, save_idx)
    button_end = footer2.find("</button>", save_idx)
    if button_start < 0 or button_end < 0:
        fail("save button boundaries not found")
    button_end += len("</button>")
    button = footer2[button_start:button_end]
    button = re.sub(r'title=["\'][^"\']*["\']', 'title="حفظ الحصة"', button, count=1)
    if "aria-label=" in button:
        button = re.sub(r'aria-label=["\'][^"\']*["\']', 'aria-label="حفظ الحصة"', button, count=1)
    button = re.sub(r"<Camera\b[^>]*/>", "<Save size={20} />", button, count=1)
    footer2 = footer2[:button_start] + button + footer2[button_end:]
    src = src[:bottom_pos] + footer2 + src[footer_end:]

    # 3) Insert ONE sibling random button into existing drawer header.
    drawer_pos = src.find("classmode-student-drawer")
    header_start = src.find("<header>", drawer_pos)
    header_end = src.find("</header>", header_start) + len("</header>")
    header = src[header_start:header_end]
    if "classmode-random-student-btn" not in header:
        close_pos = header.rfind("<button")
        if close_pos < 0:
            fail("close button not found in drawer header")
        random_btn = (
            '<button className="classmode-random-student-btn" type="button" '
            'onClick={randomStudent} title="اختيار طالب عشوائي" aria-label="اختيار طالب عشوائي">'
            '<Dices size={19} /><span>اختيار عشوائي</span></button>'
        )
        header = header[:close_pos] + random_btn + header[close_pos:]
        src = src[:header_start] + header + src[header_end:]

    # Marker comment in safe JS area.
    anchor = "const statusLabels ="
    if anchor not in src:
        fail("safe marker anchor not found")
    src = src.replace(anchor, "// " + MARK + "\n" + anchor, 1)

# Verify we have not removed viewport wrappers.
for token in (
    "<ClassModeViewport",
    "</ClassModeViewport.Footer>",
    "</ClassModeViewport.Overlays>",
    "classmode-stage-focus-toggle",
    "classmode-random-student-btn",
    MARK,
):
    if token not in src:
        fail("verification failed: " + token)

CLASSMODE.write_text(src, encoding="utf-8")

CSS_TEXT = '/* MOBDEA_CLASSMODE_SAFE3_20260911 */\n\n.classmode-scene.classmode-v103.classmode-final-layout{\n  position:fixed!important;inset:0!important;z-index:8000!important;\n  width:100dvw!important;height:100dvh!important;max-width:none!important;\n  min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;\n  overflow:hidden!important;background:#070b12!important;\n}\n.classmode-v103 .classmode-top-header{\n  height:58px!important;min-height:58px!important;padding:4px 9px!important;\n  display:grid!important;grid-template-columns:minmax(60px,1fr) auto minmax(60px,1fr)!important;\n  align-items:center!important;gap:7px!important;background:#070b12!important;\n  border-bottom:1px solid rgba(221,179,74,.25)!important;\n}\n.classmode-v103 .classmode-header-brand>div,\n.classmode-v103 .classmode-header-meta>:not(.book-icon){display:none!important}\n.classmode-v103 .classmode-header-tabs{\n  justify-self:center!important;display:flex!important;align-items:center!important;gap:5px!important;\n  max-width:calc(100dvw - 150px)!important;padding:4px!important;overflow-x:auto!important;\n  scrollbar-width:none!important;border:1px solid rgba(221,179,74,.28)!important;\n  border-radius:14px!important;background:rgba(11,14,20,.97)!important;\n}\n.classmode-v103 .classmode-header-tabs::-webkit-scrollbar{display:none!important}\n.classmode-v103 .classmode-header-tabs>button{\n  width:56px!important;min-width:56px!important;height:42px!important;min-height:42px!important;\n  padding:0!important;display:grid!important;place-items:center!important;border-radius:10px!important;\n}\n.classmode-v103 .classmode-header-tabs>button span{display:none!important}\n\n.classmode-v103 .classmode-layout{\n  width:100%!important;height:calc(100dvh - 58px)!important;min-width:0!important;min-height:0!important;\n  margin:0!important;padding:0!important;display:block!important;overflow:hidden!important;\n}\n.classmode-v103 .classmode-layout>aside{display:none!important}\n.classmode-v103 .classmode-board-panel{\n  position:relative!important;width:100%!important;height:100%!important;max-width:none!important;\n  min-width:0!important;min-height:0!important;display:flex!important;flex-direction:column!important;\n  overflow:hidden!important;\n}\n.classmode-v103 .classmode-board-topbar{display:none!important}\n.classmode-v103 .classmode-board-frame{\n  flex:1 1 auto!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;\n  margin:0!important;padding:0!important;border-radius:0!important;overflow:hidden!important;\n}\n.classmode-v103 .classmode-board-surface,\n.classmode-v103 .classmode-board-stage{\n  width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;overflow:hidden!important;\n}\n\n/* Fullscreen: use the EXISTING stage control; no new JSX container */\n.classmode-v103 button[title="ملء الشاشة"]:not(.classmode-stage-focus-toggle){display:none!important}\n.classmode-v103 .classmode-stage-focus-toggle{\n  position:absolute!important;top:8px!important;right:8px!important;z-index:650!important;\n  width:42px!important;height:42px!important;min-width:42px!important;min-height:42px!important;\n  padding:0!important;display:grid!important;place-items:center!important;\n  border:1px solid rgba(229,190,92,.72)!important;border-radius:12px!important;\n  background:rgba(7,10,16,.86)!important;color:#efc76e!important;\n}\n.classmode-v103 .classmode-stage-focus-toggle span{display:none!important}\n\n/* Footer DOM stays untouched. Only two existing buttons are visible. */\n.classmode-v103 .classmode-bottom-actions{\n  position:fixed!important;right:12px!important;bottom:10px!important;left:auto!important;top:auto!important;\n  z-index:8500!important;width:auto!important;min-width:0!important;height:auto!important;min-height:0!important;\n  padding:5px!important;display:flex!important;align-items:center!important;gap:6px!important;\n  border:1px solid rgba(222,181,78,.5)!important;border-radius:15px!important;\n  background:rgba(5,8,14,.9)!important;transform:none!important;\n}\n.classmode-v103 .classmode-bottom-actions>.classmode-exit-btn,\n.classmode-v103 .classmode-bottom-actions>.classmode-end-btn{display:none!important}\n.classmode-v103 .classmode-bottom-actions-mid{\n  display:flex!important;align-items:center!important;gap:6px!important;min-width:0!important;\n}\n.classmode-v103 .classmode-bottom-actions-mid>*{display:none!important}\n.classmode-v103 .classmode-bottom-actions-mid>button[title="حفظ الحصة"],\n.classmode-v103 .classmode-bottom-actions-mid>button[title="عرض الطلاب"]{\n  display:grid!important;place-items:center!important;width:48px!important;height:48px!important;\n  min-width:48px!important;min-height:48px!important;padding:0!important;\n  border:1px solid rgba(225,185,84,.56)!important;border-radius:12px!important;\n  background:#0c1018!important;color:#efc970!important;\n}\n.classmode-v103 .classmode-bottom-actions-mid>button[title="حفظ الحصة"] .action-label,\n.classmode-v103 .classmode-bottom-actions-mid>button[title="عرض الطلاب"] .action-label{display:none!important}\n\n/* Students */\n.classmode-v103 .classmode-student-drawer-backdrop{\n  position:fixed!important;inset:0!important;z-index:9000!important;display:grid!important;place-items:center!important;\n  padding:2dvh 2dvw!important;background:rgba(2,5,10,.76)!important;\n}\n.classmode-v103 .classmode-student-drawer{\n  width:min(1240px,96dvw)!important;height:min(780px,95dvh)!important;max-width:none!important;max-height:none!important;\n  padding:10px!important;display:grid!important;grid-template-rows:auto minmax(0,1fr) auto!important;\n  gap:8px!important;overflow:hidden!important;border:1px solid rgba(222,181,78,.5)!important;\n  border-radius:20px!important;background:linear-gradient(155deg,#0b111a,#060910)!important;\n}\n.classmode-v103 .classmode-student-drawer>header{\n  display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;\n  min-height:50px!important;padding:3px 4px 8px!important;\n}\n.classmode-v103 .classmode-random-student-btn{\n  height:40px!important;padding:0 12px!important;display:inline-flex!important;align-items:center!important;gap:7px!important;\n  border:1px solid rgba(227,187,86,.56)!important;border-radius:11px!important;\n  background:rgba(212,164,40,.12)!important;color:#efc86f!important;font-weight:800!important;\n}\n.classmode-v103 .classmode-student-drawer-list{\n  min-width:0!important;min-height:0!important;height:100%!important;padding:1px!important;\n  display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;\n  grid-auto-flow:row!important;grid-auto-rows:minmax(0,1fr)!important;gap:6px 9px!important;overflow:hidden!important;\n}\n.classmode-v103 .classmode-student-drawer-row{\n  min-width:0!important;min-height:0!important;height:100%!important;padding:5px 8px!important;overflow:hidden!important;\n}\n\n/* PDF / map / board occupy the stage */\n.classmode-v103 .classmode-resource-preview,\n.classmode-v103 .classmode-map-embed,\n.classmode-v103 .resource-preview-body{\n  width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;\n  max-width:100%!important;max-height:100%!important;\n}\n'
CSS.write_text(CSS_TEXT, encoding="utf-8")

css_import = "import './styles/user-classmode-safe3.css';"
if css_import not in main:
    lines = main.splitlines()
    imports = [i for i, line in enumerate(lines) if line.startswith("import ")]
    insert_at = max(imports) + 1 if imports else 0
    lines.insert(insert_at, css_import)
    main = "\n".join(lines) + "\n"
MAIN.write_text(main, encoding="utf-8")

print("PATCH_WRITTEN")
print("RUNNING_BUILD")

result = subprocess.run(
    ["npm", "run", "build"],
    cwd=str(ROOT),
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
)
print(result.stdout[-8000:])

if result.returncode != 0:
    print("BUILD_FAILED -> RESTORING")
    shutil.copy2(backup / CLASSMODE.name, CLASSMODE)
    shutil.copy2(backup / MAIN.name, MAIN)
    backup_css = backup / CSS.name
    if backup_css.exists():
        shutil.copy2(backup_css, CSS)
    elif CSS.exists():
        CSS.unlink()
    print("ROLLBACK_OK")
    sys.exit(result.returncode)

print("CLASSMODE_SAFE3_OK")
print("BUILD_OK")
