from pathlib import Path
from datetime import datetime
import re, shutil, subprocess, sys

ROOT = Path("/workspaces/mobdea-r20-test")
CLASSMODE = ROOT / "src/pages/ClassMode.jsx"
MAIN = ROOT / "src/main.jsx"
CSS = ROOT / "src/styles/user-classmode-fixed.css"
MARK = "MOBDEA_CLASSMODE_FIXED_20260911"

def fail(msg):
    print("ERROR:", msg)
    sys.exit(1)

if not CLASSMODE.exists() or not MAIN.exists():
    fail("R20 test project not found")

src = CLASSMODE.read_text(encoding="utf-8")
main = MAIN.read_text(encoding="utf-8")

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = ROOT / ".mobdea-backups" / ("classmode-fixed-" + stamp)
backup.mkdir(parents=True, exist_ok=True)
for p in (CLASSMODE, MAIN, CSS):
    if p.exists():
        shutil.copy2(p, backup / p.name)
print("BACKUP:", backup)

# ---- Find the REAL bottom toolbar region, without touching any wrapper tags ----
bottom_class = src.find("classmode-bottom-actions")
if bottom_class < 0:
    fail("bottom actions not found")
bottom_start = src.rfind("<div", 0, bottom_class)
students_cond = src.find("{view === 'students'", bottom_class)
if bottom_start < 0 or students_cond < 0:
    fail("bottom actions region not found")

bar = src[bottom_start:students_cond]

# Find save button INSIDE bottom toolbar. Accept old saveBoard or already-saveLessonState.
save_click = bar.find("onClick={saveBoard}")
if save_click < 0:
    save_click = bar.find("onClick={saveLessonState}")
if save_click < 0:
    fail("save button not found in bottom actions")

save_start = bar.rfind("<button", 0, save_click)
save_end = bar.find("</button>", save_click)
if save_start < 0 or save_end < 0:
    fail("save button boundaries not found")
save_end += len("</button>")

# Find students button INSIDE bottom toolbar.
stud_click = bar.find("setView('students')")
if stud_click < 0:
    stud_click = bar.find('setView("students")')
if stud_click < 0:
    fail("students button not found in bottom actions")
stud_start = bar.rfind("<button", 0, stud_click)
stud_end = bar.find("</button>", stud_click)
if stud_start < 0 or stud_end < 0:
    fail("students button boundaries not found")
stud_end += len("</button>")

if MARK not in src:
    save_button = '<button type="button" className="secondary-btn classmode-quick-save" onClick={saveLessonState} title="حفظ الحصة" aria-label="حفظ الحصة"><Save size={20} /></button>'
    students_button = '<button type="button" className="secondary-btn classmode-quick-students" onClick={() => setView(\'students\')} title="عرض الطلاب" aria-label="عرض الطلاب"><Users size={20} /></button>'

    # Replace later button first so offsets remain correct.
    repls = [(save_start, save_end, save_button), (stud_start, stud_end, students_button)]
    for a, b, repl in sorted(repls, reverse=True):
        bar = bar[:a] + repl + bar[b:]
    src = src[:bottom_start] + bar + src[students_cond:]

    # ---- Existing stage fullscreen button: keep handler, change CONTENT only ----
    focus_pos = src.find("classmode-stage-focus-toggle")
    if focus_pos < 0:
        fail("stage fullscreen button not found")
    focus_start = src.rfind("<button", 0, focus_pos)
    focus_open_end = src.find(">", focus_pos)
    focus_end = src.find("</button>", focus_pos)
    if focus_start < 0 or focus_open_end < 0 or focus_end < 0:
        fail("fullscreen button boundaries not found")
    opening = src[focus_start:focus_open_end + 1]
    src = src[:focus_start] + opening + '<ArrowUpRight size={23} />' + src[focus_end:]

    # ---- Add random button beside existing close button in drawer header ----
    drawer_pos = src.find('className="classmode-student-drawer"')
    if drawer_pos < 0:
        fail("student drawer not found")
    header_start = src.find("<header>", drawer_pos)
    header_end = src.find("</header>", header_start)
    if header_start < 0 or header_end < 0:
        fail("student drawer header not found")
    header_end += len("</header>")
    header = src[header_start:header_end]

    board_click = header.find("setView('board')")
    if board_click < 0:
        board_click = header.find('setView("board")')
    if board_click < 0:
        fail("drawer close button not found")
    close_start = header.rfind("<button", 0, board_click)
    close_end = header.find("</button>", board_click)
    if close_start < 0 or close_end < 0:
        fail("drawer close button boundaries not found")
    close_end += len("</button>")
    close_button = header[close_start:close_end]

    random_button = '<button className="classmode-random-student-btn" type="button" onClick={randomStudent} title="اختيار طالب عشوائي" aria-label="اختيار طالب عشوائي"><Dices size={19} /><span>اختيار عشوائي</span></button>'
    head_actions = '<div className="classmode-student-drawer-head-actions">' + random_button + close_button + '</div>'
    header = header[:close_start] + head_actions + header[close_end:]
    src = src[:header_start] + header + src[header_end:]

    # Safe marker in declarations; no JSX hierarchy changes.
    anchor = "const statusLabels ="
    if anchor not in src:
        fail("marker anchor not found")
    src = src.replace(anchor, "// " + MARK + "\n" + anchor, 1)

# Final checks.
for token in (
    MARK,
    "classmode-quick-save",
    "classmode-quick-students",
    "classmode-random-student-btn",
    "classmode-stage-focus-toggle",
):
    if token not in src:
        fail("verification failed: " + token)

CLASSMODE.write_text(src, encoding="utf-8")

CSS_TEXT = '/* MOBDEA_CLASSMODE_FIXED_20260911 */\n\n.classmode-scene.classmode-v103.classmode-final-layout{\n  position:fixed!important;inset:0!important;z-index:8000!important;\n  width:100dvw!important;height:100dvh!important;min-width:0!important;min-height:0!important;\n  max-width:none!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#070b12!important;\n}\n.classmode-v103 .classmode-top-header{\n  height:58px!important;min-height:58px!important;padding:4px 9px!important;\n  display:grid!important;grid-template-columns:minmax(60px,1fr) auto minmax(60px,1fr)!important;\n  align-items:center!important;gap:7px!important;background:#070b12!important;\n  border-bottom:1px solid rgba(221,179,74,.25)!important;\n}\n.classmode-v103 .classmode-header-brand>div,\n.classmode-v103 .classmode-header-meta>:not(.book-icon){display:none!important}\n.classmode-v103 .classmode-header-tabs{\n  justify-self:center!important;display:flex!important;align-items:center!important;gap:5px!important;\n  max-width:calc(100dvw - 150px)!important;padding:4px!important;overflow-x:auto!important;\n  scrollbar-width:none!important;border:1px solid rgba(221,179,74,.28)!important;\n  border-radius:14px!important;background:rgba(11,14,20,.97)!important;\n}\n.classmode-v103 .classmode-header-tabs::-webkit-scrollbar{display:none!important}\n.classmode-v103 .classmode-header-tabs>button{\n  width:56px!important;min-width:56px!important;height:42px!important;min-height:42px!important;\n  padding:0!important;display:grid!important;place-items:center!important;border-radius:10px!important;\n}\n.classmode-v103 .classmode-header-tabs>button span{display:none!important}\n\n.classmode-v103 .classmode-layout{\n  width:100%!important;height:calc(100dvh - 58px)!important;min-width:0!important;min-height:0!important;\n  margin:0!important;padding:0!important;display:block!important;overflow:hidden!important;\n}\n.classmode-v103 .classmode-side-column{display:none!important}\n.classmode-v103 .classmode-board-panel{\n  position:relative!important;width:100%!important;height:100%!important;max-width:none!important;\n  min-width:0!important;min-height:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;\n}\n.classmode-v103 .classmode-board-topbar,\n.classmode-v103 .classmode-resource-card,\n.classmode-v103 .classmode-session-plan,\n.classmode-v103 .classmode-media-navigator{display:none!important}\n.classmode-v103 .classmode-board-frame{\n  flex:1 1 auto!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;\n  margin:0!important;padding:0!important;border-radius:0!important;overflow:hidden!important;\n}\n.classmode-v103 .classmode-board-surface,\n.classmode-v103 .classmode-board-stage{\n  width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;overflow:hidden!important;\n}\n\n/* Existing fullscreen button: arrow only, top-right */\n.classmode-v103 button[title="ملء الشاشة"]:not(.classmode-stage-focus-toggle){display:none!important}\n.classmode-v103 .classmode-stage-focus-toggle{\n  position:absolute!important;top:8px!important;right:8px!important;z-index:650!important;\n  width:42px!important;height:42px!important;min-width:42px!important;min-height:42px!important;\n  padding:0!important;display:grid!important;place-items:center!important;\n  border:1px solid rgba(229,190,92,.72)!important;border-radius:12px!important;\n  background:rgba(7,10,16,.86)!important;color:#efc76e!important;\n}\n.classmode-v103 .classmode-stage-focus-toggle span{display:none!important}\n\n/* Bottom dock: only Save + Students */\n.classmode-v103 .classmode-bottom-actions{\n  position:fixed!important;right:12px!important;bottom:10px!important;left:auto!important;top:auto!important;\n  z-index:8500!important;width:auto!important;min-width:0!important;height:auto!important;min-height:0!important;\n  padding:5px!important;display:flex!important;align-items:center!important;gap:6px!important;\n  border:1px solid rgba(222,181,78,.5)!important;border-radius:15px!important;\n  background:rgba(5,8,14,.9)!important;transform:none!important;\n}\n.classmode-v103 .classmode-bottom-actions>.classmode-exit-btn,\n.classmode-v103 .classmode-bottom-actions>.classmode-end-btn{display:none!important}\n.classmode-v103 .classmode-bottom-actions-mid{\n  display:flex!important;align-items:center!important;gap:6px!important;min-width:0!important;\n}\n.classmode-v103 .classmode-bottom-actions-mid>*{display:none!important}\n.classmode-v103 .classmode-bottom-actions-mid>.classmode-quick-save,\n.classmode-v103 .classmode-bottom-actions-mid>.classmode-quick-students{\n  display:grid!important;place-items:center!important;width:48px!important;height:48px!important;\n  min-width:48px!important;min-height:48px!important;padding:0!important;\n  border:1px solid rgba(225,185,84,.56)!important;border-radius:12px!important;\n  background:#0c1018!important;color:#efc970!important;\n}\n\n/* Student management */\n.classmode-v103 .classmode-student-drawer-backdrop{\n  position:fixed!important;inset:0!important;z-index:9000!important;display:grid!important;\n  place-items:center!important;padding:2dvh 2dvw!important;background:rgba(2,5,10,.76)!important;\n}\n.classmode-v103 .classmode-student-drawer{\n  width:min(1240px,96dvw)!important;height:min(780px,95dvh)!important;max-width:none!important;max-height:none!important;\n  padding:10px!important;display:grid!important;grid-template-rows:auto minmax(0,1fr) auto!important;\n  gap:8px!important;overflow:hidden!important;border:1px solid rgba(222,181,78,.5)!important;\n  border-radius:20px!important;background:linear-gradient(155deg,#0b111a,#060910)!important;\n}\n.classmode-v103 .classmode-student-drawer>header{\n  display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;\n  min-height:50px!important;padding:3px 4px 8px!important;\n}\n.classmode-v103 .classmode-student-drawer-head-actions{\n  display:flex!important;align-items:center!important;gap:7px!important;\n}\n.classmode-v103 .classmode-random-student-btn{\n  height:40px!important;padding:0 12px!important;display:inline-flex!important;align-items:center!important;gap:7px!important;\n  border:1px solid rgba(227,187,86,.56)!important;border-radius:11px!important;\n  background:rgba(212,164,40,.12)!important;color:#efc86f!important;font-weight:800!important;\n}\n/* 10 => 5+5, 12 => 6+6, 14 => 7+7 */\n.classmode-v103 .classmode-student-drawer-list{\n  min-width:0!important;min-height:0!important;height:100%!important;padding:1px!important;\n  display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;\n  grid-auto-rows:minmax(0,1fr)!important;gap:6px 9px!important;overflow:hidden!important;\n}\n.classmode-v103 .classmode-student-drawer-row{\n  min-width:0!important;min-height:0!important;height:100%!important;padding:5px 8px!important;overflow:hidden!important;\n}\n\n.classmode-v103 .classmode-resource-preview,\n.classmode-v103 .classmode-map-embed,\n.classmode-v103 .resource-preview-body{\n  width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;\n  max-width:100%!important;max-height:100%!important;\n}\n'
CSS.write_text(CSS_TEXT, encoding="utf-8")

# Remove stale experimental CSS imports and add only this one.
lines = []
for line in main.splitlines():
    if "styles/user-classmode-" in line:
        continue
    lines.append(line)
main = "\n".join(lines) + "\n"
css_import = "import './styles/user-classmode-fixed.css';"
if css_import not in main:
    current = main.splitlines()
    imports = [i for i, line in enumerate(current) if line.startswith("import ")]
    insert_at = max(imports) + 1 if imports else 0
    current.insert(insert_at, css_import)
    main = "\n".join(current) + "\n"
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

print("CLASSMODE_FIXED_OK")
print("BUILD_OK")
