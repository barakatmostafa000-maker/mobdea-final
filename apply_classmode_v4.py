from pathlib import Path
from datetime import datetime
import re
import shutil
import subprocess
import sys

ROOT = Path('/workspaces/mobdea-r20-test')
CLASSMODE = ROOT / 'src/pages/ClassMode.jsx'
MAIN = ROOT / 'src/main.jsx'
CSS = ROOT / 'src/styles/user-classmode-20260911.css'


def fail(msg):
    print(f'ERROR: {msg}')
    sys.exit(1)


if not CLASSMODE.exists() or not MAIN.exists():
    fail('R20 test project not found')

src = CLASSMODE.read_text(encoding='utf-8')
main = MAIN.read_text(encoding='utf-8')

stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
backup = ROOT / '.mobdea-backups' / f'classmode-v4-{stamp}'
backup.mkdir(parents=True, exist_ok=True)
for p in (CLASSMODE, MAIN, CSS):
    if p.exists():
        shutil.copy2(p, backup / p.name)
print('BACKUP:', backup)

MARK = 'MOBDEA_CLASSMODE_V4_20260911'

panel_rx = re.compile(r'<section\s+className\s*=\s*["\']classmode-board-panel["\']\s*>', re.S)
bottom_rx = re.compile(r'<div\s+className\s*=\s*["\']classmode-bottom-actions["\'](?:\s+[^>]*)?>', re.S)
students_cond_rx = re.compile(r'\{\s*view\s*===\s*["\']students["\']', re.S)
drawer_rx = re.compile(r'<aside\s+[^>]*className\s*=\s*["\']classmode-student-drawer["\'][^>]*>', re.S)
drawer_header_rx = re.compile(r'<header\b[^>]*>.*?</header>', re.S)
drawer_list_rx = re.compile(r'<div\s+className\s*=\s*["\']classmode-student-drawer-list["\']\s*>', re.S)

panel_match = panel_rx.search(src)
bottom_match = bottom_rx.search(src)
if not panel_match:
    fail('classmode-board-panel not found')
if not bottom_match:
    fail('classmode-bottom-actions not found')

students_cond = students_cond_rx.search(src, bottom_match.end())
if not students_cond:
    fail('students drawer condition not found after bottom actions')

drawer_match = drawer_rx.search(src, students_cond.start())
if not drawer_match:
    fail('classmode-student-drawer not found')
header_match = drawer_header_rx.search(src, drawer_match.end())
if not header_match:
    fail('student drawer header not found')
list_match = drawer_list_rx.search(src, header_match.end())
if not list_match:
    fail('student drawer list not found')

print('ANCHORS_OK')

if MARK not in src:
    panel_new = '''<section className="classmode-board-panel">
          {/* MOBDEA_CLASSMODE_V4_20260911 */}
          <button
            type="button"
            className="classmode-stage-fullscreen"
            onClick={toggleFullscreen}
            title="ملء الشاشة"
            aria-label="ملء الشاشة"
          ><ArrowUpRight size={27} /></button>'''
    src = src[:panel_match.start()] + panel_new + src[panel_match.end():]

    bottom_match = bottom_rx.search(src)
    students_cond = students_cond_rx.search(src, bottom_match.end())
    if not bottom_match or not students_cond:
        fail('bottom toolbar could not be re-located')

    compact = '''<div className="classmode-bottom-actions classmode-compact-dock" role="toolbar" aria-label="أوامر الحصة السريعة">
        <button type="button" className="classmode-dock-icon" onClick={saveLessonState} title="حفظ الحصة" aria-label="حفظ الحصة"><Save size={25} /></button>
        <button type="button" className="classmode-dock-icon" onClick={() => setView('students')} title="إدارة الطلاب" aria-label="إدارة الطلاب"><Users size={25} /></button>
      </div>
      '''
    src = src[:bottom_match.start()] + compact + src[students_cond.start():]

    students_cond = students_cond_rx.search(src)
    drawer_match = drawer_rx.search(src, students_cond.start())
    header_match = drawer_header_rx.search(src, drawer_match.end())
    if not drawer_match or not header_match:
        fail('student drawer could not be re-located')

    new_header = '''<header>
              <div><span className="eyebrow">طلاب الحصة ({students.length})</span><h3>الحضور والنقاط الفورية</h3></div>
              <div className="classmode-student-drawer-head-actions">
                <button className="classmode-random-student-btn" type="button" onClick={randomStudent} title="اختيار طالب عشوائي" aria-label="اختيار طالب عشوائي"><Dices size={19} /><span>اختيار عشوائي</span></button>
                <button className="icon-action" type="button" onClick={() => setView('board')} title="إغلاق" aria-label="إغلاق"><X size={18} /></button>
              </div>
            </header>'''
    src = src[:header_match.start()] + new_header + src[header_match.end():]

    drawer_match = drawer_rx.search(src, students_cond.start())
    list_match = drawer_list_rx.search(src, drawer_match.end())
    if not list_match:
        fail('student list could not be re-located')
    list_new = '<div className="classmode-student-drawer-list" style={{ \'--student-rows\': Math.max(1, Math.ceil(students.length / 2)) }}>'
    src = src[:list_match.start()] + list_new + src[list_match.end():]

for token in (MARK, 'classmode-stage-fullscreen', 'classmode-compact-dock', 'classmode-random-student-btn', '--student-rows'):
    if token not in src:
        fail(f'post-patch verification failed: {token}')

css = '''/* MOBDEA_CLASSMODE_V4_20260911 */
.classmode-scene.classmode-v103.classmode-final-layout{position:fixed!important;inset:0!important;z-index:8000!important;width:100dvw!important;height:100dvh!important;min-width:0!important;min-height:0!important;max-width:none!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#070b12!important}
.classmode-v103 .classmode-top-header{height:58px!important;min-height:58px!important;padding:4px 9px!important;display:grid!important;grid-template-columns:minmax(60px,1fr) auto minmax(60px,1fr)!important;align-items:center!important;gap:7px!important;background:#070b12!important;border-bottom:1px solid rgba(221,179,74,.25)!important}
.classmode-v103 .classmode-header-tabs{justify-self:center!important;display:flex!important;align-items:center!important;gap:5px!important;max-width:calc(100dvw - 150px)!important;padding:4px!important;overflow-x:auto!important;scrollbar-width:none!important;border:1px solid rgba(221,179,74,.28)!important;border-radius:14px!important;background:rgba(11,14,20,.97)!important}
.classmode-v103 .classmode-header-tabs::-webkit-scrollbar{display:none!important}
.classmode-v103 .classmode-header-tabs>button{width:56px!important;min-width:56px!important;height:42px!important;min-height:42px!important;padding:0!important;display:grid!important;place-items:center!important;border-radius:10px!important}
.classmode-v103 .classmode-header-tabs>button span{display:none!important}
.classmode-v103 .classmode-header-brand>div,.classmode-v103 .classmode-header-meta>:not(.book-icon){display:none!important}
.classmode-v103 .classmode-layout{width:100%!important;height:calc(100dvh - 58px)!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;display:block!important;overflow:hidden!important}
.classmode-v103 .classmode-layout>aside{display:none!important}
.classmode-v103 .classmode-board-panel{position:relative!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:none!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}
.classmode-v103 .classmode-board-topbar,.classmode-v103 .classmode-resource-card,.classmode-v103 .classmode-session-plan,.classmode-v103 .classmode-media-navigator{display:none!important}
.classmode-v103 .classmode-stage-focus-toggle,.classmode-v103 button[title="ملء الشاشة"]:not(.classmode-stage-fullscreen){display:none!important}
.classmode-v103 .classmode-board-frame{flex:1 1 auto!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;border-radius:0!important;overflow:hidden!important}
.classmode-v103 .classmode-board-surface,.classmode-v103 .classmode-board-stage{width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;overflow:hidden!important}
.classmode-v103 .classmode-stage-fullscreen{position:absolute!important;top:8px!important;right:8px!important;z-index:500!important;width:42px!important;height:42px!important;min-width:42px!important;min-height:42px!important;padding:0!important;display:grid!important;place-items:center!important;border:1px solid rgba(229,190,92,.72)!important;border-radius:12px!important;background:rgba(7,10,16,.86)!important;color:#efc76e!important}
.classmode-v103 .classmode-bottom-actions.classmode-compact-dock{position:fixed!important;right:12px!important;bottom:10px!important;left:auto!important;top:auto!important;z-index:8500!important;width:auto!important;min-width:0!important;height:auto!important;min-height:0!important;padding:5px!important;display:flex!important;flex-direction:row!important;align-items:center!important;gap:6px!important;transform:none!important;border:1px solid rgba(222,181,78,.5)!important;border-radius:15px!important;background:rgba(5,8,14,.9)!important}
.classmode-v103 .classmode-compact-dock .classmode-dock-icon{width:48px!important;height:48px!important;min-width:48px!important;min-height:48px!important;padding:0!important;display:grid!important;place-items:center!important;border:1px solid rgba(225,185,84,.56)!important;border-radius:12px!important;background:#0c1018!important;color:#efc970!important}
.classmode-v103 .classmode-student-drawer-backdrop{position:fixed!important;inset:0!important;z-index:9000!important;display:grid!important;place-items:center!important;padding:2dvh 2dvw!important;background:rgba(2,5,10,.76)!important}
.classmode-v103 .classmode-student-drawer{width:min(1240px,96dvw)!important;height:min(780px,95dvh)!important;max-width:none!important;max-height:none!important;padding:10px!important;display:grid!important;grid-template-rows:auto minmax(0,1fr) auto!important;gap:8px!important;overflow:hidden!important;border:1px solid rgba(222,181,78,.5)!important;border-radius:20px!important;background:linear-gradient(155deg,#0b111a,#060910)!important}
.classmode-v103 .classmode-student-drawer>header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;min-height:50px!important;padding:3px 4px 8px!important;border-bottom:1px solid rgba(222,181,78,.18)!important}
.classmode-v103 .classmode-student-drawer-head-actions{display:flex!important;align-items:center!important;gap:7px!important}
.classmode-v103 .classmode-random-student-btn{height:40px!important;padding:0 13px!important;display:inline-flex!important;align-items:center!important;gap:7px!important;border:1px solid rgba(227,187,86,.56)!important;border-radius:11px!important;background:rgba(212,164,40,.12)!important;color:#efc86f!important;font-weight:800!important}
.classmode-v103 .classmode-student-drawer-list{min-width:0!important;min-height:0!important;height:100%!important;padding:1px!important;display:grid!important;grid-template-rows:repeat(var(--student-rows),minmax(0,1fr))!important;grid-auto-flow:column!important;grid-auto-columns:minmax(0,1fr)!important;gap:6px 9px!important;overflow:hidden!important}
.classmode-v103 .classmode-student-drawer-row{min-width:0!important;min-height:0!important;height:100%!important;padding:5px 8px!important;display:grid!important;grid-template-columns:minmax(120px,1fr) auto auto!important;align-items:center!important;gap:7px!important;overflow:hidden!important;border:1px solid rgba(211,173,74,.22)!important;border-radius:11px!important;background:rgba(255,255,255,.024)!important}
.classmode-v103 .drawer-attendance-actions,.classmode-v103 .drawer-point-actions{display:flex!important;align-items:center!important;gap:3px!important}
.classmode-v103 .drawer-attendance-actions button{min-width:37px!important;min-height:29px!important;padding:2px 6px!important;font-size:.72rem!important;border-radius:7px!important}
.classmode-v103 .drawer-point-actions button{width:30px!important;height:30px!important;min-width:30px!important;min-height:30px!important;padding:0!important}
.classmode-v103 .classmode-resource-preview,.classmode-v103 .classmode-map-embed,.classmode-v103 .resource-preview-body{width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:100%!important;max-height:100%!important}
'''

CLASSMODE.write_text(src, encoding='utf-8')
CSS.write_text(css, encoding='utf-8')

css_import = "import './styles/user-classmode-20260911.css';"
if css_import not in main:
    lines = main.splitlines()
    imports = [i for i, line in enumerate(lines) if line.startswith('import ')]
    insert_at = (max(imports) + 1) if imports else 0
    lines.insert(insert_at, css_import)
    main = '\n'.join(lines) + '\n'
MAIN.write_text(main, encoding='utf-8')

print('PATCH_WRITTEN')
print('RUNNING_BUILD')
build = subprocess.run(['npm', 'run', 'build'], cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
print(build.stdout[-7000:])

if build.returncode != 0:
    print('BUILD_FAILED')
    print('RESTORING_BACKUP')
    shutil.copy2(backup / CLASSMODE.name, CLASSMODE)
    shutil.copy2(backup / MAIN.name, MAIN)
    if (backup / CSS.name).exists():
        shutil.copy2(backup / CSS.name, CSS)
    elif CSS.exists():
        CSS.unlink()
    print('ROLLBACK_OK')
    sys.exit(build.returncode)

print('CLASSMODE_V4_OK')
print('BUILD_OK')
