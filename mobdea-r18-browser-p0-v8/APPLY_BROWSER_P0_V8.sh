#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
PATCH_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ ! -f "$ROOT/package.json" || ! -d "$ROOT/src" ]]; then
  echo "ERROR: شغّل السكريبت من جذر مشروع mobdea-final" >&2
  exit 1
fi
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.r18-browser-v8-backup-$STAMP"
mkdir -p "$BACKUP"
FILES=(
  "src/components/classmode/PanZoomSurface.jsx"
  "src/components/classmode/MediaRenderer.jsx"
  "src/components/classmode/PdfCanvasPreview.jsx"
  "src/components/maps/LessonMapStudio.jsx"
  "src/components/maps/ProfessionalMap.jsx"
  "src/pages/ClassMode.jsx"
  "src/pages/MapChallenge.jsx"
  "src/data/geography.js"
  "src/styles/v111.css"
  "tests/browser-p0-v6-regression.test.mjs"
  "tests/browser-p0-v7-regression.test.mjs"
  "tests/browser-p0-v8-board-regression.test.mjs"
  "tests/geography-maps.test.mjs"
)
for rel in "${FILES[@]}"; do
  if [[ -f "$ROOT/$rel" ]]; then
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp "$ROOT/$rel" "$BACKUP/$rel"
  fi
  mkdir -p "$ROOT/$(dirname "$rel")"
  cp "$PATCH_DIR/$rel" "$ROOT/$rel"
done
rm -rf node_modules/.vite 2>/dev/null || true
node --test tests/browser-p0-regression.test.mjs tests/browser-p0-v6-regression.test.mjs tests/browser-p0-v7-regression.test.mjs tests/browser-p0-v8-board-regression.test.mjs tests/geography-maps.test.mjs
npm run lint
npm run format:check
npm run verify:static
echo ""
echo "========================================="
echo " BROWSER P0 V8 APPLIED"
echo " Backup: $BACKUP"
echo "========================================="
echo "أعد تشغيل Vite واعمل Reload كامل للصفحة ثم جرّب وضع الحصة كله مرة واحدة."
