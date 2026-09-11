from pathlib import Path
from datetime import datetime
import re
import shutil

ROOT = Path("/workspaces/mobdea-r20-test")
CLASSMODE = ROOT / "src/pages/ClassMode.jsx"
MAIN = ROOT / "src/main.jsx"
CSS = ROOT / "src/styles/user-classmode-20260911.css"

if not CLASSMODE.exists() or not MAIN.exists():
    raise SystemExit("ERROR: run this against /workspaces/mobdea-r20-test")

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = ROOT / ".mobdea-backups" / f"classmode-{stamp}"
backup.mkdir(parents=True, exist_ok=True)
for p in (CLASSMODE, MAIN):
    shutil.copy2(p, backup / p.name)
if CSS.exists():
    shutil.copy2(CSS, backup / CSS.name)
print("BACKUP:", backup)

src = CLASSMODE.read_text(encoding="utf-8")
marker = "MOBDEA_USER_CLASSMODE_PHASE2_20260911"

if marker not in src:
    src = re.sub(r"^\s*Maximize2,\s*\n", "", src, flags=re.M)
    src = re.sub(
        r'\s*<button\s+className="icon-action"\s+onClick=\{toggleFullscreen\}\s+type="button">\s*<Maximize2(?:\s+size=\{\d+\})?\s*/>\s*</button>',
        "",
        src,
        count=1,
    )

    stage = '<div className="classmode-board-stage">'
    if stage not in src:
        raise SystemExit("ERROR: classmode-board-stage anchor not found")
    stage_patch = '''
                {/* MOBDEA_USER_CLASSMODE_PHASE2_20260911 */}
                <button
                  type="button"
                  className="classmode-stage-fullscreen"
                  onClick={toggleFullscreen}
                  title="ملء الشاشة"
                  aria-label="ملء الشاشة"
                >
                  <ArrowUpRight size={27} />
                </button>'''
    src = src.replace(stage, stage + stage_patch, 1)

    start = src.find('      <div className="classmode-bottom-actions"')
    end = src.find("      {view === 'students'", start)
    if start < 0 or end < 0:
        raise SystemExit("ERROR: bottom action bar anchors not found")
    compact = '''      <div className="classmode-bottom-actions classmode-compact-dock" role="toolbar" aria-label="أوامر الحصة السريعة">
        <button
          type="button"
          className="classmode-dock-icon classmode-dock-save"
          onClick={saveLessonState}
          title="حفظ الحصة"
          aria-label="حفظ الحصة"
        ><Save size={25} /></button>
        <button
          type="button"
          className="classmode-dock-icon classmode-dock-students"
          onClick={() => setView('students')}
          title="إدارة الطلاب"
          aria-label="إدارة الطلاب"
        ><Users size={25} /></button>
      </div>
'''
    src = src[:start] + compact + src[end:]

    old_header = '''            <header>
              <div><span className="eyebrow">طلاب الحصة ({students.length})</span><h3>الحضور والنقاط الفورية</h3></div>
              <button className="icon-action" type="button" onClick={() => setView('board')} title="إغلاق"><X size={18} /></button>
            </header>'''
    new_header = '''            <header>
              <div><span className="eyebrow">طلاب الحصة ({students.length})</span><h3>الحضور والنقاط الفورية</h3></div>
              <div className="classmode-student-drawer-head-actions">
                <button className="classmode-random-student-btn" type="button" onClick={randomStudent} title="اختيار طالب عشوائي" aria-label="اختيار طالب عشوائي">
                  <Dices size={19} /><span>اختيار عشوائي</span>
                </button>
                <button className="icon-action" type="button" onClick={() => setView('board')} title="إغلاق" aria-label="إغلاق"><X size={18} /></button>
              </div>
            </header>'''
    if old_header not in src:
        raise SystemExit("ERROR: student drawer header anchor not found")
    src = src.replace(old_header, new_header, 1)

    old_list = '<div className="classmode-student-drawer-list">'
    new_list = '<div className="classmode-student-drawer-list" style={{ \'--student-rows\': Math.max(1, Math.ceil(students.length / 2)) }}>'
    if old_list not in src:
        raise SystemExit("ERROR: student drawer list anchor not found")
    src = src.replace(old_list, new_list, 1)

    CLASSMODE.write_text(src, encoding="utf-8")
    print("PATCHED: src/pages/ClassMode.jsx")
else:
    print("ClassMode JSX patch already present")

css = r'''/* MOBDEA_USER_CLASSMODE_PHASE2_20260911 */

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
  background:
    radial-gradient(circle at 50% 12%, rgba(205, 158, 54, .07), transparent 31%),
    #070b12 !important;
}

.classmode-v103 .classmode-top-header {
  height: 72px !important;
  min-height: 72px !important;
  padding: 7px 16px !important;
  box-sizing: border-box !important;
  display: grid !important;
  grid-template-columns: minmax(150px, 1fr) auto minmax(150px, 1fr) !important;
  align-items: center !important;
  gap: 12px !important;
  background: rgba(7, 10, 16, .97) !important;
  border-bottom: 1px solid rgba(215, 173, 72, .28) !important;
  overflow: visible !important;
}

.classmode-v103 .classmode-header-tabs {
  justify-self: center !important;
  display: flex !important;
  align-items: stretch !important;
  gap: 5px !important;
  width: auto !important;
  max-width: calc(100dvw - 330px) !important;
  padding: 5px !important;
  border: 1px solid rgba(215, 173, 72, .24) !important;
  border-radius: 17px !important;
  background: rgba(12, 15, 21, .96) !important;
  overflow-x: auto !important;
  scrollbar-width: none !important;
}

.classmode-v103 .classmode-header-tabs::-webkit-scrollbar {
  display: none !important;
}

.classmode-v103 .classmode-header-tabs > button {
  min-width: 70px !important;
  height: 49px !important;
  padding: 6px 12px !important;
  border-radius: 12px !important;
}

.classmode-v103 .classmode-header-tabs > button span {
  display: none !important;
}

.classmode-v103 .classmode-layout {
  width: 100% !important;
  height: calc(100dvh - 72px) !important;
  min-width: 0 !important;
  min-height: 0 !important;
  max-height: none !important;
  margin: 0 !important;
  padding: 0 !important;
  display: block !important;
  overflow: hidden !important;
}

.classmode-v103 .classmode-layout > aside {
  display: none !important;
}

.classmode-v103 .classmode-board-panel {
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: none !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}

.classmode-v103 .classmode-board-frame {
  flex: 1 1 auto !important;
  width: 100% !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  border-radius: 0 !important;
  overflow: hidden !important;
}

.classmode-v103 .classmode-board-surface {
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  border-radius: 0 !important;
  overflow: hidden !important;
}

.classmode-v103 .classmode-board-stage {
  position: relative !important;
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  overflow: hidden !important;
}

.classmode-v103 .classmode-stage-fullscreen {
  position: absolute !important;
  top: 10px !important;
  right: 10px !important;
  z-index: 250 !important;
  width: 43px !important;
  height: 43px !important;
  min-width: 43px !important;
  min-height: 43px !important;
  padding: 0 !important;
  display: grid !important;
  place-items: center !important;
  border: 1px solid rgba(225, 185, 88, .72) !important;
  border-radius: 12px !important;
  background: rgba(7, 10, 16, .82) !important;
  color: #edc56d !important;
  box-shadow: 0 7px 24px rgba(0, 0, 0, .32) !important;
  backdrop-filter: blur(8px) !important;
}

.classmode-v103 .classmode-bottom-actions.classmode-compact-dock {
  position: fixed !important;
  right: 14px !important;
  bottom: 12px !important;
  left: auto !important;
  top: auto !important;
  z-index: 8400 !important;
  width: auto !important;
  height: auto !important;
  min-height: 0 !important;
  padding: 6px !important;
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 7px !important;
  border: 1px solid rgba(218, 177, 75, .48) !important;
  border-radius: 17px !important;
  background: rgba(6, 9, 15, .88) !important;
  box-shadow: 0 10px 32px rgba(0, 0, 0, .36) !important;
  backdrop-filter: blur(12px) !important;
  transform: none !important;
}

.classmode-v103 .classmode-compact-dock .classmode-dock-icon {
  width: 50px !important;
  height: 50px !important;
  min-width: 50px !important;
  min-height: 50px !important;
  padding: 0 !important;
  display: grid !important;
  place-items: center !important;
  border: 1px solid rgba(221, 182, 84, .55) !important;
  border-radius: 13px !important;
  background: #0c1018 !important;
  color: #efc96f !important;
}

.classmode-v103 .classmode-student-drawer-backdrop {
  position: fixed !important;
  inset: 0 !important;
  z-index: 9000 !important;
  padding: 3dvh 3dvw !important;
  display: grid !important;
  place-items: center !important;
  background: rgba(3, 6, 11, .72) !important;
  backdrop-filter: blur(7px) !important;
}

.classmode-v103 .classmode-student-drawer {
  width: min(1180px, 94dvw) !important;
  height: min(760px, 92dvh) !important;
  max-width: none !important;
  max-height: none !important;
  padding: 12px !important;
  display: grid !important;
  grid-template-rows: auto minmax(0, 1fr) auto !important;
  gap: 10px !important;
  border: 1px solid rgba(222, 181, 75, .52) !important;
  border-radius: 22px !important;
  background: linear-gradient(160deg, rgba(10, 15, 23, .99), rgba(5, 8, 13, .99)) !important;
  color: #f4e5b8 !important;
  box-shadow: 0 26px 70px rgba(0, 0, 0, .58) !important;
  overflow: hidden !important;
}

.classmode-v103 .classmode-student-drawer > header {
  min-height: 58px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 12px !important;
  padding: 4px 5px 9px !important;
  border-bottom: 1px solid rgba(221, 180, 74, .19) !important;
}

.classmode-v103 .classmode-student-drawer-head-actions {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

.classmode-v103 .classmode-random-student-btn {
  height: 42px !important;
  padding: 0 15px !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
  border: 1px solid rgba(228, 188, 83, .58) !important;
  border-radius: 12px !important;
  background: rgba(216, 168, 43, .12) !important;
  color: #efc96f !important;
  font-weight: 800 !important;
}

.classmode-v103 .classmode-student-drawer-list {
  min-height: 0 !important;
  height: 100% !important;
  padding: 2px !important;
  display: grid !important;
  grid-template-rows: repeat(var(--student-rows), minmax(0, 1fr)) !important;
  grid-auto-flow: column !important;
  grid-auto-columns: minmax(0, 1fr) !important;
  gap: 7px 10px !important;
  overflow: hidden !important;
}

.classmode-v103 .classmode-student-drawer-row {
  min-width: 0 !important;
  min-height: 0 !important;
  height: 100% !important;
  padding: 6px 9px !important;
  display: grid !important;
  grid-template-columns: minmax(130px, 1fr) auto auto !important;
  align-items: center !important;
  gap: 8px !important;
  border: 1px solid rgba(211, 174, 78, .23) !important;
  border-radius: 12px !important;
  background: rgba(255, 255, 255, .025) !important;
  overflow: hidden !important;
}

.classmode-v103 .classmode-student-drawer-row strong {
  display: block !important;
  max-width: 100% !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
  font-size: clamp(.8rem, 1.25vw, 1rem) !important;
}

.classmode-v103 .drawer-attendance-actions,
.classmode-v103 .drawer-point-actions {
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
}

.classmode-v103 .drawer-attendance-actions button {
  min-width: 42px !important;
  min-height: 32px !important;
  padding: 3px 7px !important;
  border-radius: 8px !important;
  font-size: .78rem !important;
}

.classmode-v103 .drawer-point-actions button {
  width: 33px !important;
  height: 33px !important;
  min-width: 33px !important;
  min-height: 33px !important;
  padding: 0 !important;
}

.classmode-v103 .classmode-student-drawer > footer {
  min-height: 46px !important;
  padding-top: 7px !important;
  display: flex !important;
  justify-content: center !important;
  gap: 8px !important;
  border-top: 1px solid rgba(221, 180, 74, .16) !important;
}

.classmode-v103 .classmode-resource-preview,
.classmode-v103 .classmode-map-embed {
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: 100% !important;
  max-height: 100% !important;
}

@media (orientation: landscape) and (max-height: 760px) {
  .classmode-v103 .classmode-top-header {
    height: 62px !important;
    min-height: 62px !important;
    padding: 5px 9px !important;
  }

  .classmode-v103 .classmode-layout {
    height: calc(100dvh - 62px) !important;
  }

  .classmode-v103 .classmode-header-brand > div,
  .classmode-v103 .classmode-header-meta > :not(.book-icon) {
    display: none !important;
  }

  .classmode-v103 .classmode-header-tabs {
    max-width: calc(100dvw - 145px) !important;
  }

  .classmode-v103 .classmode-header-tabs > button {
    min-width: 58px !important;
    height: 45px !important;
  }

  .classmode-v103 .classmode-student-drawer {
    width: 96dvw !important;
    height: 94dvh !important;
    padding: 8px !important;
    gap: 6px !important;
  }

  .classmode-v103 .classmode-student-drawer-row {
    padding: 4px 7px !important;
  }

  .classmode-v103 .drawer-attendance-actions button {
    min-width: 36px !important;
    min-height: 28px !important;
    font-size: .7rem !important;
  }

  .classmode-v103 .drawer-point-actions button {
    width: 29px !important;
    height: 29px !important;
    min-width: 29px !important;
    min-height: 29px !important;
  }

  .classmode-v103 .classmode-compact-dock .classmode-dock-icon {
    width: 44px !important;
    height: 44px !important;
    min-width: 44px !important;
    min-height: 44px !important;
  }
}
'''

CSS.write_text(css, encoding="utf-8")
print("WROTE:", CSS.relative_to(ROOT))

main = MAIN.read_text(encoding="utf-8")
css_import = "import './styles/user-classmode-20260911.css';"
if css_import not in main:
    lines = main.splitlines()
    insert_at = 0
    for idx, line in enumerate(lines):
        if line.startswith("import "):
            insert_at = idx + 1
    lines.insert(insert_at, css_import)
    MAIN.write_text("\n".join(lines) + ("\n" if main.endswith("\n") else ""), encoding="utf-8")
    print("PATCHED: src/main.jsx")
else:
    print("CSS import already present")

print("CLASSMODE_FIX_OK")
