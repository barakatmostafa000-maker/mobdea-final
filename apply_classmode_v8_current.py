from pathlib import Path
from datetime import datetime
import shutil
import subprocess

ROOT = Path('/workspaces/mobdea-r20-test')
MAIN = ROOT / 'src/main.jsx'
CSS = ROOT / 'src/styles/r20-classmode-geometry-v7.css'

REMOVE_IMPORTS = [
    "import './styles/r20-fix02-unified-classmode-layout.css';\n",
    "import './services/r20UnifiedClassModeLayout.js';\n",
    "import './styles/r20-fix03-student-management.css';\n",
    "import './services/r20StudentManagement.js';\n",
]

OLD_BUTTON_SELECTOR = (
    '.classmode-viewport.classmode-v103.classmode-final-layout\n'
    '.project12-classmode-dock.classmode-user-bottom-dock\n'
    '> button[data-r20-control="students"],\n'
    '.classmode-viewport.classmode-v103.classmode-final-layout\n'
    '.project12-classmode-dock.classmode-user-bottom-dock\n'
    '> button[data-r20-control="save"]{\n'
)

NEW_BUTTON_SELECTOR = (
    '.classmode-viewport.classmode-v103.classmode-final-layout\n'
    '.project12-classmode-dock.classmode-user-bottom-dock\n'
    '> button{\n'
)

PDF_ANCHOR = '/* PDF/media must own the full board stage in normal mode too. */\n'

TOPBAR_BLOCK = (
    '/* The old board topbar contained its own save/fullscreen controls.\n'
    '   It is retired in the rebuilt ClassMode. */\n'
    '.classmode-viewport.classmode-v103.classmode-final-layout .classmode-board-topbar{\n'
    '  display:none!important;\n'
    '}\n\n'
)

def fail(message):
    print('ERROR:', message)
    print('NOTHING_CHANGED')
    raise SystemExit(1)

def apply_in_memory(main_text, css_text):
    for line in REMOVE_IMPORTS:
        count = main_text.count(line)
        if count not in (0, 1):
            raise ValueError(f'unexpected import count {count}: {line.strip()}')
        main_text = main_text.replace(line, '')

    if OLD_BUTTON_SELECTOR in css_text:
        if css_text.count(OLD_BUTTON_SELECTOR) != 1:
            raise ValueError('bottom dock selector is duplicated')
        css_text = css_text.replace(OLD_BUTTON_SELECTOR, NEW_BUTTON_SELECTOR, 1)
    elif NEW_BUTTON_SELECTOR not in css_text:
        raise ValueError('bottom dock selector not found')

    if TOPBAR_BLOCK not in css_text:
        if css_text.count(PDF_ANCHOR) != 1:
            raise ValueError('PDF anchor not found exactly once')
        css_text = css_text.replace(PDF_ANCHOR, TOPBAR_BLOCK + PDF_ANCHOR, 1)

    for line in REMOVE_IMPORTS:
        if line in main_text:
            raise ValueError('legacy runtime import still present')
    if NEW_BUTTON_SELECTOR not in css_text:
        raise ValueError('direct bottom-dock selector missing')
    if TOPBAR_BLOCK not in css_text:
        raise ValueError('legacy board topbar guard missing')

    return main_text, css_text

def main():
    if not MAIN.exists() or not CSS.exists():
        fail('current R20 files not found')

    vite = ROOT / 'node_modules/.bin/vite'
    if not vite.exists():
        fail('vite binary not found')

    original_main = MAIN.read_text(encoding='utf-8')
    original_css = CSS.read_text(encoding='utf-8')

    try:
        patched_main, patched_css = apply_in_memory(original_main, original_css)
    except Exception as exc:
        fail(str(exc))

    if patched_main == original_main and patched_css == original_css:
        print('ALREADY_APPLIED')
        return 0

    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    backup = ROOT / '.mobdea-backups' / f'classmode-v8-{stamp}'
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(MAIN, backup / 'main.jsx')
    shutil.copy2(CSS, backup / 'r20-classmode-geometry-v7.css')
    print('BACKUP:', backup)

    try:
        MAIN.write_text(patched_main, encoding='utf-8')
        CSS.write_text(patched_css, encoding='utf-8')

        diff = subprocess.run(
            ['git', 'diff', '--check', '--', 'src/main.jsx', 'src/styles/r20-classmode-geometry-v7.css'],
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        if diff.returncode != 0:
            raise RuntimeError('git diff --check failed:\n' + diff.stdout)

        build = subprocess.run(
            [str(vite), 'build'],
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        print(build.stdout[-7000:])
        if build.returncode != 0:
            raise RuntimeError('VITE_BUILD_FAILED')

    except Exception as exc:
        shutil.copy2(backup / 'main.jsx', MAIN)
        shutil.copy2(backup / 'r20-classmode-geometry-v7.css', CSS)
        print('FAILED:', exc)
        print('ROLLBACK_OK')
        return 1

    print('V8_RUNTIME_CONFLICT_REMOVED_OK')
    print('VITE_BUILD_OK')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
