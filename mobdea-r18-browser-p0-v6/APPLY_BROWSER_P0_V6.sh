#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
PATCH_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ ! -f "$ROOT/package.json" || ! -d "$ROOT/src" ]]; then
  echo "ERROR: شغّل السكريبت من جذر مشروع mobdea-final" >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.r18-browser-v6-backup-$STAMP"
mkdir -p "$BACKUP"

FILES=(
  "src/components/classmode/MediaRenderer.jsx"
  "src/components/classmode/PdfCanvasPreview.jsx"
  "src/components/maps/LessonMapStudio.jsx"
  "src/components/maps/ProfessionalMap.jsx"
  "src/pages/ClassMode.jsx"
  "src/pages/MapChallenge.jsx"
  "src/styles/v111.css"
  "tests/browser-p0-regression.test.mjs"
  "tests/browser-p0-v6-regression.test.mjs"
)

for rel in "${FILES[@]}"; do
  if [[ -f "$ROOT/$rel" ]]; then
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp "$ROOT/$rel" "$BACKUP/$rel"
  fi
  mkdir -p "$ROOT/$(dirname "$rel")"
  cp "$PATCH_DIR/$rel" "$ROOT/$rel"
done

if [[ ! -f "$ROOT/node_modules/pdfjs-dist/legacy/build/pdf.mjs" ]]; then
  echo "[V6] pdfjs-dist غير موجود؛ تثبيته محليًا..."
  npm install --no-save --package-lock=false pdfjs-dist@4.10.38
fi

node --test tests/browser-p0-regression.test.mjs tests/browser-p0-v6-regression.test.mjs tests/geography-maps.test.mjs
npm run lint
npm run format:check
npm run verify:static

echo ""
echo "========================================="
echo " BROWSER P0 V6 APPLIED"
echo " Backup: $BACKUP"
echo "========================================="
echo "أعد تشغيل Vite ثم اعمل Reload كامل للصفحة."
