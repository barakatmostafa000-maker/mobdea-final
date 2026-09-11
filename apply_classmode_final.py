from pathlib import Path
from datetime import datetime
import re, shutil, subprocess, sys

ROOT = Path("/workspaces/mobdea-r20-test")
CLASSMODE = ROOT / "src/pages/ClassMode.jsx"
MAIN = ROOT / "src/main.jsx"
CSS = ROOT / "src/styles/user-classmode-final.css"
MARK = "MOBDEA_CLASSMODE_FINAL_20260911"

def fail(msg):
    print("ERROR:", msg)
    sys.exit(1)

if not CLASSMODE.exists() or not MAIN.exists():
    fail("R20 test project not found")

src = CLASSMODE.read_text(encoding="utf-8")
main = MAIN.read_text(encoding="utf-8")

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = ROOT / ".mobdea-backups" / ("classmode-final-" + stamp)
backup.mkdir(parents=True, exist_ok=True)
for p in (CLASSMODE, MAIN, CSS):
    if p.exists():
        shutil.copy2(p, backup / p.name)
print("BACKUP:", backup)

# Locate real R20 regions without deleting any ClassModeViewport wrapper.
footer_open = src.find("<ClassModeViewport.Footer")
footer_close = src.find("</ClassModeViewport.Footer>", footer_open)
if footer_open < 0 or footer_close < 0:
    fail("ClassModeViewport.Footer not found")
footer_close += len("</ClassModeViewport.Footer>")
footer = src[footer_open:footer_close]

if "onClick={saveBoard}" not in footer:
    fail("saveBoard button not found in footer")
if "setView('students')" not in footer and 'setView("students")' not in footer:
    fail("students button not found in footer")

focus_rx = re.compile(
    r'(<button\b[^>]*className=["\'][^"\']*classmode-stage-focus-toggle[^"\']*["\'][^>]*>)(.*?)(</button>)',
    re.S
)
focus = focus_rx.search(src)
if not focus:
    fail("stage fullscreen button not found")

drawer_pos = src.find('className="classmode-student-drawer"')
if drawer_pos < 0:
    fail("student drawer not found")
header_start = src.find("<header>", drawer_pos)
header_end = src.find("</header>", header_start)
if header_start < 0 or header_end < 0:
    fail("student drawer header not found")
header_end += len("</header>")

if MARK not in src:
    # Fullscreen: keep existing button/action, only make its content an arrow.
    new_focus = focus.group(1) + '<ArrowUpRight size={23} />' + focus.group(3)
    src = src[:focus.start()] + new_focus + src[focus.end():]

    # Footer: patch only the two existing buttons, never the footer/container tags.
    footer_open = src.find("<ClassModeViewport.Footer")
    footer_close = src.find("</ClassModeViewport.Footer>", footer_open) + len("</ClassModeViewport.Footer>")
    footer = src[footer_open:footer_close]

    button_rx = re.compile(r'<button\b[^>]*>.*?</button>', re.S)
    buttons = list(button_rx.finditer(footer))

    save_btn = None
    students_btn = None
    for m in buttons:
        block = m.group(0)
        if "onClick={saveBoard}" in block:
            save_btn = m
        if "setView('students')" in block or 'setView("students")' in block:
            students_btn = m

    if save_btn is None:
        fail("save button block not found")
    if students_btn is None:
        fail("students button block not found")

    # Replace from the end so offsets stay valid.
    replacements = []

    sb = save_btn.group(0)
    sb = sb.replace("onClick={saveBoard}", "onClick={saveLessonState}", 1)
    sb = re.sub(r'className="([^"]*)"', lambda m: 'className="' + m.group(1) + ' classmode-quick-save"', sb, count=1)
    sb = re.sub(r'title="[^"]*"', 'title="حفظ الحصة"', sb, count=1)
    sb = re.sub(r'aria-label="[^"]*"', 'aria-label="حفظ الحصة"', sb, count=1)
    sb = re.sub(r'>(.*?)</button>', '><Save size={20} /></button>', sb, count=1, flags=re.S)
    replacements.append((save_btn.start(), save_btn.end(), sb))

    tb = students_btn.group(0)
    tb = re.sub(r'className="([^"]*)"', lambda m: 'className="' + m.group(1) + ' classmode-quick-students"', tb, count=1)
    tb = re.sub(r'>(.*?)</button>', '><Users size={20} /></button>', tb, count=1, flags=re.S)
    replacements.append((students_btn.start(), students_btn.end(), tb))

    for a, b, repl in sorted(replacements, reverse=True):
        footer = footer[:a] + repl + footer[b:]

    src = src[:footer_open] + footer + src[footer_close:]

    # Student drawer: add random button beside existing close button only.
    drawer_pos = src.find('className="classmode-student-drawer"')
    header_start = src.find("<header>", drawer_pos)
    header_end = src.find("</header>", header_start) + len("</header>")
    header = src[header_start:header_end]

    close_rx = re.compile(
        r'<button\b[^>]*className="icon-action"[^>]*onClick=\{\(\)\s*=>\s*setView\(["\']board["\']\)\}[^>]*>.*?</button>',
        re.S
    )
    close = close_rx.search(header)
    if not close:
        fail("drawer close button not found")

    random_btn = (
        '<button className="classmode-random-student-btn" type="button" '
        'onClick={randomStudent} title="اختيار طالب عشوائي" aria-label="اختيار طالب عشوائي">'
        '<Dices size={19} /><span>اختيار عشوائي</span></button>'
    )
    head_actions = '<div className="classmode-student-drawer-head-actions">' + random_btn + close.group(0) + '</div>'
    header = header[:close.start()] + head_actions + header[close.end():]
    src = src[:header_start] + header + src[header_end:]

    # Safe marker in JS declarations.
    anchor = "const statusLabels ="
    if anchor not in src:
        fail("marker anchor not found")
    src = src.replace(anchor, "// " + MARK + "\n" + anchor, 1)

# Sanity: wrappers must still exist and balance.
required = [
    "<ClassModeViewport",
    "<ClassModeViewport.Footer",
    "</ClassModeViewport.Footer>",
    "<ClassModeViewport.Overlays",
    "</ClassModeViewport.Overlays>",
    "classmode-stage-focus-toggle",
    "classmode-quick-save",
    "classmode-quick-students",
    "classmode-random-student-btn",
    MARK,
]
for token in required:
    if token not in src:
        fail("verification failed: " + token)

CLASSMODE.write_text(src, encoding="utf-8")

CSS.write_text('\n/* MOBDEA_CLASSMODE_FINAL_20260911 */\n.classmode-scene.classmode-v103.classmode-final-layout{\n  position:fixed!important; inset:0!important; z-index:8000!important;\n  width:100dvw!important; height:100dvh!important; max-width:none!important;\n  min-width:0!important; min-height:0!important; margin:0!important; padding:0!important;\n  overflow:hidden!important; background:#070b12!important;\n}\n.classmode-v103 .classmode-top-header{\n  height:58px!important; min-height:58px!important; padding:4px 9px!important;\n  display:grid!important; grid-template-columns:minmax(60px,1fr) auto minmax(60px,1fr)!important;\n  align-items:center!important; gap:7px!important; background:#070b12!important;\n  border-bottom:1px solid rgba(221,179,74,.25)!important;\n}\n.classmode-v103 .classmode-header-brand>div,\n.classmode-v103 .classmode-header-meta>:not(.book-icon){display:none!important}\n.classmode-v103 .classmode-header-tabs{\n  justify-self:center!important; display:flex!important; align-items:center!important; gap:5px!important;\n  max-width:calc(100dvw - 150px)!important; padding:4px!important; overflow-x:auto!important;\n  scrollbar-width:none!important; border:1px solid rgba(221,179,74,.28)!important;\n  border-radius:14px!important; background:rgba(11,14,20,.97)!important;\n}\n.classmode-v103 .classmode-header-tabs::-webkit-scrollbar{display:none!important}\n.classmode-v103 .classmode-header-tabs>button{\n  width:56px!important; min-width:56px!important; height:42px!important; min-height:42px!important;\n  padding:0!important; display:grid!important; place-items:center!important; border-radius:10px!important;\n}\n.classmode-v103 .classmode-header-tabs>button span{display:none!important}\n.classmode-v103 .classmode-layout{\n  width:100%!important; height:calc(100dvh - 58px)!important;\n  min-width:0!important; min-height:0!important; margin:0!important; padding:0!important;\n  display:block!important; overflow:hidden!important;\n}\n.classmode-v103 .classmode-layout>aside,\n.classmode-v103 .classmode-side-column{display:none!important}\n.classmode-v103 .classmode-board-panel{\n  position:relative!important; width:100%!important; height:100%!important; max-width:none!important;\n  min-width:0!important; min-height:0!important; display:flex!important; flex-direction:column!important;\n  overflow:hidden!important;\n}\n.classmode-v103 .classmode-board-topbar,\n.classmode-v103 .classmode-resource-card,\n.classmode-v103 .classmode-session-plan,\n.classmode-v103 .classmode-media-navigator{display:none!important}\n.classmode-v103 .classmode-board-frame{\n  flex:1 1 auto!important; width:100%!important; height:100%!important;\n  min-width:0!important; min-height:0!important; margin:0!important; padding:0!important;\n  border-radius:0!important; overflow:hidden!important;\n}\n.classmode-v103 .classmode-board-surface,\n.classmode-v103 .classmode-board-stage{\n  width:100%!important; height:100%!important; min-width:0!important; min-height:0!important;\n  overflow:hidden!important;\n}\n.classmode-v103 button[title="ملء الشاشة"]:not(.classmode-stage-focus-toggle){display:none!important}\n.classmode-v103 .classmode-stage-focus-toggle{\n  position:absolute!important; top:8px!important; right:8px!important; z-index:650!important;\n  width:42px!important; height:42px!important; min-width:42px!important; min-height:42px!important;\n  padding:0!important; display:grid!important; place-items:center!important;\n  border:1px solid rgba(229,190,92,.72)!important; border-radius:12px!important;\n  background:rgba(7,10,16,.86)!important; color:#efc76e!important;\n}\n.classmode-v103 .classmode-stage-focus-toggle span{display:none!important}\n\n.classmode-v103 .classmode-bottom-actions{\n  position:fixed!important; right:12px!important; bottom:10px!important; left:auto!important; top:auto!important;\n  z-index:8500!important; width:auto!important; min-width:0!important; height:auto!important; min-height:0!important;\n  padding:5px!important; display:flex!important; align-items:center!important; gap:6px!important;\n  border:1px solid rgba(222,181,78,.5)!important; border-radius:15px!important;\n  background:rgba(5,8,14,.9)!important; transform:none!important;\n}\n.classmode-v103 .classmode-bottom-actions>.classmode-exit-btn,\n.classmode-v103 .classmode-bottom-actions>.classmode-end-btn{display:none!important}\n.classmode-v103 .classmode-bottom-actions-mid{\n  display:flex!important; align-items:center!important; gap:6px!important; min-width:0!important;\n}\n.classmode-v103 .classmode-bottom-actions-mid>*{display:none!important}\n.classmode-v103 .classmode-bottom-actions-mid>.classmode-quick-save,\n.classmode-v103 .classmode-bottom-actions-mid>.classmode-quick-students{\n  display:grid!important; place-items:center!important;\n  width:48px!important; height:48px!important; min-width:48px!important; min-height:48px!important;\n  padding:0!important; border:1px solid rgba(225,185,84,.56)!important; border-radius:12px!important;\n  background:#0c1018!important; color:#efc970!important;\n}\n.classmode-v103 .classmode-quick-save .action-label,\n.classmode-v103 .classmode-quick-students .action-label{display:none!important}\n\n.classmode-v103 .classmode-student-drawer-backdrop{\n  position:fixed!important; inset:0!important; z-index:9000!important; display:grid!important;\n  place-items:center!important; padding:2dvh 2dvw!important; background:rgba(2,5,10,.76)!important;\n}\n.classmode-v103 .classmode-student-drawer{\n  width:min(1240px,96dvw)!important; height:min(780px,95dvh)!important;\n  max-width:none!important; max-height:none!important; padding:10px!important;\n  display:grid!important; grid-template-rows:auto minmax(0,1fr) auto!important; gap:8px!important;\n  overflow:hidden!important; border:1px solid rgba(222,181,78,.5)!important;\n  border-radius:20px!important; background:linear-gradient(155deg,#0b111a,#060910)!important;\n}\n.classmode-v103 .classmode-student-drawer>header{\n  display:flex!important; align-items:center!important; justify-content:space-between!important;\n  gap:8px!important; min-height:50px!important; padding:3px 4px 8px!important;\n}\n.classmode-v103 .classmode-student-drawer-head-actions{\n  display:flex!important; align-items:center!important; gap:7px!important;\n}\n.classmode-v103 .classmode-random-student-btn{\n  height:40px!important; padding:0 12px!important; display:inline-flex!important; align-items:center!important;\n  gap:7px!important; border:1px solid rgba(227,187,86,.56)!important; border-radius:11px!important;\n  background:rgba(212,164,40,.12)!important; color:#efc86f!important; font-weight:800!important;\n}\n.classmode-v103 .classmode-student-drawer-list{\n  min-width:0!important; min-height:0!important; height:100%!important; padding:1px!important;\n  display:grid!important; grid-template-columns:repeat(2,minmax(0,1fr))!important;\n  grid-auto-rows:minmax(0,1fr)!important; gap:6px 9px!important; overflow:hidden!important;\n}\n.classmode-v103 .classmode-student-drawer-row{\n  min-width:0!important; min-height:0!important; height:100%!important; padding:5px 8px!important;\n  overflow:hidden!important;\n}\n.classmode-v103 .classmode-resource-preview,\n.classmode-v103 .classmode-map-embed,\n.classmode-v103 .resource-preview-body{\n  width:100%!important; height:100%!important; min-width:0!important; min-height:0!important;\n  max-width:100%!important; max-height:100%!important;\n}\n', encoding="utf-8")

css_import = "import './styles/user-classmode-final.css';"
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
    text=True
)
print(result.stdout[-7000:])

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

print("CLASSMODE_FINAL_OK")
print("BUILD_OK")
