#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
PATCH_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ ! -f "$ROOT/package.json" || ! -d "$ROOT/src" ]]; then
  echo "ERROR: شغّل السكريبت من جذر مشروع mobdea-final" >&2
  exit 1
fi
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.r18-browser-v10-backup-$STAMP"
FILES=(
  "src/components/classmode/MediaRenderer.jsx"
  "src/components/classmode/PanZoomSurface.jsx"
  "src/components/classmode/PdfCanvasPreview.jsx"
  "src/components/maps/LessonMapStudio.jsx"
  "src/components/maps/ProfessionalMap.jsx"
  "src/pages/MapChallenge.jsx"
  "src/pages/ClassMode.jsx"
  "src/styles/v111.css"
  "src/services/handwritingRecognition.js"
  "public/identity/class-board-history-reference.jpg"
  "tests/browser-p0-v10-regression.test.mjs"
)
mkdir -p "$BACKUP"
for rel in "${FILES[@]}"; do
  if [[ -f "$ROOT/$rel" ]]; then
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp "$ROOT/$rel" "$BACKUP/$rel"
  fi
  mkdir -p "$ROOT/$(dirname "$rel")"
  cp "$PATCH_DIR/$rel" "$ROOT/$rel"
done
rm -rf node_modules/.vite 2>/dev/null || true
node --test tests/browser-p0-v10-regression.test.mjs
npm run lint
npm run format:check
npm run verify:static
echo ""
echo "========================================="
echo " BROWSER P0 V10 APPLIED"
echo " Backup: $BACKUP"
echo "========================================="
echo "V10 تشمل إصلاحات V9 + السبورة التاريخية المرجعية + جودة PDF + الخطوط الحقيقية + تنسيق خط اليد."
