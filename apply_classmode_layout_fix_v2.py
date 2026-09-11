from pathlib import Path
from datetime import datetime
import shutil

ROOT = Path("/workspaces/mobdea-r20-test")
CLASSMODE = ROOT / "src/pages/ClassMode.jsx"
MAIN = ROOT / "src/main.jsx"
CSS = ROOT / "src/styles/user-classmode-20260911.css"

if not CLASSMODE.exists():
    raise SystemExit("ERROR: ClassMode.jsx not found")

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = ROOT / ".mobdea-backups" / f"classmode-v2-{stamp}"
backup.mkdir(parents=True, exist_ok=True)

for p in (CLASSMODE, MAIN, CSS):
    if p.exists():
        shutil.copy2(p, backup / p.name)

print("BACKUP:", backup)

src = CLASSMODE.read_text(encoding="utf-8")
MARK = "MOBDEA_CLASSMODE_V2_20260911"

if MARK not in src:
    panel_anchor = '<section className="classmode-board-panel">'
    if panel_anchor not in src:
        raise SystemExit("ERROR: classmode-board-panel anchor not found")

    fullscreen_button = (
        '<section className="classmode-board-panel">\\n'
        '          {/* MOBDEA_CLASSMODE_V2_20260911 */}\\n'
        '          <button type="button" className="classmode-stage-fullscreen" '
        'onClick={toggleFullscreen} title="ملء الشاشة" aria-label="ملء الشاشة">'
        '<ArrowUpRight size={27} /></button>'
    )
    src = src.replace(panel_anchor, fullscreen_button, 1)

    start = src.find('<div className="classmode-bottom-actions"')
    end = src.find("{view === 'students'", start)
    if start < 0 or end < 0:
        raise SystemExit("ERROR: bottom bar/student drawer anchors not found")

    line_start = src.rfind("\\n", 0, start) + 1
    indent = src[line_start:start]

    compact = (
        f'{indent}<div className="classmode-bottom-actions classmode-compact-dock" '
        'role="toolbar" aria-label="أوامر الحصة السريعة">\\n'
        f'{indent}  <button type="button" className="classmode-dock-icon" '
        'onClick={saveLessonState} title="حفظ الحصة" aria-label="حفظ الحصة">'
        '<Save size={25} /></button>\\n'
        f'{indent}  <button type="button" className="classmode-dock-icon" '
        'onClick={() => setView(\\'students\\')} title="إدارة الطلاب" aria-label="إدارة الطلاب">'
        '<Users size={25} /></button>\\n'
        f'{indent}</div>\\n{indent}'
    )
    src = src[:line_start] + compact + src[end:]

    drawer_at = src.find('className="classmode-student-drawer"')
    if drawer_at < 0:
        raise SystemExit("ERROR: classmode-student-drawer not found")

    close_btn = '<button className="icon-action" type="button" onClick={() => setView(\\'board\\')} title="إغلاق"><X size={18} /></button>'
    close_at = src.find(close_btn, drawer_at)
    if close_at < 0:
        raise SystemExit("ERROR: student drawer close button not found")

    replacement = (
        '<div className="classmode-student-drawer-head-actions">\\n'
        '                <button className="classmode-random-student-btn" type="button" '
        'onClick={randomStudent} title="اختيار طالب عشوائي" aria-label="اختيار طالب عشوائي">'
        '<Dices size={19} /><span>اختيار عشوائي</span></button>\\n'
        '                <button className="icon-action" type="button" onClick={() => setView(\\'board\\')} '
        'title="إغلاق" aria-label="إغلاق"><X size={18} /></button>\\n'
        '              </div>'
    )
    src = src[:close_at] + replacement + src[close_at + len(close_btn):]

    list_anchor = '<div className="classmode-student-drawer-list">'
    list_at = src.find(list_anchor, drawer_at)
    if list_at < 0:
        raise SystemExit("ERROR: student drawer list not found")

    list_replacement = '<div className="classmode-student-drawer-list" style={{ \\'--student-rows\\': Math.max(1, Math.ceil(students.length / 2)) }}>'
    src = src[:list_at] + list_replacement + src[list_at + len(list_anchor):]

    CLASSMODE.write_text(src, encoding="utf-8")
    print("PATCHED: src/pages/ClassMode.jsx")
else:
    print("JSX patch already present")

css = '''/* MOBDEA_CLASSMODE_V2_20260911 */

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

.classmode-v103 .classmode-top-header {
  height: 62px !important;
  min-height: 62px !important;
  padding: 5px 10px !important;
  box-sizing: border-box !important;
  display: grid !important;
  grid-template-columns: minmax(70px,1fr) auto minmax(70px,1fr) !important;
  align-items: center !important;
  gap: 8px !important;
  background: #070b12 !important;
  border-bottom: 1px solid rgba(221,179,74,.25) !important;
}

.classmode-v103 .classmode-header-tabs {
  justify-self: center !important;
  display: flex !important;
  align-items: center !important;
  gap: 5px !important;
  max-width: calc(100dvw - 180px) !important;
  padding: 5px !important;
  overflow-x: auto !important;
  scrollbar-width: none !important;
  border: 1px solid rgba(221,179,74,.28) !important;
  border-radius: 15px !important;
  background: rgba(11,14,20,.97) !important;
}

.classmode-v103 .classmode-header-tabs::-webkit-scrollbar {
  display: none !important;
}

.classmode-v103 .classmode-header-tabs > button {
  width: 62px !important;
  min-width: 62px !important;
  height: 45px !important;
  min-height: 45px !important;
  padding: 0 !important;
  display: grid !important;
  place-items: center !important;
  border-radius: 11px !important;
}

.classmode-v103 .classmode-header-tabs > button span {
  display: none !important;
}

.classmode-v103 .classmode-layout {
  width: 100% !important;
  height: calc(100dvh - 62px) !important;
  min-width: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  display: block !important;
  overflow: hidden !important;
}

.classmode-v103 .classmode-layout > aside {
  display: none !important;
}

.classmode-v103 .classmode-board-panel {
  position: relative !important;
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: none !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}

.classmode-v103 .classmode-board-topbar,
.classmode-v103 .classmode-resource-card,
.classmode-v103 .classmode-session-plan,
.classmode-v103 .classmode-media-navigator {
  display: none !important;
}

.classmode-v103 .classmode-stage-focus-toggle,
.classmode-v103 button[title="ملء الشاشة"]:not(.classmode-stage-fullscreen) {
  display: none !important;
}

.classmode-v103 .classmode-board-frame {
  flex: 1 1 auto !important;
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  border-radius: 0 !important;
  overflow: hidden !important;
}

.classmode-v103 .classmode-board-surface,
.classmode-v103 .classmode-board-stage {
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  overflow: hidden !important;
}

.classmode-v103 .classmode-stage-fullscreen {
  position: absolute !important;
  top: 8px !important;
  right: 8px !important;
  z-index: 500 !important;
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
  box-shadow: 0 7px 24px rgba(0,0,0,.34) !important;
}

.classmode-v103 .classmode-bottom-actions.classmode-compact-dock {
  position: fixed !important;
  right: 12px !important;
  bottom: 10px !important;
  left: auto !important;
  top: auto !important;
  z-index: 8500 !important;
  width: auto !important;
  min-width: 0 !important;
  height: auto !important;
  min-height: 0 !important;
  padding: 5px !important;
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 6px !important;
  transform: none !important;
  border: 1px solid rgba(222,181,78,.5) !important;
  border-radius: 15px !important;
  background: rgba(5,8,14,.9) !important;
  box-shadow: 0 10px 30px rgba(0,0,0,.38) !important;
}

.classmode-v103 .classmode-compact-dock .classmode-dock-icon {
  width: 48px !important;
  height: 48px !important;
  min-width: 48px !important;
  min-height: 48px !important;
  padding: 0 !important;
  display: grid !important;
  place-items: center !important;
  border: 1px solid rgba(225,185,84,.56) !important;
  border-radius: 12px !important;
  background: #0c1018 !important;
  color: #efc970 !important;
}

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
  gap: 10px !important;
  min-height: 50px !important;
  padding: 3px 4px 8px !important;
  border-bottom: 1px solid rgba(222,181,78,.18) !important;
}

.classmode-v103 .classmode-student-drawer-head-actions {
  display: flex !important;
  align-items: center !important;
  gap: 7px !important;
}

.classmode-v103 .classmode-random-student-btn {
  height: 40px !important;
  padding: 0 13px !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 7px !important;
  border: 1px solid rgba(227,187,86,.56) !important;
  border-radius: 11px !important;
  background: rgba(212,164,40,.12) !important;
  color: #efc86f !important;
  font-weight: 800 !important;
}

.classmode-v103 .classmode-student-drawer-list {
  min-width: 0 !important;
  min-height: 0 !important;
  height: 100% !important;
  padding: 1px !important;
  display: grid !important;
  grid-template-rows: repeat(var(--student-rows), minmax(0,1fr)) !important;
  grid-auto-flow: column !important;
  grid-auto-columns: minmax(0,1fr) !important;
  gap: 6px 9px !important;
  overflow: hidden !important;
}

.classmode-v103 .classmode-student-drawer-row {
  min-width: 0 !important;
  min-height: 0 !important;
  height: 100% !important;
  padding: 5px 8px !important;
  display: grid !important;
  grid-template-columns: minmax(120px,1fr) auto auto !important;
  align-items: center !important;
  gap: 7px !important;
  overflow: hidden !important;
  border: 1px solid rgba(211,173,74,.22) !important;
  border-radius: 11px !important;
  background: rgba(255,255,255,.024) !important;
}

.classmode-v103 .drawer-attendance-actions,
.classmode-v103 .drawer-point-actions {
  display: flex !important;
  align-items: center !important;
  gap: 3px !important;
}

.classmode-v103 .drawer-attendance-actions button {
  min-width: 37px !important;
  min-height: 29px !important;
  padding: 2px 6px !important;
  font-size: .72rem !important;
  border-radius: 7px !important;
}

.classmode-v103 .drawer-point-actions button {
  width: 30px !important;
  height: 30px !important;
  min-width: 30px !important;
  min-height: 30px !important;
  padding: 0 !important;
}

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

@media (orientation: landscape) and (max-height: 700px) {
  .classmode-v103 .classmode-top-header {
    height: 56px !important;
    min-height: 56px !important;
  }

  .classmode-v103 .classmode-layout {
    height: calc(100dvh - 56px) !important;
  }

  .classmode-v103 .classmode-header-brand > div,
  .classmode-v103 .classmode-header-meta > :not(.book-icon) {
    display: none !important;
  }

  .classmode-v103 .classmode-header-tabs {
    max-width: calc(100dvw - 130px) !important;
  }

  .classmode-v103 .classmode-header-tabs > button {
    width: 54px !important;
    min-width: 54px !important;
    height: 41px !important;
  }

  .classmode-v103 .classmode-student-drawer {
    width: 97dvw !important;
    height: 96dvh !important;
    padding: 7px !important;
    gap: 5px !important;
  }

  .classmode-v103 .classmode-student-drawer-row {
    padding: 3px 6px !important;
  }
}
'''

CSS.write_text(css, encoding="utf-8")
print("WROTE:", CSS.relative_to(ROOT))

main = MAIN.read_text(encoding="utf-8")
css_import = "import './styles/user-classmode-20260911.css';"
if css_import not in main:
    lines = main.splitlines()
    last_import = max(i for i, line in enumerate(lines) if line.startswith("import "))
    lines.insert(last_import + 1, css_import)
    MAIN.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("PATCHED: src/main.jsx")
else:
    print("CSS import already present")

print("CLASSMODE_V2_OK")
