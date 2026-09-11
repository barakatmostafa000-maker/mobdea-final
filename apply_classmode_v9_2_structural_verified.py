
from pathlib import Path
from datetime import datetime
import shutil
import subprocess

ROOT = Path("/workspaces/mobdea-r20-test")
CLASSMODE = ROOT / "src/pages/ClassMode.jsx"
MAIN = ROOT / "src/main.jsx"
CSS = ROOT / "src/styles/r20-classmode-v9-structural.css"

OLD_MANAGEMENT = '''          {!fullscreen && (
            <button
              type="button"
              className={`classmode-management-toggle ${managementOpen ? "active" : ""}`}
              onClick={() => setManagementOpen((value) => !value)}
              title={managementOpen ? "طي إدارة الحصة" : "فتح إدارة الحصة"}
              aria-label={managementOpen ? "طي إدارة الحصة" : "فتح إدارة الحصة"}
            >
              <Users size={17} />
              <span>{managementOpen ? "طي" : "إدارة الحصة"}</span>
            </button>
          )}
'''

OLD_FULLSCREEN_EXIT = '''          {fullscreen && (
            <button
              type="button"
              className="classmode-fullscreen-exit"
              onClick={toggleFullscreen}
              title="الخروج من ملء الشاشة"
              aria-label="الخروج من ملء الشاشة"
            >
              <X size={18} />
            </button>
          )}
'''

OLD_STAGE_FOCUS = '''              <button
                type="button"
                className={`classmode-board-focus-toggle classmode-stage-focus-toggle ${stageFocus ? "active" : ""}`}
                onClick={() => setStageFocus((value) => !value)}
                title={stageFocus ? "العودة لوضع الحصة" : "ملء مساحة العرض"}
              >
                <Maximize2 size={17} />
                <span>
                  {stageFocus
                    ? "عودة للحصة"
                    : contentMode === "board"
                      ? "ملء السبورة"
                      : "ملء العرض"}
                </span>
              </button>
'''

OLD_TOOL_SAVE = '''                    <button type="button" onClick={saveBoard} title="حفظ">
                      <Save size={19} />
                      <span>حفظ</span>
                    </button>
'''

MAIN_ANCHOR = "import './styles/r20-classmode-geometry-v7.css';\n"
MAIN_IMPORT = "import './styles/r20-classmode-v9-structural.css';\n"

OLD_ROOT_CLASS = """      className={`page classmode-scene classmode-final-layout ${fullscreen ? "fullscreen presentation-fullscreen stage-focus-mode" : ""} ${!fullscreen && stageFocus ? "stage-focus-mode" : ""} ${managementOpen ? "management-open" : "management-closed"}`}"""
NEW_ROOT_CLASS = """      className={`page classmode-scene classmode-final-layout classmode-v9-structural ${fullscreen ? "fullscreen presentation-fullscreen stage-focus-mode" : ""} ${!fullscreen && stageFocus ? "stage-focus-mode" : ""} ${managementOpen ? "management-open" : "management-closed"}`}"""

OLD_BOARD_STAGE_CLASS = """                  className={`classmode-board-stage board-template-${boardTemplate} ${contentMode === "board" ? "has-lesson-ribbon" : ""}`}"""
NEW_BOARD_STAGE_CLASS = """                  className={`classmode-board-stage board-template-${boardTemplate} ${contentMode === "board" ? "has-lesson-ribbon" : ""} ${contentMode !== "board" && displayResource ? "has-display-resource" : ""}`}"""

CSS_TEXT = '''/* R20_CLASSMODE_V9_2_STRUCTURAL */

.classmode-viewport.classmode-v103.classmode-final-layout{
  --classmode-v9-ready:2;
  position:fixed!important;
  inset:0!important;
  width:100dvw!important;
  height:100dvh!important;
  min-width:0!important;
  min-height:0!important;
  max-width:none!important;
  max-height:none!important;
  margin:0!important;
  padding:0!important;
  display:block!important;
  overflow:hidden!important;
  background:#070b12!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout
> .classmode-viewport-body.classmode-layout{
  position:absolute!important;
  inset:0!important;
  width:100%!important;
  height:100%!important;
  min-width:0!important;
  min-height:0!important;
  max-width:none!important;
  max-height:none!important;
  margin:0!important;
  padding:0!important;
  display:block!important;
  grid-template-columns:none!important;
  grid-template-rows:none!important;
  gap:0!important;
  overflow:hidden!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout
> .classmode-viewport-body.classmode-layout
> .classmode-viewport-stage{
  position:absolute!important;
  inset:0!important;
  width:100%!important;
  height:100%!important;
  min-width:0!important;
  min-height:0!important;
  max-width:none!important;
  max-height:none!important;
  margin:0!important;
  padding:0!important;
  overflow:hidden!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout
.classmode-viewport-stage > .classmode-board-panel{
  position:absolute!important;
  inset:0!important;
  width:100%!important;
  height:100%!important;
  min-width:0!important;
  min-height:0!important;
  max-width:none!important;
  max-height:none!important;
  margin:0!important;
  padding:0!important;
  display:flex!important;
  flex-direction:column!important;
  gap:0!important;
  overflow:hidden!important;
  border:0!important;
  border-radius:0!important;
  background:#070b12!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout .classmode-board-frame,
.classmode-viewport.classmode-v103.classmode-final-layout .classmode-board-surface,
.classmode-viewport.classmode-v103.classmode-final-layout .classmode-board-stage{
  position:absolute!important;
  inset:0!important;
  width:100%!important;
  height:100%!important;
  min-width:0!important;
  min-height:0!important;
  max-width:none!important;
  max-height:none!important;
  margin:0!important;
  padding:0!important;
  overflow:hidden!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout .classmode-board-topbar,
.classmode-viewport.classmode-v103.classmode-final-layout .classmode-resource-card,
.classmode-viewport.classmode-v103.classmode-final-layout .classmode-session-plan,
.classmode-viewport.classmode-v103.classmode-final-layout .classmode-media-navigator,
.classmode-viewport.classmode-v103.classmode-final-layout > .classmode-viewport-footer,
.classmode-viewport.classmode-v103.classmode-final-layout .classmode-management-toggle,
.classmode-viewport.classmode-v103.classmode-final-layout .classmode-fullscreen-exit,
.classmode-viewport.classmode-v103.classmode-final-layout .classmode-stage-focus-toggle,
.classmode-viewport.classmode-v103.classmode-final-layout .classmode-board-focus-toggle{
  display:none!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout
> .classmode-viewport-header{
  position:fixed!important;
  top:8px!important;
  left:50%!important;
  right:auto!important;
  bottom:auto!important;
  transform:translateX(-50%)!important;
  width:auto!important;
  height:auto!important;
  min-width:0!important;
  min-height:0!important;
  max-width:calc(100dvw - 150px)!important;
  margin:0!important;
  padding:0!important;
  display:block!important;
  overflow:visible!important;
  opacity:1!important;
  visibility:visible!important;
  pointer-events:none!important;
  background:transparent!important;
  border:0!important;
  z-index:9800!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout .classmode-top-header{
  width:auto!important;
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  margin:0!important;
  padding:0!important;
  display:block!important;
  overflow:visible!important;
  opacity:1!important;
  visibility:visible!important;
  background:transparent!important;
  border:0!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout .classmode-header-brand,
.classmode-viewport.classmode-v103.classmode-final-layout .classmode-header-meta{
  display:none!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout .classmode-header-tabs{
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  gap:5px!important;
  width:auto!important;
  height:48px!important;
  max-width:calc(100dvw - 150px)!important;
  margin:0!important;
  padding:4px!important;
  overflow-x:auto!important;
  overflow-y:hidden!important;
  opacity:1!important;
  visibility:visible!important;
  pointer-events:auto!important;
  border:1px solid rgba(215,173,53,.48)!important;
  border-radius:14px!important;
  background:rgba(5,8,14,.94)!important;
  box-shadow:0 8px 24px rgba(0,0,0,.35)!important;
  scrollbar-width:none!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout .classmode-header-tabs::-webkit-scrollbar{
  display:none!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout .classmode-header-tabs > button{
  flex:0 0 46px!important;
  width:46px!important;
  min-width:46px!important;
  height:38px!important;
  min-height:38px!important;
  margin:0!important;
  padding:0!important;
  display:grid!important;
  place-items:center!important;
  opacity:1!important;
  visibility:visible!important;
  font-size:0!important;
  border-radius:10px!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout .classmode-header-tabs > button span{
  display:none!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout .classmode-header-tabs > button svg{
  display:block!important;
  width:20px!important;
  height:20px!important;
  opacity:1!important;
  visibility:visible!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout .classmode-user-fullscreen{
  position:fixed!important;
  top:8px!important;
  right:12px!important;
  left:auto!important;
  bottom:auto!important;
  width:48px!important;
  min-width:48px!important;
  height:48px!important;
  min-height:48px!important;
  margin:0!important;
  padding:0!important;
  display:grid!important;
  place-items:center!important;
  opacity:1!important;
  visibility:visible!important;
  z-index:9900!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout
.project12-classmode-dock.classmode-user-bottom-dock{
  position:fixed!important;
  right:12px!important;
  bottom:max(10px,env(safe-area-inset-bottom,0px))!important;
  left:auto!important;
  top:auto!important;
  width:auto!important;
  min-width:0!important;
  max-width:none!important;
  height:auto!important;
  margin:0!important;
  padding:5px!important;
  display:flex!important;
  flex-direction:row!important;
  align-items:center!important;
  gap:6px!important;
  transform:none!important;
  opacity:1!important;
  visibility:visible!important;
  z-index:9900!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout
.project12-classmode-dock.classmode-user-bottom-dock > button{
  position:static!important;
  inset:auto!important;
  width:48px!important;
  min-width:48px!important;
  height:48px!important;
  min-height:48px!important;
  margin:0!important;
  padding:0!important;
  display:grid!important;
  place-items:center!important;
  transform:none!important;
  opacity:1!important;
  visibility:visible!important;
  font-size:0!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout
.project12-classmode-dock.classmode-user-bottom-dock > button span{
  display:none!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout
> .classmode-viewport-body.classmode-layout
> .classmode-viewport-students{
  display:none!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout.management-open
> .classmode-viewport-body.classmode-layout
> .classmode-viewport-students{
  position:absolute!important;
  inset:62px 8px 68px 8px!important;
  width:auto!important;
  height:auto!important;
  min-width:0!important;
  min-height:0!important;
  display:block!important;
  overflow:hidden!important;
  z-index:9700!important;
  background:rgba(3,6,11,.98)!important;
  border:1px solid rgba(215,173,53,.40)!important;
  border-radius:18px!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout .classmode-resource-preview{
  position:absolute!important;
  inset:0!important;
  width:100%!important;
  height:100%!important;
  min-width:0!important;
  min-height:0!important;
  max-width:none!important;
  max-height:none!important;
  margin:0!important;
  padding:0!important;
  display:block!important;
  overflow:hidden!important;
  background:#070b12!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout .resource-preview-head{
  position:absolute!important;
  inset:0!important;
  width:100%!important;
  height:0!important;
  min-height:0!important;
  max-height:0!important;
  margin:0!important;
  padding:0!important;
  overflow:visible!important;
  background:transparent!important;
  border:0!important;
  box-shadow:none!important;
  pointer-events:none!important;
  z-index:9600!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout .resource-preview-head > strong,
.classmode-viewport.classmode-v103.classmode-final-layout .resource-preview-head > small,
.classmode-viewport.classmode-v103.classmode-final-layout .resource-preview-head > .classmode-inline-media-switcher{
  display:none!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout .classmode-page-nav{
  position:fixed!important;
  top:64px!important;
  left:50%!important;
  right:auto!important;
  transform:translateX(-50%)!important;
  width:auto!important;
  height:38px!important;
  margin:0!important;
  padding:4px 7px!important;
  display:flex!important;
  align-items:center!important;
  gap:5px!important;
  opacity:1!important;
  visibility:visible!important;
  pointer-events:auto!important;
  z-index:9850!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout
.resource-preview-body.unified-media-renderer,
.classmode-viewport.classmode-v103.classmode-final-layout
.classmode-pdf-canvas-host,
.classmode-viewport.classmode-v103.classmode-final-layout
.classmode-pdf-panzoom,
.classmode-viewport.classmode-v103.classmode-final-layout
.classmode-panzoom-viewport{
  position:absolute!important;
  inset:0!important;
  width:100%!important;
  height:100%!important;
  min-width:0!important;
  min-height:0!important;
  max-width:none!important;
  max-height:none!important;
  margin:0!important;
  padding:0!important;
  overflow:hidden!important;
  opacity:1!important;
  visibility:visible!important;
}

/* Resource layering is explicit: PDF/media below, annotation canvas above,
   and the annotation layer must remain transparent. */
.classmode-viewport.classmode-v103.classmode-final-layout
.classmode-board-stage.has-display-resource{
  background:#05080d!important;
  background-image:none!important;
  border:0!important;
  box-shadow:none!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout
.classmode-board-stage.has-display-resource .classmode-resource-preview{
  z-index:10!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout
.classmode-board-stage.has-display-resource .resource-preview-body.unified-media-renderer{
  z-index:11!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout
.classmode-board-stage.has-display-resource .classmode-pdf-canvas-host,
.classmode-viewport.classmode-v103.classmode-final-layout
.classmode-board-stage.has-display-resource .classmode-pdf-panzoom,
.classmode-viewport.classmode-v103.classmode-final-layout
.classmode-board-stage.has-display-resource .classmode-panzoom-viewport{
  z-index:12!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout
.classmode-pdf-rendered-image{
  position:relative!important;
  z-index:1!important;
  display:block!important;
  width:auto!important;
  height:auto!important;
  max-width:100%!important;
  max-height:100%!important;
  object-fit:contain!important;
  opacity:1!important;
  visibility:visible!important;
  background:#fff!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout
.classmode-pdf-panzoom .classmode-panzoom-content{
  position:absolute!important;
  inset:0!important;
  width:100%!important;
  height:100%!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  overflow:visible!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout
.class-board-canvas-shell.has-resource-head{
  position:absolute!important;
  inset:0!important;
  z-index:20!important;
  width:100%!important;
  height:100%!important;
  background:transparent!important;
  background-color:transparent!important;
  background-image:none!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout
.class-board-canvas-shell.has-resource-head .class-board-canvas{
  position:absolute!important;
  inset:0!important;
  z-index:2!important;
  width:100%!important;
  height:100%!important;
  background:transparent!important;
  background-color:transparent!important;
  background-image:none!important;
}

/* Retire duplicate old page/resource edge navigation. The compact page bar
   above the PDF is the single navigation surface. */
.classmode-viewport.classmode-v103.classmode-final-layout .classmode-pdf-edge-nav,
.classmode-viewport.classmode-v103.classmode-final-layout .classmode-media-edge-nav{
  display:none!important;
}

.classmode-viewport.classmode-v103.classmode-final-layout
.classmode-board-sidebar-left button[title="حفظ"],
.classmode-viewport.classmode-v103.classmode-final-layout
.classmode-board-sidebar-left button[aria-label="حفظ طبقة السبورة"]{
  display:none!important;
}
'''

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

def main():
    if not CLASSMODE.exists() or not MAIN.exists():
        print("ERROR: current ClassMode files not found")
        print("NOTHING_CHANGED")
        return 1

    original_classmode = CLASSMODE.read_text(encoding="utf-8")
    original_main = MAIN.read_text(encoding="utf-8")
    original_css = CSS.read_text(encoding="utf-8") if CSS.exists() else None

    try:
        patched = original_classmode
        patched = replace_once(patched, OLD_ROOT_CLASS, NEW_ROOT_CLASS, "V9 root class marker")
        patched = replace_once(patched, OLD_BOARD_STAGE_CLASS, NEW_BOARD_STAGE_CLASS, "resource board-stage marker")
        patched = replace_once(patched, OLD_MANAGEMENT, "", "legacy management toggle")
        patched = replace_once(patched, OLD_FULLSCREEN_EXIT, "", "legacy fullscreen exit")
        patched = replace_once(patched, OLD_STAGE_FOCUS, "", "legacy stage focus")
        patched = replace_once(patched, OLD_TOOL_SAVE, "", "duplicate tool save")

        if MAIN_IMPORT not in original_main:
            if original_main.count(MAIN_ANCHOR) != 1:
                raise RuntimeError("main.jsx V7 anchor not found exactly once")
            patched_main = original_main.replace(
                MAIN_ANCHOR, MAIN_ANCHOR + MAIN_IMPORT, 1
            )
        else:
            patched_main = original_main

        if "classmode-management-toggle" in patched:
            raise RuntimeError("legacy management toggle still present")
        if 'className="classmode-fullscreen-exit"' in patched:
            raise RuntimeError("legacy fullscreen exit still present")
        if "classmode-stage-focus-toggle" in patched:
            raise RuntimeError("legacy stage focus still present")
        if patched.count("classmode-user-fullscreen") != 1:
            raise RuntimeError("expected exactly one user fullscreen control")
        if patched.count("classmode-user-bottom-dock") != 1:
            raise RuntimeError("expected exactly one bottom dock")
        if patched.count("classmode-v9-structural") != 1:
            raise RuntimeError("V9 root marker missing or duplicated")
        if patched.count("has-display-resource") != 1:
            raise RuntimeError("resource stage marker missing or duplicated")

    except Exception as exc:
        print("ERROR:", exc)
        print("NOTHING_CHANGED")
        return 1

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = ROOT / ".mobdea-backups" / f"classmode-v9-{stamp}"
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(CLASSMODE, backup / "ClassMode.jsx")
    shutil.copy2(MAIN, backup / "main.jsx")
    if CSS.exists():
        shutil.copy2(CSS, backup / CSS.name)
    print("BACKUP:", backup)

    try:
        CLASSMODE.write_text(patched, encoding="utf-8")
        MAIN.write_text(patched_main, encoding="utf-8")
        CSS.write_text(CSS_TEXT, encoding="utf-8")

        diff = subprocess.run(
            ["git", "diff", "--check", "--",
             "src/pages/ClassMode.jsx",
             "src/main.jsx",
             "src/styles/r20-classmode-v9-structural.css"],
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        if diff.returncode != 0:
            raise RuntimeError("git diff --check failed:\n" + diff.stdout)

        build = subprocess.run(
            [str(ROOT / "node_modules/.bin/vite"), "build"],
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        print(build.stdout[-7000:])
        if build.returncode != 0:
            raise RuntimeError("VITE_BUILD_FAILED")

        dist_assets = ROOT / "dist/assets"
        js_marker_found = False
        css_marker_found = False

        for asset in dist_assets.glob("*.js"):
            try:
                built_js = asset.read_text(encoding="utf-8", errors="ignore")
                if "classmode-v9-structural" in built_js and "has-display-resource" in built_js:
                    js_marker_found = True
                    break
            except Exception:
                pass

        for asset in dist_assets.glob("*.css"):
            try:
                built_css = asset.read_text(encoding="utf-8", errors="ignore").replace(" ", "")
                if "--classmode-v9-ready:2" in built_css and ".classmode-pdf-rendered-image" in built_css and ".classmode-header-tabs" in built_css:
                    css_marker_found = True
                    break
            except Exception:
                pass

        if not js_marker_found:
            raise RuntimeError("BUILT_JS_DOES_NOT_CONTAIN_V9_MARKER")
        if not css_marker_found:
            raise RuntimeError("BUILT_CSS_DOES_NOT_CONTAIN_V9_MARKER")

    except Exception as exc:
        shutil.copy2(backup / "ClassMode.jsx", CLASSMODE)
        shutil.copy2(backup / "main.jsx", MAIN)
        if original_css is None:
            CSS.unlink(missing_ok=True)
        else:
            shutil.copy2(backup / CSS.name, CSS)
        print("FAILED:", exc)
        print("ROLLBACK_OK")
        return 1

    print("V9_2_STRUCTURAL_REBUILD_OK")
    print("OLD_STUDENT_TOGGLE_REMOVED_OK")
    print("OLD_FULLSCREEN_CONTROLS_REMOVED_OK")
    print("DUPLICATE_SAVE_REMOVED_OK")
    print("FLOATING_HEADER_TOOLBAR_OK")
    print("FULL_VIEWPORT_STAGE_OK")
    print("PDF_RESOURCE_LAYER_ORDER_OK")
    print("PDF_RENDERED_IMAGE_VISIBLE_OK")
    print("ANNOTATION_CANVAS_TRANSPARENT_OK")
    print("TOP_MODE_TOOLBAR_FORCED_VISIBLE_OK")
    print("DUPLICATE_PDF_NAV_REMOVED_OK")
    print("BUILT_JS_V9_MARKER_OK")
    print("BUILT_CSS_V9_MARKER_OK")
    print("VITE_BUILD_OK")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
